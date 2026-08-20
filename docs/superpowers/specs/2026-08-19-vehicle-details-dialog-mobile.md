# Design: Detalles del Vehículo — Dialog Móvil + Formulario Simplificado

Fecha: 2026-08-19
Alcance: Solo vehículos (choferes pendiente)

## Overview

Dos cambios principales:
1. **Móvil**: Al tocar una tarjeta de vehículo, abrir un **Dialog** con toda la información (igual que desktop expandido)
2. **Formulario**: Simplificar de 4 pasos a 3 pasos (Identificación → Documentos → Detalles)

---

## 1. Comportamiento por Plataforma

### Desktop (≥ 768px) — SIN CAMBIOS

```
┌─────────────────────────────────────────────────────────────────────┐
│  Tabla de Vehículos                                                 │
│  ─────────────────────────────────────────────────────────────────  │
│  │ Auto              │ Placa   │ ID      │ Chofer    │ Acciones │  │
│  │───────────────────│─────────│─────────│───────────│──────────│  │
│  │ Nissan Versa 2022 │ 982-WXY │ X109186 │ Juan P.   │ ✏️ 🗑️    │  │
│  │───────────────────│─────────│─────────│───────────│──────────│  │
│  │ [Click en fila] → Se expande inline (COMPORTAMIENTO ACTUAL)     │
│  │                                                                 │
│  │ ┌───────────────────────────────────────────────────────────┐  │
│  │ │  📋 Información del Auto                                  │  │
│  │ │  Clase: Sedán | Color: Blanco | Engomado: 🔵 Azul        │  │
│  │ │  Estado: ✅ Activo | Últ. Servicio: Sin registros        │  │
│  │ │  Kilometraje: — | Próx. Servicio: 20,000 km              │  │
│  │ │  Est. Fecha: 15 Sep 2026 | Renta: Sin chofer             │  │
│  │ │  Uso Semanal: — | Media Mensual: —                        │  │
│  │ ├───────────────────────────────────────────────────────────┤  │
│  │ │  📄 Documentos                                            │  │
│  │ │  ┌──────────┐ ┌──────────┐ ┌──────────┐                  │  │
│  │ │  │Circulación│ │  Seguro  │ │Verificac.│                  │  │
│  │ │  │ 📷 thumb  │ │ 📷 thumb │ │📅 fecha  │                  │  │
│  │ │  │ Vence:... │ │ Vence:.. │ │Engomado: │                  │  │
│  │ │  │ [Renovar] │ │ [Renovar]│ │ [Renovar]│                  │  │
│  │ │  └──────────┘ └──────────┘ └──────────┘                  │  │
│  │ ├───────────────────────────────────────────────────────────┤  │
│  │ │  📜 Historial (VehicleHistory)                            │  │
│  │ │  Mantenimientos, asignaciones, checklists, rentas         │  │
│  │ └───────────────────────────────────────────────────────────┘  │
│  └─────────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────────┘
```

### Móvil (< 768px) — NUEVO COMPORTAMIENTO

```
┌────────────────────────────────────┐
│  Tarjeta de Vehículo               │
│  ┌──────────────────────────────┐  │
│  │ Nissan Versa 2022     [badge]│  │
│  │ 982-WXY · X109186           │  │
│  │ Chofer: Juan P.             │  │
│  │ [Asignar] [Editar] [Eliminar]│  │
│  └──────────────────────────────┘  │
│                                    │
│  [Tap en la tarjeta]               │
│           ↓                        │
│  ┌──────────────────────────────┐  │
│  │  ╔════════════════════════╗  │  │
│  │  ║  Dialog de Detalles    ║  │  │
│  │  ║  (full-screen en móvil)║  │  │
│  │  ╚════════════════════════╝  │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
```

---

## 2. Dialog de Detalles (Móvil)

### 2.1 Estructura del Dialog

