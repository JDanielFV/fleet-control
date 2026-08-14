-- Migration: storage de documentos privado y scoped por dueño
--
-- MOTIVO: el bucket `documentos` almacena documentos con PII (INE,
-- licencias, pólizas, fotos de inventario) pero sus policies eran públicas
-- (lectura/escritura/borrado para anon) y los paths no incluían al dueño.
-- Además, las columnas de imagen (ine_img, license_img, circulation_img,
-- verification_img) existían en el esquema de referencia pero nunca se
-- agregaron por migración (drift).
--
-- Esta migración:
--   1. Agrega las columnas de imagen faltantes (idempotente).
--   2. Pone el bucket en modo privado (public = false).
--   3. Elimina todas las policies de storage.objects que toquen `documentos`.
--   4. Crea policies owner-scoped: solo el dueño (auth.uid()) puede leer,
--      subir, actualizar o borrar objetos bajo su carpeta
--      `{owner_id}/...` (storage.foldername(name)[1] = auth.uid()).
--   5. Migra los objetos y URLs legacy (path sin dueño) a paths
--      `{owner_id}/{nombre}` tanto en storage.objects como en las columnas
--      de drivers/vehicles/vehicle_inventories.

-- 1) Columnas de imagen faltantes (drift del esquema de referencia)
ALTER TABLE public.drivers  ADD COLUMN IF NOT EXISTS ine_img TEXT;
ALTER TABLE public.drivers  ADD COLUMN IF NOT EXISTS license_img TEXT;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS circulation_img TEXT;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS verification_img TEXT;

-- 2) Bucket privado
UPDATE storage.buckets
   SET public = false
 WHERE id = 'documentos';

-- 3) Eliminar policies previas de storage.objects relacionadas con documentos
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

-- 4) Policies owner-scoped sobre storage.objects
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

-- 5) Migración de datos legacy: URLs públicas → paths owner-scoped.
--    Helper: mueve el objeto en storage.objects a `{owner}/{basename}` y
--    devuelve el nuevo path (o el valor original si no es migrable).
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