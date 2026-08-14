-- Migration correctiva: estado RLS determinista (idempotente)
--
-- MOTIVO: las migraciones 20260812000000 y 20260812100000 se aplicaron a
-- mano (editor SQL de Supabase), quedando un estado parcial: RLS activa en 6
-- de 8 tablas de flota pero `drivers`/`vehicles` abiertas al anon key, y el
-- tracking del CLI sin actualizar. Esta migración deja el estado RLS exacto
-- e idempotente, sin importar lo que haya quedado aplicado:
--
--   1. Elimina TODAS las policies de las 10 tablas (públicas heredadas y
--      owner_scope parciales) para reconstruirlas desde cero.
--   2. Habilita RLS en las 8 tablas de flota + users + registration_tokens.
--   3. Crea las policies de aislamiento por dueño (owner_id = auth.uid()).
--   4. Crea las policies de self-access en users; registration_tokens queda
--      sin policies (solo service_role).
--   5. Revoca privilegios a anon en users/registration_tokens (defensa en
--      profundidad; las tablas de flota conservan los grants para que la
--      app funcione en modo transicional sin JWT, y RLS niega por defecto).
--
-- Aplicar con `supabase db push` (nunca a mano), después de reparar el
-- tracking de las dos migraciones previas:
--   supabase migration repair --status applied 20260812000000 20260812100000

-- 1) Reset de policies: dropear todas las de las 10 tablas (nombres exactos
--    no necesarios — se reconstruyen abajo).
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

-- 2) RLS activa en las 10 tablas (idempotente)
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

-- 3) Aislamiento por dueño en las 8 tablas de flota
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

-- 4) Self-access en users; registration_tokens sin policies (solo service_role)
CREATE POLICY "user_self_select" ON public.users
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "user_self_update" ON public.users
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 5) Defensa en profundidad: quitar privilegios a anon en users/tokens
REVOKE ALL ON public.users FROM anon;
REVOKE ALL ON public.registration_tokens FROM anon;

-- Índices para el filtrado por dueño
CREATE INDEX IF NOT EXISTS idx_drivers_owner_id             ON public.drivers(owner_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_owner_id            ON public.vehicles(owner_id);
CREATE INDEX IF NOT EXISTS idx_assignments_owner_id         ON public.assignments(owner_id);
CREATE INDEX IF NOT EXISTS idx_checklists_owner_id          ON public.checklists(owner_id);
CREATE INDEX IF NOT EXISTS idx_weekly_rentals_owner_id      ON public.weekly_rentals(owner_id);
CREATE INDEX IF NOT EXISTS idx_maintenances_owner_id        ON public.maintenances(owner_id);
CREATE INDEX IF NOT EXISTS idx_renewal_logs_owner_id        ON public.renewal_logs(owner_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_inventories_owner_id ON public.vehicle_inventories(owner_id);