```
┌─────────────────────────────────────────────────────────────────────┐
│  ✕  Nissan Versa 2022                              [Editar] [🗑️]  │
│  982-WXY · X109186 · 🔵 Azul                                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  📋 INFORMACIÓN DEL AUTO                                    │   │
│  │  ─────────────────────────────────────────────────────     │   │
│  │  Clase / Tipo        Color                                  │   │
│  │  Sedán               Blanco                                 │   │
│  │                                                             │   │
│  │  Engomado            Estado                                 │   │
│  │  🔵 Azul             ✅ Activo                              │   │
│  │                                                             │   │
│  │  Últ. Servicio       Kilometraje                            │   │
│  │  Sin registros       Sin registros                          │   │
│  │                                                             │   │
│  │  Próx. Servicio      Est. Fecha                             │   │
│  │  20,000 km           15 Sep 2026                            │   │
│  │                                                             │   │
│  │  Renta               Uso Semanal        Media Mensual       │   │
│  │  Sin chofer          —                  —                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ⚡ ACCIONES RÁPIDAS                                        │   │
│  │  ─────────────────────────────────────────────────────     │   │
│  │  [🔧 Retirar a Servicio]  [⚠️ Pieza de Desgaste]           │   │
│  │  [🔄 Regresar a Chofer]   (si está en servicio)            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  📄 DOCUMENTOS                                              │   │
│  │  ─────────────────────────────────────────────────────     │   │
│  │                                                             │   │
│  │  ┌─────────────────────────────────────────────────────┐   │   │
│  │  │  🚗 Tarjeta de Circulación            [Renovar]     │   │   │
│  │  │  ┌────────┐                                          │   │   │
│  │  │  │ 📷     │  Vence: 2025-03-15                      │   │   │
│  │  │  │ thumb  │  Placas: 982-WXY                        │   │   │
│  │  │  └────────┘                                          │   │   │
│  │  └─────────────────────────────────────────────────────┘   │   │
│  │                                                             │   │
│  │  ┌─────────────────────────────────────────────────────┐   │   │
│  │  │  🛡️ Póliza de Seguro                 [Renovar]     │   │   │
│  │  │  ┌────────┐                                          │   │   │
│  │  │  │ 📷     │  Póliza: POL-123456                     │   │   │
│  │  │  │ thumb  │  Vence: 2025-06-30                      │   │   │
│  │  │  └────────┘                                          │   │   │
│  │  └─────────────────────────────────────────────────────┘   │   │
│  │                                                             │   │
│  │  ┌─────────────────────────────────────────────────────┐   │   │
│  │  │  ✓ Verificación Vehicular            [Renovar]     │   │   │
│  │  │  Vence: 2025-04-15                                  │   │   │
│  │  │  Engomado: 🔵 Azul · Jun-Jul / Dec-Ene             │   │   │
│  │  └─────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  📜 HISTORIAL                                               │   │
│  │  ─────────────────────────────────────────────────────     │   │
│  │  VehicleHistory component (mantenimientos, asignaciones,   │   │
│  │  checklists, rentas semanales)                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  [Cerrar]                                          [✏️ Editar]     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Componente: `VehicleDetailDialog`

```tsx
interface VehicleDetailDialogProps {
  vehicle: Vehicle | null;
  open: boolean;
  onClose: () => void;
  onEdit: (vehicle: Vehicle) => void;
  onDelete: (vehicleId: string) => void;
  onRenewDocument: (vehicle: Vehicle, target: "CIRCULACION" | "SEGURO" | "VERIFICACION") => void;
  onServiceOut: (vehicle: Vehicle) => void;
  onServiceReturn: (vehicle: Vehicle) => void;
  onReportWearPart: (vehicle: Vehicle) => void;
  drivers: Driver[];
  maintenances: Maintenance[];
  assignments: Assignment[];
  checklists: Checklist[];
  weeklyRentals: WeeklyRental[];
  setPreviewImage: (url: string | null) => void;
}
```

### 2.3 Layout del Dialog

```tsx
<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
  <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto rounded-2xl">
    <DialogHeader>
      {/* Header: nombre + placa + acciones */}
      <div className="flex items-start justify-between">
        <div>
          <DialogTitle>{vehicle.brand} {vehicle.vehicle_name} {vehicle.model}</DialogTitle>
          <DialogDescription>{vehicle.plate_number} · {vehicleId}</DialogDescription>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => onEdit(vehicle)}>
            <Pencil className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(vehicle.id)}>
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      </div>
    </DialogHeader>

    <div className="space-y-4 pt-2">
      {/* Sección: Información del Auto */}
      <VehicleInfoSection vehicle={vehicle} schedule={schedule} />
      
      {/* Sección: Acciones Rápidas */}
      <VehicleQuickActions 
        vehicle={vehicle}
        onServiceOut={onServiceOut}
        onServiceReturn={onServiceReturn}
        onReportWearPart={onReportWearPart}
      />
      
      {/* Sección: Documentos */}
      <VehicleDocumentsSection 
        vehicle={vehicle}
        onRenewDocument={onRenewDocument}
        setPreviewImage={setPreviewImage}
      />
      
      {/* Sección: Historial */}
      <VehicleHistory 
        vehicle={vehicle}
        maintenances={maintenances}
        assignments={assignments}
        drivers={drivers}
        checklists={checklists}
        weeklyRentals={weeklyRentals}
      />
    </div>
  </DialogContent>
