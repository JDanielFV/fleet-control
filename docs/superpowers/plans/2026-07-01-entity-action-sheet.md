# Entity Action Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a Bottom Sheet "Action Center" for Drivers and Vehicles to simplify assignments, removals, and checklist launching.

**Architecture:** Use a centralized `EntityActionSheet` component managed by the `Dashboard`. The sheet dynamically renders actions based on whether the target is a Driver or Vehicle and its current assignment status.

**Tech Stack:** Next.js 16, Tailwind CSS, Supabase (via `lib/db`).

---

## Estado: ✅ implementado (2026-08)

Este plan se completó con las siguientes desviaciones respecto al diseño original:

- **Ubicación real**: el componente vive en `features/assignments/components/EntityActionSheet.tsx` (no `components/EntityActionSheet.tsx`), gestionado por `useDashboard` (`actionSheet` state) y renderizado en `components/Dashboard.tsx`.
- **Primitivas**: `ActionItem.tsx` y `AssignmentSelector.tsx` están en `components/ui/`; el diálogo de confirmación se implementó como **`components/ui/confirm-dialog.tsx`** (hook `useConfirm()`) — no existe `ConfirmationDialog.tsx`.
- **Capa de datos**: no hay objeto `db` legacy; se usan imports directos (`createAssignment`, `removeAssignment` desde `lib/db/assignments.ts`) y la disponibilidad se determina con `active_driver_id` (no `driver_id`/`vehicle_id`).
- **Extra añadido**: tras asignar, la app abre automáticamente el **checklist** del auto con el vehículo parcheado con `active_driver_id` (fix del bug de vehículo desactualizado, ver `components/Dashboard.tsx` y `EntityActionSheet.tsx`).

---

### Task 1: Database Extensions for Assignments

**Files:**
- Modify: `lib/db/index.ts`

- [x] **Step 1: Add `removeAssignment` method to the `db` object**
```typescript
// Inside the db object in lib/db/index.ts
async removeAssignment(assignmentId: string, reason: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from("assignments").delete().match({ id: assignmentId });
    if (error) throw error;
    // Log the reason to a separate logs table or simply console.log for demo
    console.log(`Assignment ${assignmentId} removed. Reason: ${reason}`);
  } else {
    const assignments = getLocalData("assignments", seedAssignments);
    const filtered = assignments.filter(a => a.id !== assignmentId);
    setLocalData("assignments", filtered);
  }
}
```

- [x] **Step 2: Add helper methods to fetch available entities**
```typescript
// Add to db object
async getAvailableVehicles(): Promise<Vehicle[]> {
  const vehicles = await this.getVehicles();
  return vehicles.filter(v => !v.driver_id);
},
async getAvailableDrivers(): Promise<Driver[]> {
  const drivers = await this.getDrivers();
  return drivers.filter(d => !d.vehicle_id);
}
```

- [x] **Step 3: Commit**
```bash
git add lib/db/index.ts
git commit -m "feat(db): add removeAssignment and availability helpers"
```

### Task 2: UI Primitives for Action Sheet

**Files:**
- Create: `components/ui/ActionItem.tsx`
- Create: `components/ui/ConfirmationDialog.tsx`

- [x] **Step 1: Create `ActionItem.tsx`** (Simple Tailwind button with icon support)
- [x] **Step 2: Create `ConfirmationDialog.tsx`** (Overlay with Textarea for "Motivo" and Confirm/Cancel buttons)
- [x] **Step 3: Commit**
```bash
git add components/ui/ActionItem.tsx components/ui/ConfirmationDialog.tsx
git commit -m "feat(ui): add ActionItem and ConfirmationDialog primitives"
```

### Task 3: Assignment Selector Component

**Files:**
- Create: `components/ui/AssignmentSelector.tsx`

- [x] **Step 1: Implement `AssignmentSelector`**
    - Props: `type: 'driver' | 'vehicle'`, `onSelect: (id: string) => void`.
    - Fetch data using `db.getAvailableVehicles()` or `db.getAvailableDrivers()`.
    - Render as a scrollable list of cards within the Bottom Sheet.
- [x] **Step 2: Commit**
```bash
git add components/ui/AssignmentSelector.tsx
git commit -m "feat(ui): add AssignmentSelector for picking available assets"
```

### Task 4: Main EntityActionSheet Component

**Files:**
- Create: `components/EntityActionSheet.tsx`

- [x] **Step 1: Implement logic to determine available actions**
    - If `entityType === 'driver'` → check `vehicle_id` to show `Asignar` or `Retirar`.
    - If `entityType === 'vehicle'` → check `driver_id` to show `Asignar`, `Retirar`, and `Hacer Checklist`.
- [x] **Step 2: Implement "Retirar" flow**
    - Trigger → Show `ConfirmationDialog` → Validate Motivo → Call `db.removeAssignment`.
- [x] **Step 3: Implement "Asignar" flow**
    - Trigger → Show `AssignmentSelector` → Call `db.saveAssignment`.
- [x] **Step 4: Commit**
```bash
git add components/EntityActionSheet.tsx
git commit -m "feat: implement EntityActionSheet logic and flows"
```

### Task 5: Integration with Dashboard and Slices

**Files:**
- Modify: `components/Dashboard.tsx`
- Modify: `components/DriversSlice.tsx`
- Modify: `components/VehiclesSlice.tsx`

- [x] **Step 1: Add Bottom Sheet state to `Dashboard.tsx`**
    - `const [actionSheet, setActionSheet] = useState<{ open: boolean, entity: any, type: 'driver' | 'vehicle' } | null>(null);`
- [x] **Step 2: Add `EntityActionSheet` to the Dashboard render tree**
- [x] **Step 3: Update `DriversSlice` and `VehiclesSlice` cards**
    - Replace default click handlers with `onClick={() => onOpenActionSheet(entity, 'driver'|'vehicle')}`.
- [x] **Step 4: Commit**
```bash
git add components/Dashboard.tsx components/DriversSlice.tsx components/VehiclesSlice.tsx
git commit -m "feat: integrate ActionSheet into Driver and Vehicle cards"
```

### Task 6: Final Verification

- [x] **Step 1: Test Driver → Assign Auto → Verify update in UI.**
- [x] **Step 2: Test Auto → Retirar Conductor → Enter Motivo → Verify update.**
- [x] **Step 3: Test Auto → Hacer Checklist → Verify navigation.**
- [x] **Step 4: Run `npm run build` to ensure no new lint errors.**
- [x] **Step 5: Final commit**
```bash
git commit -m "test: verify entity action sheet flows"
```
