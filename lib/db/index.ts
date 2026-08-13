import { createClient } from "@supabase/supabase-js";
import { getSessionToken } from "@/lib/session";
export type * from "./types";
export { getVerificationSchedule, genId, normalizeEmptyDates } from "./utils";
export { getMondayOf, prorateRent, estimateServiceDate } from "../utils";

// --- Supabase Connection ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const isSupabaseConfigured = supabaseUrl !== "" && supabaseAnonKey !== "";

/**
 * Build a Supabase client for the current request.
 *
 * Client-side, it attaches the session JWT (minted at login with
 * SUPABASE_JWT_SECRET, stored in the session) as a Bearer token so
 * PostgREST treats the caller as `authenticated` and RLS policies
 * (owner_id = auth.uid()) apply. Without a JWT it falls back to the anon
 * key — useful pre-RLS and in local mode.
 *
 * Server-side (no window) it creates a plain anon client; server routes
 * that need privileged access create their own service-role client.
 */
export function getSupabase() {
  if (!isSupabaseConfigured) return null;
  let token: string | null = null;
  if (typeof window !== "undefined") {
    token = getSessionToken();
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    },
  });
}

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
  saveDriver: (d: Parameters<typeof import("./drivers").saveDriver>[0]) => import("./drivers").then((mod) => mod.saveDriver(d)),
  deleteDriver: (id: string) => import("./drivers").then((mod) => mod.deleteDriver(id)),

  // --- Vehicles ---
  getVehicles: () => import("./vehicles").then((mod) => mod.getVehicles()),
  getArchivedVehicles: () => import("./vehicles").then((mod) => mod.getArchivedVehicles()),
  saveVehicle: (v: Parameters<typeof import("./vehicles").saveVehicle>[0]) => import("./vehicles").then((mod) => mod.saveVehicle(v)),
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
  saveChecklist: (c: Parameters<typeof import("./checklists").saveChecklist>[0]) => import("./checklists").then((mod) => mod.saveChecklist(c)),
  autoGenerateMondayChecklists: () => import("./checklists").then((mod) => mod.autoGenerateMondayChecklists()),

  // --- Weekly Rentals & Finance ---
  getWeeklyRentals: () => import("./finances").then((mod) => mod.getWeeklyRentals()),
  addPayment: (did: string, amt: number, pd?: string) =>
    import("./finances").then((mod) => mod.addPayment(did, amt, pd)),
  getDriverDebt: (did: string) => import("./finances").then((mod) => mod.getDriverDebt(did)),
  getDriverCredit: (did: string) => import("./finances").then((mod) => mod.getDriverCredit(did)),
  addDriverCredit: (did: string, amt: number) =>
    import("./finances").then((mod) => mod.addDriverCredit(did, amt)),
  createWeeklyRental: (r: Parameters<typeof import("./finances").createWeeklyRental>[0]) => import("./finances").then((mod) => mod.createWeeklyRental(r)),
  saveWeeklyRental: (r: Parameters<typeof import("./finances").saveWeeklyRental>[0]) => import("./finances").then((mod) => mod.saveWeeklyRental(r)),

  // --- Maintenances ---
  getMaintenances: () => import("./maintenances").then((mod) => mod.getMaintenances()),
  saveMaintenance: (maint: Parameters<typeof import("./maintenances").saveMaintenance>[0]) => import("./maintenances").then((mod) => mod.saveMaintenance(maint)),

  // --- Renewal Logs ---
  saveRenewalLog: (l: Parameters<typeof import("./renewal-logs").saveRenewalLog>[0]) => import("./renewal-logs").then((mod) => mod.saveRenewalLog(l)),
  getRenewalLogs: (vid?: string) => import("./renewal-logs").then((mod) => mod.getRenewalLogs(vid)),

  // --- Alerts ---
  getAlerts: () => import("./alerts").then((mod) => mod.getAlerts()),
  dismissAlert: (id: string) => import("./alerts").then((mod) => mod.dismissAlert(id)),

  // --- Vehicle Inventory ---
  getVehicleInventory: (vid: string) => import("./inventory").then((mod) => mod.getVehicleInventory(vid)),
  saveVehicleInventory: (i: Parameters<typeof import("./inventory").saveVehicleInventory>[0]) => import("./inventory").then((mod) => mod.saveVehicleInventory(i)),

  // --- Users ---
  getUsers: () => import("./users").then((mod) => mod.getUsers()),
  getUserByEmail: (e: string) => import("./users").then((mod) => mod.getUserByEmail(e)),
  getUserCount: () => import("./users").then((mod) => mod.getUserCount()),
  saveUser: (u: Parameters<typeof import("./users").saveUser>[0]) => import("./users").then((mod) => mod.saveUser(u)),
  deleteUser: (id: string) => import("./users").then((mod) => mod.deleteUser(id)),

  // --- Registration Tokens ---
  createRegistrationToken: (cb: string | null) => import("./tokens").then((mod) => mod.createRegistrationToken(cb)),
  getRegistrationToken: (t: string) => import("./tokens").then((mod) => mod.getRegistrationToken(t)),
  useRegistrationToken: (tid: string) => import("./tokens").then((mod) => mod.useRegistrationToken(tid)),
};
