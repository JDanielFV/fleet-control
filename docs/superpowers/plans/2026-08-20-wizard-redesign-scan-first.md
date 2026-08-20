# Plan: Rediseño de Wizard de Registro (Autos y Choferes)

> **Objetivo:** Simplificar drásticamente los flujos de registro. El usuario solo ingresa 2-3 campos manuales; el resto lo llena el OCR desde los documentos escaneados.
> 
> **Inspiración:** El enfoque de Uber Fleet donde el flujo es "minimal input → scan documents → done".

---

## 📊 Análisis del Problema Actual

### Flujo Actual (Vehículos) — 3 pasos, ~12 campos
```
Paso 1: Identificación → Placa, Marca, Vehículo, Modelo, Clase, Color     (6 campos)
Paso 2: Documentos → Circulación (foto/OCR), Seguro (foto/OCR)            (2 uploads)
Paso 3: Detalles → VIN, Renta, Servicio, Vigencia Circ, Vigencia Seguro  (5 campos)
```
**Problema:** El usuario llena ~11 campos manuales cuando el OCR ya extrae Placa, VIN, Marca, Modelo, Clase y Vigencias.

### Flujo Actual (Choferes) — 3 pasos, ~10 campos
```
Paso 1: Datos → Nombre(s), Apellido Pat, Apellido Mat, CURP              (4 campos)
Paso 2: Documentos → Foto, INE (OCR), Licencia (OCR), Domicilio          (4 uploads)
Paso 3: Revisión → Resumen                                                 (0 campos)
```
**Problema:** El usuario llena nombre y CURP manualmente cuando el INE ya extrae todos esos campos.

---

## 🎯 Flujo Rediseñado: Vehículos

### Concepto: "Solo placa, color y renta → el auto se registra solo"

```
┌─────────────────────────────────────────────────────────────┐
│  REGISTRO DE VEHÍCULO                                       │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  ┌─ PASO 1: Datos del Auto ──────────────────────────────┐  │
│  │                                                       │  │
│  │  💰 Renta Semanal    │  🎨 Color                      │  │
│  │  [____$2,500____]    │  [_________Blanco_________]   │  │
│  │                                                       │  │
│  │  📋 Placa (opcional) │  🚗 Kilometraje Próx. Serv.   │  │
│  │  [________982-WXY___]│  [________20,000 km________]  │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─ PASO 2: Escanea los Documentos ──────────────────────┐  │
│  │                                                       │  │
│  │  ┌──────────────────┐    ┌──────────────────┐        │  │
│  │  │  📄 Circulación   │    │  🛡️ Seguro        │        │  │
│  │  │                   │    │                   │        │  │
│  │  │  [📷 Tomar Foto]  │    │  [📷 Tomar Foto]  │        │  │
│  │  │  [📁 Subir]       │    │  [📁 Subir]       │        │  │
│  │  │                   │    │                   │        │  │
│  │  │  ✅ Placa: 982-WXY│    │  ✅ Póliza: 12345 │        │  │
│  │  │  ✅ VIN: X109186  │    │  ✅ Vence: 2026   │        │  │
│  │  │  ✅ Marca: Nissan │    │                   │        │  │
│  │  │  ✅ Vence: 2026   │    │                   │        │  │
│  │  └──────────────────┘    └──────────────────┘        │  │
│  │                                                       │  │
│  │  ⚡ Auto-generado: engomado 🔵 Azul (por placa)      │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─ PASO 3: Revisión ───────────────────────────────────┐  │
│  │                                                       │  │
│  │  🚗 Nissan Versa 2022 · 982-WXY · 🔵 Azul           │  │
│  │  Renta: $2,500/sem · VIN: X109186                    │  │
│  │                                                       │  │
│  │  📄 Circulación · Vence: 15/Dic/2026                 │  │
│  │  🛡️ Seguro · Vence: 01/Mar/2026                     │  │
│  │                                                       │  │
│  │  ⚠️ Vigencia seguros vence en 6 meses                │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  [ ← Atrás ]                           [ Guardar Auto ]    │
└─────────────────────────────────────────────────────────────┘
```

