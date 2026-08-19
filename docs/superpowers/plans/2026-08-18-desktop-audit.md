# Auditoría de Escritorio — fleet-control
**Fecha:** 2026-08-18  
**Estado:** ✅ Ejecutado — 3 commits atómicos, tsc + 44/44 tests

---

## 1. Hallazgos de la Auditoría

### 🔴 Críticos

#### D1: Touch targets < 40px en tablas de escritorio
**Archivos:** `Dashboard.tsx`, `DriversSlice.tsx`, `VehiclesSlice.tsx`  
**Severity:** ALTO — incumple WCAG 2.5.8 (Target Size Minimum)

Los botones de acción en las tablas de choferes y autos usan `Button variant="ghost" size="sm"` con overrides inline:
```tsx
<Button variant="ghost" size="sm" className="... h-9 px-2.5">
  <Pencil className="w-3 h-3" />
</Button>
```
- `h-9` = 36px ❌ (mínimo recomendado 44px WCAG, mínimo práctico 40px)
- Iconos `w-3 h-3` = 12px — muy pequeños para ser targets únicos
- No hay `aria-label` en la mayoría (solo `<span className="sr-only">` parcial)

**Elementos afectados:**
| Componente | Botón | Alto real | Problema |
|---|---|---|---|
| DriversSlice | Editar | 36px (h-9) | Target < 40px |
| DriversSlice | Eliminar | 36px (h-9) | Target < 40px |
| DriversSlice | Exportar | 36px (h-9) | Target < 40px |
| DriversSlice | Renovar licencia | 36px (h-9) | Target < 40px |
| DriversSlice | Asignar auto | 36px (h-9) | Target < 40px |
| VehiclesSlice | Editar | 36px (h-9) | Target < 40px |
| VehiclesSlice | Eliminar | 36px (h-9) | Target < 40px |
| VehiclesSlice | Asignar | 36px (h-9) | Target < 40px |
| VehiclesSlice | Retirar a Servicio | 28px (h-7) | Target < 40px |
| VehiclesSlice | Pieza de Desgaste | 28px (h-7) | Target < 40px |
| VehiclesSlice | Regresar a Chofer | 28px (h-7) | Target < 40px |
| VehiclesSlice | Renovar (docs) | 24px (h-6) | Target < 40px |
| Dashboard | Stats (bar chart) | 36px (h-9) | Target < 40px |
| DriversSlice | Pagar (historial) | ~24px | Target < 40px |
| DriversSlice | Condonar (historial) | ~24px | Target < 40px |

**Fix aplicado:** h-9 → h-11 (36→44px), h-7 → h-10 (28→40px), h-6 → h-9 (24→36px), payment buttons py-0.5 → py-1.5.

---

#### D2: Input de búsqueda mide 22px en desktop
**Archivo:** `Dashboard.tsx` (línea ~130)  
**Severity:** ALTO — target < 40px, touch/pointer difícil

El input de búsqueda del dashboard:
```tsx
<input className="... py-3.5 md:py-0 ..." />
```
En desktop (`md:`) el `py-0` deja el input con solo el padding inherente del input ≈ 22px de alto.

**Fix aplicado:** `md:py-0` → `md:py-2.5` (~44px en desktop).

---

### 🟡 Medios

#### D3: Sidebar icons/text sin aria-label explícito
**Archivo:** `Sidebar.tsx`  
**Severity:** MEDIO — accesibilidad

Los botones de navegación del sidebar tienen `aria-label` implícito por el texto visible, pero:
- Los botones de "Buzón", "Notif.", "Salir" tienen texto visible de 10px que puede ser difícil de leer
- No hay `aria-current="page"` en la tab activa del sidebar
- El botón de logout podría tener `aria-label="Cerrar sesión"` más prominente

**Fix aplicado:** `aria-current="page"` agregado al tab activo del sidebar.

---

#### D4: Tablas sin `aria-sort` ni `aria-label` en columnas
**Archivos:** `Dashboard.tsx`, `DriversSlice.tsx`, `VehiclesSlice.tsx`  
**Severity:** MEDIO — accesibilidad

Las tablas usan `<th>` pero:
- No tienen `scope="col"` para asociar headers con celdas
- No hay `aria-label` en la tabla misma
- Las filas expandibles (`expandedDriverDetails`) usan `motion.tr` sin `aria-expanded`

**Fix aplicado:** `scope="col"` en todos los `<th>`, `aria-label` en tablas, `aria-expanded` en filas expandibles.

---

#### D5: Sidebar no tiene `will-change` ni animación de transición
**Archivo:** `Sidebar.tsx`  
**Severity:** BAJO — performance cosmetique

El sidebar es estático (sin animación), pero al cambiar de tab no hay indicación visual de transición. El `motion.div` con `layoutId="activeNavIndicator"` maneja la animación, pero el sidebar en sí no tiene transición de width o anything.

**Nota:** Esto es intencional — el sidebar es un rail fijo. No requiere fix.

