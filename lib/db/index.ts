import { createClient } from "@supabase/supabase-js";
import type {
  Driver,
  Vehicle,
  Assignment,
  Checklist,
  WeeklyRental,
  Maintenance,
  Alert,
} from "./types";
export type * from "./types";
export { getVerificationSchedule, genId, normalizeEmptyDates } from "./utils";

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

  async saveDriver(driver: Omit<Driver, "id" | "created_at"> & { id?: string }): Promise<Driver> {
    const fullDriver: Driver = normalizeEmptyDates({
      id: driver.id || genId(),
      created_at: new Date().toISOString(),
      ...driver,
    }, DRIVER_DATE_KEYS) as Driver;
    if (supabase) {
      const { data, error } = await supabase.from("drivers").upsert(fullDriver).select().single();
      if (!error && data) {
        clearPendingIds("drivers", [fullDriver.id]);
        return data;
      }
      if (error) {
        console.error("Supabase saveDriver error:", error.message, error.details, error.hint);
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

  async saveVehicle(vehicle: Omit<Vehicle, "id" | "created_at"> & { id?: string }): Promise<Vehicle> {
    const fullVehicle: Vehicle = normalizeEmptyDates({
      id: vehicle.id || genId(),
      created_at: new Date().toISOString(),
      ...vehicle,
    }, VEHICLE_DATE_KEYS) as Vehicle;
    if (supabase) {
      const { data, error } = await supabase.from("vehicles").upsert(fullVehicle).select().single();
      if (!error && data) {
        clearPendingIds("vehicles", [fullVehicle.id]);
        return data;
      }
      if (error) {
        console.error("Supabase saveVehicle error:", error.message, error.details, error.hint);
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

  // --- Assignments ---
  async getAssignments(): Promise<Assignment[]> {
    if (supabase) {
      const { data, error } = await supabase.from("assignments").select("*").order("created_at", { ascending: false });
      if (!error) return mergePendingLocal("assignments", data, seedAssignments);
    }
    return getLocalData("assignments", seedAssignments);
  },

  async createAssignment(vehicleId: string, driverId: string, type: "ASSIGN" | "RELEASE", reason: string, isFirstTime: boolean = false): Promise<Assignment> {
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

    // Auto-generate Weekly Rental if it's an ASSIGN action
    if (type === "ASSIGN") {
      const d = new Date();
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      const yyyy = monday.getFullYear();
      const mm = String(monday.getMonth() + 1).padStart(2, "0");
      const dd = String(monday.getDate()).padStart(2, "0");
      const weekStart = `${yyyy}-${mm}-${dd}`;

      const rentals = getLocalData("weekly_rentals", seedWeeklyRentals);
      const exists = rentals.some((r) => r.driver_id === driverId && r.week_start === weekStart);
      if (!exists) {
        const vehicleObj = vehicles.find((v) => v.id === vehicleId);
        const rentCost = vehicleObj?.rent_cost || 2500;

        const newRental: WeeklyRental = {
          id: genId(),
          driver_id: driverId,
          week_start: weekStart,
          rent_amount: rentCost,
          paid_amount: 0,
          accumulated_debt: isFirstTime ? rentCost * 2 : rentCost,
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

  async removeAssignment(assignmentId: string, reason: string): Promise<void> {
    if (supabase) {
      const { error } = await supabase.from("assignments").delete().match({ id: assignmentId });
      if (error) throw error;
      console.log(`Assignment ${assignmentId} removed. Reason: ${reason}`);
    } else {
      const assignments = getLocalData("assignments", seedAssignments);
      const filtered = assignments.filter(a => a.id !== assignmentId);
      setLocalData("assignments", filtered);
    }
  },

  async getAvailableVehicles(): Promise<Vehicle[]> {
    const vehicles = await this.getVehicles();
    return vehicles.filter(v => !v.driver_id);
  },

  async getAvailableDrivers(): Promise<Driver[]> {
    const drivers = await this.getDrivers();
    return drivers.filter(d => !d.vehicle_id);
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

  async addPayment(driverId: string, weekStart: string, amount: number): Promise<WeeklyRental> {
    const rentals = getLocalData("weekly_rentals", seedWeeklyRentals);
    const rentalIndex = rentals.findIndex((r) => r.driver_id === driverId && r.week_start === weekStart);

    let updatedRental: WeeklyRental;

    if (rentalIndex >= 0) {
      const current = rentals[rentalIndex];
      const newPaid = current.paid_amount + amount;
      let newStatus: "PAID" | "PARTIAL" | "UNPAID" = "PARTIAL";
      if (newPaid >= current.rent_amount) {
        newStatus = "PAID";
      } else if (newPaid === 0) {
        newStatus = "UNPAID";
      }

      const newAccumulatedDebt = Math.max(0, current.accumulated_debt - amount);

      updatedRental = {
        ...current,
        paid_amount: newPaid,
        accumulated_debt: newAccumulatedDebt,
        status: newStatus,
        payments_log: [...current.payments_log, { amount, date: new Date().toISOString().split("T")[0] }],
      };
      rentals[rentalIndex] = updatedRental;
    } else {
      const newAccumulatedDebt = Math.max(0, 2500 - amount);
      updatedRental = {
        id: genId(),
        driver_id: driverId,
        week_start: weekStart,
        rent_amount: 2500,
        paid_amount: amount,
        accumulated_debt: newAccumulatedDebt,
        status: amount >= 2500 ? "PAID" : amount > 0 ? "PARTIAL" : "UNPAID",
        payments_log: [{ amount, date: new Date().toISOString().split("T")[0] }],
        created_at: new Date().toISOString(),
      };
      rentals.unshift(updatedRental);
    }

    setLocalData("weekly_rentals", rentals);

    if (supabase) {
      const { data, error } = await supabase.from("weekly_rentals").upsert(updatedRental).select().single();
      if (!error && data) {
        clearPendingIds("weekly_rentals", [updatedRental.id]);
        return data;
      }
    }
    addPendingId("weekly_rentals", updatedRental.id);

    return updatedRental;
  },

  async createWeeklyRental(rental: Omit<WeeklyRental, "id" | "created_at" | "payments_log">): Promise<WeeklyRental> {
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
          id: `alert-lic-${driver.id}`,
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
          id: `alert-ins-${vehicle.id}`,
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
              id: `alert-ver-${vehicle.id}`,
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

      if (diffDays <= 15) {
        alerts.push({
          id: `alert-maint-${maint.id}`,
          type: "MAINTENANCE",
          title: `Mantenimiento Programado`,
          description: `Próximo servicio programado para el vehículo en ${diffDays} días (${maint.next_maintenance_date}).`,
          targetId: maint.vehicle_id,
          severity: diffDays <= 0 ? "critical" : diffDays <= 5 ? "warning" : "info",
          dueDate: maint.next_maintenance_date,
        });
      }
    });

    const completed = getLocalData("completed_alerts", [] as string[]);
    return alerts.filter((a) => !completed.includes(a.id));
  },

  async dismissAlert(alertId: string): Promise<boolean> {
    const completed = getLocalData("completed_alerts", [] as string[]);
    if (!completed.includes(alertId)) {
      completed.push(alertId);
      setLocalData("completed_alerts", completed);
    }
    return true;
  },
};
