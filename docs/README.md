# Documentación del proyecto

Índice de la documentación de **fleet-control**. El README raíz (`README.md`) es la fuente principal: arquitectura (vertical slices), seguridad, rutas/API, OCR, móvil, testing y operación.

## `docs/superpowers/`

| Documento | Qué es | Estado |
|---|---|---|
| `plans/2026-07-01-entity-action-sheet.md` | Plan de implementación del EntityActionSheet (asignar/retirar auto⇄chofer, lanzar checklist) | ✅ Implementado (2026-08) |
| `specs/2026-07-01-entity-action-sheet-design.md` | Spec de diseño del mismo componente | ✅ Implementado — ver sección *Implementation Status* |
| `plans/2026-08-11-security-hardening.md` | Plan de endurecimiento de seguridad (RLS, JWT, cookie HttpOnly, rate-limit, tests/CI, refactor) | ✅ Implementado y desplegado — ver tabla de fases en el propio doc |
| `plans/2026-08-14-mobile-breakpoints.md` | Plan maestro de auditoría y mejora de responsividad móvil | 🟡 Fase 0 ✅ (auditoría Playwright); Fases 1–6 pendientes |
| `plans/2026-08-18-breakpoints-phase1.md` | Plan de ejecución de la Fase 1 (consistencia de breakpoints sin tocar desktop) | ✅ Ejecutado — T1/T2/T4/T5 ✅, T3 sin incidencias; 1 error eslint preexistente pendiente |
| `plans/2026-08-18-card-lists-phase2.md` | Plan de ejecución de la Fase 2 (card lists móviles para las tablas) | ✅ Ejecutado — cards en dashboard/choferes/autos; desktop intacto verificado |
| `screens/before/INVENTORY.md` | Inventario de incidencias de responsividad — línea base "antes" (capturas + `metrics.json`) | ✅ Línea base congelada (comparar en Fase 6) |

## Convenciones

- **Slices**: la arquitectura vertical se describe en el README raíz (sección *Slices y Arquitectura del Proyecto*).
- **Estado de los planes**: los docs de `plans/` mantienen su contenido histórico (checklists, fases) y el estado real se refleja en su encabezado/sección de ejecución — no borrar pasos cumplidos, solo marcarlos.
- **Capturas de pantalla**: `screens/before/` es la línea base; cualquier cambio móvil futuro debe compararse contra ella antes de moverla a `screens/after/`.
