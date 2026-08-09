-- ============================================================
-- Migration: Roles — solo admin y dueños (owners)
-- Fecha: 2026-08-07
-- Proyecto: Fleet Control
--
-- Antes había dos roles en el modelo: 'admin' y 'operator'.
-- Ahora el sistema tiene exactamente DOS tipos de usuario:
--   'admin'  → administra TODO el proyecto (accede al panel /admin).
--   'owner'  → dueño: ve y administra exclusivamente su propia flota.
--
-- Los usuarios existentes con rol 'operator' pasan a ser 'owner'.
-- Solo queda UN 'admin': el administrador del sistema (el marcado en
-- metadata.is_system_admin, o el usuario más antiguo como fallback).
-- ============================================================

-- 1) Ajustar la restricción CHECK: de ('admin','operator') a ('admin','owner').
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'owner'));

-- 2) TODOS los usuarios existentes pasan a ser dueños (incluidos los que
--    tenían rol 'admin', porque la app anterior creaba a todos como 'admin').
UPDATE public.users SET role = 'owner';

-- 3) El administrador del sistema vuelve a ser el único 'admin'.
--    (Marcado en metadata, o el más antiguo como fallback.)
UPDATE public.users
   SET role = 'admin'
 WHERE id = (
   SELECT id FROM public.users
   WHERE metadata->>'is_system_admin' = 'true'
   ORDER BY created_at ASC
   LIMIT 1
 );

-- Si nadie está marcado como system admin, el usuario más antiguo es el admin.
UPDATE public.users
   SET role = 'admin'
 WHERE id = (
   SELECT id FROM public.users
   ORDER BY created_at ASC
   LIMIT 1
 )
   AND NOT EXISTS (SELECT 1 FROM public.users WHERE role = 'admin');

-- 4) El rol por defecto para usuarios nuevos es 'owner'.
ALTER TABLE public.users ALTER COLUMN role SET DEFAULT 'owner';