### Cambios Clave

| # | Cambio | Antes | Después |
|---|--------|-------|---------|
| 1 | **Paso 1 = solo datos manuales** | 6 campos (Placa, Marca, Vehículo, Modelo, Clase, Color) | 2-4 campos (Renta, Color, Placa opcional, Servicio opc.) |
| 2 | **Paso 2 = solo escaneo** | Mix de uploads + campos manuales | Solo botones de cámara/subir por documento |
| 3 | **OCR llena todo** | El usuario rellena después del OCR | El OCR llena automáticamente Marca, Modelo, VIN, Vigencias |
| 4 | **Engomado auto-calculado** | Manual o no existía | Se calcula desde la placa en tiempo real |
| 5 | **Resumen visual en paso 3** | Lista de texto | Card visual con datos consolidados |
| 6 | **Campos eliminados** | Clase/Tipo manual | Se infiere del OCR o se deja "Sedán" como default |

### Campos que el OCR llena automáticamente (Circulación):

```
OCR Circulación → extrae:
  ├── plateNumber    → se muestra como confirmación
  ├── vin            → se llena automáticamente
  ├── brand          → se llena automáticamente  
  ├── modelYear      → se llena como "Modelo"
  ├── expirationDate → vigencia de circulación
  └── classType      → se infiere (futuro)

OCR Seguro → extrae:
  ├── policyNumber   → número de póliza
  └── expirationDate → vigencia del seguro
```

---

## 🎯 Flujo Rediseñado: Choferes

### Concepto: "Solo nombre → el chofer se registra desde sus documentos"

```
┌─────────────────────────────────────────────────────────────┐
│  REGISTRO DE CONDUCTOR                                      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  ┌─ PASO 1: Datos del Conductor ─────────────────────────┐  │
│  │                                                       │  │
│  │  [Avatar circular] ← foto (opcional, cámara/subir)   │  │
│  │                                                       │  │
│  │  Nombre(s) *          │  Apellido Paterno *           │  │
│  │  [____Juan Carlos____]│  [________Pérez____________]  │  │
│  │                                                       │  │
│  │  Apellido Materno     │  Teléfono (opcional)          │  │
│  │  [____López_________]│  [____443 123 4567__________] │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─ PASO 2: Documentos ──────────────────────────────────┐  │
│  │                                                       │  │
│  │  ┌──────────────────┐    ┌──────────────────┐        │  │
│  │  │  🪪 INE            │    │  🪪 Licencia       │        │  │
│  │  │                   │    │                   │        │  │
│  │  │  [📷 Tomar Foto]  │    │  [📷 Tomar Foto]  │        │  │
│  │  │  [📁 Subir]       │    │  [📁 Subir]       │        │  │
│  │  │                   │    │                   │        │  │
│  │  │  ✅ CURP: ABCD12..│    │  ✅ No: 123456789 │        │  │
│  │  │  ✅ Clave Electoral│    │  ✅ Vence: 2026   │        │  │
│  │  └──────────────────┘    └──────────────────┘        │  │
│  │                                                       │  │
│  │  ┌──────────────────────────────────────────────┐    │  │
│  │  │  📄 Comprobante Domicilio (opcional)          │    │  │
│  │  │  [📷 Tomar Foto]  [📁 Subir]                  │    │  │
│  │  └──────────────────────────────────────────────┘    │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─ PASO 3: Revisión ───────────────────────────────────┐  │
│  │                                                       │  │
│  │  [Avatar] Juan Carlos Pérez López                    │  │
│  │  CURP: ABCD123456HDFRRN01                            │  │
│  │                                                       │  │
│  │  ✅ INE cargado · ✅ Licencia cargada                │  │
│  │  ⚠️ Domicilio no cargado (opcional)                  │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  [ ← Atrás ]                       [ Guardar Conductor ]   │
└─────────────────────────────────────────────────────────────┘
```

