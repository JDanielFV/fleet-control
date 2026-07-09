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

// --- Live DB API Layer ---
export const db = {
  // --- Drivers ---
  async getDrivers(): Promise<Driver[]> {
    if (supabase) {
      const { data, error } = await supabase.from("drivers").select("*").order("created_at", { ascending: false });
      if (!error) return mergePendingLocal("drivers", data, seedDrivers);
    }
    return getLocalData("drivers", seedDrivers);
  },

  async saveDriver(driver: Omit<Driver, "id" | "created_at"> & { id?: string; created_at?: string }): Promise<Driver> {
    const fullDriver: Driver = normalizeEmptyDates({
      ...driver,
      id: driver.id || genId(),
      created_at: driver.created_at || new Date().toISOString(),
    }, DRIVER_DATE_KEYS) as Driver;
    if (supabase) {
      const { data, error } = await supabase.from("drivers").upsert(fullDriver).select().single();
      if (!error && data) {
        clearPendingIds("drivers", [fullDriver.id]);
        return data;
      }
      if (error) {
        console.error("Supabase saveDriver error:", error.message, error.details, error.hint);
        // Throw database errors to let the UI react
        throw new Error(error.message);
      }
    }
    const drivers = getLocalData("drivers", seedDrivers);
    const existingIndex = drivers.findIndex((d) => d.id === fullDriver.id);
    if (existingIndex >= 0) {
      drivers[existingIndex] = { ...drivers[existingIndex], ...driver };
    } else {
      drivers.unshift(fullDriver);
    }
    setLocalData("drivers", drivers);
    addPendingId("drivers", fullDriver.id);
    return fullDriver;
  },

  async deleteDriver(id: string): Promise<boolean> {
    // 1. Clear active_driver_id on any vehicles that are assigned to this driver
    const vehicles = getLocalData("vehicles", seedVehicles);
    let updatedAny = false;
    vehicles.forEach((v) => {
      if (v.active_driver_id === id) {
        v.active_driver_id = null;
        updatedAny = true;
      }
    });
    if (updatedAny) {
      setLocalData("vehicles", vehicles);
    }

    // 2. Delete driver from local storage
    const drivers = getLocalData("drivers", seedDrivers);
    const filtered = drivers.filter((d) => d.id !== id);
    setLocalData("drivers", filtered);

    // 3. Delete from Supabase if active
    if (supabase) {
      if (updatedAny) {
        await supabase.from("vehicles").update({ active_driver_id: null }).eq("active_driver_id", id);
      }
      const { error } = await supabase.from("drivers").delete().eq("id", id);
      return !error;
    }
    return true;
  },

  // --- Vehicles ---
  async getVehicles(): Promise<Vehicle[]> {
    if (supabase) {
      const { data, error } = await supabase.from("vehicles").select("*").order("created_at", { ascending: false });
      if (!error) return mergePendingLocal("vehicles", data, seedVehicles);
    }
    return getLocalData("vehicles", seedVehicles);
  },

  async saveVehicle(vehicle: Omit<Vehicle, "id" | "created_at"> & { id?: string; created_at?: string }): Promise<Vehicle> {
    const fullVehicle: Vehicle = normalizeEmptyDates({
      ...vehicle,
      id: vehicle.id || genId(),
      created_at: vehicle.created_at || new Date().toISOString(),
    }, VEHICLE_DATE_KEYS) as Vehicle;
    if (supabase) {
      const { data, error } = await supabase.from("vehicles").upsert(fullVehicle).select().single();
      if (!error && data) {
        clearPendingIds("vehicles", [fullVehicle.id]);
        return data;
      }
      if (error) {
        console.error("Supabase saveVehicle error:", error.message, error.details, error.hint);
        throw new Error(error.message);
      }
    }
    const vehicles = getLocalData("vehicles", seedVehicles);
    const existingIndex = vehicles.findIndex((v) => v.id === fullVehicle.id);
    if (existingIndex >= 0) {
      vehicles[existingIndex] = { ...vehicles[existingIndex], ...vehicle };
    } else {
      vehicles.unshift(fullVehicle);
    }
    setLocalData("vehicles", vehicles);
    addPendingId("vehicles", fullVehicle.id);
    return fullVehicle;
  },

  async deleteVehicle(id: string): Promise<boolean> {
    const vehicles = getLocalData("vehicles", seedVehicles);
    const filtered = vehicles.filter((v) => v.id !== id);
    setLocalData("vehicles", filtered);

    if (supabase) {
      const { error } = await supabase.from("vehicles").delete().eq("id", id);
      return !error;
    }
    return true;
  },

  async updateVehicleServiceSchedule(
    id: string,
    nextServiceMileage: number | null,
    _nextMaintenanceDate: string | null
  ): Promise<void> {
    const patch: Record<string, any> = {
      next_service_mileage: nextServiceMileage,
    };

    if (supabase) {
      const { error } = await supabase.from("vehicles").update(patch).eq("id", id);
      if (!error) return;
      console.error("Supabase updateVehicleServiceSchedule error:", error.message);
    }

    const vehicles = getLocalData("vehicles", seedVehicles);
    const idx = vehicles.findIndex((v) => v.id === id);
    if (idx >= 0) {
      vehicles[idx] = { ...vehicles[idx], ...patch };
      setLocalData("vehicles", vehicles);
    }
  },

  // --- Assignments ---
  async getAssignments(): Promise<Assignment[]> {
    if (supabase) {
      const { data, error } = await supabase.from("assignments").select("*").order("created_at", { ascending: false });
      if (!error) return mergePendingLocal("assignments", data, seedAssignments);
    }
    return getLocalData("assignments", seedAssignments);
  },

  async createAssignment(vehicleId: string, driverId: string, type: "ASSIGN" | "RELEASE", reason: string): Promise<Assignment> {
    const newAssignment: Assignment = {
      id: genId(),
      vehicle_id: vehicleId,
      driver_id: driverId,
      action_type: type,
      reason,
      created_at: new Date().toISOString(),
    };

    // Update active_driver_id on vehicle
    const vehicles = getLocalData("vehicles", seedVehicles);
    const vIndex = vehicles.findIndex((v) => v.id === vehicleId);
    if (vIndex >= 0) {
      vehicles[vIndex].active_driver_id = type === "ASSIGN" ? driverId : null;
      setLocalData("vehicles", vehicles);
    }

    // Auto-generate Weekly Rental if it's an ASSIGN action.
    if (type === "ASSIGN") {
      const weekStart = getMondayOf(new Date());

      const rentals = getLocalData("weekly_rentals", seedWeeklyRentals);
      const exists = rentals.some((r) => r.driver_id === driverId && r.week_start === weekStart);

      if (!exists) {
        // ── First assignment this week: create prorated rental ──
        const vehicleObj = vehicles.find((v) => v.id === vehicleId);
        const rentCost = vehicleObj?.rent_cost || 2500;
        const { amount, days } = prorateRent(rentCost, new Date());

        const newRental: WeeklyRental = {
          id: genId(),
          driver_id: driverId,
          week_start: weekStart,
          rent_amount: amount,
          paid_amount: 0,
          is_prorated: days < 7,
          prorated_days: days < 7 ? days : undefined,
          condoned_days: 0,
          condoned_amount: 0,
          status: "UNPAID",
          payments_log: [],
          created_at: new Date().toISOString(),
        };
        rentals.unshift(newRental);
        setLocalData("weekly_rentals", rentals);
        if (supabase) {
          const { error: rErr } = await supabase.from("weekly_rentals").insert(newRental);
          if (rErr) addPendingId("weekly_rentals", newRental.id);
        }
      } else {
        // ── Re-assignment mid-week: pre-create next week's rental with new auto's rate ──
        const nextMonday = new Date();
        nextMonday.setDate(nextMonday.getDate() + (8 - nextMonday.getDay()) % 7 || 7);
        const nextWeekStart = getMondayOf(nextMonday);

        const hasNextWeek = rentals.some((r) => r.driver_id === driverId && r.week_start === nextWeekStart);
        if (!hasNextWeek) {
          const vehicleObj = vehicles.find((v) => v.id === vehicleId);
          const rentCost = vehicleObj?.rent_cost || 2500;

          const nextRental: WeeklyRental = {
            id: genId(),
            driver_id: driverId,
            week_start: nextWeekStart,
            rent_amount: rentCost,
            paid_amount: 0,
            is_prorated: false,
            prorated_days: undefined,
            condoned_days: 0,
            condoned_amount: 0,
            status: "UNPAID",
            payments_log: [],
            created_at: new Date().toISOString(),
          };
          rentals.unshift(nextRental);
          setLocalData("weekly_rentals", rentals);
          if (supabase) {
            const { error: rErr } = await supabase.from("weekly_rentals").insert(nextRental);
            if (rErr) addPendingId("weekly_rentals", nextRental.id);
          }
        }
      }
    }

    if (supabase) {
      await supabase.from("vehicles").update({ active_driver_id: type === "ASSIGN" ? driverId : null }).eq("id", vehicleId);
      const { data, error } = await supabase.from("assignments").insert(newAssignment).select().single();
      if (!error && data) return data;
    }

    const assignments = getLocalData("assignments", seedAssignments);
    assignments.unshift(newAssignment);
    setLocalData("assignments", assignments);
    addPendingId("assignments", newAssignment.id);

    return newAssignment;
  },

  async removeAssignment(vehicleId: string, driverId: string, reason: string): Promise<void> {
    // 1. Create a RELEASE record in the assignments log so we keep the history
    const newReleaseEntry: Assignment = {
      id: genId(),
      vehicle_id: vehicleId,
      driver_id: driverId,
      action_type: "RELEASE",
      reason,
      created_at: new Date().toISOString(),
    };

    // 2. Clear active_driver_id on the vehicle (in local storage)
    const vehicles = getLocalData("vehicles", seedVehicles);
    const vIndex = vehicles.findIndex((v) => v.id === vehicleId);
    if (vIndex >= 0) {
      vehicles[vIndex].active_driver_id = null;
      setLocalData("vehicles", vehicles);
    }

    // 3. Persist the RELEASE record in local storage
    const assignments = getLocalData("assignments", seedAssignments);
    assignments.unshift(newReleaseEntry);
    setLocalData("assignments", assignments);

    // 4. Sync to Supabase
    if (supabase) {
      // Clear driver on vehicle
      const { error: updateError } = await supabase
        .from("vehicles")
        .update({ active_driver_id: null })
        .eq("id", vehicleId);
      if (updateError) console.error("Error clearing driver on vehicle:", updateError.message);

      // Insert RELEASE log entry
      const { error: insertError } = await supabase
        .from("assignments")
        .insert(newReleaseEntry);
      if (insertError) {
        console.error("Error logging release assignment:", insertError.message);
        addPendingId("assignments", newReleaseEntry.id);
      } else {
        clearPendingIds("assignments", [newReleaseEntry.id]);
      }
    } else {
      addPendingId("assignments", newReleaseEntry.id);
    }
  },

  async getAvailableVehicles(): Promise<Vehicle[]> {
    const vehicles = await this.getVehicles();
    return vehicles.filter(v => !v.active_driver_id);
  },

  async getAvailableDrivers(): Promise<Driver[]> {
    const drivers = await this.getDrivers();
    // A driver is "available" if no vehicle has them as active driver
    const vehicles = await this.getVehicles();
    const assignedDriverIds = new Set(vehicles.filter(v => v.active_driver_id).map(v => v.active_driver_id));
    return drivers.filter(d => !assignedDriverIds.has(d.id));
  },

  // --- Checklists ---
  async getChecklists(): Promise<Checklist[]> {
    if (supabase) {
      const { data, error } = await supabase.from("checklists").select("*").order("created_at", { ascending: false });
      if (!error) return mergePendingLocal("checklists", data, seedChecklists);
    }
    return getLocalData("checklists", seedChecklists);
  },

  async saveChecklist(checklist: Omit<Checklist, "id" | "created_at">): Promise<Checklist> {
    const fullChecklist: Checklist = {
      id: genId(),
      created_at: new Date().toISOString(),
      ...checklist,
    };
    if (supabase) {
      const { data, error } = await supabase.from("checklists").insert(fullChecklist).select().single();
      if (!error && data) {
        clearPendingIds("checklists", [fullChecklist.id]);
        return data;
      }
    }
    const checklists = getLocalData("checklists", seedChecklists);
    checklists.unshift(fullChecklist);
    setLocalData("checklists", checklists);
    addPendingId("checklists", fullChecklist.id);
    return fullChecklist;
  },

  async autoGenerateMondayChecklists(): Promise<number> {
    const today = new Date();
    if (today.getDay() !== 1) return 0;

    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const currentMondayStr = `${yyyy}-${mm}-${dd}`;

    if (typeof window !== "undefined") {
      const lastGen = localStorage.getItem("last_weekly_checklist_gen");
      if (lastGen === currentMondayStr) return 0;
    }

    const vehicles = await this.getVehicles();
    const checklists = await this.getChecklists();
    let count = 0;

    for (const vehicle of vehicles) {
      if (vehicle.active_driver_id) {
        const hasTodayChecklist = checklists.some(
          (c) =>
            c.vehicle_id === vehicle.id &&
            c.type === "WEEKLY_START" &&
            c.created_at.startsWith(currentMondayStr)
        );

        if (!hasTodayChecklist) {
          const vehicleChecklists = checklists.filter((c) => c.vehicle_id === vehicle.id);
          const lastMileage =
            vehicleChecklists.length > 0
              ? Math.max(...vehicleChecklists.map((c) => c.mileage))
              : 0;

          await this.saveChecklist({
            vehicle_id: vehicle.id,
            driver_id: vehicle.active_driver_id,
            type: "WEEKLY_START",
            mileage: lastMileage,
            gasoline_level: "8/8",
            checklist_items: {
              lights: true,
              brakes: true,
              tires: true,
              bodywork: true,
              documents: true,
            },
            irregularities: "Checklist autogenerado de inicio de semana.",
          });
          count++;
        }
      }
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("last_weekly_checklist_gen", currentMondayStr);
    }
    return count;
  },

  // --- Weekly Rentals & Finance ---
  async getWeeklyRentals(): Promise<WeeklyRental[]> {
    if (supabase) {
      const { data, error } = await supabase.from("weekly_rentals").select("*").order("week_start", { ascending: false });
      if (!error) return mergePendingLocal("weekly_rentals", data, seedWeeklyRentals);
    }
    return getLocalData("weekly_rentals", seedWeeklyRentals);
  },

  /**
   * Apply a payment to a driver. The amount is spread across the
   * driver's rentals using FIFO (oldest week first). If the amount
   * exceeds the total pending debt, the leftover becomes a credit
   * for the driver (returned in `applied.leftover`).
   *
   * @returns the array of rentals after the payment was applied.
   */
  async addPayment(
    driverId: string,
    amount: number,
    paymentDate: string = new Date().toISOString().split("T")[0]
  ): Promise<{
    rentals: WeeklyRental[];
    appliedPerWeek: { week_start: string; amount: number }[];
    leftover: number;
  }> {
    if (amount <= 0) {
      return { rentals: getLocalData("weekly_rentals", seedWeeklyRentals), appliedPerWeek: [], leftover: 0 };
    }

    const allRentals = getLocalData("weekly_rentals", seedWeeklyRentals);
    const driverRentals = allRentals.filter((r) => r.driver_id === driverId);
    const otherRentals = allRentals.filter((r) => r.driver_id !== driverId);

    const { updatedRentals, appliedPerWeek, leftover } = applyPayment(
      driverRentals,
      amount,
      paymentDate
    );

    // Persist the full rentals list (other drivers + updated this driver).
    const merged = [...updatedRentals, ...otherRentals];
    setLocalData("weekly_rentals", merged);

    // Credit leftover, if any.
    if (leftover > 0) {
      const credits = getLocalData<{ driver_id: string; amount: number; updated_at: string }>(
        "driver_credits",
        []
      );
      const idx = credits.findIndex((c) => c.driver_id === driverId);
      const now = new Date().toISOString();
      if (idx >= 0) {
        credits[idx] = {
          driver_id: driverId,
          amount: credits[idx].amount + leftover,
          updated_at: now,
        };
      } else {
        credits.push({ driver_id: driverId, amount: leftover, updated_at: now });
      }
      setLocalData("driver_credits", credits);
    }

    // Supabase sync (best-effort; the local store is the source of truth).
    if (supabase) {
      for (const r of updatedRentals) {
        const { error } = await supabase
          .from("weekly_rentals")
          .upsert(r)
          .eq("id", r.id);
        if (error) addPendingId("weekly_rentals", r.id);
        else clearPendingIds("weekly_rentals", [r.id]);
      }
    } else {
      // No Supabase: every updated row is a pending write.
      for (const r of updatedRentals) addPendingId("weekly_rentals", r.id);
    }

    return { rentals: updatedRentals, appliedPerWeek, leftover };
  },

  /** Sum of all pending (unpaid + partial) rentals for a driver. */
  async getDriverDebt(driverId: string): Promise<number> {
    const rentals = getLocalData("weekly_rentals", seedWeeklyRentals);
    return rentals
      .filter((r) => r.driver_id === driverId && r.status !== "PAID")
      .reduce((acc, r) => acc + Math.max(0, r.rent_amount - r.paid_amount), 0);
  },

  /** Credit the driver has built up from overpayments. */
  async getDriverCredit(driverId: string): Promise<number> {
    const credits = getLocalData<{ driver_id: string; amount: number; updated_at: string }>(
      "driver_credits",
      []
    );
    return credits.find((c) => c.driver_id === driverId)?.amount ?? 0;
  },

  /** Add a credit to a driver (e.g. for days the vehicle was in service). */
  async addDriverCredit(driverId: string, amount: number): Promise<void> {
    const credits = getLocalData<{ driver_id: string; amount: number; updated_at: string }>(
      "driver_credits",
      []
    );
    const existing = credits.find((c) => c.driver_id === driverId);
    if (existing) {
      existing.amount += amount;
      existing.updated_at = new Date().toISOString();
    } else {
      credits.push({ driver_id: driverId, amount, updated_at: new Date().toISOString() });
    }
    setLocalData("driver_credits", credits);
    addPendingId("driver_credits", driverId);
  },

  async createWeeklyRental(rental: Omit<WeeklyRental, "id" | "created_at" | "payments_log">): Promise<WeeklyRental | null> {
    // Prevent duplicates: if a rental already exists for this driver + week,
    // return null instead of creating a second one.
    const existing = getLocalData("weekly_rentals", seedWeeklyRentals);
    const dup = existing.find(
      (r) => r.driver_id === rental.driver_id && r.week_start === rental.week_start
    );
    if (dup) {
      console.warn(
        `[fleet] Duplicate weekly rental skipped: driver=${rental.driver_id} week=${rental.week_start}`
      );
      return null;
    }

    const fullRental: WeeklyRental = {
      id: genId(),
      payments_log: [],
      created_at: new Date().toISOString(),
      ...rental,
    };
    if (supabase) {
      const { data, error } = await supabase.from("weekly_rentals").insert(fullRental).select().single();
      if (!error && data) {
        clearPendingIds("weekly_rentals", [fullRental.id]);
        return data;
      }
    }
    const rentals = getLocalData("weekly_rentals", seedWeeklyRentals);
    rentals.unshift(fullRental);
    setLocalData("weekly_rentals", rentals);
    addPendingId("weekly_rentals", fullRental.id);
    return fullRental;
  },

  async saveWeeklyRental(rental: WeeklyRental): Promise<WeeklyRental> {
    if (supabase) {
      const { data, error } = await supabase
        .from("weekly_rentals")
        .upsert(rental)
        .select()
        .single();
      if (!error && data) {
        clearPendingIds("weekly_rentals", [rental.id]);
        return data;
      }
    }
    const rentals = getLocalData("weekly_rentals", seedWeeklyRentals);
    const idx = rentals.findIndex((r) => r.id === rental.id);
    if (idx >= 0) {
      rentals[idx] = rental;
    } else {
      rentals.unshift(rental);
    }
    setLocalData("weekly_rentals", rentals);
    addPendingId("weekly_rentals", rental.id);
    return rental;
  },

  // --- Maintenances ---
  async getMaintenances(): Promise<Maintenance[]> {
    if (supabase) {
      const { data, error } = await supabase.from("maintenances").select("*").order("created_at", { ascending: false });
      if (!error) return mergePendingLocal("maintenances", data, seedMaintenances);
    }
    return getLocalData("maintenances", seedMaintenances);
  },

  async saveMaintenance(maintenance: Omit<Maintenance, "id" | "created_at">): Promise<Maintenance> {
    const fullMaint: Maintenance = {
      id: genId(),
      created_at: new Date().toISOString(),
      ...maintenance,
    };

    // Auto-update the vehicle's next_service_mileage: latest odometer + 10000 km.
    // This runs regardless of Supabase success so the local state is always correct.
    const checklists = getLocalData("checklists", seedChecklists);
    const vChecklists = checklists.filter((c) => c.vehicle_id === maintenance.vehicle_id);
    if (vChecklists.length > 0) {
      const sorted = [...vChecklists].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const latestMileage = sorted[0].mileage;
      const newServiceMileage = latestMileage + 10000;
      await this.updateVehicleServiceSchedule(maintenance.vehicle_id, newServiceMileage, maintenance.next_maintenance_date);
    } else {
      // No checklists yet — just update the date, leave mileage as-is.
      await this.updateVehicleServiceSchedule(maintenance.vehicle_id, null, maintenance.next_maintenance_date);
    }

    if (supabase) {
      const { data, error } = await supabase.from("maintenances").insert(fullMaint).select().single();
      if (!error && data) {
        clearPendingIds("maintenances", [fullMaint.id]);
        return data;
      }
    }
    const maintenances = getLocalData("maintenances", seedMaintenances);
    maintenances.unshift(fullMaint);
    setLocalData("maintenances", maintenances);
    addPendingId("maintenances", fullMaint.id);
    return fullMaint;
  },

  // --- Renewal Logs ---
  async saveRenewalLog(log: Omit<RenewalLog, "id" | "created_at">): Promise<RenewalLog> {
    const fullLog: RenewalLog = {
      id: genId(),
      created_at: new Date().toISOString(),
      ...log,
    };
    if (supabase) {
      const { data, error } = await supabase.from("renewal_logs").insert(fullLog).select().single();
      if (!error && data) {
        clearPendingIds("renewal_logs", [fullLog.id]);
        return data;
      }
    }
    const logs = getLocalData("renewal_logs", [] as RenewalLog[]);
    logs.unshift(fullLog);
    setLocalData("renewal_logs", logs);
    addPendingId("renewal_logs", fullLog.id);
    return fullLog;
  },

  async getRenewalLogs(vehicleId?: string): Promise<RenewalLog[]> {
    if (supabase) {
      let query = supabase.from("renewal_logs").select("*").order("created_at", { ascending: false });
      if (vehicleId) query = query.eq("vehicle_id", vehicleId);
      const { data, error } = await query;
      if (!error) return mergePendingLocal("renewal_logs", data, []);
    }
    const logs = getLocalData("renewal_logs", [] as RenewalLog[]);
    if (vehicleId) return logs.filter((l) => l.vehicle_id === vehicleId);
    return logs;
  },

  // --- Alerts (Derived Dynamically) ---
  async getAlerts(): Promise<Alert[]> {
    const drivers = await this.getDrivers();
    const vehicles = await this.getVehicles();
    const maintenances = await this.getMaintenances();
    const alerts: Alert[] = [];
    const today = new Date();

    // 1. Driver License Alerts
    drivers.forEach((driver) => {
      if (driver.license_is_permanent) return;
      if (!driver.license_expiration_date) return;

      const expDate = new Date(driver.license_expiration_date);
      const diffTime = expDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 30) {
        alerts.push({
          id: `alert-lic-${driver.id}-${driver.license_expiration_date}`,
          type: "LICENSE",
          title: `Licencia de Conducir Vencida / Por Vencer`,
          description: `La licencia de ${driver.first_name} ${driver.paternal_last_name} vence en ${diffDays} días (${driver.license_expiration_date}).`,
          targetId: driver.id,
          severity: diffDays <= 0 ? "critical" : diffDays <= 7 ? "warning" : "info",
          dueDate: driver.license_expiration_date,
        });
      }
    });

    // 2. Vehicle Insurance Alerts
    vehicles.forEach((vehicle) => {
      if (!vehicle.insurance_expiration_date) return;

      const expDate = new Date(vehicle.insurance_expiration_date);
      const diffTime = expDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 30) {
        alerts.push({
          id: `alert-ins-${vehicle.id}-${vehicle.insurance_expiration_date}`,
          type: "INSURANCE",
          title: `Seguro del Vehículo Vencido / Por Vencer`,
          description: `La póliza de seguro del auto ${vehicle.brand} ${vehicle.vehicle_name} (${vehicle.plate_number}) vence en ${diffDays} días.`,
          targetId: vehicle.id,
          severity: diffDays <= 0 ? "critical" : diffDays <= 10 ? "warning" : "info",
          dueDate: vehicle.insurance_expiration_date,
        });
      }

      // 3. Vehicle Verification Alerts (Dynamic Mexican logic)
      if (vehicle.plate_number) {
        const schedule = getVerificationSchedule(vehicle.plate_number);
        const match = vehicle.plate_number.replace(/\D/g, "");
        const lastDigit = match ? parseInt(match.slice(-1), 10) : 5;

        type Window = { startMonth: number; endMonth: number; limitDate: string; period: string };
        let activeWindow: Window | null = null;

        if (lastDigit === 5 || lastDigit === 6) {
          activeWindow = today.getMonth() <= 2
            ? { startMonth: 0, endMonth: 2, limitDate: `${today.getFullYear()}-03-31`, period: "Primer Semestre (Feb-Mar)" }
            : { startMonth: 6, endMonth: 8, limitDate: `${today.getFullYear()}-09-30`, period: "Segundo Semestre (Ago-Sep)" };
        } else if (lastDigit === 7 || lastDigit === 8) {
          activeWindow = today.getMonth() <= 3
            ? { startMonth: 1, endMonth: 3, limitDate: `${today.getFullYear()}-04-30`, period: "Primer Semestre (Mar-Abr)" }
            : { startMonth: 7, endMonth: 9, limitDate: `${today.getFullYear()}-10-31`, period: "Segundo Semestre (Sep-Oct)" };
        } else if (lastDigit === 3 || lastDigit === 4) {
          activeWindow = today.getMonth() <= 4
            ? { startMonth: 2, endMonth: 4, limitDate: `${today.getFullYear()}-05-31`, period: "Primer Semestre (Abr-May)" }
            : { startMonth: 8, endMonth: 10, limitDate: `${today.getFullYear()}-11-30`, period: "Segundo Semestre (Oct-Nov)" };
        } else if (lastDigit === 1 || lastDigit === 2) {
          activeWindow = today.getMonth() <= 5
            ? { startMonth: 3, endMonth: 5, limitDate: `${today.getFullYear()}-06-30`, period: "Primer Semestre (May-Jun)" }
            : { startMonth: 9, endMonth: 11, limitDate: `${today.getFullYear()}-12-31`, period: "Segundo Semestre (Nov-Dic)" };
        } else {
          activeWindow = today.getMonth() >= 10 || today.getMonth() === 0
            ? {
                startMonth: 10,
                endMonth: 0,
                limitDate: `${today.getMonth() === 0 ? today.getFullYear() : today.getFullYear() + 1}-01-31`,
                period: "Segundo Semestre (Dic-Ene)",
              }
            : { startMonth: 4, endMonth: 6, limitDate: `${today.getFullYear()}-07-31`, period: "Primer Semestre (Jun-Jul)" };
        }

        if (activeWindow) {
          const limit = new Date(activeWindow.limitDate);
          const daysUntilLimit = Math.ceil((limit.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

          // Alert only in the last 30 days of the window or if the deadline has passed.
          const shouldAlert = daysUntilLimit <= 30 || daysUntilLimit < 0;
          const severity = daysUntilLimit <= 0 ? "critical" : daysUntilLimit <= 7 ? "warning" : "info";

          if (shouldAlert) {
            alerts.push({
              id: `alert-ver-${vehicle.id}-${activeWindow.limitDate}`,
              type: "VERIFICATION",
              title: daysUntilLimit < 0 ? `Verificación Vehicular Vencida` : `Verificación Vehicular Próxima`,
              description: daysUntilLimit < 0
                ? `La verificación del vehículo ${vehicle.brand} ${vehicle.vehicle_name} (${vehicle.plate_number}) con terminación ${lastDigit} (Engomado ${schedule.color}) venció el ${activeWindow.limitDate}.`
                : `El vehículo ${vehicle.brand} ${vehicle.vehicle_name} (${vehicle.plate_number}) con terminación ${lastDigit} (Engomado ${schedule.color}) debe verificar en ${activeWindow.period}. Quedan ${daysUntilLimit} días.`,
              targetId: vehicle.id,
              severity,
              dueDate: activeWindow.limitDate,
            });
          }
        }
      }
    });

    // 4. Maintenance Alerts
    maintenances.forEach((maint) => {
      if (!maint.next_maintenance_date) return;

      const nextDate = new Date(maint.next_maintenance_date);
      const diffTime = nextDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 30) {
        alerts.push({
          id: `alert-maint-${maint.id}-${maint.next_maintenance_date}`,
          type: "MAINTENANCE",
          title: `Mantenimiento Programado`,
          description: `Próximo servicio programado para el vehículo en ${diffDays} días (${maint.next_maintenance_date}).`,
          targetId: maint.vehicle_id,
          severity: diffDays <= 0 ? "critical" : diffDays <= 10 ? "warning" : "info",
          dueDate: maint.next_maintenance_date,
        });
      }
    });

    // 5. Mileage-based maintenance alerts — compare each vehicle's
    //    next_service_mileage against the latest odometer reading from
    //    checklists. If the vehicle is within 1000 km of the service
    //    threshold, fire an alert with an estimated date based on usage.
    const checklists = await this.getChecklists();
    for (const vehicle of vehicles) {
      if (!vehicle.next_service_mileage) continue;

      const vChecklists = checklists.filter((c) => c.vehicle_id === vehicle.id);
      if (vChecklists.length === 0) continue;

      const sorted = [...vChecklists].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const latestMileage = sorted[0].mileage;
      const kmRemaining = Math.max(0, vehicle.next_service_mileage - latestMileage);

      // Only alert when within 1000 km of the service threshold.
      if (kmRemaining > 1000) continue;

      // Compute average daily km from the last 4 weeks of checklists.
      const { computeUsageStats } = await import("../usageStats");
      const stats = computeUsageStats(vChecklists);
      const est = estimateServiceDate(latestMileage, vehicle.next_service_mileage, stats.monthlyAverage);

      const severity: "critical" | "warning" | "info" =
        kmRemaining <= 0 ? "critical" : kmRemaining <= 200 ? "warning" : "info";

      alerts.push({
        id: `alert-mileage-${vehicle.id}-${vehicle.next_service_mileage}`,
        type: "MAINTENANCE",
        title: kmRemaining <= 0
          ? `Mantenimiento Vencido — ${vehicle.brand} ${vehicle.vehicle_name}`
          : `Mantenimiento Próximo — ${vehicle.brand} ${vehicle.vehicle_name}`,
        description: kmRemaining <= 0
          ? `El vehículo ${vehicle.brand} ${vehicle.vehicle_name} (${vehicle.plate_number}) superó el kilometraje de servicio (${vehicle.next_service_mileage} km). Odómetro actual: ${latestMileage.toLocaleString()} km.`
          : `El vehículo ${vehicle.brand} ${vehicle.vehicle_name} (${vehicle.plate_number}) está a ${kmRemaining} km del servicio de ${vehicle.next_service_mileage.toLocaleString()} km. Odómetro actual: ${latestMileage.toLocaleString()} km.${est?.estimatedDate && est.estimatedDate !== "—" ? ` Fecha estimada: ${est.estimatedDate}.` : ""}`,
        targetId: vehicle.id,
        severity,
        dueDate: est?.estimatedDate && est.estimatedDate !== "—" ? est.estimatedDate : new Date().toISOString().split("T")[0],
      });
    }

    const completed = getLocalData("completed_alerts", [] as string[]);
    return alerts.filter((a) => !completed.includes(a.id));
  },

  async dismissAlert(alertId: string): Promise<boolean> {
    const completed = getLocalData("completed_alerts", [] as string[]);
    let resolvedId = alertId;

    // Resolve verification alert prefix: alert-ver-[vehicleId]
    if (alertId.startsWith("alert-ver-") && alertId.split("-").length === 3) {
      const vehicleId = alertId.replace("alert-ver-", "");
      const vehicles = getLocalData("vehicles", seedVehicles);
      const vehicle = vehicles.find(v => v.id === vehicleId);
      if (vehicle && vehicle.plate_number) {
        const today = new Date();
        const match = vehicle.plate_number.replace(/\D/g, "");
        const lastDigit = match ? parseInt(match.slice(-1), 10) : 5;
        let activeLimitDate = "";
        
        if (lastDigit === 5 || lastDigit === 6) {
          activeLimitDate = today.getMonth() <= 2 ? `${today.getFullYear()}-03-31` : `${today.getFullYear()}-09-30`;
        } else if (lastDigit === 7 || lastDigit === 8) {
          activeLimitDate = today.getMonth() <= 3 ? `${today.getFullYear()}-04-30` : `${today.getFullYear()}-10-31`;
        } else if (lastDigit === 3 || lastDigit === 4) {
          activeLimitDate = today.getMonth() <= 4 ? `${today.getFullYear()}-05-31` : `${today.getFullYear()}-11-30`;
        } else if (lastDigit === 1 || lastDigit === 2) {
          activeLimitDate = today.getMonth() <= 5 ? `${today.getFullYear()}-06-30` : `${today.getFullYear()}-12-31`;
        } else {
          activeLimitDate = today.getMonth() >= 10 || today.getMonth() === 0
            ? `${today.getMonth() === 0 ? today.getFullYear() : today.getFullYear() + 1}-01-31`
            : `${today.getFullYear()}-07-31`;
        }
        resolvedId = `alert-ver-${vehicleId}-${activeLimitDate}`;
      }
    }

    if (!completed.includes(resolvedId)) {
      completed.push(resolvedId);
    }
    if (resolvedId !== alertId && !completed.includes(alertId)) {
      completed.push(alertId);
    }
    setLocalData("completed_alerts", completed);
    return true;
  },

  // --- Vehicle Inventory ---
  async getVehicleInventory(vehicleId: string): Promise<VehicleInventory | null> {
    if (supabase) {
      const { data, error } = await supabase
        .from("vehicle_inventories")
        .select("*")
        .eq("vehicle_id", vehicleId)
        .maybeSingle();
      if (!error && data) return data;
    }
    const inventories: VehicleInventory[] = getLocalData("vehicle_inventories", []);
    return inventories.find((i) => i.vehicle_id === vehicleId) || null;
  },

  async saveVehicleInventory(inventory: Omit<VehicleInventory, "id" | "created_at" | "updated_at"> & { id?: string }): Promise<VehicleInventory> {
    const now = new Date().toISOString();
    const full: VehicleInventory = {
      id: inventory.id || genId(),
      vehicle_id: inventory.vehicle_id,
      photos: inventory.photos,
      items: inventory.items,
      created_at: now,
      updated_at: now,
    };
    if (supabase) {
      const { data, error } = await supabase
        .from("vehicle_inventories")
        .upsert({ ...full, updated_at: now })
        .select()
        .single();
      if (!error && data) return data;
      if (error) console.error("Supabase saveVehicleInventory error:", error.message);
    }
    const inventories: VehicleInventory[] = getLocalData("vehicle_inventories", []);
    const idx = inventories.findIndex((i) => i.vehicle_id === full.vehicle_id);
    if (idx >= 0) {
      inventories[idx] = { ...inventories[idx], ...full, updated_at: now };
    } else {
      inventories.push(full);
    }
    setLocalData("vehicle_inventories", inventories);
    return full;
  },
};
