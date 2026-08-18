# Plan: Breakpoints y vistas móviles — fleet-control

Fecha: 2026-08-14
Base: auditoría de responsividad del código actual (Dashboard, slices, dialogs, globals.css)

## Contexto / estado real detectado

La app **no está 100% en escritorio**: ya existe un andamiaje móvil considerable que conviene conocer antes de planear, para no duplicar trabajo:

- **Navegación dual**: `Sidebar` (rail de iconos) es `hidden md:flex` → solo escritorio; en móvil hay **bottom nav** (`md:hidden`) con 4 tabs + logout en `Dashboard`.
- **Sheets adaptativos**: `EntityActionSheet` y el buzón de alertas se muestran como **modal centrado / slide-in** en móvil y como **panel lateral inline** en desktop (vía `isLargeScreen`, ≥1024px).
- **Safe areas iOS**: `env(safe-area-inset-*)` en `.glass-header`, `.glass-nav`, main y bottom nav; splash screens y meta PWA en `layout.tsx`.
- **Tipografía escalada**: `html, body` 16px en móvil y 22px en `@media (min-width: 768px)` (globals.css).
- **Formularios responsive**: `DriverFormDialog` y los formularios de `VehiclesSlice` ya colapsan con `grid-cols-1 md:grid-cols-2`.
- **Diálogos**: `DialogContent` base es `w-full max-w-lg max-h-[90vh]` centrado con padding `p-4` externo.
- **Login**: `LoginPage`/`LoginScreen` ya son `max-w-sm` centrados — OK en móvil.

**Conclusión**: el gap no es "no hay móvil", es que las **vistas de datos siguen siendo tablas de escritorio** con scroll horizontal, los **touch targets son pequeños** y hay **inconsistencias de breakpoint** entre CSS y JS.

## Defectos a resolver

| # | Severidad | Defecto | Ubicación |
|---|---|---|---|
| 1 | ALTO | Tablas anchas (7–9 columnas) con scroll horizontal; sin card list en móvil | `Dashboard` (tabla checklists), `DriversSlice`, `VehiclesSlice`, `UsersSlice`, `app/admin/components/UsersTab.tsx`, `AuditTab.tsx` |
| 2 | ALTO | Touch targets pequeños: botones `h-7`/`h-9`, iconos `w-3 h-3`, texto `10px` (mínimo recomendado 40–44px) | filas de acciones en `DriversSlice`/`VehiclesSlice`, chips de acciones |
| 3 | MEDIO | Inconsistencia de breakpoints: nav/sidebar cambian en `md` (768px) pero paneles inline usan `isLargeScreen` (1024px); tablet 768–1024 queda en modo híbrido | `Sidebar`, `Dashboard`, `useDashboard` |
| 4 | MEDIO | Diálogos custom con ancho fijo `w-64` (angostos en móvil) | condonación/pago en `DriversSlice` |
| 5 | MEDIO | `SliceHeader` con `text-[26px]` + botón "Registrar" puede saturarse en pantallas <360px | `SliceHeader`, slices |
| 6 | MEDIO | Quick actions de la búsqueda del Dashboard hacen wrap desordenado en móvil | `Dashboard` (search bar) |
| 7 | BAJO | Sin método de verificación de layout (no hay E2E de viewports) | — |

## Principios (la regla de oro)

1. **Todo cambio se hace agregando capas móviles**: clases con prefijos `sm:`/`md:`/`lg:` y elementos `md:hidden` / `hidden md:*`. **Nada de tocar el layout de escritorio (≥1024px)** — la estética actual queda intacta por construcción.
2. **Mobile-first**: las reglas base son móvil y se refinan con prefijos, nunca al revés. Esto ya es el estilo del proyecto.
3. **CSS antes que JS**: no usar `useMediaQuery` ni listeners de resize donde clases responsivas alcanzan (evita FOUC y doble render). El único uso JS justificado sigue siendo `isLargeScreen` para decidir *panel inline vs overlay*.
4. **Reutilizar tokens existentes**: `glass`, `elevation-*`, `text-*`, `bg-card`, `border-border` — las cards móviles deben verse como parte del mismo sistema, no como una UI nueva.

## Breakpoints canónicos (Tailwind v4 default, ya en uso)

| Prefijo | Ancho | Uso previsto |
|---|---|---|
| (base) | <640px | Teléfonos: card lists, bottom nav, overlays |
| `sm` | ≥640px | Ajustes finos (hero, acciones) |
| `md` | ≥768px | Tablas vuelven a aparecer; sidebar visible; tipografía 22px |
| `lg` | ≥1024px | Desktop completo: paneles inline (buzón/action sheet) |
| `xl` | ≥1280px | Contenido `max-w-7xl` centrado |

> **Decisión a tomar (Fase 1)**: hoy la navegación cambia en `md` pero los paneles inline en `lg`. Propuesta: dejar `md` como "tablet" (sidebar + bottom nav oculto) y `lg` como "desktop completo" — así tablet 768–1024 usa overlays (ya implementados) en vez del panel lateral. No cambia nada en ≥1024px.

