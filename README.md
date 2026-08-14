# Fleet Control Mobile-First Management App

This is a premium, mobile-first management system built with **Next.js 16 (App Router)**, **Tailwind CSS v4**, **Radix UI/Shadcn primitives**, and **Supabase**.

---

## Seguridad (estado actual)

> **2026-08:** la autenticación y el aislamiento por dueño ya están implementados.
> - **RLS habilitada** en las 8 tablas de flota (`owner_id = auth.uid()`) y cerradas `users` / `registration_tokens` al anon key.
> - Login con **correo + passkey (WebAuthn)** o **contraseña** (scrypt con salt por usuario).
> - La sesión vive en una **cookie HttpOnly firmada** (JWT HS256 con `SUPABASE_JWT_SECRET`): el cliente no puede forjar el rol.
> - **Rate-limit** en login: máx. 5 intentos por email+IP en 15 min con bloqueo temporal.
> - Registro, login y panel `/admin` operan server-side con la `service_role` key (omite RLS).
> - Sin Supabase configurado, la app corre en **modo demo** con `localStorage` (sin RLS).

---

## Slices y Arquitectura del Proyecto

Este proyecto fue desarrollado bajo una arquitectura de **Vertical Slices** y un esquema híbrido de base de datos que corre localmente con fallback automático a `localStorage` y se sincroniza con **Supabase** si las credenciales de entorno se especifican.

### Slice 1: Infraestructura y Base UI
- Configuración de dependencias base y helpers de Shadcn (`lib/utils.ts`).
- Contenedor mobile-first adaptativo con barra de navegación inferior integrada.
- Componentes base de Radix UI (`Dialog`, `Select`, `Switch`, `Card`, `Button`, `Input`, `Label`) estilizados en conformidad estricta a la prohibición de crear componentes desde cero.

### Slice 2: Registro de Conductores e Inteligencia OCR
- Captura digital de INE y Licencia de Conducir.
- **Motores de Validación Cruzada**:
  - Validación cruzada de **CURP** (la CURP leída de la INE debe coincidir exactamente con la de la licencia).
  - Validación cruzada de **Fecha de Nacimiento** (las fechas deben coincidir entre ambos documentos).
- Interruptor de **Licencia Permanente**: deshabilita avisos de renovación.
- Simulación OCR que procesa campos críticos y genera avisos en caso de discrepancias detectadas.

### Slice 3: Inventario de Autos y Placa-Métrica de Verificación
- Formulario de captura de tarjeta de circulación y póliza de seguro.
- **Cronograma de Verificación Vehicular de México** integrado. Basado en el último dígito numérico de la placa, calcula dinámicamente el mes límite y color de engomado de verificación:
  - **5 o 6** (Amarillo): Feb-Mar / Ago-Sep
  - **7 o 8** (Rosa): Mar-Abr / Sep-Oct
  - **3 o 4** (Rojo): Apr-May / Oct-Nov
  - **1 o 2** (Verde): May-Jun / Nov-Dic
  - **9 o 0** (Azul): Jun-Jul / Dec-Jan
- Alertas de vencimiento de seguro integradas directamente al subir la imagen de la póliza.

### Slice 4: Bitácora de Asignación y Checklists Semanales
- Permite la asignación y retiro de autos de conductores documentando el motivo, con opción de anulación/sobreescritura por parte del administrador.
- Checklist de entrega y de inicio de semana:
  - Registro de kilometraje.
  - Registro de nivel de gasolina usando **octavos de entero** (`1/8` a `8/8`).
  - Lista de chequeo del estado del auto (Luces, llantas, frenos, carrocería, papelería).
  - Registro escrito de irregularidades.

### Slice 5: Contabilidad y Balance General de Renta
- Configuración de renta estándar semanal por conductor.
- Historial de cobros semanales con acumulación de deuda anterior.
- Soporte para pagos parciales con cálculo en tiempo real de deuda acumulada y desglose histórico de abonos.

### Slice 6: Registro de Taller y Consola de Alertas Unificada
- Bitácora de mantenimientos con costo, descripción y próxima fecha recomendada de servicio.
- Tablero de avisos unificado: consolida alertas de licencias de conducir vencidas, seguros próximos a expirar, verificaciones vehiculares vigentes y mantenimiento programado.

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
