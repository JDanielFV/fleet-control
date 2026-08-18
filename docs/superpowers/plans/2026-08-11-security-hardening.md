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

## Estado de ejecución (2026-08-18)

> El plan está **implementado y desplegado**. Los únicos pendientes son refinamientos de arquitectura (Fase 4.2/4.3) y el trabajo móvil, que vive en su propio plan (`2026-08-14-mobile-breakpoints.md`).

| Fase | Estado | Notas |
|---|---|---|
| Fase 0 — Saneamiento y base segura | ✅ Completada | `migration repair` → 8/8 migraciones registradas; secretos en Vercel + `.env.local`. |
| Fase 1 — RLS real | ✅ Desplegada | Migraciones `20260812000000` + `20260812100000` (+ fixup `20260813000000`) aplicadas; JWT custom emitido en login/passkey/registro; policies `owner_id = auth.uid()` y `users`/`registration_tokens` cerradas. |
| Fase 2.1 — Cookie HttpOnly | ✅ Desplegada | `fleet_session` HttpOnly firmada; `GET /api/auth/me` y `POST /api/auth/logout`; espejo local (`lib/session.ts`) no autoritativo, `syncSessionFromServer()` corrige rol/cuenta desactivada. |
| Fase 2.2 — Contraseñas | ✅ Desplegada | **scrypt** con salt por usuario (se eligió scrypt/Web Crypto sobre bcrypt/argon2 del plan) + `upgrade-on-login`; política mín. 8 caracteres en `lib/password-policy.ts`. |
| Fase 2.3 — Rate limit | ✅ Desplegada | 5 intentos/15 min por email+IP con lockout de 15 min; el store ahora es **compartido** en la tabla `rate_limits` (global entre instancias serverless) con fallback en memoria. |
| Fase 2.4 — WebAuthn hardening | ✅ Documentada | `NEXT_PUBLIC_RP_ID`/`NEXT_PUBLIC_RP_ORIGIN` explícitas (commit `4d980a3`); pasos de regeneración de passkey en README. |
| Fase 3 — Tests y CI | ✅ Completada | Vitest (`tests/`: password-policy, rate-limit, jwt, password-server, tokens, storage-url) + CI en `.github/workflows/ci.yml` (`npm ci` → tsc → eslint → test). |
| Fase 4.1 — Eliminar facade `db` | ✅ Completada | `lib/db/index.ts` solo re-exporta módulos; todos los componentes importan funciones directas (`saveChecklist`, `getVehicles`, …). |
| Fase 4.2 — Dividir god components | 🟡 Parcial | `DriversSlice` 726→318 líneas (split, commit `a5c19b9`); `useDrivers` (~700) / `useVehicles` (~670) y `Dashboard` (526) siguen grandes. |
| Fase 4.3 — Reducir doble vía | 🟡 Por diseño | El camino `localStorage` se conserva como **modo demo** (sin `.env.local`); la cola de pendientes sigue activa para sincronizar cambios offline. |
| Fase 5 — Operación y documentación | ✅ Completada | README actualizado (variables, migraciones, passkeys, OCR, móvil); `git tag` por release pendiente de adoptar. |

**Trabajo posterior al plan (08-13 → 08-17):**
- `20260813000010_secure_document_storage`: bucket `documentos` privado + URLs firmadas vía `GET /api/doc?path=...`.
- `20260813000020_integrity_and_credits`: RPC `apply_rental_payment` / `apply_payment` / `adjust_driver_credit` (pagos atómicos, crédito del chofer).
- `20260813000030_push_subscriptions`: notificaciones push (VAPID).
- OCR con Gemini (`gemini-3.5-flash-lite`, PDF/PNG, límite 20/hora) — ver README.
- Auditoría móvil Playwright (`_audit.mjs`) + plan `2026-08-14-mobile-breakpoints.md`.
- Guardas de idempotencia en botones de guardar; queries del dashboard en paralelo; saneamiento de campos de chofer/auto.

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
