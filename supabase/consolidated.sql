-- ============================================================
-- FLEET CONTROL — ESQUEMA COMPLETO (consolidado)
-- ============================================================
-- Generado a partir de las 14 migraciones de supabase/migrations/ y
-- ALINEADO al esquema real exportado del dashboard (verificación:
-- drivers.ine_img/license_img, vehicles.verification_completed,
-- vin sin UNIQUE, renewal_logs.vehicle_id nullable, etc.).
--
-- Diseñado para correr TODO DE UNA VEZ, tanto en base nueva como en
-- la base existente, sin fallar por "policy already exists":
--
--   - Las policies de la era demo (públicas) y las owner_scope
--     INTERMEDIAS NO se crean aquí: la migración rls_fixup (sección 11)
--     dropea TODAS las policies de las 10 tablas y reconstruye el
--     estado RLS final. Ese es el ÚNICO bloque que crea policies
--     (junto con storage/driver_credits/push, que dropean antes).
--   - Los ALTER ... ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT
--     EXISTS / CREATE INDEX IF NOT EXISTS hacen no-op en base existente.
--   - Crea el bucket storage 'documentos' como PRIVADO y las 2 tablas
--     que antes se creaban a mano (renewal_logs, vehicle_inventories).
--
-- CÓMO EJECUTAR (una sola vez):
--   1) Supabase Dashboard → SQL Editor → pegar → Run.
--      (o: supabase db execute --file supabase/consolidated.sql)
--   2) Después del deploy a Vercel, los usuarios existentes deben
--      iniciar sesión una vez (sus sesiones viejas no traen la cookie).
--
-- ADVERTENCIA: no correr con `supabase db push` (esa vía usa las
-- migraciones individuales y actualiza el tracking). Este archivo es
-- para ejecución directa.
-- ============================================================

-- ============================================================
-- 1) EXTENSIONES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 2) TABLAS BASE (alineadas al esquema real del dashboard)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.drivers (
  id TEXT NOT NULL PRIMARY KEY,
  first_name TEXT NOT NULL,
  paternal_last_name TEXT NOT NULL,
  maternal_last_name TEXT,
  curp TEXT NOT NULL UNIQUE,
  dob DATE,
  license_number TEXT,
  license_issue_date DATE,
  license_expiration_date DATE,
  license_is_permanent BOOLEAN DEFAULT FALSE,
  ine_address TEXT,
  ine_sex TEXT CHECK (ine_sex = ANY (ARRAY['M'::TEXT, 'F'::TEXT, 'X'::TEXT])),
  ine_elector_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  driver_photo_img TEXT,
  address_proof_img TEXT,
  ine_img TEXT,
  license_img TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE
);
COMMENT ON TABLE public.drivers IS 'Conductores registrados con INE, licencia y domicilio.';

