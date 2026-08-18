# Fleet Control Mobile-First Management App

Sistema premium de control de flotas, mobile-first, construido con **Next.js 16 (App Router)**, **Tailwind CSS v4**, **Radix UI/Shadcn primitives** y **Supabase**.

---

## Estado actual (2026-08)

- **Auth y multi-tenant completos**: login con correo + passkey (WebAuthn) o contraseña, sesión en cookie HttpOnly firmada, roles `admin` / `owner` con RLS por `owner_id`.
- **OCR real con Gemini**: lectura de INE, licencia, tarjeta de circulación y póliza vía `POST /api/ocr` (modelo `gemini-3.5-flash-lite`), con límite de uso y parsing difuso (reparación de CURP/clave de elector).
- **Offline-first híbrido**: cada entidad se lee de Supabase y cae a `localStorage` (modo demo) si no hay credenciales o si la red falla; los cambios locales se sincronizan con cola de pendientes.
- **PWA instalable**: manifest, service worker, splash screens iOS y meta tags apple.
- **Móvil-first**: navegación inferior en teléfonos, sidebar en escritorio, safe areas iOS; auditoría de responsividad con Playwright (`_audit.mjs`).
- **Últimos cambios**: guardas de idempotencia y estados de carga visibles en todos los botones de guardar; queries del dashboard en paralelo; saneamiento de campos de chofer/auto; soporte PDF/PNG en OCR.

---

## Seguridad (estado actual)

