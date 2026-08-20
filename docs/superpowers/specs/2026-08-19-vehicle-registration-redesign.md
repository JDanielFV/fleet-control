# Design: Registro de Vehículo — Flujo Simplificado (3 Pasos)

Fecha: 2026-08-19
Inspiración: Uber Fleet vehicle onboarding

## Overview

Reemplazar el flujo actual de 4 pasos (Circulación → Seguro → Datos → Vigencias) con un flujo de **3 pasos** que pone la identificación del vehículo primero, combinando documentos en un solo paso.

---

## 1. Flujo de Usuario (UX)

### Estado Actual vs. Nuevo

| Paso | Actual | Nuevo |
|------|--------|-------|
| 1 | Tarjeta de Circulación (OCR) | **Identificación** (placa, marca, modelo) |
| 2 | Póliza de Seguro (OCR) | **Documentos** (circulación + seguro) |
| 3 | Datos del vehículo | **Detalles** (VIN, renta, vigencias) |
| 4 | Identificación y vigencias | — |

### Nuevo Flujo Detallado

```
┌─────────────────────────────────────────────────────────────────────┐
│  PASO 1: IDENTIFICACIÓN                                            │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  🚗 Datos del Vehículo                                     │   │
│  │  ─────────────────────────────────────────────────────     │   │
│  │                                                             │   │
│  │  Placa *                                                   │   │
│  │  ┌─────────────────────────────────────────────────────┐   │   │
│  │  │ 982-WXY                                              │   │   │
│  │  └─────────────────────────────────────────────────────┘   │   │
│  │  ✓ Formato válido · ✓ No duplicada                         │   │
│  │                                                             │   │
│  │  Marca *          Vehículo / Submarca *                    │   │
│  │  ┌──────────────┐ ┌──────────────────────────────────┐    │   │
│  │  │ Nissan       │ │ Versa                            │    │   │
│  │  └──────────────┘ └──────────────────────────────────┘    │   │
│  │                                                             │   │
│  │  Modelo (Año)       Clase / Tipo                           │   │
│  │  ┌──────────────┐ ┌──────────────────────────────────┐    │   │
│  │  │ 2022         │ │ Sedán                             │    │   │
│  │  └──────────────┘ └──────────────────────────────────┘    │   │
│  │                                                             │   │
│  │  Color                                                      │   │
│  │  ┌─────────────────────────────────────────────────────┐   │   │
│  │  │ Blanco                                               │   │   │
│  │  └─────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  💡 Datos pre-cargados desde OCR (si escaneaste primero)   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  [Atrás]                                    [Siguiente →]          │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  PASO 2: DOCUMENTOS                                                │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  📋 Documentos Vehiculares                                 │   │
│  │  ─────────────────────────────────────────────────────     │   │
│  │  ☑ Tarjeta de Circulación (requerido)                     │   │
│  │  ☑ Póliza de Seguro (requerido)                           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  🚗 Tarjeta de Circulación                                 │   │
│  │  ┌─────────────────────────────────────────────────────┐   │   │
│  │  │  [📸 Tomar Foto]  [📁 Subir Archivo]                │   │   │
│  │  └─────────────────────────────────────────────────────┘   │   │
│  │  ┌─────────────────────────────────────────────────────┐   │   │
│  │  │  ✅ Circulación cargada                              │   │   │
│  │  │  • Placa: 982-WXY                                   │   │   │
│  │  │  • VIN: 1HGBH41JXMN109186                           │   │   │
│  │  │  • Vigencia: 2025-03-15                             │   │   │
│  │  └─────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  🛡️ Póliza de Seguro                                       │   │
│  │  ┌─────────────────────────────────────────────────────┐   │   │
│  │  │  [📸 Tomar Foto]  [📁 Subir Archivo]  [📄 Multi-pág]│   │   │
│  │  └─────────────────────────────────────────────────────┘   │   │
│  │  ┌─────────────────────────────────────────────────────┐   │   │
│  │  │  ✅ Seguro cargado · 2 páginas                      │   │   │
│  │  │  • No. Póliza: POL-123456                           │   │   │
│  │  │  • Vigencia: 2025-06-30                             │   │   │
│  │  └─────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  💡 Ambos documentos se escanean en un solo paso           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  [← Atrás]                              [Siguiente →]              │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  PASO 3: DETALLES                                                  │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  🔢 Identificación                                         │   │
│  │  ─────────────────────────────────────────────────────     │   │
│  │                                                             │   │
│  │  VIN / NIV                                                 │   │
│  │  ┌─────────────────────────────────────────────────────┐   │   │
│  │  │ 1HGBH41JXMN109186                                   │   │   │
│  │  └─────────────────────────────────────────────────────┘   │   │
│  │  ✓ 17 caracteres · Formato válido                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  💰 Renta y Servicio                                       │   │
│  │  ─────────────────────────────────────────────────────     │   │
│  │                                                             │   │
│  │  Costo Renta Semanal ($)    Próx. Servicio (km)            │   │
│  │  ┌──────────────────────┐  ┌──────────────────────────┐   │   │
│  │  │ 2500                 │  │ 20000                     │   │   │
│  │  └──────────────────────┘  └──────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  📅 Vigencias                                              │   │
│  │  ─────────────────────────────────────────────────────     │   │
│  │                                                             │   │
│  │  Circulación           Seguro               Verificación   │   │
│  │  ┌──────────────┐     ┌──────────────┐     ┌──────────┐  │   │
│  │  │ 2025-03-15   │     │ 2025-06-30   │     │ 2025-04  │  │   │
│  │  └──────────────┘     └──────────────┘     └──────────┘  │   │
│  │                                                             │   │
│  │  🔵 Engomado: Azul (meses: Jun-Jul / Dec-Ene)             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ✅ Todo listo para registrar                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  [← Atrás]                    [✓ Registrar Vehículo]               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Componentes y Estructura

### 2.1 Stepper

```tsx
// Nuevo stepper de 3 pasos
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

