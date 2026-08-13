-- Migration (Milestone B): cerrar RLS en users y registration_tokens
--
-- Antes: RLS habilitada pero con policies públicas "Allow public ... USING
-- (true)" (migraciones 20260710000000 / 20260710000001) → cualquiera con la
-- anon key podía leer/modificar/borrar la tabla users, incluidos los hashes
-- de contraseña.
--
-- Después de esta migración:
--   - users: un usuario autenticado solo puede leer/actualizar su propia
--     fila (auth.uid() = id). El registro (POST /api/auth/register), el
--     login (POST /api/auth/login, /api/webauthn/*) y el panel admin
--     (/api/admin/users) operan con service_role (omite RLS).
--   - registration_tokens: sin policies → anon/authenticated denegados; solo
--     service_role (creación en /api/auth/status y /api/admin/tokens,
--     consumo en /api/auth/register).
--   - REVOKE ALL FROM anon en ambas tablas (defensa en profundidad).
--
-- Orden de deploy: junto con el mismo release que trae las rutas
-- server-side de registro/status (nunca sola: sin ellas la app no podría
-- crear la primera cuenta).

-- 1) Eliminar las policies públicas de la era pre-auth
DROP POLICY IF EXISTS "Allow public read users" ON public.users;
DROP POLICY IF EXISTS "Allow public insert users" ON public.users;
DROP POLICY IF EXISTS "Allow public update users" ON public.users;
DROP POLICY IF EXISTS "Allow public delete users" ON public.users;

DROP POLICY IF EXISTS "Allow public read registration_tokens" ON public.registration_tokens;
DROP POLICY IF EXISTS "Allow public insert registration_tokens" ON public.registration_tokens;
DROP POLICY IF EXISTS "Allow public update registration_tokens" ON public.registration_tokens;

-- 2) Acceso propio en users (el cliente ya no escribe usuarios: el registro
--    y el panel van por service_role)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_self_select" ON public.users
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "user_self_update" ON public.users
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 3) registration_tokens: RLS activa sin policies → denegado para
--    anon/authenticated; solo service_role.
ALTER TABLE public.registration_tokens ENABLE ROW LEVEL SECURITY;

-- 4) Defensa en profundidad: quitar privilegios a anon
REVOKE ALL ON public.users FROM anon;
REVOKE ALL ON public.registration_tokens FROM anon;