</Dialog>
```

---

## 3. Formulario de Registro Simplificado (3 Pasos)

### 3.1 Nuevo Stepper

```tsx
<Stepper
  steps={[
    { id: "id", label: "Identificación" },
    { id: "docs", label: "Documentos" },
    { id: "details", label: "Detalles" },
  ]}
  currentStep={activeSection}
  onStepClick={scrollToSection}
/>
```

### 3.2 Paso 1: Identificación

```
┌─────────────────────────────────────────────────────────────┐
│  🚗 Datos del Vehículo                                     │
│  ─────────────────────────────────────────────────────     │
│                                                             │
│  Placa *                                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 982-WXY                                              │   │
│  └─────────────────────────────────────────────────────┘   │
│  ✓ Formato válido · ✓ No duplicada                         │
│                                                             │
│  Marca *          Vehículo / Submarca *                    │
│  ┌──────────────┐ ┌──────────────────────────────────┐    │
│  │ Nissan       │ │ Versa                            │    │
│  └──────────────┘ └──────────────────────────────────┘    │
│                                                             │
│  Modelo (Año)       Clase / Tipo                           │
│  ┌──────────────┐ ┌──────────────────────────────────┐    │
│  │ 2022         │ │ Sedán                             │    │
│  └──────────────┘ └──────────────────────────────────┘    │
│                                                             │
│  Color                                                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Blanco                                               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [4/6 campos completados]                                   │
└─────────────────────────────────────────────────────────────┘
```

**Campos:**

| Campo | Tipo | Requerido | Validación |
|-------|------|-----------|------------|
| Placa | Text (mono) | Sí | 5-10 caracteres, sin duplicados |
| Marca | Text | Sí | Min 2 caracteres |
| Vehículo/Submarca | Text | Sí | Min 2 caracteres |
| Modelo (Año) | Text | No | 4 dígitos |
| Clase/Tipo | Text | No | Sedán, SUV, etc. |
| Color | Text | No | — |

### 3.3 Paso 2: Documentos

```
┌─────────────────────────────────────────────────────────────┐
│  📋 Documentos Vehiculares                                 │
│  ─────────────────────────────────────────────────────     │
│  ☑ Tarjeta de Circulación (requerido)                     │
│  ☑ Póliza de Seguro (requerido)                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🚗 Tarjeta de Circulación                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  [📸 Tomar Foto]  [📁 Subir Archivo]                │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ✅ Circulación cargada                              │   │
│  │  • Placa: 982-WXY                                   │   │
│  │  • VIN: 1HGBH41JXMN109186                           │   │
│  │  • Vigencia: 2025-03-15                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  🛡️ Póliza de Seguro                                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  [📸 Tomar Foto]  [📁 Subir Archivo]  [📄 Multi-pág]│   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ✅ Seguro cargado · 2 páginas                      │   │
│  │  • No. Póliza: POL-123456                           │   │
│  │  • Vigencia: 2025-06-30                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  💡 Ambos documentos se escanean en un solo paso           │
└─────────────────────────────────────────────────────────────┘
```

**Documentos:**

| Documento | Requerido | OCR | Feedback |
|-----------|-----------|-----|----------|
| Tarjeta Circulación | Sí | Gemini → Tesseract | ✅ Cargado + datos extraídos |
| Póliza Seguro | Sí | Gemini → Tesseract | ✅ Cargado + No. póliza |

### 3.4 Paso 3: Detalles

```
┌─────────────────────────────────────────────────────────────┐
│  🔢 Detalles del Vehículo                                  │
│  ─────────────────────────────────────────────────────     │
│                                                             │
│  VIN / NIV                                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 1HGBH41JXMN109186                                   │   │
│  └─────────────────────────────────────────────────────┘   │
│  ✓ 17 caracteres · Formato válido                          │
│                                                             │
│  💰 Renta y Servicio                                       │
│  ─────────────────────────────────────────────────────     │
│  Costo Renta Semanal ($)    Próx. Servicio (km)            │
│  ┌──────────────────────┐  ┌──────────────────────────┐   │
│  │ 2500                 │  │ 20000                     │   │
│  └──────────────────────┘  └──────────────────────────┘   │
│                                                             │
│  📅 Vigencias                                              │
│  ─────────────────────────────────────────────────────     │
│  Circulación           Seguro               Verificación   │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────┐  │
│  │ 2025-03-15   │     │ 2025-06-30   │     │ 2025-04  │  │
│  └──────────────┘     └──────────────┘     └──────────┘  │
│                                                             │
│  🔵 Engomado: Azul (meses: Jun-Jul / Dec-Ene)             │
│                                                             │
│  ✅ Todo listo para registrar                               │
└─────────────────────────────────────────────────────────────┘
```

**Campos:**

| Campo | Tipo | Requerido | Validación |
|-------|------|-----------|------------|
| VIN/NIV | Text (mono) | No | 17 caracteres |
| Costo renta semanal | Number | No | ≥ 0 |
| Próximo servicio (km) | Number | No | ≥ 0 |
| Vigencia circulación | Date | No | — |
| Vigencia seguro | Date | No | — |
| Verificación | Date | No | Auto-calculado |

---

## 4. Layout Responsivo

### 4.1 Formulario — Móvil (< 768px)

```
┌────────────────────────────┐
│  [Stepper: ID → Docs → Details]  │
├────────────────────────────┤
│  [Contenido scrollable]    │
│  - Stack vertical          │
│  - Inputs h-11             │
├────────────────────────────┤
│  [← Atrás] [Siguiente →]  │  ← Sticky footer
└────────────────────────────┘
```

- Contenido: `max-h-[62vh] overflow-y-auto`
- Footer: `sticky bottom-0 bg-background border-t`
- Inputs: `h-11` (target ≥44px)

### 4.2 Formulario — Desktop (≥ 768px)

```
┌──────────────────────────────────────────────────┐
│  [Stepper: ID → Docs → Details]                  │
├──────────────────────────────────────────────────┤
│  ┌─────────────────────┬─────────────────────┐   │
│  │  Identificación     │  Documentos         │   │
│  │  - Placa            │  - Circulación      │   │
│  │  - Marca            │  - Seguro           │   │
│  │  - Modelo           │                     │   │
│  │  - Color            │                     │   │
│  └─────────────────────┴─────────────────────┘   │
├──────────────────────────────────────────────────┤
│  [Detalles]                                      │
│  ┌──────────────────────────────────────────┐   │
│  │  VIN · Renta · Vigencias · Engomado     │   │
│  └──────────────────────────────────────────┘   │
├──────────────────────────────────────────────────┤
│  [← Atrás]                    [Registrar →]      │
└──────────────────────────────────────────────────┘
```

- Grid 2 columnas para identificación + documentos
- Detalles full-width debajo
- `max-h-[78vh]` con scroll interno

### 4.3 Dialog Detalles — Móvil

```
┌────────────────────────────────────┐
│  ✕  Nissan Versa 2022    [✏️] [🗑️]│
│  982-WXY · X109186                │
├────────────────────────────────────┤
│  [Contenido scrollable]           │
│  - Información del Auto           │
│  - Acciones Rápidas               │
│  - Documentos                     │
│  - Historial                      │
├────────────────────────────────────┤
│  [Cerrar]           [✏️ Editar]    │
└────────────────────────────────────┘
```

- `max-w-md` (448px)
- `max-h-[90vh]` con scroll
- Footer sticky con acciones

---

## 5. Validaciones

### 5.1 Placa

```typescript
const PLATE_REGEX = /^[A-Z0-9]{5,10}$/;

