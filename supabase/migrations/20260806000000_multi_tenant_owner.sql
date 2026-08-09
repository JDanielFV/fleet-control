-- ============================================================
-- Migration: multi-tenant ownership (owner_id)
-- Fecha: 2026-08-06
-- Proyecto: Fleet Control
--
-- Cada usuario (dueño) ve y administra exclusivamente su propia flota.
-- - Se agrega owner_id a todas las tablas de datos del operador.
-- - Las filas existentes se asignan al primer admin (backfill) para no
--   perder datos reales previos al cambio.
-- - Las unicidades GLOBALES (curp, plate_number, vin) se MANTIENEN:
--   ningún usuario puede registrar el mismo chofer o auto que otro.
--
-- Nota RLS: las políticas siguen abiertas (modo demo). Cuando se adopte
-- Supabase Auth, reemplazar por políticas USING (auth.uid() = owner_id).
-- ============================================================

-- 1) Columna owner_id en todas las tablas de datos
ALTER TABLE public.drivers            ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.users(id);
ALTER TABLE public.vehicles           ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.users(id);
ALTER TABLE public.assignments        ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.users(id);
ALTER TABLE public.checklists         ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.users(id);
ALTER TABLE public.weekly_rentals     ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.users(id);
ALTER TABLE public.maintenances       ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.users(id);
ALTER TABLE public.renewal_logs       ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.users(id);
ALTER TABLE public.vehicle_inventories ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.users(id);

-- 2) Backfill: filas existentes → primer admin (una sola persona administra)
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

-- 3) Índices por dueño (lecturas scoped por owner_id)
CREATE INDEX IF NOT EXISTS idx_drivers_owner            ON public.drivers(owner_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_owner           ON public.vehicles(owner_id);
CREATE INDEX IF NOT EXISTS idx_assignments_owner        ON public.assignments(owner_id);
CREATE INDEX IF NOT EXISTS idx_checklists_owner         ON public.checklists(owner_id);
CREATE INDEX IF NOT EXISTS idx_weekly_rentals_owner     ON public.weekly_rentals(owner_id);
CREATE INDEX IF NOT EXISTS idx_maintenances_owner       ON public.maintenances(owner_id);
CREATE INDEX IF NOT EXISTS idx_renewal_logs_owner       ON public.renewal_logs(owner_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_inventories_owner ON public.vehicle_inventories(owner_id);
