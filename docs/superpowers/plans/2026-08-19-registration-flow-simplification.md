# Plan: Simplificación de flujos de registro — fleet-control

Fecha: 2026-08-19
Base: análisis comparativo con Uber Fleet y auditoría del código actual

## Contexto / problema

Los flujos de registro actuales son funcionales pero tienen **exceso de pasos y complejidad** comparados con la experiencia de Uber Fleet:

### Estado actual

| Entidad | Pasos actuales | Problemas clave |
|---------|----------------|-----------------|
| **Choferes** | 4 secciones (Foto → Docs → Domicilio → Datos) | Sección "Datos" con 10 campos colapsable; denso en móvil |
| **Vehículos** | 4 pasos (Circulación → Seguro → Datos → Vigencias) | Documentos separados; información básica en paso 3 |

### Referencia: Uber Fleet

Uber usa un flujo de **3 pasos simples**:
1. **Tell us about yourself** → Datos básicos
2. **Share required documents** → Documentos esenciales  
3. **Get the app and go** → Revisión/activación

**Principios de Uber:**
- Minimalismo: solo lo esencial primero
- Progreso lineal claro
- Documentos en un solo paso
- Revisión al final

## Objetivo

Reducir los flujos de **4 pasos a 3 pasos** siguiendo el modelo Uber:

### Nuevo flujo: Choferes (3 pasos)

```
┌─────────────────────────────────────────────────────────────┐
│  PASO 1: Datos Básicos                                      │
│  ├── Nombre completo (campo compound: nombre + apellidos)   │
│  ├── CURP (con validación en tiempo real)                   │
│  └── Teléfono (opcional, para contacto)                     │
├─────────────────────────────────────────────────────────────┤
│  PASO 2: Documentos                                         │
│  ├── INE (foto/OCR)                                         │
│  ├── Licencia de Conducir (foto/OCR)                        │
│  ├── Foto de perfil (opcional)                              │
│  └── Comprobante de domicilio (opcional)                    │
├─────────────────────────────────────────────────────────────┤
│  PASO 3: Revisión                                           │
│  ├── Resumen de datos capturados                            │
│  ├── Documentos cargados (thumbnails)                       │
│  ├── Validaciones pendientes (si hay)                       │
│  └── Botón "Registrar Conductor"                            │
└─────────────────────────────────────────────────────────────┘
```

### Nuevo flujo: Vehículos (3 pasos)

```
┌─────────────────────────────────────────────────────────────┐
│  PASO 1: Identificación                                     │
│  ├── Placa (con validación de duplicados)                   │
│  ├── Marca / Modelo / Año                                   │
│  ├── Color                                                  │
│  └── Clase/Tipo (Sedán, SUV, etc.)                          │
├─────────────────────────────────────────────────────────────┤
│  PASO 2: Documentos                                         │
│  ├── Tarjeta de Circulación (foto/OCR)                      │
│  ├── Póliza de Seguro (foto/OCR, multi-página)              │
│  └── Ambos documentos en un solo paso                       │
├─────────────────────────────────────────────────────────────┤
│  PASO 3: Detalles                                           │
│  ├── VIN/NIV (validación 17 caracteres)                     │
│  ├── Costo renta semanal                                    │
│  ├── Kilometraje próximo servicio                           │
│  └── Fechas de vigencia (circulación, seguro, verificación) │
└─────────────────────────────────────────────────────────────┘
```

## Cambios necesarios por archivo

### 1. `components/DriverFormDialog.tsx`

**Cambios:**
- Reordenar secciones: Datos Básicos → Documentos → Revisión
- Crear sección "Datos Básicos" con campos esenciales al inicio
- Mover foto de perfil a sección de documentos (opcional)
- Crear sección "Revisión" con resumen antes de guardar
- Actualizar Stepper de 4 a 3 pasos

**Estructura actual:**
```tsx
<Stepper steps={[
  { id: "foto", label: "Foto" },
  { id: "doc", label: "Documentos" },
  { id: "dom", label: "Domicilio" },
  { id: "datos", label: "Datos" },
]} />
```

**Nueva estructura:**
```tsx
<Stepper steps={[
  { id: "datos", label: "Datos" },
  { id: "docs", label: "Documentos" },
  { id: "review", label: "Revisión" },
]} />
```

### 2. `features/drivers/hooks/useDrivers.ts`

**Cambios:**
- Actualizar `activeSection` default de `"doc"` a `"datos"`
- Actualizar IntersectionObserver IDs de `["foto", "doc", "dom", "datos"]` a `["datos", "docs", "review"]`
- Agregar estado para teléfono (nuevo campo)
- Agregar función `getCompletionStatus()` para la sección de revisión

### 3. `components/VehiclesSlice.tsx`

**Cambios:**
- Reordenar secciones: Identificación → Documentos → Detalles
- Mover placa, marca, modelo, año al paso 1
- Combinar circulación y seguro en paso 2
- Mover VIN, renta, vigencias al paso 3
- Actualizar Stepper de 4 a 3 pasos

**Estructura actual:**
```tsx
<Stepper steps={[
  { id: "circ", label: "Circulación" },
  { id: "seguro", label: "Seguro" },
  { id: "datos", label: "Datos" },
  { id: "vig", label: "Vigencias" },
]} />
```

