# Plan: Endurecimiento de seguridad y arquitectura — fleet-control

Fecha: 2026-08-11
Base: auditoría completa del proyecto (14k líneas TS, 8 migraciones SQL, 0 tests)

## Contexto / estado real detectado

- El CLI de Supabase **2.111.0** está instalado, autenticado y el proyecto está **vinculado** (`ouyszgcvesmigardlnug` — "JDanielFV's Project").
- **No hay MCP de Supabase** disponible en este entorno → todo se opera con el CLI.
- **Docker no disponible** → no hay stack local (`supabase start`); se opera directo contra la nube con backup previo.
- **Drift de migraciones confirmado**: `supabase migration list` muestra que solo 2/8 migraciones están registradas como aplicadas (`20250701160000`, `20260709000000`). El schema real **sí está aplicado** (users, owner_id, CHECK de roles admin/owner, registration_tokens, panel admin) — se aplicó a mano. El tracking del CLI quedó atrás.

## Defectos a resolver (de la auditoría)

| # | Severidad | Defecto |
|---|---|---|
| 1 | CRÍTICO | RLS abierta: anon key puede leer/borrar toda la DB; el multi-tenant es solo de UI |
| 2 | CRÍTICO | Contraseñas SHA-256 con salt fijo, hashes legibles públicamente, sin rate-limit |
| 3 | ALTO | Sesión en localStorage (rol forjable); confianza cliente-side |
| 4 | ALTO | Cero tests y cero CI |
| 5 | MEDIO | Doble vía Supabase/localStorage con colas de pendientes |
| 6 | MEDIO | God components (DriversSlice 726, useVehicles 679, useDrivers 675, VehiclesSlice 592, Dashboard 503) |
| 7 | MEDIO | Facade `db` legacy con imports dinámicos conviviendo con imports directos |
| 8 | BAJO | Migraciones aplicadas a mano → drift (ya pasó con `expires_at` y el CHECK) |
| 9 | BAJO | WebAuthn frágil a configuración (RP ID default `localhost`) |

---

## Estado de ejecución (2026-08-11)

**Fase 0 completada** (CLI): `migration repair` → 8/8 migraciones registradas como aplicadas; `projects api-keys` confirma la `service_role` key. **Falta**: backup (pg_dump/PITR) y pegar las variables en Vercel + `.env.local`.

**Milestone A implementado en código (pendiente de deploy y de aplicar la migración):**
- `lib/jwt.ts` (HS256 con Web Crypto, server-only) + emisión de JWT en `/api/auth/login`, `/api/webauthn/login` y `/api/webauthn/register`.
- `lib/session.ts` + `lib/auth.ts`: la sesión guarda el JWT; `getSupabase()` en `lib/db/index.ts` lo adjunta como Bearer; los 11 módulos de datos usan el factory.
- `lib/password-server.ts`: scrypt con salt por usuario + `upgrade-on-login` (los hashes SHA-256 existentes se re-hashean en el próximo login exitoso); `/api/admin/users` crea usuarios con scrypt.
- `supabase/migrations/20260812000000_rls_owner_scoping.sql`: RLS por `owner_id = auth.uid()` en las 8 tablas de flota (anon queda sin acceso; service_role omite RLS). **NO aplicada todavía** — requiere las variables y un deploy conjunto.
- Validación: `tsc` 0, `eslint` 0, `next build` OK. Backwards-compatible hasta que se aplique la migración (sin JWT secret, el login devuelve `token: null` y todo sigue con anon).

**Pendiente para aplicar Milestone A:** 1) backup; 2) `SUPABASE_JWT_SECRET` (Dashboard → Settings → API) y `SUPABASE_SERVICE_ROLE_KEY` en Vercel + `.env.local`; 3) redeploy; 4) `supabase db push`; 5) probar login + aislamiento; 6) los usuarios con sesión previa deben cerrar/abrir sesión una vez (sus sesiones viejas no traen JWT).