### Cambios Clave

| # | Cambio | Antes | Después |
|---|--------|-------|---------|
| 1 | **Paso 1 = solo nombre + foto** | 4 campos (Nombre, Ap Pat, Ap Mat, CURP) | 4 campos pero CURP se llena desde OCR |
| 2 | **CURP auto-desde INE** | Se llenaba manual o con sugerencia | El INE llena automáticamente: CURP, Clave Electoral, Sexo, DOB |
| 3 | **Licencia llena: número, vigencia** | Se llenaba manual | OCR extrae todo automáticamente |
| 4 | **Domicilio = 100% opcional** | Requerido en sección separada | Opcional en paso 2, badge "Cargado" |
| 5 | **Foto de perfil = opcional** | Paso dedicado completo | Botón pequeño en paso 1 |
| 6 | **Resumen visual en paso 3** | Lista de texto | Card con thumbnails y badges |

---

## 📁 Archivos a Modificar

### Vehículos

| Archivo | Cambios |
|---------|---------|
| `components/VehiclesSlice.tsx` | Reordenar form: Paso 1 (Renta, Color, Placa, Servicio), Paso 2 (solo uploads), Paso 3 (resumen visual) |
| `features/vehicles/hooks/useVehicles.ts` | Nuevo default step, IntersectionObserver actualizado, OCR auto-fill mejorado |
| `lib/ocr.ts` | *(opcional)* Mejorar parsing de CIRCULACION para extraer más campos confiables |

### Choferes

| Archivo | Cambios |
|---------|---------|
| `components/DriverFormDialog.tsx` | Reordenar: Paso 1 (Nombre + foto), Paso 2 (INE + Lic + Domicilio), Paso 3 (resumen) |
| `features/drivers/hooks/useDrivers.ts` | CURP auto-fill desde INE OCR, nuevo default step |

---

## 🔧 Flujo OCR Auto-Fill (Vehículos)

```
1. Usuario ingresa en Paso 1: Renta ($2,500) + Color (Blanco)
2. Usuario avanza a Paso 2
3. Usuario escanea Tarjeta de Circulación:
   ┌─────────────────────────────────────────────┐
   │ OCR detecta:                                │
   │   Placa: 982-WXY → confirma/auto-llena     │
   │   VIN: X109186789012345 → auto-llena       │
   │   Marca: NISSAN → auto-llena                │
   │   Modelo: 2022 → auto-llena                 │
   │   Vigencia: 2026-12-15 → auto-llena         │
   └─────────────────────────────────────────────┘
4. Usuario escanea Póliza de Seguro:
   ┌─────────────────────────────────────────────┐
   │ OCR detecta:                                │
   │   No. Póliza: 987654321 → auto-llena       │
   │   Vigencia: 2026-03-01 → auto-llena         │
   └─────────────────────────────────────────────┘
5. Engomado se auto-calcula: 982-WXY termina en 2 → 🔵 Azul
6. Paso 3 muestra resumen consolidado con TODOS los datos
```

## 🔧 Flujo OCR Auto-Fill (Choferes)

```
1. Usuario ingresa en Paso 1: Nombre (Juan Carlos) + Apellido (Pérez López)
2. Usuario escanea INE:
   ┌─────────────────────────────────────────────┐
   │ OCR detecta:                                │
   │   CURP: ABCD123456HDFRRN01 → auto-llena   │
   │   Clave Electoral: FLOV.. → auto-llena     │
   │   Sexo: M → auto-llena                      │
   │   Fecha Nac: 1990-01-15 → auto-llena       │
   │   Domicilio: Calle... → auto-llena         │
   └─────────────────────────────────────────────┘
3. Si nombre del OCR ≠ nombre manual → mostrar sugerencia "¿Aplicar?"
4. Usuario escanea Licencia:
   ┌─────────────────────────────────────────────┐
   │ OCR detecta:                                │
   │   No. Licencia: 1234567890 → auto-llena    │
   │   CURP: ABCD123456HDFRRN01 → confirma     │
   │   Vigencia: 2026-12-31 → auto-llena        │
   │   ¿Permanente?: No → auto-llena            │
   └─────────────────────────────────────────────┘
5. Validación cruzada: CURP INE === CURP Licencia → ✅ o ⚠️
6. Paso 3 muestra resumen con thumbnails de documentos
```

