-- ============================================================
-- Migration: Panel de administración (system admin)
-- Fecha: 2026-08-07
-- Proyecto: Fleet Control
--
-- El panel externo /admin solo es accesible por la persona que
-- administra el sistema. Marcamos al PRIMER usuario registrado
-- como system admin (metadata.is_system_admin = true).
-- Si se borra ese usuario, el fallback en código usa el más
-- antiguo que quede.
-- ============================================================

-- 1) Seguridad: en caso de que la migración multi-tenant no se haya
--    aplicado aún, la dejamos idempotente (no-op si ya existe).
ALTER TABLE public.drivers            ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.users(id);
ALTER TABLE public.vehicles           ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.users(id);
ALTER TABLE public.assignments        ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.users(id);
ALTER TABLE public.checklists         ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.users(id);
ALTER TABLE public.weekly_rentals     ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.users(id);
ALTER TABLE public.maintenances       ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.users(id);
ALTER TABLE public.renewal_logs       ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.users(id);
ALTER TABLE public.vehicle_inventories ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.users(id);

-- 2) Marcar al primer usuario como administrador del sistema.
UPDATE public.users
   SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"is_system_admin": true}'::jsonb
 WHERE id = (SELECT id FROM public.users ORDER BY created_at ASC LIMIT 1);

-- 3) Backfill defensivo: filas que hayan quedado sin dueño se asignan
--    al system admin para que nunca haya datos "invisibles".
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
