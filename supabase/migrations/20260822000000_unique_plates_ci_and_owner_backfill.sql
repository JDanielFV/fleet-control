-- Migration: case-insensitive unique indexes for vehicles + backfill owner_id
--
-- 1) Replaces the case-sensitive UNIQUE constraints on
--    vehicles.plate_number / vehicles.vin with functional lower() indexes
--    so "ABC123D" and "abc123d" collide. Soft-deleted rows (deleted_at NOT
--    NULL) are EXCLUDED via partial index — archiving a vehicle frees its
--    plate/VIN for re-registration.
-- 2) Backfills owner_id on fleet rows that pre-date multi-tenant, assigning
--    them to the OLDEST admin user (the original account owner). This closes
--    the `owner_id.is.null` visibility window in the db layer.

-- ============================================================
-- 1) Case-insensitive, soft-delete-aware uniqueness
-- ============================================================

-- Drop the original column-level UNIQUE constraints (they back implicit indexes)
ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_plate_number_key;
ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_vin_key;

-- Partial, case-insensitive unique indexes (only live rows participate)
CREATE UNIQUE INDEX IF NOT EXISTS uq_vehicles_plate_live
  ON public.vehicles (LOWER(plate_number))
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_vehicles_vin_live
  ON public.vehicles (LOWER(vin))
  WHERE deleted_at IS NULL AND vin IS NOT NULL;

-- ============================================================
-- 2) Backfill owner_id from the oldest admin
-- ============================================================

DO $$
DECLARE
  fallback_owner UUID;
BEGIN
  SELECT id INTO fallback_owner
  FROM public.users
  WHERE role = 'admin'
  ORDER BY created_at ASC
  LIMIT 1;

  IF fallback_owner IS NULL THEN
    RAISE NOTICE 'No admin user found — skipping owner_id backfill.';
    RETURN;
  END IF;

  UPDATE public.drivers             SET owner_id = fallback_owner WHERE owner_id IS NULL;
  UPDATE public.vehicles            SET owner_id = fallback_owner WHERE owner_id IS NULL;
  UPDATE public.assignments         SET owner_id = fallback_owner WHERE owner_id IS NULL;
  UPDATE public.checklists          SET owner_id = fallback_owner WHERE owner_id IS NULL;
  UPDATE public.weekly_rentals      SET owner_id = fallback_owner WHERE owner_id IS NULL;
  UPDATE public.maintenances        SET owner_id = fallback_owner WHERE owner_id IS NULL;
  UPDATE public.renewal_logs        SET owner_id = fallback_owner WHERE owner_id IS NULL;
  UPDATE public.vehicle_inventories SET owner_id = fallback_owner WHERE owner_id IS NULL;

  RAISE NOTICE 'owner_id backfilled to %', fallback_owner;
END $$;
