# Documentación del proyecto

Índice de la documentación de **fleet-control**. El README raíz (`README.md`) es la fuente principal: arquitectura (vertical slices), seguridad, rutas/API, OCR, móvil, testing y operación.

## `docs/superpowers/`

| Documento | Qué es | Estado |
|---|---|---|
| `plans/2026-07-01-entity-action-sheet.md` | Plan de implementación del EntityActionSheet (asignar/retirar auto⇄chofer, lanzar checklist) | ✅ Implementado (2026-08) |
| `specs/2026-07-01-entity-action-sheet-design.md` | Spec de diseño del mismo componente | ✅ Implementado — ver sección *Implementation Status* |
| `plans/2026-08-11-security-hardening.md` | Plan de endurecimiento de seguridad (RLS, JWT, cookie HttpOnly, rate-limit, tests/CI, refactor) | ✅ Implementado y desplegado — ver tabla de fases en el propio doc |
| `plans/2026-08-14-mobile-breakpoints.md` | Plan maestro de auditoría y mejora de responsividad móvil | ✅ Fases 0–6 ✅ (auditoría, breakpoints, card lists, touch targets, diálogos, navegación, QA Playwright) |
| `plans/2026-08-18-breakpoints-phase1.md` | Plan de ejecución de la Fase 1 (consistencia de breakpoints sin tocar desktop) | ✅ Ejecutado — T1/T2/T4/T5 ✅, T3 sin incidencias; 1 error eslint preexistente pendiente |
| `plans/2026-08-18-card-lists-phase2.md` | Plan de ejecución de la Fase 2 (card lists móviles para las tablas) | ✅ Ejecutado — cards en dashboard/choferes/autos; desktop intacto verificado |
| Fase 3 — Touch targets (plan maestro 2026-08-14) | Targets táctiles ≥44px en móvil (búsquedas, toggles, quick actions, tabs login) | ✅ Ejecutado — targets<40 = **0** en todas las vistas 375/390/430px; desktop intacto |
| Fase 4 — Diálogos móviles (plan maestro 2026-08-14) | Padding `DialogContent` <640px, popovers `w-64` de pago/condonación, `SliceHeader` con wrap | ✅ Ejecutado — desktop no-op verificado con control de dos runs |
| Fase 5 — Navegación móvil (plan maestro 2026-08-14) | Badge de alertas en bottom nav, `aria-current`, safe-areas, viewport landscape 667×375 | ✅ Ejecutado — targets<40 = **0** también en 667×375; desktop intacto |
| Fase 6 — QA Playwright (plan maestro 2026-08-14) | Script `_qa.mjs`: 83 checks en 6 viewports (login, dashboard, tabs, dialog flow, bottom nav, overflow) | ✅ 83/83 passed; tiers mobile/tablet/desktop |
| `plans/2026-08-18-mobile-nav-audit.md` | Auditoría de navegación móvil (iOS focus): viewport duplicado, body fixed, h-dvh, safe areas en modales, z-index, overscroll | ✅ Ejecutado — 6 commits atómicos, tsc + 44/44 tests |
| `plans/2026-08-18-desktop-audit.md` | Auditoría de escritorio: touch targets <40px en tablas, input de búsqueda, aria en sidebar/tablas, right panel | 📋 Plan listo para ejecutar |
| `screens/before/INVENTORY.md` | Inventario de incidencias de responsividad — línea base "antes" (capturas + `metrics.json`) | ✅ Línea base congelada (comparar en Fase 6) |
| `screens/qa/` | Screenshots de referencia del QA Playwright (`_qa.mjs`) — 6 viewports × 4-6 vistas | ✅ 38 capturas generadas (Fase 6) |

## Convenciones

- **Slices**: la arquitectura vertical se describe en el README raíz (sección *Slices y Arquitectura del Proyecto*).
- **Estado de los planes**: los docs de `plans/` mantienen su contenido histórico (checklists, fases) y el estado real se refleja en su encabezado/sección de ejecución — no borrar pasos cumplidos, solo marcarlos.
- **Capturas de pantalla**: `screens/before/` es la línea base; cualquier cambio móvil futuro debe compararse contra ella antes de moverla a `screens/after/`.
