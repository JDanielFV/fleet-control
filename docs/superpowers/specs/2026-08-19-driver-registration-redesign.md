# Design: Registro de Conductor — Flujo Simplificado (3 Pasos)

Fecha: 2026-08-19
Inspiración: Uber Fleet driver onboarding

## Overview

Reemplazar el flujo actual de 4 secciones (Foto → Docs → Domicilio → Datos) con un flujo de **3 pasos** que pone los datos básicos primero, siguiendo el patrón minimalista de Uber Fleet.

---

## 1. Flujo de Usuario (UX)

### Estado Actual vs. Nuevo

| Paso | Actual | Nuevo |
|------|--------|-------|
| 1 | Foto de perfil | **Datos Básicos** (nombre, CURP, teléfono) |
| 2 | Documentos (INE + Licencia) | **Documentos** (INE + Licencia + Foto + Domicilio) |
| 3 | Comprobante de domicilio | **Revisión** (resumen + confirmar) |
| 4 | Datos manuales (10 campos) | — |

### Nuevo Flujo Detallado

```
┌─────────────────────────────────────────────────────────────────────┐
│  PASO 1: DATOS BÁSICOS                                             │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Nombre Completo *                                         │   │
│  │  ┌─────────────────────┬─────────────────┬───────────────┐ │   │
│  │  │ Nombre(s)           │ Ap. Paterno *   │ Ap. Materno   │ │   │
│  │  └─────────────────────┴─────────────────┴───────────────┘ │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  CURP *                                                    │   │
│  │  ┌─────────────────────────────────────────────────────┐   │   │
│  │  │ ABCD123456HDFRRN01                                  │   │   │
│  │  └─────────────────────────────────────────────────────┘   │   │
│  │  ✓ Válida · Estado: CIUDAD DE MÉXICO · Sexo: HOMBRE       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Teléfono (opcional)                                       │   │
│  │  ┌─────────────────────────────────────────────────────┐   │   │
│  │  │ +52 55 1234 5678                                    │   │   │
│  │  └─────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  💡 Sugerencia CURP calculada                              │   │
│  │  ┌─────────────────────────────────────────────────────┐   │   │
│  │  │ ABCD123456HDFRRN01  [Aplicar]                       │   │   │
│  │  └─────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  [Atrás]                                    [Siguiente →]          │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  PASO 2: DOCUMENTOS                                                │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  📋 Documentos Requeridos                                  │   │
│  │  ─────────────────────────────────────────────────────     │   │
│  │  ☑ INE (Identificación oficial)                           │   │
│  │  ☑ Licencia de Conducir                                   │   │
│  │  ☐ Foto de perfil (recomendado)                           │   │
│  │  ☐ Comprobante de domicilio                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  🪪 INE (Identificación)                                   │   │
│  │  ┌─────────────────────────────────────────────────────┐   │   │
│  │  │  [📸 Tomar Foto]  [📁 Subir Archivo]                │   │   │
│  │  └─────────────────────────────────────────────────────┘   │   │
│  │  ┌─────────────────────────────────────────────────────┐   │   │
│  │  │  ✅ INE cargado · CURP: ABCD123456HDFRRN01         │   │   │
│  │  └─────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  🚗 Licencia de Conducir                                  │   │
│  │  ┌─────────────────────────────────────────────────────┐   │   │
│  │  │  [📸 Tomar Foto]  [📁 Subir Archivo]                │   │   │
│  │  └─────────────────────────────────────────────────────┘   │   │
│  │  ┌─────────────────────────────────────────────────────┐   │   │
│  │  │  ✅ Licencia cargada · No. 1234567890               │   │   │
│  │  └─────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  📷 Foto de Perfil (opcional)                              │   │
│  │  ┌───────────────────────┐                                 │   │
│  │  │      [Avatar]         │  [📸 Tomar] [📁 Subir]          │   │
│  │  └───────────────────────┘                                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  🏠 Comprobante de Domicilio (opcional)                    │   │
│  │  ┌─────────────────────────────────────────────────────┐   │   │
│  │  │  [📸 Tomar Foto]  [📁 Subir Archivo]                │   │   │
│  │  └─────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  [← Atrás]                              [Siguiente →]              │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  PASO 3: REVISIÓN                                                  │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  👤 Datos Personales                                       │   │
│  │  ─────────────────────────────────────────────────────     │   │
│  │  Nombre: Juan Carlos Pérez López                          │   │
│  │  CURP: ABCD123456HDFRRN01                                 │   │
│  │  Teléfono: +52 55 1234 5678                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  📄 Documentos                                             │   │
│  │  ─────────────────────────────────────────────────────     │   │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                     │   │
│  │  │ INE  │ │ Lic. │ │ Foto │ │ Dom. │                     │   │
│  │  │  ✅  │ │  ✅  │ │  ☐   │ │  ☐   │                     │   │
│  │  └──────┘ └──────┘ └──────┘ └──────┘                     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ⚠️  Validaciones Pendientes                               │   │
│  │  ─────────────────────────────────────────────────────     │   │
│  │  • CURP INE ≠ CURP Licencia (revisar)                     │   │
│  │  • Fecha de nacimiento no coincide                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ✅ Todo listo para registrar                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  [← Atrás]                    [✓ Registrar Conductor]              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Componentes y Estructura

### 2.1 Stepper

```tsx
// Nuevo stepper de 3 pasos
<Stepper
  steps={[
    { id: "datos", label: "Datos" },
    { id: "docs", label: "Documentos" },
    { id: "review", label: "Revisión" },
  ]}
  currentStep={activeSection}
  onStepClick={scrollToSection}
