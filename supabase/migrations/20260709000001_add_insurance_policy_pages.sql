-- ============================================================
-- Migration: add_insurance_policy_pages
-- Fecha: 2026-07-09
-- Proyecto: Fleet Control
-- Notas:
--   Agrega la columna insurance_policy_pages a vehicles
--   para soportar múltiples páginas en la póliza de seguro.
-- ============================================================

ALTER TABLE IF EXISTS public.vehicles
  ADD COLUMN IF NOT EXISTS insurance_policy_pages TEXT DEFAULT '[]';

COMMENT ON COLUMN public.vehicles.insurance_policy_pages IS 'JSON array de URLs de todas las páginas de la póliza de seguro';
