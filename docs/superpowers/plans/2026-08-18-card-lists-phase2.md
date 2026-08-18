# Plan: Fase 2 — Card lists móviles para las tablas de datos

Fecha: 2026-08-18
Base: plan maestro `2026-08-14-mobile-breakpoints.md` (Fase 2), auditoría Fase 0 (P1: tablas con scroll horizontal en <1024px), y Fase 1 ya ejecutada (`2026-08-18-breakpoints-phase1.md`).

## Objetivo

En **<768px**, reemplazar el scroll horizontal de las tablas por **listas de cards** que muestren los datos clave + acciones táctiles (≥44px). En **≥768px** la tabla queda **byte-idéntica** (regla de oro del plan maestro: capas móviles con prefijos, nunca tocar desktop).

## Patrón (un slice por commit)

1. Contenedor de la tabla: `w-full overflow-x-auto pb-6` → `**hidden md:block** w-full overflow-x-auto pb-6` (se oculta solo en <768px; desktop sin cambios).
2. Bloque hermano `**md:hidden**` con la misma data renderizada como cards `MobileCard`.
3. **Derivación duplicada** en el bloque de cards (no refactorizar el map de la tabla → cero riesgo para desktop). Solo se extrae a scope de módulo lo que es puro y compartido (p. ej. `getRowStatus` en Dashboard).
4. Card: `rounded-2xl border border-border/60 bg-card p-3.5 space-y-2.5` + `border-l-4` de estado.
   - Header: nombre/placa `text-base font-extrabold` + badge de estado.
   - Filas: pares `label uppercase 10px muted` + `value` (mismo patrón de las filas expandidas).
   - Acciones: `grid grid-cols-2 gap-2` (o full-width) con `py-3.5` (target ≥44px), icono + **texto visible**.
5. Tap de card → misma acción que el row (Dashboard: `openActionModal`; slices: toggle de detalles).

## Componente compartido

`components/ui/MobileCard.tsx` — slots `header`, `rows`, `actions`, `children` (expandido), `statusClass`, `onClick`. Se usa en los 3 slices (el patrón se repite 3+ veces, justifica el componente).

## Tareas y commits

1. **`feat(ui): add MobileCard component`** — componente base.
2. **`feat(dashboard): mobile card list for checklists table`** — cards del dashboard (tap → `openActionModal`, botón "Ver estadísticas").
3. **`feat(vehicles): mobile card list for vehicles table`** — cards de autos (tap → toggle detalles + info compacta; acciones Asignar/Editar/Eliminar).
4. **`feat(drivers): mobile card list for drivers table`** — cards de choferes (tap → toggle detalles + info compacta; acciones Asignar/Renovar/Exportar/Editar/Eliminar).
5. **Verificación**: `tsc`, `eslint`, `npm test`, y capturas `_audit.mjs` en 375/430 (cards, cero scroll horizontal) + 1024/1440 (tablas idénticas a la línea base).

## Decisión de diseño (expansión en slices)

En móvil, el tap en la card de auto/chofer expande una **sección compacta** (los pares clave ya derivados: estado, engomado, servicios, renta / datos del documento). Los documentos con imágenes y el historial completo quedan para desktop (y accesibles vía el action sheet en móvil) — se documenta como simplificación móvil deliberada, revisable en un refinamiento posterior de Fase 2.

## Checklist de aceptación

- [x] En 375–430px: cards sin scroll horizontal en las 3 vistas; targets ≥44px con texto visible.
- [x] En ≥768px: tablas renderizando idéntico a la línea base (misma derivación, solo data nueva en el bloque `md:hidden`).
- [x] `tsc`, `eslint` (sin errores nuevos) y `npm test` verdes.

## Resultados de ejecución (2026-08-18)

**Métricas de la auditoría (`_audit.mjs`), antes → después:**

| Vista | 375px | 390px | 430px |
|---|---|---|---|
| Check Lists | tabla 672px/9col + 6 targets<40 → **cards OK, 0 overflow** | ✅ | ✅ |
| Choferes | tabla 723px/7col + 32 targets<40 → **cards OK, 2 targets<40** | ✅ | ✅ |
| Autos | tabla 417px/5col + 22 targets<40 → **cards OK, 2 targets<40** | ✅ | ✅ |

Los 2 targets restantes en choferes/autos son el input de búsqueda (~20px) y el toggle Archivo — se abordan en Fase 3.

**Desktop ≥1024px sin cambios**: `checklists` **0 px** de diff; `drivers` 0–8 px (ruido); `vehicles`/`users` difieren solo por **ruido del harness** (control: dos runs con el mismo código difieren en el mismo orden, 5651 vs 5649 px; UsersSlice no fue tocado). `tsc` 0 errores, `npm test` 44/44.

**Commits**: 1) `feat(ui)` MobileCard, 2) `feat(dashboard)`, 3) `feat(vehicles)`, 4) `feat(drivers)`.

**Nota**: las capturas de los 6 viewports no se commitearon (la línea base oficial sigue siendo la de `screens/before/`); la evidencia queda en este documento y re-ejecutable con `_audit.mjs`.