**Milestone B implementado en código (pendiente de deploy y de aplicar la migración):**
- `POST /api/auth/register` (nueva): valida el token de invitación (`{ step: "validate" }` o registro completo), crea el usuario con **scrypt**, consume el token (un solo uso) y emite el JWT de sesión. El primer usuario del sistema se crea como `admin` (decidido server-side por `count === 0`); el resto como `owner`.
- `GET /api/auth/status` (nueva): sustituye `db.getUserCount()` y la creación del setup token del primer arranque (service-role).
- Las rutas de auth (`/api/auth/login`, `/api/webauthn/login`, `/api/webauthn/register`) y `getAdminClient()` ahora exigen `SUPABASE_SERVICE_ROLE_KEY` (vía `getServiceRoleClient()` en `lib/admin-server.ts`) — el anon key ya no puede leer `users`.
- `LoginPage`/`UserForm`: el registro y la validación de token pasan por las APIs (con fallback a localStorage en modo demo). `UsersSlice` usa `adminGetUsers`/`adminDeleteUser`/`adminCreateRegistrationToken`. `lib/db/users.ts` y `lib/db/tokens.ts` quedan solo-localStorage (modo demo).
- `supabase/migrations/20260812100000_rls_users_registration_tokens.sql`: cierra RLS en `users` (self-access por `auth.uid() = id`) y `registration_tokens` (sin policies; solo service_role), eliminando las policies públicas y revocando `anon`.
- Validación: `tsc` 0, `eslint` 0, `next build` OK.

**Fase 2.1 completada — sesión en cookie HttpOnly (en código, pendiente de deploy):**
- `lib/session-server.ts` (nueva): cookie `fleet_session` HttpOnly + SameSite=Lax firmada como JWT con `SUPABASE_JWT_SECRET` (set/get/clear). `lib/jwt.ts` ganó `verifyJwt` (HS256 + exp).
- Guard de admin por cookie: `requireSystemAdminFromRequest()` en `lib/admin-server.ts` reemplaza el header `x-admin-user-id`; las 3 rutas admin (`users`, `tokens`, `data`) lo usan. `lib/admin.ts` ya no envía header de identidad.
- Rutas de auth fijan la cookie: `/api/auth/login`, `/api/webauthn/login` (verify) y `/api/webauthn/register` (verify) y `/api/auth/register`.
- Nuevas rutas `GET /api/auth/me` (lee la cookie server-side y reminta JWT; invalida sesiones de usuarios desactivados) y `POST /api/auth/logout` (limpia la cookie).
- Cliente: `lib/session.ts` quedó como espejo (memoria + localStorage) con `syncSessionFromServer()`; `useDashboard` y `LoginPage` restauran la sesión vía `/api/auth/me`. El rol viene de la cookie, nunca del cliente.
- Bug corregido: el paso verify de `/api/webauthn/login` descartaba la respuesta con la cookie y retornaba un `NextResponse` nuevo — ahora retorna la respuesta construida.

**Fase 2.3 completada — rate-limit y lockout en login (en código, pendiente de deploy):**
- `lib/rate-limit.ts` (nueva): ventana deslizante en memoria, **máx 5 fallos por email+IP en 15 min**, bloqueo temporal de 15 min tras el 5º fallo, mensaje genérico (`LOGIN_LOCKED_MESSAGE`, 429 + `Retry-After`). IP desde `x-forwarded-for`/`x-real-ip`.
- Conectado en `/api/auth/login` (check antes de validar credenciales, fallo → cuenta, éxito → resetea) y en el paso `verify` de `/api/webauthn/login` (fallos de verificación cuentan, éxito resetea).
- Nota: el store es por-proceso (per-instance en serverless); suficiente para este proyecto, un store compartido (tabla Supabase/Redis) lo haría global.
- Validación: `tsc` 0, `eslint` 0, prueba empírica del limiter (5 fallos → bloqueo 900 s → reset OK).

**Milestone B (pendiente):** aplicar todo junto con Milestone A en el mismo release: migraciones `20260812000000` + `20260812100000` + código nuevo + variables (`SUPABASE_JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`) + redeploy.

---

## Fase 0 — Saneamiento y base segura (CLI, bajo riesgo)

**0.1 Backup previo.** Antes de cualquier cambio, dump de la base. Supabase tiene PITR en el dashboard; además:
```bash
# con la connection string de producción (dashboard → Project Settings → Database)
pg_dump "$DATABASE_URL" -Fc -f backup-$(date +%F).dump
```

**0.2 Reconciliar el tracking de migraciones.** Las 6 migraciones faltantes ya están aplicadas como schema (verificado en sesiones previas: tabla users con CHECK admin/owner, owner_id en drivers/vehicles, registration_tokens, rutas de admin operativas). Se registran como aplicadas para que el historial quede limpio y `db push` no falle al reintentarlas:
```bash
supabase migration repair --status applied \
  20260709000001 20260710000000 20260710000001 \
  20260806000000 20260807000000 20260807010000
supabase migration list   # verificar: todas las filas con ✓ remoto
```
*Riesgo: nulo (solo toca `supabase_migrations.schema_migrations`, no el schema). Reversible con `--status reverted`.*

