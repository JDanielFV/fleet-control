# Fase 0 — Inventario de incidencias de responsividad (línea base "antes")

Fecha: 2026-08-14
Método: auditoría automatizada con Playwright en modo demo (localStorage, sin tocar Supabase) con datos sembrados (6 choferes, 6 autos, 4 asignados, 10 checklists, 8 rentas). Capturas en `docs/superpowers/screens/before/<width>/`.

> **Cómo re-ejecutar**: `npm run dev -p 3100` con las vars de Supabase **vaciadas** en el shell (modo demo) y luego `node _audit.mjs`. Genera capturas + `metrics.json`.

## Resumen ejecutivo

La app ya tiene navegación móvil (bottom nav), sheets y safe-areas. Los problemas reales se concentran en **las tablas de datos** (scroll horizontal obligatorio) y en **targets táctiles pequeños**. No hay overflow a nivel de página (`doc == inner` en todos los viewports) — el scroll horizontal es interno a las tablas.

| Vista | 375px | 390px | 430px | 768px | 1024px+ |
|---|---|---|---|---|---|
| Check Lists (tabla 9 col) | **672px → scroll** | **672px** | **672px** | **807px** | OK |
| Choferes (tabla 7 col) | **723px → scroll** | **723px** | **723px** | **941px** | OK |
| Autos (tabla 5 col) | **417px → scroll** | **417px** | OK | OK | OK |
| Usuarios | OK | OK | OK | OK | OK |

*Valores = ancho real de la tabla vs. ancho del viewport. Con `overflow-x-auto` el usuario debe hacer scroll horizontal para ver ~45–55% de las columnas.*

## Incidencias (priorizadas)

### P1 — Tablas con scroll horizontal (sin alternativa móvil)
- `Dashboard` tabla de checklists: **672px en teléfonos / 807px en tablet** (9 columnas). Se ven ~3 columnas de 9 en 375px.
- `DriversSlice` tabla: **723px en teléfonos / 941px en tablet** (7 columnas).
- `VehiclesSlice` tabla: **417px** (solo se desborda en <430px).
- `UsersSlice`: cabe bien; no requiere cards.
- **Fase asociada**: Fase 2 del plan (card lists `md:hidden`).

### P2 — Touch targets < 40px
- Dashboard (375px): **6 targets** — Exportar CSV 30×30, botón buzón 30×30, input de búsqueda 16px, botones "Chofer"/"Auto"/"Asignar" 28px.
- Choferes (375px): **32 targets** — botones de acción por fila **36×36** (Renovar/Exportar/Editar/Eliminar), toggle "Archivo" 25px, input búsqueda 20px.
- Autos (375px): **22 targets** (mismos botones 36×36).
- Login (375/430px): tabs "Passkey"/"Contraseña" **32px**.
- **Fase asociada**: Fase 3 del plan.

### P3 — Wrapping de la barra de búsqueda del Dashboard
- La barra `bg-[#ECECEC]` crece a **70px en móvil** (66px en desktop): los botones de acción rápida (`Chofer`/`Auto`/`Asignar`) envuelven a una segunda fila por el `flex-wrap`. Ocupa espacio vertical y se ve desordenado.
- **Fase asociada**: Fase 3 del plan (apilar en fila scrolleable o compactar).

### P4 — Observaciones menores
- Diálogos `w-64` de pago/condonación en `DriversSlice` (angostos en pantallas grandes, sin `max-w` ni margen seguro en móvil). Fase 4.
- Indicador flotante de dev-tools de Next (solo dev) se posa sobre el primer tab del bottom nav en viewports móviles — no es bug de la app, pero se eliminó en el harness de captura.
- Desktop (≥1024px): sin incidencias — layout actual OK, consistente con el objetivo de no tocarlo.

## Verificación de escritorio (control)

Las capturas en **1024px y 1440px** muestran el layout actual sin overflow ni targets rotos (solo el input de búsqueda mide 22px, aceptable en desktop donde el ratón manda). Esto valida que el trabajo futuro debe concentrarse en <1024px y que la regla "no tocar desktop" es viable: basta añadir capas móviles con prefijos.

## Artefactos

- Capturas: `docs/superpowers/screens/before/{375,390,430,768,1024,1440}/` (checklists, drivers, vehicles, users, login, vehicle-dialog + variantes `-bottom`).
- Métricas crudas: `docs/superpowers/screens/before/metrics.json`.
- Script reutilizable: `_audit.mjs` + `_audit-seed.mjs` (para comparar "después" en Fase 6).