/>
```

### 2.2 Sección: Datos Básicos

**Campos:**

| Campo | Tipo | Requerido | Validación |
|-------|------|-----------|------------|
| Nombre(s) | Text | Sí | Min 2 caracteres |
| Ap. Paterno | Text | Sí | Min 2 caracteres |
| Ap. Materno | Text | No | — |
| CURP | Text (mono) | Sí | 18 caracteres, formato válido |
| Teléfono | Tel | No | Formato mexicano |

**Elementos UI:**
- Campo compound para nombre (grid 3 columnas en desktop, stack en móvil)
- CURP con feedback en tiempo real (✓ válida, ✗ inválida)
- Sugerencia de CURP calculada (si hay nombre + fecha nacimiento)
- Indicador de completitud: `[3/4 campos]`

### 2.3 Sección: Documentos

**Documentos:**

| Documento | Requerido | OCR | Feedback |
|-----------|-----------|-----|----------|
| INE | Sí | Gemini → Tesseract | ✅ Cargado + CURP extraída |
| Licencia | Sí | Gemini → Tesseract | ✅ Cargado + No. extraído |
| Foto perfil | No | No | Avatar preview |
| Comprobante domicilio | No | No | Thumbnail |

**Elementos UI:**
- Lista de requerimientos con checkmarks dinámicos
- Cada documento: botones [📸 Tomar] [📁 Subir]
- Preview del documento cargado con opción eliminar
- Scanner OCR con progreso (scan → extract → done)
- Feedback de éxito: "✅ INE cargado · CURP: ABCD123456HDFRRN01"

### 2.4 Sección: Revisión

**Contenido:**

| Sección | Muestra |
|---------|---------|
| Datos Personales | Nombre, CURP, Teléfono |
| Documentos | Thumbnails con checkmarks |
| Validaciones | Alertas de inconsistencias |

**Elementos UI:**
- Cards con resumen de cada sección
- Thumbnails clickeables para ver documentos
- Alertas de validación cruzada (CURP INE ≠ CURP Licencia)
- Botón final: "✓ Registrar Conductor"

---

## 3. Estado del Formulario (Hook)

### 3.1 Nuevo Estado

```typescript
// Nuevo estado para teléfono
const [phone, setPhone] = useState("");

// Estado de completitud por paso
const completionStatus = {
  datos: {
    total: 3, // nombre, apellido, curp
    completed: [firstName, paternalLastName, effectiveCurp].filter(Boolean).length,
  },
  docs: {
    total: 2, // ine, licencia (requeridos)
    completed: [ineImg, licenseImg].filter(Boolean).length,
  },
};
```

### 3.2 IntersectionObserver

```typescript
// Actualizar IDs de secciones
const ids = ["datos", "docs", "review"];

// Default step
const [activeSection, setActiveSection] = useState<string>("datos");
```

### 3.3 Funciones de Utilidad

```typescript
// Verificar si un paso está completo
const isStepComplete = (step: "datos" | "docs" | "review") => {
  switch (step) {
    case "datos":
      return firstName.trim() && paternalLastName.trim() && effectiveCurp;
    case "docs":
      return ineImg && licenseImg;
    case "review":
      return true; // Siempre se puede revisar
  }
};

