# Plan: Fase 1 — Consistencia de breakpoints (sin tocar desktop)

Fecha: 2026-08-18
Base: auditoría estática del código actual (archivos con `md:`/`lg:` y el check JS `isLargeScreen`), sobre el plan maestro `2026-08-14-mobile-breakpoints.md`.

## Objetivo

Unificar los puntos de corte de la app en dos niveles canónicos y **dejar el layout de escritorio (≥1024px) pixel-idéntico**. Esta fase no introduce card lists ni targets nuevos (eso es Fase 2/3) — solo consistencia + verificación.

## Estado real detectado (2026-08-18)

| Elemento | Breakpoint | Dónde | Consistente |
|---|---|---|---|
| Sidebar (navegación) | `md` 768px | `components/Sidebar.tsx:37` → `hidden md:flex md:w-24` | ✅ |
| Bottom nav | `md` 768px | `components/Dashboard.tsx:502` → `md:hidden` | ✅ |
| Botón buzón móvil | `md` 768px | `components/Dashboard.tsx:110` → `md:hidden` | ✅ |
| Tipografía base | `md` 768px | `app/globals.css` → `@media (min-width: 768px) { font-size: 22px }` | ✅ |
| Panel inline buzón/actions (aside) | `lg` 1024px | `components/Dashboard.tsx:229` → `hidden lg:flex lg:w-[400px] xl:w-[440px]` | ✅ |
| Gate JS inline-vs-overlay | 1024px | `useDashboard` (`isLargeScreen`, `window.innerWidth >= 1024`) + `Dashboard.tsx:228,287` | ✅ (coincide con `lg`) |

**Conclusión**: los dos cortes ya son coherentes entre CSS y JS. La única "inconsistencia" real es la **decisión de producto** sobre el rango 768–1024 (tablet), que hoy es híbrido: sidebar visible + sin bottom nav + paneles en overlay.

## Decisión de diseño (Fase 1)

- `md` (768px) = **tablet**: sidebar visible, bottom nav oculto, overlays para buzón/action sheet.
- `lg` (1024px) = **desktop completo**: paneles inline en el aside derecho.
- El rango 768–1024 **se conserva híbrido por diseño** (ya es el comportamiento actual; los overlays de `!isLargeScreen` cubren bien ese rango). **No hay cambio de breakpoints en esta fase.**
- Regla de oro (heredada del plan maestro): todo cambio de UI usa prefijos `sm:`/`md:`/`lg:`; el código de escritorio ≥1024 no se altera visualmente.

## Tareas

### T1 — Documentar la decisión (✅ ya hecho)

La sección **"Móvil y Responsividad"** del `README.md` ya documenta la navegación dual, la tabla de breakpoints canónicos y el estado de la auditoría (commit `8533e66`). Este plan fija la *decisión* 768–1024 híbrido para el registro.

### T2 — Un solo source of truth para el panel inline (refactor no-op, diff visual 0)

**Problema**: el aside derecho está doble-gateado: `ctx.isLargeScreen && (buzón || actionSheet)` (JS, `Dashboard.tsx:228`) **y** `hidden lg:flex` (CSS, `Dashboard.tsx:229`). Ambas condiciones usan 1024px, así que hoy son equivalentes — pero son dos fuentes de verdad y el proyecto define `isLargeScreen` como el único uso JS justificado para *panel inline vs overlay* (principio 3 del plan maestro).

**Cambio** (`components/Dashboard.tsx`, 1 línea — se quita solo `hidden`, se conserva `lg:flex` que es quien da `display:flex`):
```diff
-          <aside className="hidden lg:flex lg:w-[400px] xl:w-[440px] shrink-0 border-l border-border bg-card/30 h-full flex-col overflow-hidden">
+          <aside className="lg:flex lg:w-[400px] xl:w-[440px] shrink-0 border-l border-border bg-card/30 h-full flex-col overflow-hidden">
```

- **Por qué es seguro**: a <1024px `isLargeScreen` es `false` → el aside nunca se renderiza (igual que hoy con `hidden`); a ≥1024px ambas condiciones coinciden y `lg:flex` mantiene el `display:flex`. El ancho `lg:w-[400px] xl:w-[440px]` se conserva.
- **Nota**: aunque el elemento se renderiza solo en ≥1024px, es un refactor sobre "desktop" — se incluye porque es no-op visual. La verificación de T5 (diff de screenshots) es la puerta de salida.
- ~~*(Opcional)* inicializar `isLargeScreen` desde `window.innerWidth`~~ **descartado**: el initializer de `useState` corre también en SSR y en hidratación → divergencia `false`/`true` en desktop = hydration mismatch. El patrón actual (estado `false` + efecto) es el correcto.

**✅ Completado (2026-08-18)** — verificación en T5: diff visual 0 (ruido de antialiasing ≤66 px de ~786k, mismo orden entre runs sin cambios; `checklists` 0 px; `metrics.json` idéntico).

### T3 — Auditar anchos `rem` y `px` con la tipografía de 22px (verificación, sin cambios salvo bug)

La base 22px en `md`+ escala los anchos en `rem` (no los `px` fijos). Inventario a revisar en ≥1024px:

| Utilidad | Valor @16px | Valor @22px | Riesgo |
|---|---|---|---|
| `DialogContent` base `max-w-lg` (`ui/dialog.tsx:37`) | 512px | **704px** | Centrado en overlay `fixed inset-0` → cabe en ≥1024. OK, verificar visual. |
| `max-w-md` (diálogos de formularios) | 448px | **616px** | Ídem. OK. |
| `max-w-sm` (confirm/checklist action modal) | 384px | **528px** | Ídem. OK. |
| `w-64` (popovers pago/condonación, `DriversSlice.tsx:261,282`) | 256px | **352px** | Angosto en móvil (defecto P4 conocido) pero **no rompe** en desktop. ✅ **Fix aplicado en Fase 4** (2026-08-18): `w-full max-w-xs mx-4 sm:w-64 sm:max-w-none sm:mx-0`. |
| `lg:w-[400px] xl:w-[440px]` (aside) | fijo px | fijo px | Contenido `text-xs` (16.5px @22px) cabe. OK. |
| `sm:w-[440px]` (drawer buzón móvil) | fijo px | fijo px | Solo <1024px. OK. |
| `max-w-[240px]`/`max-w-[260px]` (empty state) | fijo px | fijo px | OK. |

**Entregable**: lista verificada en T5 con capturas 1024/1440 (antes/después). **No se toca código** salvo que la captura muestre un desbordamiento real (no esperado).

### T4 — Extender `_audit.mjs` con el rango híbrido (tooling, no toca la app)

El harness captura hoy `375/390/430/768/1024/1440` (`_audit.mjs` → `VIEWPORTS`). Los bordes 768 y 1024 existen, pero el **interior del rango híbrido** (ej. 800, 900) no tiene línea base — justo donde conviven sidebar + overlays.

**Cambio** (tooling):
```diff
  const VIEWPORTS = [
    { width: 375, height: 667, mobile: true },
    { width: 390, height: 844, mobile: true },
    { width: 430, height: 932, mobile: true },
    { width: 768, height: 1024, mobile: true },
+   { width: 800, height: 900, mobile: true },
+   { width: 900, height: 900, mobile: false },
    { width: 1024, height: 768, mobile: false },
    { width: 1440, height: 900, mobile: false },
  ];
```
*(los `deviceScaleFactor`/`hasTouch` ya derivan de `mobile`)*

**Aceptación**: `node _audit.mjs` (modo demo en `-p 3100`) genera `screens/before/{800,900}/` con la línea base del híbrido.

**✅ Completado (2026-08-18)** — `800/` y `900/` generados; `metrics.json` actualizado con los 8 viewports. Requisito previo encontrado en ejecución: `npx playwright install chromium` (faltaba el binario en la caché). Los screenshots de los 6 viewports previos se regeneraron pero **no se commitearon** (solo ruido de fecha/antialiasing); la línea base oficial de esos viewports sigue siendo la de 2026-08-14.

### T5 — Verificación de la fase

1. `npx tsc --noEmit && npx eslint . && npm test` — verdes (no hay lógica nueva, pero se corre igual).
2. Ejecutar `_audit.mjs` **antes** de T2 y **después** (misma semilla) y comparar:
   - `metrics.json` idéntico (o solo con los viewports nuevos).
   - Screenshots 1024/1440 idénticos en las 4 tabs (diff visual 0).
   - 800/900: sidebar visible + overlays correctos (buzón/action sheet como modal/slide-in).
3. QA manual rápido en 800 y 900: abrir buzón y action sheet → deben verse como overlay, no como panel lateral.

**✅ Completado (2026-08-18)**:
- `tsc` 0 errores; `npm test` 44/44 ✅.
- `eslint`: **1 error preexistente** en `features/drivers/hooks/useDrivers.ts:582` (`react-hooks/preserve-manual-memoization` — React Compiler no conserva un `useMemo` manual; archivo no tocado en esta fase) + 11 warnings preexistentes. Fuera de alcance; fix opcional en commit aparte.
- Diff visual T2: `checklists` **0 px**; drivers/users/vehicles **0–66 px** (ruido de antialiasing de subpíxel: mismo orden entre runs sin cambios de código, regiones dispersas en filas de texto). `metrics.json` **idéntico** entre runs en los viewports compartidos → estructura de layout sin cambios.
- Rango híbrido confirmado en las capturas 800/900 (sidebar visible + overlays).

## Orden de commits atómicos

1. `chore(audit): capture hybrid tablet range in breakpoint audit` — T4 (tooling + línea base 800/900 + metrics.json). ✅ hecho
2. `refactor(dashboard): single source of truth for inline panel breakpoint` — T2 (no-op visual verificado por T5). ✅ hecho
3. *(si aplica)* fix de algún ancho roto detectado en T3 — commit aparte con captura antes/después. (T3: ninguno roto; `w-64` diferido a Fase 4.)

## Riesgos

- **Doble fuente de verdad** (JS + CSS) en el aside: T2 la elimina; si se omite T2, el riesgo persiste pero es benigno (ambas condiciones coinciden hoy).
- **`rem` en media queries vs propiedades**: los breakpoints de Tailwind v4 se evalúan con el font-size inicial (16px) → `lg` = 1024px real siempre. Los anchos `rem` en *propiedades* (max-w-*) sí escalan a 22px — verificado en T3, no es un bug, es la estética desktop actual.
- **Regresión visual en 768–1024**: imposible por construcción (T2 no cambia nada <1024px; T4 solo añade capturas). La única vía de regresión es en ≥1024 y queda cubierta por el diff de screenshots.

## Checklist de aceptación (definición de hecho)

- [x] Breakpoints documentados en README (T1) y la decisión 768–1024 híbrido registrada en este plan.
- [x] `_audit.mjs` captura 800/900 con línea base (T4).
- [x] Screenshots 1024/1440 sin cambios visuales antes/después de T2 (diff ≤ ruido de antialiasing, `metrics.json` idéntico).
- [x] `tsc` y `npm test` verdes; `eslint` con 1 error **preexistente** no relacionado (useDrivers.ts).
- [x] Sin cambios en la UI de escritorio ≥1024px (refactor no-op verificado).

**Pendiente fuera de esta fase**: fix del error de eslint en `useDrivers.ts:582` (opcional) y QA manual de buzón/action sheet en 800/900 (se puede cubrir con el Preview al levantar dev).
