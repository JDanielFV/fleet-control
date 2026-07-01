# Design: Entity Action Sheet (Quick Actions)

## Overview
Implement a mobile-first interaction pattern where clicking a Driver or Vehicle card opens a Bottom Sheet with contextual quick actions. This replaces the need to navigate deep into slices for common tasks like assigning/unassigning assets.

## 1. User Experience (UX)
### Trigger
- **Click/Tap** on any Driver or Vehicle card in their respective slices.

### Component: `EntityActionSheet`
- A slide-up container (Bottom Sheet) containing:
    - **Header**: Entity name and type (e.g., "Driver: Juan Perez").
    - **Action List**: A set of buttons based on the entity's current state.

### Contextual Flows
#### A. Driver Context
- **If no vehicle assigned**:
    - Action: `Asignar Vehículo` $\rightarrow$ Opens a list of available vehicles $\rightarrow$ Select $\rightarrow$ Execute.
- **If vehicle assigned**:
    - Action: `Retirar Vehículo` $\rightarrow$ Opens confirmation dialog $\rightarrow$ Input "Motivo" $\rightarrow$ Execute.

#### B. Vehicle Context
- **If no driver assigned**:
    - Action: `Asignar Conductor` $\rightarrow$ Opens a list of available drivers $\rightarrow$ Select $\rightarrow$ Execute.
- **If driver assigned**:
    - Action: `Retirar Conductor` $\rightarrow$ Opens confirmation dialog $\rightarrow$ Input "Motivo" $\rightarrow$ Execute.
- **Always available**:
    - Action: `Hacer Checklist` $\rightarrow$ Navigates user to the detailed Checklist view for that vehicle.

## 2. Technical Architecture

### Component Structure
- `EntityActionSheet.tsx`: The main UI wrapper.
- `ActionItem.tsx`: Generic button for actions.
- `AssignmentSelector.tsx`: A filtered list component used for picking available entities.
- `ConfirmationDialog.tsx`: A small overlay for the "Motivo" input and confirmation.

### Data Flow
1. **State Management**: Use a global or context-based state to track the `activeEntity` and the `isOpen` state of the sheet.
2. **Filtering**:
    - `getAvailableVehicles()`: Returns vehicles where `driver_id` is null.
    - `getAvailableDrivers()`: Returns drivers where `vehicle_id` is null.
3. **API Interaction**:
    - Uses the existing `db.ts` methods (or adds new ones) to update assignments.
    - `saveAssignment(driverId, vehicleId)` and `removeAssignment(assignmentId, reason)`.

### Error Handling
- Loading states on buttons during API calls.
- Toast notifications for success/failure of assignments.
- Validation to ensure "Motivo" is not empty during removal.

## 3. Success Criteria
- Users can assign/unassign a vehicle in < 3 taps.
- The "Motivo" is captured and stored (or logged) during removal.
- Slices remain clean, acting primarily as viewers rather than heavy form managers.
