-- ============================================================
-- Migration: add_vehicle_new_fields
-- Fecha: 2026-07-09
-- Proyecto: Fleet Control
-- Notas:
--   Agrega los nuevos campos al modelo Vehicle:
--   - insurance_policy_number: número de póliza de seguro
--   - verification_expiration_date: fecha de verificación vehicular
--   - status: estado del auto (active | in_service)
--   - service_out_date: fecha de retiro a servicio
--   - service_return_date: fecha de regreso de servicio
-- ============================================================

ALTER TABLE IF EXISTS public.vehicles
  ADD COLUMN IF NOT EXISTS insurance_policy_number TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS verification_expiration_date DATE,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status = ANY (ARRAY['active'::TEXT, 'in_service'::TEXT])),
  ADD COLUMN IF NOT EXISTS service_out_date DATE,
  ADD COLUMN IF NOT EXISTS service_return_date DATE;

COMMENT ON COLUMN public.vehicles.insurance_policy_number IS 'Número de póliza de seguro';
COMMENT ON COLUMN public.vehicles.verification_expiration_date IS 'Fecha de vencimiento de verificación vehicular';
COMMENT ON COLUMN public.vehicles.status IS 'Estado del auto: active = en uso, in_service = en taller';
COMMENT ON COLUMN public.vehicles.service_out_date IS 'Fecha en que se retiró a servicio';
COMMENT ON COLUMN public.vehicles.service_return_date IS 'Fecha en que regresó de servicio';
