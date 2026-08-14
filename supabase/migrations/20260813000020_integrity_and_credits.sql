-- Migration: integridad de datos y operaciones atómicas
--
-- 1) `rate_limits`: store compartido del rate limiter (login/OCR) para que
--    los contadores sean globales entre instancias serverless. Sin policies:
--    solo service_role la toca.
-- 2) `driver_credits`: créditos por chofer/dueño en DB (antes solo
--    localStorage). Con RLS owner-scoped.
-- 3) Columnas de weekly_rentals faltantes por drift (condoned/prorated).
-- 4) Índices UNIQUE sobre license_number e ine_elector_key (nulls ok).
-- 5) RPCs transaccionales de pago y crédito (security definer, validan
--    auth.uid()): eliminan el read-modify-write del cliente.

-- 1) rate_limits
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key          TEXT PRIMARY KEY,
  failures     JSONB NOT NULL DEFAULT '[]'::jsonb,
  locked_until TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
-- Sin policies: solo service_role (BYPASSRLS) puede leer/escribir.

-- 2) driver_credits
CREATE TABLE IF NOT EXISTS public.driver_credits (
  driver_id  TEXT NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  owner_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (driver_id, owner_id)
);

ALTER TABLE public.driver_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_scope_driver_credits" ON public.driver_credits
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- 3) Columnas de weekly_rentals faltantes (drift)
ALTER TABLE public.weekly_rentals ADD COLUMN IF NOT EXISTS is_prorated   BOOLEAN DEFAULT FALSE;
ALTER TABLE public.weekly_rentals ADD COLUMN IF NOT EXISTS prorated_days  INTEGER;
ALTER TABLE public.weekly_rentals ADD COLUMN IF NOT EXISTS condoned_days  INTEGER DEFAULT 0;
ALTER TABLE public.weekly_rentals ADD COLUMN IF NOT EXISTS condoned_amount NUMERIC(10,2) DEFAULT 0;

-- 4) Unicidad de licencia y clave de elector (nulls y '' permitidos)
CREATE UNIQUE INDEX IF NOT EXISTS uq_drivers_license_number
  ON public.drivers(license_number)
  WHERE license_number IS NOT NULL AND license_number <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_drivers_ine_elector_key
  ON public.drivers(ine_elector_key)
  WHERE ine_elector_key IS NOT NULL AND ine_elector_key <> '';

-- 5) RPCs de operaciones financieras

-- Aplica un pago sobre UN rental concreto (flujo de la UI): incrementa
-- paid_amount de forma atómica y recalcula status considerando condonación.
CREATE OR REPLACE FUNCTION public.apply_rental_payment(
  p_rental_id text,
  p_amount numeric,
  p_payment_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner  uuid := auth.uid();
  v_rental public.weekly_rentals%ROWTYPE;
  v_effective numeric;
  v_status text;
  v_paid numeric;
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  SELECT * INTO v_rental
    FROM public.weekly_rentals
   WHERE id = p_rental_id AND owner_id = v_owner
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'rental not found';
  END IF;

  v_effective := v_rental.rent_amount - COALESCE(v_rental.condoned_amount, 0);
  v_paid := v_rental.paid_amount + p_amount;
  v_status := CASE
    WHEN v_paid >= v_effective THEN 'PAID'
    WHEN v_paid > 0 THEN 'PARTIAL'
    ELSE 'UNPAID'
  END;

  UPDATE public.weekly_rentals
     SET paid_amount  = v_paid,
         status       = v_status,
         payments_log = COALESCE(payments_log, '[]'::jsonb)
                        || jsonb_build_array(jsonb_build_object('amount', p_amount, 'date', p_payment_date::text))
   WHERE id = p_rental_id;

  RETURN jsonb_build_object(
    'rental', jsonb_build_object(
      'id', v_rental.id, 'paid_amount', v_paid, 'status', v_status
    )
  );
END $$;

-- Aplica un pago contra las rentas pendientes de un chofer (de la más
-- antigua a la más reciente); el sobrante se convierte en crédito.
CREATE OR REPLACE FUNCTION public.apply_payment(
  p_driver_id text,
  p_amount numeric,
  p_payment_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner      uuid := auth.uid();
  v_remaining  numeric := p_amount;
  r            record;
  v_applied    jsonb := '[]'::jsonb;
  v_leftover   numeric := 0;
  v_effective  numeric;
  v_status     text;
  v_paid       numeric;
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('applied', v_applied, 'leftover', 0);
  END IF;

  FOR r IN
    SELECT id, week_start, rent_amount, paid_amount, condoned_amount
      FROM public.weekly_rentals
     WHERE driver_id = p_driver_id AND owner_id = v_owner
     ORDER BY week_start ASC
     FOR UPDATE
  LOOP
    IF v_remaining <= 0 THEN
      EXIT;
    END IF;

    v_effective := r.rent_amount - COALESCE(r.condoned_amount, 0);
    IF v_effective - r.paid_amount <= 0 THEN
      CONTINUE;
    END IF;

    v_paid := r.paid_amount + LEAST(v_effective - r.paid_amount, v_remaining);
    v_remaining := v_remaining - (v_paid - r.paid_amount);
    v_status := CASE
      WHEN v_paid >= v_effective THEN 'PAID'
      WHEN v_paid > 0 THEN 'PARTIAL'
      ELSE 'UNPAID'
    END;

    UPDATE public.weekly_rentals
       SET paid_amount  = v_paid,
           status       = v_status,
           payments_log = COALESCE(payments_log, '[]'::jsonb)
                          || jsonb_build_array(jsonb_build_object('amount', v_paid - r.paid_amount, 'date', p_payment_date::text))
     WHERE id = r.id;

    v_applied := v_applied || jsonb_build_object(
      'week_start', r.week_start::text,
      'amount', v_paid - r.paid_amount
    );
  END LOOP;

  v_leftover := v_remaining;
  IF v_leftover > 0 THEN
    INSERT INTO public.driver_credits (driver_id, owner_id, amount, updated_at)
    VALUES (p_driver_id, v_owner, v_leftover, now())
    ON CONFLICT (driver_id, owner_id) DO UPDATE
      SET amount = public.driver_credits.amount + EXCLUDED.amount,
          updated_at = now();
  END IF;

  RETURN jsonb_build_object('applied', v_applied, 'leftover', v_leftover);
END $$;

-- Ajusta el crédito de un chofer (delta positivo o negativo).
CREATE OR REPLACE FUNCTION public.adjust_driver_credit(
  p_driver_id text,
  p_delta numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner  uuid := auth.uid();
  v_amount numeric;
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  INSERT INTO public.driver_credits (driver_id, owner_id, amount, updated_at)
  VALUES (p_driver_id, v_owner, p_delta, now())
  ON CONFLICT (driver_id, owner_id) DO UPDATE
    SET amount = GREATEST(0, public.driver_credits.amount + EXCLUDED.amount),
        updated_at = now()
  RETURNING amount INTO v_amount;

  RETURN jsonb_build_object('amount', v_amount);
END $$;

-- La app solo invoca estas funciones como usuario autenticado.
REVOKE ALL ON FUNCTION public.apply_rental_payment(text, numeric, date) FROM public;
REVOKE ALL ON FUNCTION public.apply_payment(text, numeric, date) FROM public;
REVOKE ALL ON FUNCTION public.adjust_driver_credit(text, numeric) FROM public;
GRANT EXECUTE ON FUNCTION public.apply_rental_payment(text, numeric, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_payment(text, numeric, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_driver_credit(text, numeric) TO authenticated;