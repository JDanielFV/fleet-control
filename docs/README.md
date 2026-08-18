# Documentación del proyecto

Índice de la documentación de **fleet-control**. El README raíz (`README.md`) es la fuente principal: arquitectura (vertical slices), seguridad, rutas/API, OCR, móvil, testing y operación.

## `docs/superpowers/`

| Documento | Qué es | Estado |
|---|---|---|
| `plans/2026-07-01-entity-action-sheet.md` | Plan de implementación del EntityActionSheet (asignar/retirar auto⇄chofer, lanzar checklist) | ✅ Implementado (2026-08) |
| `specs/2026-07-01-entity-action-sheet-design.md` | Spec de diseño del mismo componente | ✅ Implementado — ver sección *Implementation Status* |
| `plans/2026-08-11-security-hardening.md` | Plan de endurecimiento de seguridad (RLS, JWT, cookie HttpOnly, rate-limit, tests/CI, refactor) | ✅ Implementado y desplegado — ver tabla de fases en el propio doc |
| `plans/2026-08-14-mobile-breakpoints.md` | Plan de auditoría y mejora de responsividad móvil | 🟡 Fase 0 ✅ (auditoría Playwright); Fases 1–6 pendientes |
| `screens/before/INVENTORY.md` | Inventario de incidencias de responsividad — línea base "antes" (capturas + `metrics.json`) | ✅ Línea base congelada (comparar en Fase 6) |

## Convenciones

- **Slices**: la arquitectura vertical se describe en el README raíz (sección *Slices y Arquitectura del Proyecto*).
- **Estado de los planes**: los docs de `plans/` mantienen su contenido histórico (checklists, fases) y el estado real se refleja en su encabezado/sección de ejecución — no borrar pasos cumplidos, solo marcarlos.
- **Capturas de pantalla**: `screens/before/` es la línea base; cualquier cambio móvil futuro debe compararse contra ella antes de moverla a `screens/after/`.
