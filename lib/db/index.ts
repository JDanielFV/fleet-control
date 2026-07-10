import { createClient } from "@supabase/supabase-js";
import type {
  Driver,
  Vehicle,
  Assignment,
  Checklist,
  WeeklyRental,
  Maintenance,
  RenewalLog,
  Alert,
  VehicleInventory,
  User,
  RegistrationToken,
} from "./types";
export type * from "./types";
export { getVerificationSchedule, genId, normalizeEmptyDates } from "./utils";
export { getMondayOf, prorateRent, estimateServiceDate } from "../utils";

import {
  seedDrivers,
  seedVehicles,
  seedAssignments,
  seedChecklists,
  seedWeeklyRentals,
  seedMaintenances,
} from "./seed";
import {
  getLocalData,
  setLocalData,
  mergePendingLocal,
  addPendingId,
  clearPendingIds,
} from "./localStorage";
import {
  DRIVER_DATE_KEYS,
  VEHICLE_DATE_KEYS,
  genId,
  normalizeEmptyDates,
  getVerificationSchedule,
} from "./utils";
import { getMondayOf, prorateRent, applyPayment, estimateServiceDate } from "../utils";

// --- Supabase Connection ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const isSupabaseConfigured = supabaseUrl !== "" && supabaseAnonKey !== "";

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Re-export all entity-specific modules
export * from "./drivers";
export * from "./vehicles";
export * from "./assignments";
export * from "./checklists";
export * from "./finances";
export * from "./maintenances";
export * from "./renewal-logs";
export * from "./alerts";
export * from "./inventory";
export * from "./users";
export * from "./tokens";

// Legacy `db` object for backward compatibility
// New code should import directly from the entity modules.
export const db = {
  // --- Drivers ---
  getDrivers: () => import("./drivers").then((m) => m.getDrivers()),
  getArchivedDrivers: () => import("./drivers").then((m) => m.getArchivedDrivers()),
  saveDriver: (d: any) => import("./drivers").then((mod) => mod.saveDriver(d)),
  deleteDriver: (id: string) => import("./drivers").then((mod) => mod.deleteDriver(id)),

  // --- Vehicles ---
  getVehicles: () => import("./vehicles").then((mod) => mod.getVehicles()),
  getArchivedVehicles: () => import("./vehicles").then((mod) => mod.getArchivedVehicles()),
  saveVehicle: (v: any) => import("./vehicles").then((mod) => mod.saveVehicle(v)),
  deleteVehicle: (id: string) => import("./vehicles").then((mod) => mod.deleteVehicle(id)),
  updateVehicleServiceSchedule: (id: string, nsm: number | null, nmd: string | null) =>
    import("./vehicles").then((mod) => mod.updateVehicleServiceSchedule(id, nsm, nmd)),
  getAvailableVehicles: () => import("./vehicles").then((mod) => mod.getAvailableVehicles()),

  // --- Assignments ---
  getAssignments: () => import("./assignments").then((mod) => mod.getAssignments()),
  createAssignment: (vid: string, did: string, t: "ASSIGN" | "RELEASE", r: string) =>
    import("./assignments").then((mod) => mod.createAssignment(vid, did, t, r)),
  removeAssignment: (vid: string, did: string, r: string) =>
    import("./assignments").then((mod) => mod.removeAssignment(vid, did, r)),
  getAvailableDrivers: () => import("./assignments").then((mod) => mod.getAvailableDrivers()),

  // --- Checklists ---
  getChecklists: () => import("./checklists").then((mod) => mod.getChecklists()),
  saveChecklist: (c: any) => import("./checklists").then((mod) => mod.saveChecklist(c)),
  autoGenerateMondayChecklists: () => import("./checklists").then((mod) => mod.autoGenerateMondayChecklists()),

  // --- Weekly Rentals & Finance ---
  getWeeklyRentals: () => import("./finances").then((mod) => mod.getWeeklyRentals()),
  addPayment: (did: string, amt: number, pd?: string) =>
    import("./finances").then((mod) => mod.addPayment(did, amt, pd)),
  getDriverDebt: (did: string) => import("./finances").then((mod) => mod.getDriverDebt(did)),
  getDriverCredit: (did: string) => import("./finances").then((mod) => mod.getDriverCredit(did)),
  addDriverCredit: (did: string, amt: number) =>
    import("./finances").then((mod) => mod.addDriverCredit(did, amt)),
  createWeeklyRental: (r: any) => import("./finances").then((mod) => mod.createWeeklyRental(r)),
  saveWeeklyRental: (r: any) => import("./finances").then((mod) => mod.saveWeeklyRental(r)),

  // --- Maintenances ---
  getMaintenances: () => import("./maintenances").then((mod) => mod.getMaintenances()),
  saveMaintenance: (maint: any) => import("./maintenances").then((mod) => mod.saveMaintenance(maint)),

  // --- Renewal Logs ---
  saveRenewalLog: (l: any) => import("./renewal-logs").then((mod) => mod.saveRenewalLog(l)),
  getRenewalLogs: (vid?: string) => import("./renewal-logs").then((mod) => mod.getRenewalLogs(vid)),

  // --- Alerts ---
  getAlerts: () => import("./alerts").then((mod) => mod.getAlerts()),
  dismissAlert: (id: string) => import("./alerts").then((mod) => mod.dismissAlert(id)),

  // --- Vehicle Inventory ---
  getVehicleInventory: (vid: string) => import("./inventory").then((mod) => mod.getVehicleInventory(vid)),
  saveVehicleInventory: (i: any) => import("./inventory").then((mod) => mod.saveVehicleInventory(i)),

  // --- Users ---
  getUsers: () => import("./users").then((mod) => mod.getUsers()),
  getUserByEmail: (e: string) => import("./users").then((mod) => mod.getUserByEmail(e)),
  getUserCount: () => import("./users").then((mod) => mod.getUserCount()),
  saveUser: (u: any) => import("./users").then((mod) => mod.saveUser(u)),
  deleteUser: (id: string) => import("./users").then((mod) => mod.deleteUser(id)),

  // --- Registration Tokens ---
  createRegistrationToken: (cb: string | null) => import("./tokens").then((mod) => mod.createRegistrationToken(cb)),
  getRegistrationToken: (t: string) => import("./tokens").then((mod) => mod.getRegistrationToken(t)),
  useRegistrationToken: (tid: string) => import("./tokens").then((mod) => mod.useRegistrationToken(tid)),
};