### 2.2 Sección: Identificación

**Campos:**

| Campo | Tipo | Requerido | Validación |
|-------|------|-----------|------------|
| Placa | Text (mono) | Sí | 5-10 caracteres, sin duplicados |
| Marca | Text | Sí | Min 2 caracteres |
| Vehículo/Submarca | Text | Sí | Min 2 caracteres |
| Modelo (Año) | Text | No | 4 dígitos |
| Clase/Tipo | Text | No | Sedán, SUV, etc. |
| Color | Text | No | — |

**Elementos UI:**
- Campo placa con validación en tiempo real
- Feedback de duplicado: "✗ Ya existe un auto con estas placas"
- Campos de marca/vehículo en grid 2 columnas
- Indicador de completitud: `[4/6 campos]`

### 2.3 Sección: Documentos

**Documentos:**

| Documento | Requerido | OCR | Feedback |
|-----------|-----------|-----|----------|
| Tarjeta Circulación | Sí | Gemini → Tesseract | ✅ Cargado + datos extraídos |
| Póliza Seguro | Sí | Gemini → Tesseract | ✅ Cargado + No. póliza |

**Elementos UI:**
- Ambos documentos en un solo paso
- Scanner OCR combinado (puede escanear uno y luego otro)
- Preview del documento cargado
- Para seguro: soporte multi-página (PDF/Imágenes)
- Feedback de éxito con datos extraídos

### 2.4 Sección: Detalles

**Campos:**

| Campo | Tipo | Requerido | Validación |
|-------|------|-----------|------------|
| VIN/NIV | Text (mono) | No | 17 caracteres |
| Costo renta semanal | Number | No | ≥ 0 |
| Próximo servicio (km) | Number | No | ≥ 0 |
| Vigencia circulación | Date | No | — |
| Vigencia seguro | Date | No | — |
| Verificación | Date | No | Auto-calculado |

**Elementos UI:**
- VIN con validación de longitud
- Campos de renta y servicio en grid 2 columnas
- Fechas de vigencia en grid 3 columnas
- Engomado auto-calculado desde la placa
- Indicador de verificación: "🔵 Azul · Jun-Jul"

---

## 3. Estado del Formulario (Hook)

### 3.1 Reordenar Estado

```typescript
// Paso 1: Identificación (NUEVO ORDEN)
const [plateNumber, setPlateNumber] = useState("");
const [brand, setBrand] = useState("");
const [vehicleName, setVehicleName] = useState("");
const [model, setModel] = useState("");
const [classType, setClassType] = useState("");
const [color, setColor] = useState("");

// Paso 2: Documentos (COMBINADOS)
const [circulationImg, setCirculationImg] = useState("");
const [insurancePolicyImg, setInsurancePolicyImg] = useState("");
const [insurancePolicyFiles, setInsurancePolicyFiles] = useState<string[]>([]);

// Paso 3: Detalles
const [vin, setVin] = useState("");
const [rentCost, setRentCost] = useState(2500);
const [nextServiceMileage, setNextServiceMileage] = useState("");
const [circulationExpirationDate, setCirculationExpirationDate] = useState("");
const [insuranceExpirationDate, setInsuranceExpirationDate] = useState("");
```

### 3.2 IntersectionObserver

```typescript
// Actualizar IDs de secciones
const ids = ["id", "docs", "details"];

// Default step
const [activeSection, setActiveSection] = useState<string>("id");
```

### 3.3 Funciones de Utilidad

```typescript
// Verificar si un paso está completo
const isStepComplete = (step: "id" | "docs" | "details") => {
  switch (step) {
    case "id":
      return plateNumber.trim() && brand.trim() && vehicleName.trim();
    case "docs":
      return circulationImg && insurancePolicyImg;
    case "details":
      return true; // Siempre se puede revisar
  }
};

// Calcular engomado desde placa
const getEngomadoFromPlate = (plate: string) => {
  const lastDigit = parseInt(plate.slice(-1)) || 0;
  // Lógica de engomado según último dígito
  return { color: "Azul", months: "Jun-Jul / Dec-Ene" };
};
```