**0.3 Obtener y guardar secretos.**
```bash
supabase projects api-keys --project-ref ouyszgcvesmigardlnug
```
- `SUPABASE_SERVICE_ROLE_KEY` → `.env.local` (solo server) y **Vercel** (Settings → Environment Variables). Necesaria para el panel admin y las API server-side.
- `SUPABASE_JWT_SECRET` (Dashboard → Settings → API) → server-only. Necesaria para Fase 1 (emitir JWTs firmados).
- **Regla**: ningún secreto con prefijo `NEXT_PUBLIC_` fuera del cliente.

**0.4 Workflow de migraciones a partir de ahora.**
```bash
supabase db lint            # antes de cada push
supabase db push            # aplicar al remoto
supabase migration list     # verificar estado
```
Toda migración nueva se crea en `supabase/migrations/` y se aplica con el CLI — nunca más a mano.

## Fase 1 — Seguridad de datos: RLS real (CRÍTICO)

### Decisión de arquitectura (validar con un spike de 1 día)

**Opción A (recomendada): JWT propio con claims + RLS por `auth.uid()`**
- El login (server-side) ya valida contraseña/passkey contra la tabla `users`. Tras validar, emite un **JWT HS256 firmado con `SUPABASE_JWT_SECRET`** con claims `{ sub: <user_id>, role: "authenticated", exp, iat }`.
- El cliente usa ese JWT como token en el cliente supabase-js → `auth.uid()` funciona en las policies.
- Las policies quedan: flota → `auth.uid() = owner_id`; `users` → `auth.uid() = id` (solo leerse a sí mismo); `registration_tokens` → solo service-role.
- **Ventaja**: conserva toda la arquitectura client-side actual (hooks → supabase-js), passkeys custom (simplewebauthn) intactas, refactor mínimo.
- *Spike obligatorio antes de la migración RLS*: emitir un JWT de prueba, consultar con él una policy por `auth.uid()` y confirmar que PostgREST lo acepta.

**Opción B (largo plazo): Supabase Auth real.** `signInWithPassword` + WebAuthn nativo, sesiones con cookies, policies estándar. Más robusto y estándar, pero reescribe login, sesión, passkeys (re-registro) y el panel admin. Se plantea como evolución posterior, no como paso inicial.

**Plan de migración (Opción A):**

1. **1.1** Ruta de login emite JWT: `app/api/auth/login` y `app/api/webauthn/login` → tras validar, `signJwt(userId)` con `SUPABASE_JWT_SECRET` (lib nueva `lib/jwt.ts`, server-only, con exp 24h).
2. **1.2** `lib/auth.ts`: la sesión guarda el JWT; `supabase-js` se crea con `global.headers.authorization = Bearer <jwt>` (o `supabase.auth.setSession` con el JWT custom como access_token).
3. **1.3** Migración SQL `20260811000000_rls_owner_scoping.sql`:
   - Revocar accesos anon: `REVOKE ALL ON <tablas> FROM anon;` + `GRANT` solo a `authenticated` y `service_role`.
   - Habilita RLS en las 8 tablas de flota + `users` + `registration_tokens` + `vehicle_inventories`.
   - Policies: `USING (owner_id = auth.uid())` para SELECT/INSERT/UPDATE/DELETE en flota; `users`: solo `auth.uid() = id`; `registration_tokens`: sin acceso anon.
   - **Orden crítico de deploy**: migración RLS + login con JWT en el **mismo release** — si se cierra RLS antes de que el login emita JWT, la app se rompe.
4. **1.4** Panel admin: `getAdminClient()` ya usa service-role cuando existe la env → verificar que la ruta de admin siga funcionando tras cerrar RLS (service-role bypass).
5. **1.5** Migración de datos: script idempotente que asigna `owner_id` a filas huérfanas (filas sin owner se asignan al admin del sistema).

## Fase 2 — Autenticación y sesión (ALTO)

**2.1 Sesión en cookie HttpOnly.** Reemplazar `localStorage` (`fleet_session`) por cookie `fleet_session` HttpOnly + SameSite=Lax firmada con el JWT. `getSession()` pasa a leerse server-side en las API y en layout; el rol ya no se forja desde el cliente. El guard de `/admin` (`x-admin-user-id`) se reemplaza por la cookie.