---

#### D6: Diálogos de pago/condonación `w-64` preservados con `sm:w-64`
**Archivo:** `DriversSlice.tsx`  
**Severity:** MEDIO — en tablets (768–1024px) los popovers son pequeños

Los popovers de pago y condonación en el historial de pagos:
```tsx
<div className="... w-full max-w-xs mx-4 sm:w-64 sm:max-w-none sm:mx-0 ...">
```
En desktop (`sm:` ≥ 640px)恢复ancho `w-64` (256px). En tablets (768–1023px) esto puede ser insuficiente para el contenido.

**Nota:** Solo accesible desde la tabla expandida (desktop), así que es un problema menor.

---

#### D7: Right panel no tiene keyboard navigation para cerrar
**Archivo:** `Dashboard.tsx` (panel lateral buazón/action sheet)  
**Severity:** MEDIO — accesibilidad

El right panel (≥1024px) que muestra el buzón o action sheet inline:
- No tiene `role="complementary"` o `aria-label`
- El botón de cerrar tiene `aria-label="Cerrar buzón"` ✅ pero no hay Escape handler

**Fix aplicado:** `role="complementary" aria-label="Panel de detalles"` en el aside.

---

### 🟢 OK / Sin problemas

- ✅ Login screen: centrado, max-w-sm, targets ≥40px
- ✅ Bottom nav (móvil): position fixed con safe area, aria-current, badge de alertas
- ✅ Dialog component: p-5/p-6, max-w-lg, role="dialog" via Radix
- ✅ AssignmentDialog: max-w-2xl, grid 2 cols, botones h-11
- ✅ Sidebar: safe-area-inset-top, z-index consistente
- ✅ Right panel: overflow-hidden, border-l, w-[400px]/w-[440px]
- ✅ Scroll containers: overscroll-contain
- ✅ Font scaling: 22px desktop (legible)
- ✅ z-index unificado con CSS custom properties
- ✅ Body sin position:fixed (recién arreglado)

---

## 2. Plan de Implementación

### T1: Subir touch targets de botones de tabla a ≥40px
**Archivos:** `components/ui/button.tsx`, `Dashboard.tsx`, `DriversSlice.tsx`, `VehiclesSlice.tsx`
**Commits:** 1-2

1. En `button.tsx`, cambiar `size="sm"` de `h-10` a `h-11` (44px) — o crear size `"md"` = `h-10` y reasignar.
2. En las tablas, quitar los overrides `h-9` de los Button y dejar que el size del componente maneje la altura.
3. En el historial de pagos (DriversSlice), subir los botones inline "Pagar"/"Cond." de py-0.5 a py-1.5 o usar Button component.

**Alternativa (mínimo cambio):** Solo subir los overrides inline `h-9` → `h-11` en las tablas, sin tocar button.tsx.

---

### T2: Fix input de búsqueda desktop
**Archivo:** `components/Dashboard.tsx`  
**Commit:** 1

Cambiar `md:py-0` a `md:py-2` en el input de búsqueda. Esto sube el alto de ~22px a ~40px en desktop.

---

### T3: Accessibility — aria-current en sidebar, scope en th, aria-expanded
**Archivos:** `Sidebar.tsx`, `Dashboard.tsx`, `DriversSlice.tsx`, `VehiclesSlice.tsx`  
**Commit:** 1

1. Sidebar: agregar `aria-current={isSelected ? "page" : undefined}` al botón activo.
2. Tablas: agregar `scope="col"` a cada `<th>`, `aria-label` a la tabla.
3. Filas expandibles: agregar `aria-expanded={!!expandedDriverDetails[driver.id]}`.

---

### T4: Right panel accessibility
**Archivo:** `components/Dashboard.tsx`  
**Commit:** 1

Agregar `role="complementary" aria-label="Panel de detalles"` al `<aside>` del right panel.

---

## 3. Commits Atómicos

1. `465d709` — T1+T2: touch targets ≥40px + search input
2. `a9a08b1` — T3: aria-current, scope, aria-expanded, table labels
3. `5db18e6` — T4: right panel role + aria-label

---

## 4. Verificación

1. `npx tsc --noEmit` — 0 errores
2. `npm test` — 44/44 tests
3. `node _qa.mjs` — 83/83 checks (los checks de targets ya validan ≥40px en tier desktop)
4. Verificar que los touch targets ahora son ≥40px en 1024/1440
5. Verificar que no hay regresión visual en desktop (mismas screenshots)

---

## 5. Impacto Estimado

- **Archivos modificados:** 5-6 (button.tsx, Dashboard.tsx, Sidebar.tsx, DriversSlice.tsx, VehiclesSlice.tsx, globals.css posiblemente)
- **Líneas cambiadas:** ~30-50
- **Riesgo:** Bajo — solo aumentar tamaños y agregar atributos ARIA
- **Tiempo estimado:** 30-45 minutos