## Estado de ejecución (2026-08-14)

**Fase 0 completada** — auditoría automatizada con Playwright en modo demo (localStorage, sin Supabase) con datos sembrados; capturas en `docs/superpowers/screens/before/` y **inventario en `docs/superpowers/screens/before/INVENTORY.md`**.

Hallazgos confirmados con métricas:
- Tablas con scroll horizontal en <1024px: checklists **672px/9col** en teléfonos y **807px** en tablet; choferes **723px/7col** (941px en tablet); autos **417px/5col** (solo <430px). Usuarios OK.
- Targets <40px: **6** en dashboard (botones 28–30px, input 16px), **32** en choferes y **22** en autos (botones de acción 36×36), tabs de login 32px.
- Barra de búsqueda del dashboard se envuelve a **70px** en móvil (66px desktop).
- Desktop ≥1024px: sin incidencias → confirma que la regla de no tocar escritorio es viable.
- Tooling: se añadió `playwright` como devDependency (el repo ya tenía `_shot.mjs` que lo importaba); script reutilizable `_audit.mjs` + `_audit-seed.mjs`.

**Avance (2026-08-18)**:
- **Fase 1 ✅ ejecutada** — ver `2026-08-18-breakpoints-phase1.md` (breakpoints documentados, single source of truth del panel inline, viewports 800/900 en el harness, diff visual 0 en desktop).
- **Fase 2 ✅ ejecutada** — ver `2026-08-18-card-lists-phase2.md` (card lists en dashboard/choferes/autos; cero scroll horizontal en 375–430px).
- **Fase 3 ✅ ejecutada** — touch targets ≥44px en móvil (inputs de búsqueda, toggle Archivo, quick actions, Export/buzón, tabs del login): `targets<40 = 0` en todas las vistas 375/390/430px.

**Siguiente**: Fase 4 (diálogos y overlays móviles: `w-64` de pago/condonación, padding de `DialogContent` en <400px) y Fase 5 (pulido de navegación móvil).

## Fases

### Fase 0 — Línea base visual (auditoría, sin código)

- Capturar cada vista (login, dashboard, choferes, autos, usuarios, admin) en viewports: **375, 390, 430, 768, 1024, 1440** (DevTools o Playwright).
- Marcar en cada captura: scroll horizontal, overlap, targets pequeños, texto cortado.
- Guardar las capturas en `docs/superpowers/screens/` como referencia de "antes".
- **Entregable**: inventario de incidencias priorizado (alimenta las Fases 2–5).

### Fase 1 — Consistencia de breakpoints y tokens

- Documentar la tabla de breakpoints canónicos en `README.md` (sección corta).
- Unificar el punto de corte de navegación: `md` (768px) = tablet (sidebar), `lg` (1024px) = desktop completo con paneles inline. Revisar que el bottom nav y los overlays cubran bien el rango 768–1024 (ya lo hacen vía `!ctx.isLargeScreen`).
- Verificar que `--font-size-base` (22px desktop) no rompe componentes con `px` fijos en `lg`+ (auditar `w-64`, `w-[440px]`, `max-w-[240px]`).
- **Entregable**: nada visual cambia; solo consistencia documentada.

### Fase 2 — Card lists móviles para las tablas (el grueso del trabajo)

Patrón por slice (aplicar en este orden):

1. **Dashboard → tabla de checklists** (9 columnas, la más crítica).
2. **VehiclesSlice** (tabla + fila expandida).
3. **DriversSlice** (tabla + fila expandida + historial de pagos).
4. **UsersSlice** y **admin `UsersTab`/`AuditTab`** (decidir si merecen cards o basta scroll horizontal en una vista administrativa poco usada en móvil).

Implementación recomendada por slice:

- Mantener el `<table>` actual **sin tocarlo** para `md:` en adelante.
- Añadir un bloque `md:hidden` que renderice la misma data como **lista de cards**:
  - Card `rounded-2xl border border-border/60 bg-card p-3.5 space-y-2.5` (sigue el sistema `glass`/`elevation-1`).
  - Header de la card: nombre/placa en `text-base font-extrabold` + badge de estado (reusar los badges existentes: `bg-red-500/10 text-red-500`, etc.).
  - Filas de datos clave como pares `label uppercase 10px muted` + `value` (mismo patrón que las filas expandidas actuales, ya probado en `VehiclesSlice`).
  - Acciones: botones de ancho completo o `grid grid-cols-2` con `py-3` (target ≥44px), con icono + texto visible (no `sr-only`).
  - Tap de la card → misma acción que el row (toggle de detalles / action modal).
- Extraer a un componente compartido si el patrón se repite 3+ veces (p. ej. `components/ui/MobileCard.tsx` con slots `header`, `rows`, `actions`); si no, mantener local por slice para no sobre-ingenierizar.