---

## ⏱️ Fases de Implementación

### Fase 1: Wizard de Vehículos (Prioridad)
1. Reordenar `VehiclesSlice.tsx` — Paso 1 solo Renta + Color + Placa + Servicio
2. Paso 2 solo uploads de documentos (sin campos manuales)
3. Paso 3 resumen visual consolidado
4. Auto-fill mejorado en `useVehicles.ts`
5. Engomado auto-calculado visible en tiempo real

### Fase 2: Wizard de Choferes
1. Reordenar `DriverFormDialog.tsx` — Paso 1 solo Nombre + Foto
2. CURP auto-fill desde INE OCR
3. Domicilio como 100% opcional con badge
4. Paso 3 resumen visual con thumbnails

### Fase 3: Pulido
1. Animaciones de transición entre pasos
2. Indicadores de completitud en tiempo real
3. Feedback de OCR inline (checkmarks ✅ por campo auto-llenado)
4. Testing mobile + desktop

---

## ✅ Criterios de Aceptación

### Vehículos
- [ ] Paso 1: Solo Renta + Color (+ Placa y Servicio opcionales)
- [ ] Paso 2: Solo botones de cámara/subir por documento
- [ ] OCR Circulación llena: Placa, VIN, Marca, Modelo, Vigencia
- [ ] OCR Seguro llena: No. Póliza, Vigencia
- [ ] Engomado auto-calculado desde placa
- [ ] Paso 3: Resumen visual con TODOS los datos consolidados
- [ ] Desktop (≥768px): Mantiene tabla, dialog solo en móvil
- [ ] Touch targets ≥44px en móvil

### Choferes
- [ ] Paso 1: Solo Nombre + Apellidos (+ Foto opcional)
- [ ] CURP auto-llenado desde INE OCR
- [ ] Licencia OCR llena: No. Licencia, Vigencia, Permanente
- [ ] Domicilio 100% opcional
- [ ] Paso 3: Resumen visual con thumbnails
- [ ] Desktop (≥768px): Mantiene layout actual

### Ambos
- [ ] `npx tsc --noEmit` sin errores
- [ ] `npm test` 44/44 passed
- [ ] `_qa.mjs` 83/83 checks passed
- [ ] Stepper funciona correctamente en ambos breakpoints
- [ ] Scroll automático al paso actual
- [ ] Form validation funciona correctamente

---

## 📐 Diagrama de Flujo General

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   PASO 1     │     │   PASO 2     │     │   PASO 3     │
│  (Manual)    │ ──→ │  (Escaneo)   │ ──→ │  (Resumen)   │
│              │     │              │     │              │
│ Vehículo:    │     │ Vehículo:    │     │ Ambos:       │
│ • Renta      │     │ • Circulación│     │ • Card visual│
│ • Color      │     │ • Seguro     │     │ • Checkmarks │
│ • Placa (op) │     │              │     │ • Alerts     │
│ • Servicio   │     │ Chofer:      │     │ • Editar     │
│              │     │ • INE        │     │              │
│ Chofer:      │     │ • Licencia   │     │              │
│ • Nombre     │     │ • Domicilio  │     │              │
│ • Apellidos  │     │              │     │              │
│ • Foto (op)  │     │              │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
     2-4 campos           0 campos            0 campos
     manuales             manuales            manuales
```