**Nueva estructura:**
```tsx
<Stepper steps={[
  { id: "id", label: "Identificación" },
  { id: "docs", label: "Documentos" },
  { id: "details", label: "Detalles" },
]} />
```

### 4. `features/vehicles/hooks/useVehicles.ts`

**Cambios:**
- Actualizar `activeSection` default de `"circ"` a `"id"`
- Actualizar IntersectionObserver IDs de `["circ", "seguro", "datos", "vig"]` a `["id", "docs", "details"]`
- Reordenar campos del formulario para coincidir con nuevos pasos

## Fases de implementación

### Fase 1: Choferes — Reordenar formulario (1-2 horas)

**Tareas:**
1. Crear nueva sección "Datos Básicos" con campos esenciales
2. Mover campos de "Datos Manuales" al inicio
3. Mover foto de perfil a sección de documentos
4. Crear sección "Revisión" con resumen visual
5. Actualizar Stepper de 4 a 3 pasos
6. Actualizar IntersectionObserver en hook
7. Testing manual en móvil (375px) y desktop

**Archivos a modificar:**
- `components/DriverFormDialog.tsx`
- `features/drivers/hooks/useDrivers.ts`

**Criterios de aceptación:**
- [ ] Stepper muestra 3 pasos: Datos → Documentos → Revisión
- [ ] Nombre, CURP visibles en paso 1
- [ ] INE, Licencia, Foto en paso 2
- [ ] Resumen completo en paso 3
- [ ] Guardar funciona correctamente
- [ ] Desktop (≥1024px) no cambia visualmente

### Fase 2: Vehículos — Reordenar formulario (1-2 horas)

**Tareas:**
1. Crear nueva sección "Identificación" con placa, marca, modelo
2. Combinar circulación y seguro en sección "Documentos"
3. Mover VIN, renta, vigencias a sección "Detalles"
4. Actualizar Stepper de 4 a 3 pasos
5. Actualizar IntersectionObserver en hook
6. Testing manual en móvil y desktop

**Archivos a modificar:**
- `components/VehiclesSlice.tsx`
- `features/vehicles/hooks/useVehicles.ts`

**Criterios de aceptación:**
- [ ] Stepper muestra 3 pasos: Identificación → Documentos → Detalles
- [ ] Placa, marca, modelo, año visibles en paso 1
- [ ] Circulación y seguro en paso 2
- [ ] VIN, renta, vigencias en paso 3
- [ ] Guardar funciona correctamente
- [ ] Desktop no cambia visualmente

### Fase 3: Validaciones mejoradas (1 hora)

**Tareas:**
1. Agregar validación de CURP en tiempo real (formato + checksum)
2. Agregar validación de placa (formato mexicano)
3. Agregar indicadores de completitud por campo
4. Agregar tooltips explicativos para documentos requeridos

**Archivos a modificar:**
- `components/DriverFormDialog.tsx`
- `components/VehiclesSlice.tsx`
- `lib/ocr.ts` (validación CURP)

### Fase 4: Testing y QA (1 hora)

**Tareas:**
1. Ejecutar `_qa.mjs` en todos los viewports
2. Verificar touch targets ≥40px en nuevos formularios
3. Probar flujo completo en móvil (iOS Safari, Chrome)
4. Verificar que desktop no cambió
5. Typecheck y lint

**Comandos:**
```bash
npx tsc --noEmit
npx eslint .
npm test
node _qa.mjs
```

## Orden de ejecución

```
Fase 1 (Choferes) → Fase 2 (Vehículos) → Fase 3 (Validaciones) → Fase 4 (QA)
```

**Riesgos:**
- Reordenar secciones puede romper IntersectionObserver → verificar IDs
- Cambiar orden de campos puede afectar OCR → probar OCR después de cambios
- Desktop no debe cambiar → usar prefijos `md:`/`lg:` cuidadosamente

## Rollback

Si hay problemas:
1. Revertir commits por fase (cada fase es un commit atómico)
2. El código actual funciona bien, solo es menos óptimo
3. No hay cambios de base de datos ni API

## Métricas de éxito

| Métrica | Actual | Objetivo |
|---------|--------|----------|
| Pasos choferes | 4 | 3 |
| Pasos vehículos | 4 | 3 |
| Tiempo registro chofer (est.) | ~5 min | ~3 min |
| Tiempo registro vehículo (est.) | ~4 min | ~2.5 min |
| Campos obligatorios visibles primero | 0 de 3 | 3 de 3 |

## Checklist de aceptación final

- [ ] Choferes: 3 pasos (Datos → Docs → Revisión)
- [ ] Vehículos: 3 pasos (Identificación → Docs → Detalles)
- [ ] Datos básicos visibles en paso 1
- [ ] Documentos combinados en paso 2
- [ ] Revisión/resumen en paso 3
- [ ] Validaciones en tiempo real funcionando
- [ ] Desktop (≥1024px) idéntico al actual
- [ ] Móvil (<768px) sin scroll horizontal
- [ ] Touch targets ≥40px
- [ ] `tsc`, `eslint`, `npm test` verdes
- [ ] `_qa.mjs` 83/83 checks passed
