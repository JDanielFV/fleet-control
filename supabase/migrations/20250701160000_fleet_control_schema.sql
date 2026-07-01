-- ============================================================
-- Migration: fleet_control_schema
-- Fecha: 2026-07-01
-- Proyecto: Fleet Control
-- Notas:
--   - RLS se deja DESACTIVADO intencionalmente durante la fase demo.
--     Antes de producción activar RLS y definir políticas por usuario.
--   - Los IDs son de tipo text y se generan en la app (crypto.randomUUID).
-- ============================================================

-- Habilitar extensión pgcrypto si se requiere UUID nativo en el futuro
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------
-- drivers
-- ---------------------------------------------------------
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
  address_proof_img TEXT
);

COMMENT ON TABLE public.drivers IS 'Conductores registrados con INE, licencia y domicilio.';

-- ---------------------------------------------------------
-- vehicles
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vehicles (
  id TEXT NOT NULL PRIMARY KEY,
  brand TEXT NOT NULL,
  vehicle_name TEXT NOT NULL,
  model TEXT,
  class_type TEXT,
  circulation_expiration_date DATE,
  vin TEXT UNIQUE,
  plate_number TEXT NOT NULL UNIQUE,
  insurance_policy_img TEXT,
  insurance_expiration_date DATE,
  active_driver_id TEXT REFERENCES public.drivers(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  rent_cost NUMERIC DEFAULT 2500,
  next_service_mileage NUMERIC,
  color TEXT
);

COMMENT ON TABLE public.vehicles IS 'Inventario de autos y su estado documental.';

-- ---------------------------------------------------------
-- assignments
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assignments (
  id TEXT NOT NULL PRIMARY KEY,
  vehicle_id TEXT REFERENCES public.vehicles(id) ON DELETE CASCADE,
  driver_id TEXT REFERENCES public.drivers(id) ON DELETE CASCADE,
  action_type TEXT CHECK (action_type = ANY (ARRAY['ASSIGN'::TEXT, 'RELEASE'::TEXT])),
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE public.assignments IS 'Bitácora de asignación y retiro de autos.';

-- ---------------------------------------------------------
-- checklists
-- ---------------------------------------------------------
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

-- ---------------------------------------------------------
-- weekly_rentals
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.weekly_rentals (
  id TEXT NOT NULL PRIMARY KEY,
  driver_id TEXT REFERENCES public.drivers(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  rent_amount NUMERIC NOT NULL,
  paid_amount NUMERIC DEFAULT 0.00,
  accumulated_debt NUMERIC DEFAULT 0.00,
  status TEXT CHECK (status = ANY (ARRAY['PAID'::TEXT, 'PARTIAL'::TEXT, 'UNPAID'::TEXT])),
  payments_log JSONB DEFAULT '[]'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE public.weekly_rentals IS 'Cobros semanales de renta y deuda acumulada.';

-- ---------------------------------------------------------
-- maintenances
-- ---------------------------------------------------------
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

-- ---------------------------------------------------------
-- Índices recomendados
-- ---------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_vehicles_active_driver ON public.vehicles(active_driver_id);
CREATE INDEX IF NOT EXISTS idx_assignments_vehicle ON public.assignments(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_assignments_driver ON public.assignments(driver_id);
CREATE INDEX IF NOT EXISTS idx_assignments_created_at ON public.assignments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_checklists_vehicle ON public.checklists(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_checklists_driver ON public.checklists(driver_id);
CREATE INDEX IF NOT EXISTS idx_weekly_rentals_driver ON public.weekly_rentals(driver_id);
CREATE INDEX IF NOT EXISTS idx_weekly_rentals_week ON public.weekly_rentals(week_start);
CREATE INDEX IF NOT EXISTS idx_maintenances_vehicle ON public.maintenances(vehicle_id);