**Riesgo de doble render**: los slices ya cargan todos los datos en memoria (hooks `useDrivers`/`useVehicles`/contexto), así que el card list es derivado — sin fetch adicional.

### Fase 3 — Touch targets y legibilidad

- Botones de acción de filas (`h-7`, `h-9`, iconos `w-3 h-3`): subir a `min-h-10 min-w-10` y `w-4 h-4` en móvil (clases base nuevas; desktop no cambia si se añaden clases móviles... **cuidado**: estos botones están dentro del `<table>` desktop; aplicar los targets solo en las cards móviles de Fase 2 y en overlays).
- Textos `text-[10px]` → `text-[11px]` donde sea viable en móvil (labels de badges pueden quedarse).
- Botones de quick actions del Dashboard: `h-10` en móvil y evitar `flex-wrap` desordenado (apilar en una fila scrolleable horizontal `overflow-x-auto` si no caben 3).
- **Entregable**: ningún target interactivo < 40px en las vistas móviles principales.

### Fase 4 — Diálogos y overlays móviles

- `DialogContent` base: revisar padding `p-6` en pantallas <400px (bajar a `p-5` y asegurar `w-full` con el wrapper `p-4` existente). Mantener el **modal centrado** (ya es la convención del proyecto, incluido `EntityActionSheet`) — no introducir bottom sheets salvo decisión explícita de diseño.
- Diálogos `w-64` de condonación/pago en `DriversSlice`: `w-full max-w-xs` con margen seguro (`mx-4`) y botones `py-2.5`.
- Verificar que los diálogos con formularios largos (`DriverFormDialog`, registro de vehículo) mantengan scroll interno (`max-h-[90vh]` + `overflow-y-auto` ya presente) y que el foco de inputs en iOS no tape el contenido (probarlo en Fase 6).
- `SliceHeader`: `flex-wrap gap-2` para que el botón "Registrar…" nunca se desborde en <360px.

### Fase 5 — Pulido de navegación móvil

- Bottom nav: agregar **badge de alertas** en la tab "Check Lists" (hoy el badge solo está en el botón del buzón) y `aria-current`.
- Confirmar que el buzón slide-in y los sheets respetan `safe-area-inset-bottom` al cerrarse sobre el bottom nav.
- Pantallas cortas (landscape móvil, <500px de alto): verificar que `pb-20` del main no tape contenido y que los sheets usen `max-h-[90vh]` con scroll.

### Fase 6 — Verificación y pruebas

- **Guía de QA manual** (o script Playwright opcional como devDep): recorrer login → dashboard → 4 tabs → admin en **375, 430, 768, 1024, 1440**, comprobando:
  - Cero scroll horizontal en las vistas principales (excepto tablas secundarias/historial, intencional).
  - Todos los targets ≥40px; texto sin cortes; sin overlap con bottom nav.
  - Sheets/diálogos abren y cierran sin romper el scroll del fondo.
- Correr `npx tsc --noEmit && npx eslint . && npm test` en cada fase.
- Si se agrega Playwright: un spec `tests/responsive.spec.ts` que verifique ausencia de `scrollWidth > clientWidth` en 375/430 para las 4 tabs (con datos demo).

## Orden de ejecución y riesgos

1. **Fase 0** (hoy, sin riesgo): capturas y línea base.
2. **Fase 1** (bajo riesgo): consistencia de breakpoints — nada visual cambia.
3. **Fase 2** (riesgo medio, mayor esfuerzo): card lists por slice, **un slice por commit** (dashboard → vehicles → drivers → users/admin) para poder revisar cada uno con su vista de escritorio intacta.
4. **Fases 3–5** (bajo riesgo): targets, diálogos, navegación.
5. **Fase 6** (verificación): QA en viewports + typecheck/lint/test por PR.

**Riesgos clave**:
- **Doble fuente de verdad** en listas (table + cards) puede derivar en drift visual si se edita una y no la otra → mantener los datos derivados en el mismo map del slice y revisar ambos en cada cambio.
- Cambiar tamaños en móvil puede filtrarse a desktop si no se usan prefijos → regla de oro 1 en cada PR.
- El salto de tipografía 16→22px en `md` es intencional y **no debe tocarse** (es parte de la estética desktop).

**Entregables por fase**: commits atómicos, typecheck/lint verdes, capturas "después" comparadas contra la línea base de Fase 0.

## Checklist de aceptación (definición de hecho)

- [ ] En 375–430px: todas las vistas principales muestran cards (sin scroll horizontal).
- [ ] En ≥1024px: la UI es idéntica a hoy (diff visual 0 en los componentes tocados).
- [ ] Targets interactivos ≥40px en móvil; textos sin cortes; bottom nav no tapa contenido.
- [ ] Sheets y diálogos funcionan en móvil (apertura, cierre, scroll interno, teclado iOS).
- [ ] `tsc`, `eslint` y `npm test` verdes.
