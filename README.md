# Fleet Control Mobile-First Management App

This is a premium, mobile-first management system built with **Next.js 16 (App Router)**, **Tailwind CSS v4**, **Radix UI/Shadcn primitives**, and **Supabase**.

---

## 🚀 Slices y Arquitectura del Proyecto

Este proyecto fue desarrollado bajo una arquitectura de **Vertical Slices** y un esquema híbrido de base de datos que corre localmente con fallback automático a `localStorage` y se sincroniza con **Supabase** si las credenciales de entorno se especifican.

### 🍰 Slice 1: Infraestructura y Base UI
- Configuración de dependencias base y helpers de Shadcn (`lib/utils.ts`).
- Contenedor mobile-first adaptativo con barra de navegación inferior integrada.
- Componentes base de Radix UI (`Dialog`, `Select`, `Switch`, `Card`, `Button`, `Input`, `Label`) estilizados en conformidad estricta a la prohibición de crear componentes desde cero.

### 🍰 Slice 2: Registro de Conductores e Inteligencia OCR
- Captura digital de INE y Licencia de Conducir.
- **Motores de Validación Cruzada**:
  - Validación cruzada de **CURP** (la CURP leída de la INE debe coincidir exactamente con la de la licencia).
  - Validación cruzada de **Fecha de Nacimiento** (las fechas deben coincidir entre ambos documentos).
- Interruptor de **Licencia Permanente**: deshabilita avisos de renovación.
- Simulación OCR que procesa campos críticos y genera avisos en caso de discrepancias detectadas.

### 🍰 Slice 3: Inventario de Autos y Placa-Métrica de Verificación
- Formulario de captura de tarjeta de circulación y póliza de seguro.
- **Cronograma de Verificación Vehicular de México** integrado. Basado en el último dígito numérico de la placa, calcula dinámicamente el mes límite y color de engomado de verificación:
  - **5 o 6** (Amarillo): Feb-Mar / Ago-Sep
  - **7 o 8** (Rosa): Mar-Abr / Sep-Oct
  - **3 o 4** (Rojo): Apr-May / Oct-Nov
  - **1 o 2** (Verde): May-Jun / Nov-Dic
  - **9 o 0** (Azul): Jun-Jul / Dec-Jan
- Alertas de vencimiento de seguro integradas directamente al subir la imagen de la póliza.

### 🍰 Slice 4: Bitácora de Asignación y Checklists Semanales
- Permite la asignación y retiro de autos de conductores documentando el motivo, con opción de anulación/sobreescritura por parte del administrador.
- Checklist de entrega y de inicio de semana:
  - Registro de kilometraje.
  - Registro de nivel de gasolina usando **octavos de entero** (`1/8` a `8/8`).
  - Lista de chequeo del estado del auto (Luces, llantas, frenos, carrocería, papelería).
  - Registro escrito de irregularidades.

### 🍰 Slice 5: Contabilidad y Balance General de Renta
- Configuración de renta estándar semanal por conductor.
- Historial de cobros semanales con acumulación de deuda anterior.
- Soporte para pagos parciales con cálculo en tiempo real de deuda acumulada y desglose histórico de abonos.

### 🍰 Slice 6: Registro de Taller y Consola de Alertas Unificada
- Bitácora de mantenimientos con costo, descripción y próxima fecha recomendada de servicio.
- Tablero de avisos unificado: consolida alertas de licencias de conducir vencidas, seguros próximos a expirar, verificaciones vehiculares vigentes y mantenimiento programado.

---

## 🛠️ Ejecución Local

1. Instalar dependencias:
   ```bash
   npm install
   ```

2. Ejecutar servidor de desarrollo:
   ```bash
   npm run dev
   ```

3. (Opcional) Configurar Supabase agregando las variables al archivo `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=tu-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
   ```
