# Auditoría de Navegación Móvil — iOS Focus
**Fecha:** 2026-08-18  
**Estado:** ✅ Ejecutado — 6 commits atómicos, tsc + 44/44 tests

---

## 1. Hallazgos de la Auditoría

### 🔴 Problemas Críticos (iOS)

#### 1.1 Viewport meta duplicado
**Archivo:** `app/layout.tsx`
- El archivo tiene **dos** declaraciones de viewport: `export const viewport` (Next.js API) **Y** `<meta name="viewport">` en `<head>`.
- El `export const viewport` de Next.js genera automáticamente un `<meta name="viewport">`. El tag `<head>` manual lo duplica.
- **Impacto iOS:** Puede causar que el navegador use la última declaración, ignorando `viewport-fit: cover` u otras propiedades. En iOS Safari, viewport duplicado puede causar bugs de zoom y safe area.

#### 1.2 `body { position: fixed }` bloquea scroll nativo iOS
**Archivo:** `app/globals.css` (líneas 55-68)
- `body` tiene `position: fixed; top:0; left:0; right:0; bottom:0; overflow: hidden`.
- **Impacto iOS:** 
  - Bloquea el **elastic overscroll** (bounce effect) de iOS, que los usuarios esperan.
  - Puede causar que el **teclado virtual** no scrollee la página correctamente (iOS mueve el viewport cuando un input recibe foco, pero `position: fixed` lo impide).
  - Puede causar **scroll jumping** cuando se abre/cierra el teclado.
  - `overscroll-behavior: none` ya previene pull-to-refresh; `position: fixed` es redundante y dañino.

#### 1.3 `h-screen` (100vh) no cuenta la barra de Safari
**Archivo:** `components/Dashboard.tsx` (línea 102)
- El root div usa `h-screen` (= `height: 100vh`).
- En iOS Safari, `100vh` incluye el área detrás de la barra de URL (que varía entre ~50px cuando visible y ~0px cuando oculta al hacer scroll).
- **Impacto iOS:** El layout "baila" cuando la barra de Safari aparece/desaparece. El bottom nav puede quedar oculto o el contenido se recorta.
- **Fix:** Usar `h-dvh` (dynamic viewport height) que sí sigue el viewport real. Tailwind v4 soporta `h-dvh`.

#### 1.4 Safe area inconsistente en modales/sheets
**Archivos:** `EntityActionSheet.tsx`, `ChecklistSheet.tsx`, `ChecklistActionModal.tsx`
- **Ninguno** de estos modales usa `env(safe-area-inset-*)`.
- Usan `fixed inset-0` + `max-h-[90vh]`, pero `90vh` no account safe areas.
- **Impacto iOS:** En iPhones con notch (X en adelante), el contenido del modal puede quedar detrás del notch/home indicator.
- Solo el **Buzón** (drawer) en Dashboard.tsx y el **Sidebar** usan safe areas correctamente.

#### 1.5 Bottom nav: `env()` en `style` attribute sin fallback confiable
**Archivo:** `components/Dashboard.tsx` (línea 562)
- `style={{ height: 'calc(56px + env(safe-area-inset-bottom, 0px))' }}` 
- **Problema:** El `env()` en inline style funciona, pero Tailwind no lo procesa. Si `env()` no se resuelve (p. ej., en un browser sin soporte), el fallback `0px` es correcto, pero el `calc()` podría fallar en browsers antiguos.
- **Mejor:** Usar CSS custom property definida en `globals.css` con `@supports` para fallback.

### 🟡 Problemas Medios

#### 1.6 Z-index fragmented
**Archivos:** Múltiples
- Bottom nav: `z-40`
- Backdrop overlays: `z-40`
- Modal containers: `z-50`
- Loading overlay: `z-[60]`
- Passkey dialog: `z-[90]`
- **Problema:** Si el bottom nav y un backdrop ambos tienen `z-40`, el order取决于 DOM order. El nav debería estar **siempre visible** sobre todo, pero comparte z-index con overlays que deberían taparlo.
- **Fix:** Subir nav a `z-[100]` o usar una escala consistente (nav=50, overlays=60, modales=70, toasts=80).