// Obtener estado de validación cruzada
const getCrossValidationStatus = () => {
  const issues: string[] = [];
  if (ineCurp && licenseCurp && ineCurp !== licenseCurp) {
    issues.push("CURP INE ≠ CURP Licencia");
  }
  if (ineDob && licenseDob && ineDob !== licenseDob) {
    issues.push("Fecha de nacimiento no coincide");
  }
  return issues;
};
```

---

## 4. Layout Responsivo

### 4.1 Móvil (< 768px)

```
┌────────────────────────────┐
│  [Stepper: Datos → Docs → Review]  │
├────────────────────────────┤
│  [Contenido scrollable]    │
│  - Datos Básicos           │
│  - Documentos              │
│  - Revisión                │
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
│  [Stepper: Datos → Docs → Review]                │
├──────────────────────────────────────────────────┤
│  ┌─────────────────────┬─────────────────────┐   │
│  │  Datos Básicos      │  Documentos         │   │
│  │  - Nombre           │  - INE              │   │
│  │  - CURP             │  - Licencia         │   │
│  │  - Teléfono         │  - Foto             │   │
│  │                     │  - Domicilio        │   │
│  └─────────────────────┴─────────────────────┘   │
├──────────────────────────────────────────────────┤
│  [Revisión]                                      │
│  ┌──────────────────────────────────────────┐   │
│  │  Resumen + Validaciones                  │   │
│  └──────────────────────────────────────────┘   │
├──────────────────────────────────────────────────┤
│  [← Atrás]                    [Registrar →]      │
└──────────────────────────────────────────────────┘
```

- Grid 2 columnas para datos + documentos
- Revisión full-width debajo
- `max-h-[78vh]` con scroll interno

---

## 5. Validaciones

### 5.1 CURP

```typescript
// Formato: 18 caracteres alfanuméricos
const CURP_REGEX = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/;

// Feedback en tiempo real
const validateCurp = (curp: string) => {
  if (curp.length === 0) return { valid: false, message: "" };
  if (curp.length < 18) return { valid: false, message: `${curp.length}/18 caracteres` };
  if (!CURP_REGEX.test(curp)) return { valid: false, message: "Formato inválido" };
  return { valid: true, message: "✓ CURP válida" };
};
```

### 5.2 Validación Cruzada

```typescript
// Comparar CURP INE vs Licencia
if (ineCurp && licenseCurp && ineCurp !== licenseCurp) {
  warnings.push({
    type: "CURP_MISMATCH",
    message: "La CURP de la INE no coincide con la de la licencia",
    severity: "warning",
  });
}
```

---

## 6. Criterios de Aceptación

- [ ] Stepper muestra 3 pasos: Datos → Documentos → Revisión
- [ ] Paso 1 muestra nombre, CURP, teléfono
- [ ] CURP tiene feedback en tiempo real
- [ ] Paso 2 muestra INE, Licencia, Foto, Domicilio
- [ ] Documentos requeridos tienen checkmarks dinámicos
- [ ] Paso 3 muestra resumen completo
- [ ] Validaciones cruzadas se muestran en revisión
- [ ] Desktop (≥768px) usa grid 2 columnas
- [ ] Móvil (<768px) usa stack vertical
- [ ] Touch targets ≥44px en todos los botones
- [ ] Guardar funciona correctamente
- [ ] OCR sigue funcionando

---

## 7. Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `components/DriverFormDialog.tsx` | Reordenar secciones, nuevo stepper |
| `features/drivers/hooks/useDrivers.ts` | Nuevo default step, IntersectionObserver |

---

## 8. Testing

### 8.1 Manual

1. Abrir formulario de nuevo chofer
2. Verificar stepper muestra 3 pasos
3. Llenar datos básicos → siguiente
4. Cargar INE y licencia → siguiente
5. Verificar resumen en revisión
6. Guardar → verificar chofer se crea

### 8.2 Automático

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

## 9. Rollback

Si hay problemas:
1. Revertir commit: `git revert HEAD`
2. El flujo actual (4 pasos) sigue funcionando
3. No hay cambios de base de datos

---

## 10. Referencias

- Uber Fleet: https://www.uber.com/us/en/drive/requirements/
- Stepper actual: `components/ui/stepper.tsx`
- Wizard: `components/ui/wizard.tsx`
- Plan completo: `docs/superpowers/plans/2026-08-19-registration-flow-simplification.md`
