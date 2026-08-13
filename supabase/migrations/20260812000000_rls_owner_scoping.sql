-- Migration: RLS real por dueño (owner_id = auth.uid())
--
-- Cierra el acceso anónimo a los datos de flota. A partir de esta migración:
--   - El rol `anon` (clave pública) NO puede leer/escribir nada en estas
--     tablas (RLS niega por defecto al no existir policies para anon).
--   - El rol `authenticated` solo ve/edita sus propias filas
--     (owner_id = auth.uid()). El login emite un JWT custom firmado con
--     SUPABASE_JWT_SECRET con role='authenticated' y sub=<user_id>.
--   - El rol `service_role` omite RLS (BYPASSRLS) → el panel admin (/admin)
--     y las rutas server-side siguen operando sin cambios.
--
-- NOTA: las tablas `users` y `registration_tokens` permanecen con su RLS
-- actual (acceso público) en este milestone porque el registro de usuarios
-- todavía se hace desde el cliente. Se cerrarán en el milestone B junto con
-- la ruta server-side de registro.
--
-- Orden de deploy: aplicar JUNTO con el flujo de login que emite el JWT
-- (mismo release). Si se aplica sola, la app deja de ver datos.

-- 1) Habilitar RLS en las 8 tablas de flota
ALTER TABLE public.drivers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklists          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_rentals      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenances        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.renewal_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_inventories ENABLE ROW LEVEL SECURITY;

-- 2) Policies de aislamiento por dueño (FOR ALL cubre SELECT/INSERT/UPDATE/DELETE)
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

-- 3) Índices para el filtrado por dueño
CREATE INDEX IF NOT EXISTS idx_drivers_owner_id             ON public.drivers(owner_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_owner_id            ON public.vehicles(owner_id);
CREATE INDEX IF NOT EXISTS idx_assignments_owner_id         ON public.assignments(owner_id);
CREATE INDEX IF NOT EXISTS idx_checklists_owner_id          ON public.checklists(owner_id);
CREATE INDEX IF NOT EXISTS idx_weekly_rentals_owner_id      ON public.weekly_rentals(owner_id);
CREATE INDEX IF NOT EXISTS idx_maintenances_owner_id        ON public.maintenances(owner_id);
CREATE INDEX IF NOT EXISTS idx_renewal_logs_owner_id        ON public.renewal_logs(owner_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_inventories_owner_id ON public.vehicle_inventories(owner_id);