CREATE TABLE IF NOT EXISTS public.vehicles (
  id TEXT NOT NULL PRIMARY KEY,
  brand TEXT NOT NULL,
  vehicle_name TEXT NOT NULL,
  model TEXT,
  class_type TEXT,
  circulation_expiration_date DATE,
  vin TEXT,
  plate_number TEXT NOT NULL UNIQUE,
  insurance_policy_img TEXT,
  insurance_expiration_date DATE,
  active_driver_id TEXT REFERENCES public.drivers(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  rent_cost NUMERIC DEFAULT 2500,
  next_service_mileage NUMERIC,
  color TEXT,
  insurance_policy_number TEXT DEFAULT '',
  verification_expiration_date DATE,
  verification_completed BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'active' CHECK (status = ANY (ARRAY['active'::TEXT, 'in_service'::TEXT])),
  service_out_date DATE,
  service_return_date DATE,
  circulation_img TEXT,
  verification_img TEXT,
  insurance_policy_pages TEXT DEFAULT '[]',
  deleted_at TIMESTAMP WITH TIME ZONE
);
COMMENT ON TABLE public.vehicles IS 'Inventario de autos y su estado documental.';

CREATE TABLE IF NOT EXISTS public.assignments (
  id TEXT NOT NULL PRIMARY KEY,
  vehicle_id TEXT REFERENCES public.vehicles(id) ON DELETE CASCADE,
  driver_id TEXT REFERENCES public.drivers(id) ON DELETE CASCADE,
  action_type TEXT CHECK (action_type = ANY (ARRAY['ASSIGN'::TEXT, 'RELEASE'::TEXT])),
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE public.assignments IS 'Bitácora de asignación y retiro de autos.';

CREATE TABLE IF NOT EXISTS public.checklists (
  id TEXT NOT NULL PRIMARY KEY,
  vehicle_id TEXT REFERENCES public.vehicles(id) ON DELETE CASCADE,
  driver_id TEXT REFERENCES public.drivers(id) ON DELETE CASCADE,
  type TEXT CHECK (type = ANY (ARRAY['DELIVERY'::TEXT, 'WEEKLY_START'::TEXT])),
  mileage INTEGER NOT NULL,
  gasoline_level TEXT NOT NULL,
  checklist_items JSONB NOT NULL,
  irregularities TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE public.checklists IS 'Checklist de entrega e inicio de semana.';

CREATE TABLE IF NOT EXISTS public.weekly_rentals (
  id TEXT NOT NULL PRIMARY KEY,
  driver_id TEXT REFERENCES public.drivers(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  rent_amount NUMERIC NOT NULL,
  paid_amount NUMERIC DEFAULT 0.00,
  accumulated_debt NUMERIC DEFAULT 0.00,
  status TEXT CHECK (status = ANY (ARRAY['PAID'::TEXT, 'PARTIAL'::TEXT, 'UNPAID'::TEXT])),
  payments_log JSONB DEFAULT '[]'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  condoned_days INTEGER DEFAULT 0,
  condoned_amount NUMERIC(10,2) DEFAULT 0
);
COMMENT ON TABLE public.weekly_rentals IS 'Cobros semanales de renta y deuda acumulada.';

CREATE TABLE IF NOT EXISTS public.maintenances (
  id TEXT NOT NULL PRIMARY KEY,
  vehicle_id TEXT REFERENCES public.vehicles(id) ON DELETE CASCADE,
  cost NUMERIC NOT NULL,
  description TEXT NOT NULL,
  maintenance_date DATE NOT NULL,
  next_maintenance_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE public.maintenances IS 'Registro de mantenimientos y próximos servicios.';

CREATE TABLE IF NOT EXISTS public.renewal_logs (
  id TEXT NOT NULL PRIMARY KEY,
  vehicle_id TEXT REFERENCES public.vehicles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type = ANY (ARRAY['CIRCULACION'::TEXT, 'SEGURO'::TEXT])),
  previous_expiration TEXT,
  new_expiration TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE public.renewal_logs IS 'Bitácora de renovaciones (circulación y seguro).';

CREATE TABLE IF NOT EXISTS public.vehicle_inventories (
  id TEXT NOT NULL PRIMARY KEY,
  vehicle_id TEXT NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE public.vehicle_inventories IS 'Inventario físico de cada vehículo (fotos y artículos).';

-- Índices recomendados
CREATE INDEX IF NOT EXISTS idx_vehicles_active_driver ON public.vehicles(active_driver_id);
CREATE INDEX IF NOT EXISTS idx_assignments_vehicle ON public.assignments(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_assignments_driver ON public.assignments(driver_id);
CREATE INDEX IF NOT EXISTS idx_assignments_created_at ON public.assignments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_checklists_vehicle ON public.checklists(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_checklists_driver ON public.checklists(driver_id);
CREATE INDEX IF NOT EXISTS idx_weekly_rentals_driver ON public.weekly_rentals(driver_id);
CREATE INDEX IF NOT EXISTS idx_weekly_rentals_week ON public.weekly_rentals(week_start);
CREATE INDEX IF NOT EXISTS idx_maintenances_vehicle ON public.maintenances(vehicle_id);

-- ============================================================
-- 3) users y registration_tokens
--    (state final: role 'admin'|'owner' DEFAULT 'owner',
--     password_hash, RLS habilitada. LAS POLICIES LAS CONSTRUYE
--     LA SECCIÓN 11 — aquí NO se crean para evitar duplicados.)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name TEXT NOT NULL,
    email TEXT UNIQUE,
    role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('admin', 'owner')),
    webauthn_credentials JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    password_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.registration_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT UNIQUE NOT NULL,
    created_by UUID REFERENCES public.users(id),
    used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.registration_tokens ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_registration_tokens_token ON public.registration_tokens(token);

-- Soft delete en drivers/vehicles
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_drivers_deleted_at ON public.drivers(deleted_at);
CREATE INDEX IF NOT EXISTS idx_vehicles_deleted_at ON public.vehicles(deleted_at);

-- ============================================================
-- 4) MULTI-TENANT (owner_id) + roles admin/owner + system admin
--    (los ALTER/UPDATE son no-op en base existente)
-- ============================================================
ALTER TABLE public.drivers            ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.users(id);
ALTER TABLE public.vehicles           ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.users(id);
ALTER TABLE public.assignments        ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.users(id);
ALTER TABLE public.checklists         ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.users(id);
ALTER TABLE public.weekly_rentals     ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.users(id);
ALTER TABLE public.maintenances       ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.users(id);
ALTER TABLE public.renewal_logs       ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.users(id);
ALTER TABLE public.vehicle_inventories ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.users(id);

-- Backfill 1: filas existentes → primer admin (para que nada quede sin dueño)
UPDATE public.drivers
   SET owner_id = (SELECT id FROM public.users WHERE role = 'admin' ORDER BY created_at LIMIT 1)
 WHERE owner_id IS NULL;

UPDATE public.vehicles
   SET owner_id = (SELECT id FROM public.users WHERE role = 'admin' ORDER BY created_at LIMIT 1)
 WHERE owner_id IS NULL;

UPDATE public.assignments
   SET owner_id = (SELECT id FROM public.users WHERE role = 'admin' ORDER BY created_at LIMIT 1)
 WHERE owner_id IS NULL;

UPDATE public.checklists
   SET owner_id = (SELECT id FROM public.users WHERE role = 'admin' ORDER BY created_at LIMIT 1)
 WHERE owner_id IS NULL;

UPDATE public.weekly_rentals
   SET owner_id = (SELECT id FROM public.users WHERE role = 'admin' ORDER BY created_at LIMIT 1)
 WHERE owner_id IS NULL;

UPDATE public.maintenances
   SET owner_id = (SELECT id FROM public.users WHERE role = 'admin' ORDER BY created_at LIMIT 1)
 WHERE owner_id IS NULL;

UPDATE public.renewal_logs
   SET owner_id = (SELECT id FROM public.users WHERE role = 'admin' ORDER BY created_at LIMIT 1)
 WHERE owner_id IS NULL;

UPDATE public.vehicle_inventories
   SET owner_id = (SELECT id FROM public.users WHERE role = 'admin' ORDER BY created_at LIMIT 1)
 WHERE owner_id IS NULL;

-- Marcar al primer usuario como administrador del sistema
UPDATE public.users
   SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"is_system_admin": true}'::jsonb
 WHERE id = (SELECT id FROM public.users ORDER BY created_at ASC LIMIT 1);

-- Backfill 2 (defensivo): filas sin dueño → system admin
UPDATE public.drivers
   SET owner_id = (SELECT id FROM public.users
                   WHERE metadata->>'is_system_admin' = 'true'
                   ORDER BY created_at LIMIT 1)
 WHERE owner_id IS NULL;

UPDATE public.vehicles
   SET owner_id = (SELECT id FROM public.users
                   WHERE metadata->>'is_system_admin' = 'true'
                   ORDER BY created_at LIMIT 1)
 WHERE owner_id IS NULL;

UPDATE public.assignments
   SET owner_id = (SELECT id FROM public.users
                   WHERE metadata->>'is_system_admin' = 'true'
                   ORDER BY created_at LIMIT 1)
 WHERE owner_id IS NULL;

UPDATE public.checklists
   SET owner_id = (SELECT id FROM public.users
                   WHERE metadata->>'is_system_admin' = 'true'
                   ORDER BY created_at LIMIT 1)
 WHERE owner_id IS NULL;

UPDATE public.weekly_rentals
   SET owner_id = (SELECT id FROM public.users
                   WHERE metadata->>'is_system_admin' = 'true'
                   ORDER BY created_at LIMIT 1)
 WHERE owner_id IS NULL;

UPDATE public.maintenances
   SET owner_id = (SELECT id FROM public.users
                   WHERE metadata->>'is_system_admin' = 'true'
                   ORDER BY created_at LIMIT 1)
 WHERE owner_id IS NULL;

UPDATE public.renewal_logs
   SET owner_id = (SELECT id FROM public.users
                   WHERE metadata->>'is_system_admin' = 'true'
                   ORDER BY created_at LIMIT 1)
 WHERE owner_id IS NULL;

UPDATE public.vehicle_inventories
   SET owner_id = (SELECT id FROM public.users
                   WHERE metadata->>'is_system_admin' = 'true'
                   ORDER BY created_at LIMIT 1)
 WHERE owner_id IS NULL;

-- Roles: solo 'admin' y 'owner'; todos → owner, el system admin → admin
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'owner'));

UPDATE public.users SET role = 'owner';

UPDATE public.users
   SET role = 'admin'
 WHERE id = (
   SELECT id FROM public.users
   WHERE metadata->>'is_system_admin' = 'true'
   ORDER BY created_at ASC
   LIMIT 1
 );

UPDATE public.users
   SET role = 'admin'
 WHERE id = (
   SELECT id FROM public.users
   ORDER BY created_at ASC
   LIMIT 1
 )
   AND NOT EXISTS (SELECT 1 FROM public.users WHERE role = 'admin');

ALTER TABLE public.users ALTER COLUMN role SET DEFAULT 'owner';

-- Índices por dueño
CREATE INDEX IF NOT EXISTS idx_drivers_owner            ON public.drivers(owner_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_owner           ON public.vehicles(owner_id);
CREATE INDEX IF NOT EXISTS idx_assignments_owner        ON public.assignments(owner_id);
CREATE INDEX IF NOT EXISTS idx_checklists_owner         ON public.checklists(owner_id);
CREATE INDEX IF NOT EXISTS idx_weekly_rentals_owner     ON public.weekly_rentals(owner_id);
CREATE INDEX IF NOT EXISTS idx_maintenances_owner       ON public.maintenances(owner_id);
CREATE INDEX IF NOT EXISTS idx_renewal_logs_owner       ON public.renewal_logs(owner_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_inventories_owner ON public.vehicle_inventories(owner_id);

-- ============================================================
-- 5) ESTADO RLS FINAL (rls_fixup_idempotent)
--    ÚNICO bloque que crea policies de las 10 tablas: dropea TODAS
--    las existentes (demo o parciales) y reconstruye el estado
--    definitivo. Re-ejecución segura.
-- ============================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'drivers', 'vehicles', 'assignments', 'checklists',
        'weekly_rentals', 'maintenances', 'renewal_logs',
        'vehicle_inventories', 'users', 'registration_tokens'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

ALTER TABLE public.drivers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklists          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_rentals      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenances        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.renewal_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_inventories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_tokens ENABLE ROW LEVEL SECURITY;

-- Aislamiento por dueño en las 8 tablas de flota
CREATE POLICY "owner_scope_drivers" ON public.drivers
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owner_scope_vehicles" ON public.vehicles
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owner_scope_assignments" ON public.assignments
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owner_scope_checklists" ON public.checklists
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owner_scope_weekly_rentals" ON public.weekly_rentals
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owner_scope_maintenances" ON public.maintenances
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owner_scope_renewal_logs" ON public.renewal_logs
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owner_scope_vehicle_inventories" ON public.vehicle_inventories
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Self-access en users; registration_tokens sin policies (solo service_role)
CREATE POLICY "user_self_select" ON public.users
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "user_self_update" ON public.users
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Defensa en profundidad: quitar privilegios a anon en users/tokens
REVOKE ALL ON public.users FROM anon;
REVOKE ALL ON public.registration_tokens FROM anon;

CREATE INDEX IF NOT EXISTS idx_drivers_owner_id             ON public.drivers(owner_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_owner_id            ON public.vehicles(owner_id);
CREATE INDEX IF NOT EXISTS idx_assignments_owner_id         ON public.assignments(owner_id);
CREATE INDEX IF NOT EXISTS idx_checklists_owner_id          ON public.checklists(owner_id);
CREATE INDEX IF NOT EXISTS idx_weekly_rentals_owner_id      ON public.weekly_rentals(owner_id);
CREATE INDEX IF NOT EXISTS idx_maintenances_owner_id        ON public.maintenances(owner_id);
CREATE INDEX IF NOT EXISTS idx_renewal_logs_owner_id        ON public.renewal_logs(owner_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_inventories_owner_id ON public.vehicle_inventories(owner_id);

-- ============================================================
-- 6) secure_document_storage: bucket 'documentos' PRIVADO +
--    policies owner-scoped + migración de URLs legacy
-- ============================================================
-- Columnas de imagen faltantes (drift — no-op si ya existen)
ALTER TABLE public.drivers  ADD COLUMN IF NOT EXISTS ine_img TEXT;
ALTER TABLE public.drivers  ADD COLUMN IF NOT EXISTS license_img TEXT;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS circulation_img TEXT;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS verification_img TEXT;

-- Bucket privado (lo crea si no existe; lo pone privado si existía)
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos', 'documentos', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Eliminar policies previas de storage.objects relacionadas con documentos
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT p.policyname
      FROM pg_policies p
     WHERE p.schemaname = 'storage' AND p.tablename = 'objects'
       AND (p.policyname ILIKE '%documentos%'
            OR p.qual ILIKE '%documentos%'
            OR p.with_check ILIKE '%documentos%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "documentos_owner_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documentos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "documentos_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "documentos_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'documentos' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'documentos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "documentos_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documentos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Migración de datos legacy: URLs públicas → paths owner-scoped.
CREATE OR REPLACE FUNCTION public.fleet_migrate_doc(owner uuid, url text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  basename text;
  new_name text;
BEGIN
  IF url IS NULL OR url = '' OR url LIKE 'data:%' THEN
    RETURN url;
  END IF;
  IF url NOT LIKE '%documentos/%' THEN
    RETURN url;
  END IF;
  basename := substring(url from 'documentos/([^/?]+)');
  IF basename IS NULL OR basename = '' OR basename LIKE '%/%' THEN
    RETURN url;
  END IF;
  IF owner IS NULL THEN
    RETURN url;
  END IF;
  new_name := owner::text || '/' || basename;
  UPDATE storage.objects
     SET name = new_name,
         updated_at = now()
   WHERE bucket_id = 'documentos' AND name = basename;
  RETURN new_name;
END $$;

-- Drivers
UPDATE public.drivers SET ine_img            = public.fleet_migrate_doc(owner_id, ine_img)
 WHERE owner_id IS NOT NULL AND ine_img LIKE '%documentos/%';
UPDATE public.drivers SET license_img        = public.fleet_migrate_doc(owner_id, license_img)
 WHERE owner_id IS NOT NULL AND license_img LIKE '%documentos/%';
UPDATE public.drivers SET driver_photo_img   = public.fleet_migrate_doc(owner_id, driver_photo_img)
 WHERE owner_id IS NOT NULL AND driver_photo_img LIKE '%documentos/%';
UPDATE public.drivers SET address_proof_img  = public.fleet_migrate_doc(owner_id, address_proof_img)
 WHERE owner_id IS NOT NULL AND address_proof_img LIKE '%documentos/%';

-- Vehicles
UPDATE public.vehicles SET circulation_img       = public.fleet_migrate_doc(owner_id, circulation_img)
 WHERE owner_id IS NOT NULL AND circulation_img LIKE '%documentos/%';
UPDATE public.vehicles SET insurance_policy_img  = public.fleet_migrate_doc(owner_id, insurance_policy_img)
 WHERE owner_id IS NOT NULL AND insurance_policy_img LIKE '%documentos/%';
UPDATE public.vehicles SET verification_img      = public.fleet_migrate_doc(owner_id, verification_img)
 WHERE owner_id IS NOT NULL AND verification_img LIKE '%documentos/%';

-- Vehicles: insurance_policy_pages (JSON array de { url, ... })
UPDATE public.vehicles v
   SET insurance_policy_pages = (
     SELECT COALESCE(jsonb_agg(jsonb_set(p, '{url}', to_jsonb(public.fleet_migrate_doc(v.owner_id, p->>'url')))), '[]'::jsonb)
       FROM jsonb_array_elements(
         CASE WHEN jsonb_typeof(v.insurance_policy_pages::jsonb) = 'array'
              THEN v.insurance_policy_pages::jsonb
              ELSE '[]'::jsonb END
       ) p
   )
 WHERE v.owner_id IS NOT NULL
   AND v.insurance_policy_pages IS NOT NULL
   AND v.insurance_policy_pages LIKE '%documentos/%';

-- Vehicle inventories: photos (JSON array de { angle, url })
UPDATE public.vehicle_inventories vi
   SET photos = (
     SELECT COALESCE(jsonb_agg(jsonb_set(p, '{url}', to_jsonb(public.fleet_migrate_doc(vi.owner_id, p->>'url')))), '[]'::jsonb)
       FROM jsonb_array_elements(
         CASE WHEN jsonb_typeof(vi.photos) = 'array' THEN vi.photos ELSE '[]'::jsonb END
       ) p
   )
 WHERE vi.owner_id IS NOT NULL
   AND vi.photos IS NOT NULL
   AND vi.photos::text LIKE '%documentos/%';

-- ============================================================
-- 7) integrity_and_credits: rate_limits, driver_credits,
--    drift de weekly_rentals, unicidad y RPCs de pago
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key          TEXT PRIMARY KEY,
  failures     JSONB NOT NULL DEFAULT '[]'::jsonb,
  locked_until TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
-- Sin policies: solo service_role (BYPASSRLS) puede leer/escribir.

CREATE TABLE IF NOT EXISTS public.driver_credits (
  driver_id  TEXT NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  owner_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (driver_id, owner_id)
);

ALTER TABLE public.driver_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_scope_driver_credits" ON public.driver_credits;
CREATE POLICY "owner_scope_driver_credits" ON public.driver_credits
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Columnas de weekly_rentals faltantes (drift)
ALTER TABLE public.weekly_rentals ADD COLUMN IF NOT EXISTS is_prorated   BOOLEAN DEFAULT FALSE;
ALTER TABLE public.weekly_rentals ADD COLUMN IF NOT EXISTS prorated_days  INTEGER;
ALTER TABLE public.weekly_rentals ADD COLUMN IF NOT EXISTS condoned_days  INTEGER DEFAULT 0;
ALTER TABLE public.weekly_rentals ADD COLUMN IF NOT EXISTS condoned_amount NUMERIC(10,2) DEFAULT 0;

-- Unicidad de licencia y clave de elector (nulls y '' permitidos)
CREATE UNIQUE INDEX IF NOT EXISTS uq_drivers_license_number
  ON public.drivers(license_number)
  WHERE license_number IS NOT NULL AND license_number <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_drivers_ine_elector_key
  ON public.drivers(ine_elector_key)
  WHERE ine_elector_key IS NOT NULL AND ine_elector_key <> '';

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

-- ============================================================
-- 8) push_subscriptions: suscripciones Web Push (RLS owner-scoped)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_scope_push_select" ON public.push_subscriptions;
DROP POLICY IF EXISTS "owner_scope_push_insert" ON public.push_subscriptions;
DROP POLICY IF EXISTS "owner_scope_push_delete" ON public.push_subscriptions;

CREATE POLICY "owner_scope_push_select" ON public.push_subscriptions
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "owner_scope_push_insert" ON public.push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owner_scope_push_delete" ON public.push_subscriptions
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- ============================================================
-- VERIFICACIÓN RÁPIDA (opcional — corre después del script)
-- ============================================================
-- SELECT tablename, policyname FROM pg_policies
--   WHERE schemaname = 'public'
--   ORDER BY tablename;
--
-- SELECT id, public FROM storage.buckets WHERE id = 'documentos';  -- public = false
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'vehicles' AND column_name = 'verification_completed';