**2.2 Contraseñas robustas.**
- Nuevo `lib/password.ts`: **bcrypt** (dependencia `bcryptjs` o `bcrypt` server-only) o **argon2** (`argon2`), salt por usuario.
- `hashPassword` solo se ejecuta en el server (las rutas de registro/creación pasan a ser API routes; `UserForm` ya no hashea en cliente).
- **Migración de hashes existentes**: en el próximo login exitoso, si el hash es del esquema viejo (SHA-256), rehash a bcrypt y guardar (`upgrade-on-login`) — no requiere script masivo ni resetear contraseñas.
- **Cierre**: la tabla `users` deja de exponer hashes (RLS de Fase 1 ya lo garantiza).

**2.3 Rate limit y lockout en login.** Ventana fija en memoria (o tabla `login_attempts`): máx. 5 intentos/15 min por email+IP, bloqueo temporal; mensaje genérico de error. Suficiente para single-project; si crece, mover a Upstash Redis.

**2.4 WebAuthn hardening.** En `register`/`login`: si `NEXT_PUBLIC_RP_ID`/`RP_ORIGIN` no están definidas y no es localhost, responder 400 con instrucción clara; guardar el `rpId` usado por credencial para dar error legible al fallar por dominio. Documentar las variables en README.

## Fase 3 — Tests y CI (ALTO)

**3.1 Vitest** (devDep + script `test`):
- Lógica pura (hoy 0 cobertura): `prorateRent`, `getMondayOf`, `estimateServiceDate`, `verifyPassword`/upgrade, validación CURP, `lib/ocr.ts` (extracción de campos), `lib/db/tokens.ts`, scoping `lib/db/owner.ts`, `lib/storage` (upload paths por owner).
- **3.2 Test de integración del flujo de invitación**: crear token (API admin) → registrar owner con el enlace → token marcado usado → datos aislados entre dos owners (el bug de "se muestran datos de otros" se prueba aquí).
  - Ejecutable contra un **proyecto Supabase de staging** (nuevo, vacío) vía CLI, o contra mock de PostgREST. Nunca contra producción.
- **3.3 GitHub Actions**: `npm ci && npx tsc --noEmit && npx eslint . && npm test` en cada PR + workflow de push de migraciones a staging.

## Fase 4 — Refactor de arquitectura (MEDIO)

**4.1 Eliminar facade `db` legacy.** Migrar los usos de `db.*` (imports dinámicos) a imports directos de `lib/db/*`; borrar el objeto `db` de `lib/db/index.ts`. Buscar usos: `grep -rn "\bdb\." --include="*.tsx" --include="*.ts"` (aprox. 10 módulos × 3-5 ops).

**4.2 Dividir god components.**
- `DriversSlice` (726) → subcomponentes por sección del formulario + hook ya existente.
- `useDrivers` (675) / `useVehicles` (679) → dividir por dominio (CRUD, OCR, asignaciones, inventario).
- `Dashboard` (503) → mover el shell de navegación a `components/layout/`, tab content a sus features.
- Sin cambio de comportamiento; validar con typecheck por PR.

**4.3 Reducir la doble vía.** Con RLS + JWT (Fase 1) el modo Supabase es el único real; el camino localStorage queda solo para dev sin `.env.local`. Marcar la cola de pendientes (`mergePendingLocal`, `addPendingId`) como modo-debug y sacarla del flujo por defecto (decidir si se elimina o se conserva con tests).

## Fase 5 — Operación y documentación (BAJO)

- README con: variables requeridas (tabla con server/client), workflow de migraciones, cómo regenerar una passkey al cambiar de dominio.
- `supabase_schema.sql`: actualizar el bloque de comentarios RLS (ya no aplica "no hay auth").
- Etiquetar releases con `git tag` para correlacionar schema ↔ código.

## Orden de ejecución y riesgos

1. **Fase 0** (hoy, seguro): backup → migration repair → api-keys → envs.
2. **Spike Fase 1** (validar JWT custom) antes de escribir la migración RLS.
3. **Fase 1 + 2.1 + 2.2 en el mismo release** — el cierre de RLS y la sesión HttpOnly rompen la app si van por separado. Este release es el único de riesgo alto; probarlo en staging de Vercel primero.
4. Fases 3-5 en paralelo después, sin riesgo para producción.

**Entregables por fase**: migraciones SQL aplicadas con `supabase db push` (nunca a mano), commits atómicos por cambio, tests verdes, y el flujo de invitación verificado end-to-end en staging.

## Comandos CLI de referencia

```bash
supabase migration list                              # estado real
supabase migration repair --status applied <ids...>  # reconciliar tracking
supabase projects api-keys --project-ref ouyszgcvesmigardlnug
supabase db lint                                     # validar SQL
supabase db push                                     # aplicar migraciones
```