---

## 4. Layout Responsivo

### 4.1 Móvil (< 768px)

```
┌────────────────────────────┐
│  [Stepper: ID → Docs → Details]  │
├────────────────────────────┤
│  [Contenido scrollable]    │
│  - Identificación          │
│  - Documentos              │
│  - Detalles                │
├────────────────────────────┤
│  [← Atrás] [Siguiente →]  │  ← Sticky footer
└────────────────────────────┘
```

- Contenido: `max-h-[62vh] overflow-y-auto`
- Footer: `sticky bottom-0 bg-background border-t`
- Inputs: `h-11` (target ≥44px)

### 4.2 Desktop (≥ 768px)

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

---

## 5. Validaciones

### 5.1 Placa

```typescript
// Formato mexicano: 3 letras + 3 números (o variaciones)
const PLATE_REGEX = /^[A-Z0-9]{5,10}$/;

// Verificar duplicado
const isDuplicatePlate = vehicles.some(
  (v) => v.plate_number === formattedPlate && v.id !== editingVehicleId
);

// Feedback en tiempo real
const validatePlate = (plate: string) => {
  if (plate.length === 0) return { valid: false, message: "" };
  if (plate.length < 5) return { valid: false, message: "Mínimo 5 caracteres" };
  if (!PLATE_REGEX.test(plate)) return { valid: false, message: "Formato inválido" };
  if (isDuplicatePlate) return { valid: false, message: "Ya existe un auto con estas placas" };
  return { valid: true, message: "✓ Placa válida" };
};
```

### 5.2 VIN

```typescript
// VIN: 17 caracteres alfanuméricos (sin I, O, Q)
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
// Calcular engomado desde placa
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

## 6. OCR Combinado

### 6.1 Flujo de Escaneo

```
Usuario hace clic en [📸 Tomar Foto] de Circulación
  → Se abre cámara
  → Se captura imagen
  → OCR processOcrOnImageSource(image, "CIRCULACION")
  → Se extraen: placa, marca, modelo, VIN, vigencia
  → Se auto-completan campos de Paso 1 y Paso 3

Usuario hace clic en [📸 Tomar Foto] de Seguro
  → Se abre cámara
  → Se captura imagen
  → OCR processOcrOnImageSource(image, "SEGURO")
  → Se extrae: No. póliza, vigencia
  → Se auto-completan campos de Paso 3
```

### 6.2 Prioridad de Datos

Si hay conflictos entre datos manualmente introducidos y OCR:
- **Placa**: OCR sobreescribe solo si el campo está vacío
- **Marca/Modelo**: OCR sobreescribe solo si el campo está vacío
- **VIN**: OCR sobreescribe solo si el campo está vacío
- **Vigencias**: OCR siempre actualiza (es datos de documento)

---

## 7. Criterios de Aceptación

- [ ] Stepper muestra 3 pasos: Identificación → Documentos → Detalles
- [ ] Paso 1 muestra placa, marca, modelo, color
- [ ] Placa tiene feedback en tiempo real
- [ ] Paso 2 muestra circulación y seguro juntos
- [ ] OCR funciona para ambos documentos
- [ ] Paso 3 muestra VIN, renta, vigencias
- [ ] Engomado se auto-calcula desde placa
- [ ] Desktop (≥768px) usa grid 2 columnas
- [ ] Móvil (<768px) usa stack vertical
- [ ] Touch targets ≥44px en todos los botones
- [ ] Guardar funciona correctamente
- [ ] No hay regressions en funcionalidad existente

---

## 8. Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `components/VehiclesSlice.tsx` | Reordenar secciones, nuevo stepper |
| `features/vehicles/hooks/useVehicles.ts` | Nuevo default step, IntersectionObserver |

---

## 9. Testing

### 9.1 Manual

1. Abrir formulario de nuevo vehículo
2. Verificar stepper muestra 3 pasos
3. Llenar identificación → siguiente
4. Cargar circulación y seguro → siguiente
5. Verificar detalles y vigencias
6. Guardar → verificar vehículo se crea

### 9.2 Automático

```bash
# Typecheck
npx tsc --noEmit

# Lint
npx eslint .

# Tests
npm test

# QA Playwright
node _qa.mjs
```

---

## 10. Rollback

Si hay problemas:
1. Revertir commit: `git revert HEAD`
2. El flujo actual (4 pasos) sigue funcionando
3. No hay cambios de base de datos

---

## 11. Referencias

- Uber Fleet: https://www.uber.com/us/en/drive/requirements/
- Stepper actual: `components/ui/stepper.tsx`
- Wizard: `components/ui/wizard.tsx`
- Plan completo: `docs/superpowers/plans/2026-08-19-registration-flow-simplification.md`
- OCR actual: `features/vehicles/hooks/useVehicles.ts` (processOcrOnImageSource)
