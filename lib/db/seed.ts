// Demo data has been removed: each user starts with an empty fleet and only
// sees records they created (scoped by owner_id). The exports are kept as
// empty arrays so existing imports (localStorage helpers, db modules) keep
// working without changes.
import type { Driver, Vehicle, Assignment, Checklist, WeeklyRental, Maintenance } from "./types";

export const seedDrivers: Driver[] = [];
export const seedVehicles: Vehicle[] = [];
export const seedAssignments: Assignment[] = [];
export const seedChecklists: Checklist[] = [];
export const seedWeeklyRentals: WeeklyRental[] = [];
export const seedMaintenances: Maintenance[] = [];