> **2026-08:** la autenticación y el aislamiento por dueño ya están implementados.
> - **RLS habilitada** en las 8 tablas de flota (`owner_id = auth.uid()`) y cerradas `users` / `registration_tokens` al anon key.
> - Login con **correo + passkey (WebAuthn)** o **contraseña** (scrypt con salt por usuario).
> - La sesión vive en una **cookie HttpOnly firmada** (JWT HS256 con `SUPABASE_JWT_SECRET`): el cliente no puede forjar el rol.
> - **Sesión rodante**: la cookie y el espejo local expiran de forma continua a 24 h desde la última actividad.
> - **Rate-limit en login**: máx. 5 intentos por email+IP en 15 min con bloqueo temporal de 15 min. El contador global vive en la tabla `rate_limits` (compartida entre instancias serverless); sin Supabase cae a un store en memoria.
> - **Política de contraseñas**: mínimo 8 caracteres (validada en servidor y cliente desde `lib/password-policy.ts`).
> - **OCR limitado**: 20 llamadas por hora por usuario (tabla `rate_limits`); solo usuarios autenticados cuando hay `SUPABASE_JWT_SECRET`.
> - Registro, login y panel `/admin` operan server-side con la `service_role` key (omite RLS).
> - **Headers de seguridad**: CSP con nonce por petición, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy` y `Permissions-Policy` inyectados desde `proxy.ts`.
> - Sin Supabase configurado, la app corre en **modo demo** con `localStorage` (sin RLS).

---

## Slices y Arquitectura del Proyecto

Este proyecto fue desarrollado bajo una arquitectura de **Vertical Slices** y un esquema híbrido de base de datos que corre localmente con fallback automático a `localStorage` y se sincroniza con **Supabase** si las credenciales de entorno se especifican.

### Slice 1: Infraestructura y Base UI
- Configuración de dependencias base y helpers de Shadcn (`lib/utils.ts`).
- Contenedor mobile-first adaptativo con barra de navegación inferior integrada (`md:hidden`) y sidebar de escritorio (`hidden md:flex`).
- Componentes base de Radix UI (`Dialog`, `Select`, `Switch`, `Card`, `Button`, `Input`, `Label`) estilizados en conformidad estricta a la prohibición de crear componentes desde cero.
- PWA: manifest (`app/manifest.ts`), service worker (`public/sw.js`), splash screens y meta tags apple en `app/layout.tsx`.

### Slice 2: Registro de Conductores e Inteligencia OCR
- Captura digital de INE, Licencia de Conducir, fotografía del chofer y comprobante de domicilio.
- **OCR con Gemini** (server-side, `app/api/ocr/route.ts`): recibe la imagen en base64 y el tipo de documento (`INE`, `LICENCIA`, `CIRCULACION`, `SEGURO`), y devuelve un JSON estructurado.
  - Formatos soportados: JPEG, PNG, WebP, HEIC/HEIF y **PDF**; máximo 4 MB.
  - Modelo `gemini-3.5-flash-lite` con prompt estructurado (sin markdown, JSON plano).
  - *Fallback* client-side (`lib/ocr.ts`): parsing difuso con reparación de caracteres confundidos (O/0, I/1, etc.), cálculo teórico de CURP y extracción de fecha de nacimiento desde la CURP.
- **Motores de Validación Cruzada**:
  - Validación cruzada de **CURP** (la CURP leída de la INE debe coincidir exactamente con la de la licencia).
  - Validación cruzada de **Fecha de Nacimiento** (las fechas deben coincidir entre ambos documentos).
- Interruptor de **Licencia Permanente**: deshabilita avisos de renovación.
- Cámara gestionada por `components/useOcrScanner.ts` (WebRTC, timeout de 15 s, manejo de permisos y estados de progreso por paso).

### Slice 3: Inventario de Autos y Placa-Métrica de Verificación
- Formulario de captura de tarjeta de circulación, póliza de seguro (primera página + páginas adicionales), VIN/NIV, placa, clase, color, fechas de vigencia y costo de renta semanal.
- **Cronograma de Verificación Vehicular de México** integrado. Basado en el último dígito numérico de la placa, calcula dinámicamente el mes límite y color de engomado de verificación:
  - **5 o 6** (Amarillo): Feb-Mar / Ago-Sep
  - **7 o 8** (Rosa): Mar-Abr / Sep-Oct
  - **3 o 4** (Rojo): Apr-May / Oct-Nov
  - **1 o 2** (Verde): May-Jun / Nov-Dic
  - **9 o 0** (Azul): Jun-Jul / Dec-Jan
- Evidencia de verificación: foto (`verification_img`) y marca de completado (`verification_completed`).
- Alertas de vencimiento de seguro integradas directamente al subir la imagen de la póliza.
- **Inventario del vehículo** (`components/InventoryWizard.tsx`): wizard de fotos por ángulo (frente, lateral, interior, etc.) + checklist de artículos/equipamiento (gato, llanta de refacción, herramientas, etc.), persistido por vehículo.
- Estados del auto: `active` / `in_service` con fechas de retiro y regreso a servicio, y **kilometraje de próximo servicio** (`next_service_mileage`) para alertas basadas en odómetro.

### Slice 4: Bitácora de Asignación y Checklists Semanales
- Permite la asignación y retiro de autos de conductores documentando el motivo, con opción de anulación/sobreescritura por parte del administrador.
- Al completar una asignación, la app abre automáticamente el checklist del auto con el chofer ya resuelto (vehículo parcheado con `active_driver_id` — ver nota de fix en git history).
- Checklist de entrega y de inicio de semana:
  - Registro de kilometraje.
  - Registro de nivel de gasolina usando **octavos de entero** (`1/8` a `8/8`).
  - Lista de chequeo del estado del auto (Luces, llantas, frenos, carrocería, papelería).
  - Registro escrito de irregularidades con foto opcional de evidencia.
- Checklist autogenerado los lunes (`autoGenerateMondayChecklists`).

### Slice 5: Contabilidad y Balance General de Renta
- Configuración de renta estándar semanal por conductor (prorrateo si la asignación ocurre a mitad de semana; re-asignación crea la renta de la semana siguiente).
- Historial de cobros semanales con acumulación de deuda anterior y **pagos parciales** con desglose histórico de abonos (`payments_log`).
- **Pagos atómicos server-side**: los handlers usan los RPC `apply_rental_payment` / `apply_payment` / `adjust_driver_credit` (migración `20260813000020`), que calculan deuda, condonación y saldo de crédito dentro de una transacción.
- **Crédito del chofer**: si un pago excede la deuda, el sobrante se convierte en crédito aplicable a la siguiente renta.
- **Condonación por servicio**: días del auto en taller se condonan de la renta (botón de condonación por día/semana).
- Botón **Cobrar Renta** desde el modal de acciones del checklist (`ChecklistActionModal`).

### Slice 6: Registro de Taller y Consola de Alertas Unificada
- Bitácora de mantenimientos con costo, descripción y próxima fecha recomendada de servicio.
- Alertas basadas en **kilometraje**: si el auto tiene `next_service_mileage`, se alerta al acercarse/superar el umbral con fecha estimada según el promedio mensual de uso (`lib/usageStats.ts`).
- Tablero de avisos unificado: consolida alertas de licencias de conducir vencidas, seguros próximos a expirar, verificaciones vehiculares vigentes, mantenimiento programado y kilometraje.
- Registro de renovaciones (`renewal_logs`) para circulación y seguro.

---

## Rutas y API

| Ruta | Descripción |
|---|---|
| `/` | Login / Dashboard principal (tabs: Check Lists, Choferes, Autos, Usuarios) |
| `/admin` | Panel de administración externo (solo el system admin): gestión de usuarios, tokens de invitación y auditoría |
| `POST /api/auth/register` | Registro server-side con token de invitación (valida + crea usuario) |
| `POST /api/auth/login` | Login con contraseña o passkey (emite cookie HttpOnly + JWT) |
| `POST /api/auth/logout` | Cierre de sesión (limpia la cookie) |
| `GET /api/auth/me` | Re-sincroniza el espejo local con la cookie autoritativa |
| `GET /api/auth/status` | Estado de registro inicial (primer usuario / setup token) |
| `POST /api/webauthn/register` · `POST /api/webauthn/login` | Ceremonias WebAuthn (passkeys) |
| `POST /api/ocr` | OCR con Gemini (ver sección OCR) |
| `GET /api/doc?path=...` | URLs firmadas para documentos del bucket privado `documentos` |
| `POST /api/finances/payments` | Pago atómico vía RPC (por chofer o por rental) |
| `GET/POST /api/finances/credits` | Lectura/ajuste de crédito del chofer |
| `POST /api/push` · `POST /api/push/send` | Suscripción y envío de notificaciones push (VAPID) |
| `GET/POST/PATCH/DELETE /api/admin/users` | Gestión de usuarios (panel admin, service role) |
| `POST /api/admin/tokens` | Creación de tokens de invitación |
| `GET/POST /api/admin/data` | Datos de auditoría del panel admin |

La capa de datos (`lib/db/*`) expone funciones por entidad (`getDrivers`, `saveVehicle`, `createAssignment`, `saveChecklist`, `getWeeklyRentals`, `getVehicleInventory`, etc.) que siempre intentan Supabase primero y caen a `localStorage` + cola de pendientes (`lib/db/localStorage.ts`).

---

## OCR con Gemini (detalle)

1. El cliente captura el documento con la cámara (`useOcrScanner`) y envía la imagen base64 + tipo de documento a `POST /api/ocr`.
2. El servidor valida sesión (si `SUPABASE_JWT_SECRET` está definido) y el **límite de 20 llamadas/hora** por usuario.
3. Envía la imagen a `gemini-3.5-flash-lite` con un prompt estructurado que devuelve JSON plano.
4. El JSON parseado autocompleta el formulario (INE/licencia/circulación/póliza según el target).
5. Si no hay `GEMINI_API_KEY`, el endpoint responde `412` y la UI cae al parser client-side (`lib/ocr.ts`) para texto ya extraído.

> **Privacidad**: la respuesta de Gemini (CURP, INE, licencia — PII) nunca se loguea en el servidor.

---

## Móvil y Responsividad

La app es **mobile-first** con doble navegación:
- **Teléfonos (<768px)**: bottom nav con 4 tabs + logout, safe areas iOS (`env(safe-area-inset-*)`), tipografía base 16px.
- **Tablet/Desktop (≥768px)**: sidebar de iconos, tipografía 22px.
- **Paneles inline vs overlay**: los sheets (action sheet, buzón de alertas) usan `isLargeScreen` (≥1024px) para decidir entre panel lateral inline y overlay.

**Breakpoints canónicos** (Tailwind v4 default, ya en uso):

| Prefijo | Ancho | Uso previsto |
|---|---|---|
| (base) | <640px | Teléfonos: card lists, bottom nav, overlays |
| `sm` | ≥640px | Ajustes finos (hero, acciones) |
| `md` | ≥768px | Tablas vuelven a aparecer; sidebar visible; tipografía 22px |
| `lg` | ≥1024px | Desktop completo: paneles inline (buzón/action sheet) |
| `xl` | ≥1280px | Contenido `max-w-7xl` centrado |

**Estado de la auditoría móvil** (plan en `docs/superpowers/plans/2026-08-14-mobile-breakpoints.md`):
- ✅ **Fase 0 completada**: auditoría automatizada con Playwright (`_audit.mjs`) en 6 viewports (375→1440), capturas en `docs/superpowers/screens/before/` e inventario en `docs/superpowers/screens/before/INVENTORY.md`.
- ⏳ **Pendiente**: Fase 1 (consistencia de breakpoints), Fase 2 (card lists móviles para las tablas), Fases 3–6 (touch targets ≥40px, diálogos, navegación y QA).

Regla de oro: todo cambio móvil se hace con prefijos `sm:`/`md:`/`lg:` — el layout de escritorio (≥1024px) no se toca.

---

## Tooling de Auditoría (Playwright)

- `_audit.mjs` — levanta las vistas en 6 viewports, siembra sesión + datos demo en localStorage (modo demo, nunca toca Supabase), captura screenshots y mide overflow horizontal / targets <40px / tablas anchas.
- `_audit-seed.mjs` — datos demo (choferes, autos, usuarios) para sembrar la sesión.
- `_shot.mjs` — capturas ad-hoc de una vista.
- Reporte JSON en `docs/superpowers/screens/before/metrics.json`.

Uso (servidor en modo demo en el puerto 3100):

```bash
NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= \
SUPABASE_SERVICE_ROLE_KEY= SUPABASE_JWT_SECRET= npm run dev -- -p 3100
node _audit.mjs
```

---

## Ejecución Local

1. Instalar dependencias:
   ```bash
   npm install
   ```

2. Copiar las variables de entorno (ver tabla abajo) a `.env.local`:
   ```bash
   cp .env.example .env.local   # si existe; si no, crear el archivo a mano
   ```
   Con solo `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` la app corre en modo demo; con las variables server-side (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`) se activa el modo producción.

3. Ejecutar el servidor de desarrollo:
   ```bash
   npm run dev
   ```

4. Validar antes de desplegar (lo mismo que corre el CI):
   ```bash
   npm test          # suite de tests (Vitest)
   npx tsc --noEmit  # typecheck
   npx eslint .      # lint
   ```

---

## Testing y CI

- **Vitest** (`npm test`): tests unitarios en `tests/` con alias `@` y setup en `tests/setup.ts`.
  - `password-policy.test.ts` — política de contraseñas.
  - `rate-limit.test.ts` — rate limit de login (ventana, lockout, reset).
  - `jwt.test.ts` — firma/verificación del JWT de sesión.
  - `password-server.test.ts` — hash scrypt y verificación.
  - `tokens.test.ts` — tokens de invitación.
  - `storage-url.test.ts` — resolución de URLs de almacenamiento.
- **CI** (`.github/workflows/ci.yml`): en push a `main` y PRs corre `npm ci` → `tsc --noEmit` → `eslint` → `npm test` (Node 22).

---

## Variables de Entorno Requeridas

> **Regla de oro**: nunca prefijar secretos con `NEXT_PUBLIC_` (se exponen al navegador). Solo las variables marcadas como *cliente* pueden llevarlo.

| Variable | Lado | Requerida | Dónde se obtiene |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Cliente | Sí | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente | Sí | Supabase → Settings → API (publishable / anon key) |
| `SUPABASE_SERVICE_ROLE_KEY` | Servidor | Sí (prod) | `supabase projects api-keys --project-ref <ref>` o Settings → API |
| `SUPABASE_JWT_SECRET` | Servidor | Sí (prod) | Supabase → Settings → API → **JWT Secret** |
| `NEXT_PUBLIC_RP_ID` | Cliente | Solo multi-dominio | El dominio del deploy (p. ej. `fleet-control-three.vercel.app`) |
| `NEXT_PUBLIC_RP_ORIGIN` | Cliente | Solo multi-dominio | `https://<dominio>` (sin barra final) |
| `GEMINI_API_KEY` | Servidor | Solo OCR | Google AI Studio |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Cliente | Solo push | `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | Servidor | Solo push | `npx web-push generate-vapid-keys` |
| `VAPID_SUBJECT` | Servidor | Opcional | `mailto:tu@correo.com` (contacto del emisor push) |

**Dónde ponerlas**: en `.env.local` para desarrollo (archivo gitignored — nunca commitees secretos) y en **Vercel → Settings → Environment Variables** (Production) + redeploy. Con el CLI de Vercel: `vercel env add NOMBRE production`.

**Defaults que debes conocer**: `NEXT_PUBLIC_RP_ID` y `NEXT_PUBLIC_RP_ORIGIN` valen `localhost` / `http://localhost:3000` si no se definen — las passkeys se registrarían contra ese dominio.

---

## Workflow de Migraciones (Supabase CLI)

Toda migración nueva se crea como archivo SQL en `supabase/migrations/` y se aplica **con el CLI — nunca a mano** en el editor SQL del dashboard. Aplicar SQL a mano no actualiza `supabase_migrations.schema_migrations`: el CLI queda desincronizado (drift) y `db push` reintenta migraciones ya aplicadas (error de `CREATE POLICY` duplicado, etc.).

```bash
supabase link --project-ref <project-ref>   # vincular el proyecto (una vez)
supabase migration list                     # estado local vs remoto
supabase db lint                            # validar el SQL pendiente
supabase db push                            # aplicar las migraciones pendientes
```

**Recuperar el drift** (migraciones aplicadas a mano pero sin tracking):

```bash
supabase migration repair --status applied <migration-id>...
supabase migration list                     # verificar que local == remoto
```

**Orden crítico del release de seguridad**: el cierre de RLS y el código que emite el JWT van **en el mismo release**:

1. Backup de la base (PITR en el dashboard o `pg_dump`).
2. `SUPABASE_JWT_SECRET` y `SUPABASE_SERVICE_ROLE_KEY` en Vercel + `.env.local`.
3. Redeploy del código.
4. `supabase db push` (aplica las migraciones RLS).

> Si cierras RLS antes de que el deploy emita el JWT, la app deja de leer datos. Después del release, los usuarios con sesión previa deben iniciar sesión una vez (sus sesiones viejas no traen la cookie).

**Documentos e imágenes (bucket privado)**: desde la migración `20260813000010_secure_document_storage` el bucket `documentos` es **privado** y el acceso se hace por URLs firmadas de corta duración vía `GET /api/doc?path=...` (verificación de sesión + ruta bajo `{ownerId}/`). No hay URLs públicas.

**Pagos atómicos**: los handlers usan los RPC `apply_rental_payment` / `apply_payment` / `adjust_driver_credit` (migración `20260813000020`), que calculan deuda, condonación y saldo de crédito del chofer dentro de una transacción — la UI ya no hace read-modify-write.

**Notificaciones push**: el botón *Notif.* en el sidebar pide permiso y guarda la suscripción en `push_subscriptions` (migración `20260813000030`, RLS owner-scoped). Para el envío se necesitan las llaves VAPID:

```bash
npx web-push generate-vapid-keys
```

---

## Documentación adicional

El índice completo de la documentación del proyecto (planes, specs e inventarios) vive en [`docs/README.md`](docs/README.md).

---

## Passkeys y Cambio de Dominio

Las passkeys (WebAuthn) están **ligadas al dominio** donde se registraron (RP ID). Si cambias el dominio del deploy (p. ej. de `algo.vercel.app` a un dominio propio), las passkeys viejas dejan de funcionar en el nuevo — es un comportamiento intencional del navegador.

**Configurar el nuevo dominio** (en Vercel y `.env.local`):

```env
NEXT_PUBLIC_RP_ID=mi-dominio.com
NEXT_PUBLIC_RP_ORIGIN=https://mi-dominio.com
```

**Cómo regenerar una passkey tras el cambio:**

1. Inicia sesión con **correo + contraseña** en el nuevo dominio.
2. En la pantalla de login aparece el botón **"Registrar passkey para este usuario"**.
3. Regístrala: queda ligada al nuevo dominio y ya puedes entrar con huella o rostro.

Notas:
- Las credenciales viejas permanecen en la tabla `users` pero son inofensivas (no matchean el RP nuevo).
- El admin puede eliminar una passkey concreta desde el panel `/admin` (editar usuario → quitar credencial).
