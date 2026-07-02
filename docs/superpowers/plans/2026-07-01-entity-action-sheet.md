# Entity Action Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a Bottom Sheet "Action Center" for Drivers and Vehicles to simplify assignments, removals, and checklist launching.

**Architecture:** Use a centralized `EntityActionSheet` component managed by the `Dashboard`. The sheet dynamically renders actions based on whether the target is a Driver or Vehicle and its current assignment status.

**Tech Stack:** Next.js 16, Tailwind CSS, Supabase (via `lib/db`).

---

### Task 1: Database Extensions for Assignments

**Files:**
- Modify: `lib/db/index.ts`

- [ ] **Step 1: Add `removeAssignment` method to the `db` object**
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

- [ ] **Step 2: Add helper methods to fetch available entities**
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

- [ ] **Step 3: Commit**
```bash
git add lib/db/index.ts
git commit -m "feat(db): add removeAssignment and availability helpers"
```

### Task 2: UI Primitives for Action Sheet

**Files:**
- Create: `components/ui/ActionItem.tsx`
- Create: `components/ui/ConfirmationDialog.tsx`

- [ ] **Step 1: Create `ActionItem.tsx`** (Simple Tailwind button with icon support)
- [ ] **Step 2: Create `ConfirmationDialog.tsx`** (Overlay with Textarea for "Motivo" and Confirm/Cancel buttons)
- [ ] **Step 3: Commit**
```bash
git add components/ui/ActionItem.tsx components/ui/ConfirmationDialog.tsx
git commit -m "feat(ui): add ActionItem and ConfirmationDialog primitives"
```

### Task 3: Assignment Selector Component

**Files:**
- Create: `components/ui/AssignmentSelector.tsx`

- [ ] **Step 1: Implement `AssignmentSelector`**
    - Props: `type: 'driver' | 'vehicle'`, `onSelect: (id: string) => void`.
    - Fetch data using `db.getAvailableVehicles()` or `db.getAvailableDrivers()`.
    - Render as a scrollable list of cards within the Bottom Sheet.
- [ ] **Step 2: Commit**
```bash
git add components/ui/AssignmentSelector.tsx
git commit -m "feat(ui): add AssignmentSelector for picking available assets"
```

### Task 4: Main EntityActionSheet Component

**Files:**
- Create: `components/EntityActionSheet.tsx`

- [ ] **Step 1: Implement logic to determine available actions**
    - If `entityType === 'driver'` $\rightarrow$ check `vehicle_id` to show `Asignar` or `Retirar`.
    - If `entityType === 'vehicle'` $\rightarrow$ check `driver_id` to show `Asignar`, `Retirar`, and `Hacer Checklist`.
- [ ] **Step 2: Implement "Retirar" flow**
    - Trigger $\rightarrow$ Show `ConfirmationDialog` $\rightarrow$ Validate Motivo $\rightarrow$ Call `db.removeAssignment`.
- [ ] **Step 3: Implement "Asignar" flow**
    - Trigger $\rightarrow$ Show `AssignmentSelector` $\rightarrow$ Call `db.saveAssignment`.
- [ ] **Step 4: Commit**
```bash
git add components/EntityActionSheet.tsx
git commit -m "feat: implement EntityActionSheet logic and flows"
```

### Task 5: Integration with Dashboard and Slices

**Files:**
- Modify: `components/Dashboard.tsx`
- Modify: `components/DriversSlice.tsx`
- Modify: `components/VehiclesSlice.tsx`

- [ ] **Step 1: Add Bottom Sheet state to `Dashboard.tsx`**
    - `const [actionSheet, setActionSheet] = useState<{ open: boolean, entity: any, type: 'driver' | 'vehicle' } | null>(null);`
- [ ] **Step 2: Add `EntityActionSheet` to the Dashboard render tree**
- [ ] **Step 3: Update `DriversSlice` and `VehiclesSlice` cards**
    - Replace default click handlers with `onClick={() => onOpenActionSheet(entity, 'driver'|'vehicle')}`.
- [ ] **Step 4: Commit**
```bash
git add components/Dashboard.tsx components/DriversSlice.tsx components/VehiclesSlice.tsx
git commit -m "feat: integrate ActionSheet into Driver and Vehicle cards"
```

### Task 6: Final Verification

- [ ] **Step 1: Test Driver $\rightarrow$ Assign Auto $\rightarrow$ Verify update in UI.**
- [ ] **Step 2: Test Auto $\rightarrow$ Retirar Conductor $\rightarrow$ Enter Motivo $\rightarrow$ Verify update.**
- [ ] **Step 3: Test Auto $\rightarrow$ Hacer Checklist $\rightarrow$ Verify navigation.**
- [ ] **Step 4: Run `npm run build` to ensure no new lint errors.**
- [ ] **Step 5: Final commit**
```bash
git commit -m "test: verify entity action sheet flows"
```