const validatePlate = (plate: string, vehicles: Vehicle[], excludeId?: string) => {
  if (plate.length === 0) return { valid: false, message: "" };
  if (plate.length < 5) return { valid: false, message: "Mínimo 5 caracteres" };
  if (!PLATE_REGEX.test(plate)) return { valid: false, message: "Formato inválido" };
  
  const isDuplicate = vehicles.some(
    (v) => v.plate_number === plate.toUpperCase() && v.id !== excludeId
  );
  if (isDuplicate) return { valid: false, message: "Ya existe un auto con estas placas" };
  
  return { valid: true, message: "✓ Placa válida" };
};
```

### 5.2 VIN

```typescript
const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/;

const validateVin = (vin: string) => {
  if (vin.length === 0) return { valid: false, message: "" };
  if (vin.length < 17) return { valid: false, message: `${vin.length}/17 caracteres` };
  if (!VIN_REGEX.test(vin)) return { valid: false, message: "Formato inválido" };
  return { valid: true, message: "✓ VIN válido" };
};
```

### 5.3 Engomado Automático

```typescript
const getVerificationSchedule = (plate: string) => {
  const lastDigit = parseInt(plate.slice(-1)) || 0;
  
  const schedules: Record<number, { color: string; months: string }> = {
    0: { color: "Azul", months: "Jun-Jul / Dec-Ene" },
    1: { color: "Verde", months: "May-Jun / Nov-Dic" },
    2: { color: "Verde", months: "May-Jun / Nov-Dic" },
    3: { color: "Rojo", months: "Apr-May / Oct-Nov" },
    4: { color: "Rojo", months: "Apr-May / Oct-Nov" },
    5: { color: "Amarillo", months: "Feb-Mar / Ago-Sep" },
    6: { color: "Amarillo", months: "Feb-Mar / Ago-Sep" },
    7: { color: "Rosa", months: "Mar-Abr / Sep-Oct" },
    8: { color: "Rosa", months: "Mar-Abr / Sep-Oct" },
    9: { color: "Azul", months: "Jun-Jul / Dec-Ene" },
  };
  
  return schedules[lastDigit] || { color: "N/D", months: "N/D" };
};
```

---

## 6. Criterios de Aceptación

### Dialog Detalles (Móvil)
- [ ] Tap en tarjeta abre Dialog (no expansión inline)
- [ ] Dialog muestra TODA la información de desktop expandido
- [ ] Header con nombre, placa, acciones (editar/eliminar)
- [ ] Sección: Información del Auto (11 campos)
- [ ] Sección: Acciones Rápidas (retirar/pieza/regresar)
- [ ] Sección: Documentos (3 documentos con thumbnails)
- [ ] Sección: Historial (VehicleHistory)
- [ ] Footer sticky con Cerrar + Editar
- [ ] Scroll funciona correctamente
- [ ] Desktop NO muestra dialogs (mantiene expansión inline)

### Formulario Registro (3 Pasos)
- [ ] Stepper muestra 3 pasos: Identificación → Documentos → Detalles
- [ ] Paso 1: Placa, marca, modelo, color
- [ ] Paso 2: Circulación + Seguro (combinados)
- [ ] Paso 3: VIN, renta, vigencias, engomado
- [ ] Validaciones en tiempo real (placa, VIN)
- [ ] OCR funciona para ambos documentos
- [ ] Guardar funciona correctamente
- [ ] Desktop usa grid 2 columnas
- [ ] Móvil usa stack vertical
- [ ] Touch targets ≥44px

### General
- [ ] Desktop (≥768px) idéntico al actual
- [ ] `tsc`, `eslint`, `npm test` verdes
- [ ] `_qa.mjs` 83/83 checks passed

---

## 7. Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `components/VehiclesSlice.tsx` | Reordenar form, nuevo stepper, agregar Dialog móvil |
| `features/vehicles/hooks/useVehicles.ts` | Nuevo default step, IntersectionObserver |
| `components/ui/VehicleDetailDialog.tsx` | **NUEVO** — Dialog de detalles para móvil |

---

## 8. Testing

### 8.1 Manual

1. **Móvil**: Tap en tarjeta → verificar Dialog abre
2. **Móvil**: Verificar toda la información se muestra
3. **Móvil**: Probar acciones (editar, eliminar, renovar)
4. **Desktop**: Verificar expansión inline funciona igual
5. **Formulario**: Probar 3 pasos en móvil y desktop
6. **Formulario**: Probar OCR y guardado

### 8.2 Automático

```bash
npx tsc --noEmit
npx eslint .
npm test
node _qa.mjs
```

---

## 9. Rollback

Si hay problemas:
1. Revertir commit: `git revert HEAD`
2. El comportamiento actual sigue funcionando
3. No hay cambios de base de datos

---

## 10. Referencias

- Uber Fleet: https://www.uber.com/us/en/drive/requirements/
- MobileCard actual: `components/ui/MobileCard.tsx`
- VehicleHistory: `components/VehicleHistory.tsx`
- Plan completo: `docs/superpowers/plans/2026-08-19-registration-flow-simplification.md`