#### 1.7 `-webkit-overflow-scrolling` no declarado
**Archivo:** `app/globals.css`
- Los containers con `overflow-y-auto` no tienen `-webkit-overflow-scrolling: touch`.
- **Impacto iOS < 13:** Scroll interno no es " momentum scrolling" (lento y sin inertia).
- **Nota:** En iOS 13+ esto ya no es necesario (es el default), pero no hace daño declararlo.

#### 1.8 `overscroll-behavior: none` en body impide scroll chaining natural
**Archivo:** `app/globals.css` (línea 59)
- `overscroll-behavior: none` en body bloquea el overscroll chaining.
- **Problema:** Cuando el usuario scrollea al fondo del contenido y sigue scrolleando, en vez de hacer bounce, simplemente no pasa nada. Esto es intencional (evita pull-to-refresh), pero puede confundir usuarios iOS que esperan el bounce.
- **Fix alternativo:** Usar `overscroll-behavior-y: contain` en el `<main>` (container de scroll) en vez de `none` en body. Así el bounce ocurre dentro del scroll container, no a nivel de página.

### 🟢 Solucionado / OK

- ✅ Bottom nav `position: fixed` con safe area (commit `8d2e975`)
- ✅ Main padding `pb-[calc(56px+env(...))]` account nav height
- ✅ Touch targets ≥44px en móvil (< 768px)
- ✅ Cards reemplazan tablas en móvil
- ✅ `viewport-fit: cover` en viewport export
- ✅ Buzón drawer con safe area insets
- ✅ Sidebar con safe area top

---

## 2. Plan de Implementación

### T1: Viewport meta duplicado ✅
**Commit:** `d87567a`
- Eliminado `<meta name="viewport">` manual de `<head>`.
- Next.js `export const viewport` genera el tag automáticamente.

### T2: Quitar `position: fixed` del body ✅
**Commit:** `e00500e`
- Eliminado `position: fixed; top:0; left:0; right:0; bottom:0;` de `html, body`.
- Cambiado `overscroll-behavior: none` a `contain` (bounce interno funciona, pull-to-refresh prevenido).
- El root div con `h-dvh + overflow-hidden` es suficiente.

### T3: Cambiar `h-screen` → `h-dvh` ✅
**Commit:** `30bba37`
- `h-screen` → `h-dvh` en Dashboard root div y app/page.tsx loading state.
- Tailwind v4 genera fallback a `100vh` automáticamente.

### T4: Safe areas en modales ✅
**Commit:** `f04809b`
- Nueva clase CSS `.modal-safe-area` en `globals.css`.
- Aplicada a: EntityActionSheet, ChecklistSheet, ChecklistActionModal, PasskeyRegistrationDialog.

### T5: Z-index consistente ✅
**Commit:** `60a1f1b`
- CSS custom properties: `--z-sidebar:30, --z-nav:40, --z-overlay:50, --z-modal:60, --z-loading:70, --z-toast:80`.
- Actualizados10 archivos: Dashboard, Sidebar, DriversSlice, EntityActionSheet, ChecklistSheet, ChecklistActionModal, confirm-dialog, PasskeyRegistrationDialog.

### T6: Overscroll chaining mejorado ✅
**Commits:** `e00500e` (body) + `30bba37` (scroll containers)
- Body: `overscroll-behavior: contain` (bounce funciona, pull-to-refresh prevenido).
- Main scroll containers: `overscroll-contain` en dashboard cards y other tabs.

---

## 3. Commits Atómicos

1. `d87567a` — T1: viewport meta duplicado
2. `e00500e` — T2: body position:fixed + overscroll
3. `30bba37` — T3: h-dvh + scroll containers
4. `f04809b` — T4: safe areas en modales
5. `60a1f1b` — T5: z-index unificado

Todos verificados: `tsc` 0 errores, 44/44 tests.

---

## 4. Verificación Final

Después de todos los tasks:
1. `npx tsc --noEmit` — 0 errores
2. `npm test` — 44/44 tests pasan
3. `node _qa.mjs` — 83/83 checks pasan
4. Prueba manual en iPhone real:
   - Login → scroll → teclado → navegar tabs → abrir buzón → abrir modal → cerrar → scroll al fondo
   - Verificar: bottom nav siempre visible, sin overlap, sin jump, bounce funciona
