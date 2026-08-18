import { getSupabase } from "./index";
import type { Assignment, Driver, Vehicle, WeeklyRental } from "./types";
import { getLocalData, setLocalData, mergePendingLocal, addPendingId, clearPendingIds } from "./localStorage";
import { seedAssignments, seedVehicles, seedWeeklyRentals } from "./seed";
import { genId } from "./utils";
import { getMondayOf, prorateRent } from "../utils";
import { getOwnerId, ownerScoped, ownerEq } from "./owner";
import { getSession } from "@/lib/session";

export async function getAssignments(): Promise<Assignment[]> {
  const session = getSession();
  const ownerId = session?.userId;
  const isAdmin = session?.role === "admin";
  const supabase = getSupabase(); if (supabase) {
    let query = supabase.from("assignments").select("*");
    if (ownerId && !isAdmin) query = query.or(`owner_id.eq.${ownerId},owner_id.is.null`);
    const { data, error } = await query.order("created_at", { ascending: false });
    if (!error) return mergePendingLocal("assignments", data, seedAssignments, ownerId);
  }
  return ownerScoped(getLocalData("assignments", seedAssignments));
}

export async function createAssignment(
  vehicleId: string,
  driverId: string,
  type: "ASSIGN" | "RELEASE",
  reason: string
): Promise<Assignment> {
  const ownerId = getOwnerId();
  const newAssignment: Assignment = {
    id: genId(),
    owner_id: ownerId ?? undefined,
    vehicle_id: vehicleId,
    driver_id: driverId,
    action_type: type,
    reason,
    created_at: new Date().toISOString(),
  };

  // Update active_driver_id on vehicle (owner-scoped read/write)
  const allVehicles = getLocalData<Vehicle>("vehicles", seedVehicles);
  const vehicles = ownerScoped(allVehicles);
  const vIndex = allVehicles.findIndex((v) => v.id === vehicleId);
  if (vIndex >= 0) {
    allVehicles[vIndex].active_driver_id = type === "ASSIGN" ? driverId : null;
    setLocalData("vehicles", allVehicles);
  }

  // Auto-generate Weekly Rental if it's an ASSIGN action.
  if (type === "ASSIGN") {
    const weekStart = getMondayOf(new Date());

    const allRentals = getLocalData<WeeklyRental>("weekly_rentals", seedWeeklyRentals);
    const rentals = ownerScoped(allRentals);
    const exists = rentals.some((r) => r.driver_id === driverId && r.week_start === weekStart);

    if (!exists) {
      const vehicleObj = vehicles.find((v) => v.id === vehicleId);
      const rentCost = vehicleObj?.rent_cost || 2500;
      const { amount, days } = prorateRent(rentCost, new Date());

      const newRental = {
        id: genId(),
        owner_id: ownerId ?? undefined,
        driver_id: driverId,
        week_start: weekStart,
        rent_amount: amount,
        paid_amount: 0,
        is_prorated: days < 7,
        prorated_days: days < 7 ? days : undefined,
        condoned_days: 0,
        condoned_amount: 0,
        status: "UNPAID" as const,
        payments_log: [],
        created_at: new Date().toISOString(),
      };
      allRentals.unshift(newRental);
      setLocalData("weekly_rentals", allRentals);
      const supabase = getSupabase(); if (supabase) {
        const { error: rErr } = await supabase.from("weekly_rentals").insert(newRental);
        if (rErr) addPendingId("weekly_rentals", newRental.id);
      }
    } else {
      // Re-assignment mid-week: pre-create next week's rental with new auto's rate
      const nextMonday = new Date();
      nextMonday.setDate(nextMonday.getDate() + ((8 - nextMonday.getDay()) % 7 || 7));
      const nextWeekStart = getMondayOf(nextMonday);

      const hasNextWeek = rentals.some((r) => r.driver_id === driverId && r.week_start === nextWeekStart);
      if (!hasNextWeek) {
        const vehicleObj = vehicles.find((v) => v.id === vehicleId);
        const rentCost = vehicleObj?.rent_cost || 2500;

        const nextRental = {
          id: genId(),
          owner_id: ownerId ?? undefined,
          driver_id: driverId,
          week_start: nextWeekStart,
          rent_amount: rentCost,
          paid_amount: 0,
          is_prorated: false,
          prorated_days: undefined,
          condoned_days: 0,
          condoned_amount: 0,
          status: "UNPAID" as const,
          payments_log: [],
          created_at: new Date().toISOString(),
        };
        allRentals.unshift(nextRental);
        setLocalData("weekly_rentals", allRentals);
        const supabase = getSupabase(); if (supabase) {
          const { error: rErr } = await supabase.from("weekly_rentals").insert(nextRental);
          if (rErr) addPendingId("weekly_rentals", nextRental.id);
        }
      }
    }
  }

  const supabase = getSupabase(); if (supabase) {
    await ownerEq(supabase.from("vehicles").update({ active_driver_id: type === "ASSIGN" ? driverId : null }), ownerId).eq("id", vehicleId);
    const { data, error } = await supabase.from("assignments").insert(newAssignment).select().single();
    if (!error && data) return data;
  }

  const assignments = getLocalData("assignments", seedAssignments);
  assignments.unshift(newAssignment);
  setLocalData("assignments", assignments);
  addPendingId("assignments", newAssignment.id);

  return newAssignment;
}

export async function removeAssignment(vehicleId: string, driverId: string, reason: string): Promise<void> {
  const ownerId = getOwnerId();
  const newReleaseEntry: Assignment = {
    id: genId(),
    owner_id: ownerId ?? undefined,
    vehicle_id: vehicleId,
    driver_id: driverId,
    action_type: "RELEASE",
    reason,
    created_at: new Date().toISOString(),
  };

  // Clear active_driver_id on the vehicle
  const allVehicles = getLocalData<Vehicle>("vehicles", seedVehicles);
  const vIndex = allVehicles.findIndex((v) => v.id === vehicleId);
  if (vIndex >= 0) {
    allVehicles[vIndex].active_driver_id = null;
    setLocalData("vehicles", allVehicles);
  }

  // Persist the RELEASE record
  const assignments = getLocalData("assignments", seedAssignments);
  assignments.unshift(newReleaseEntry);
  setLocalData("assignments", assignments);

  // Sync to Supabase (owner-scoped vehicle update)
  const supabase = getSupabase(); if (supabase) {
    await ownerEq(supabase.from("vehicles").update({ active_driver_id: null }), ownerId).eq("id", vehicleId);
    const { error: insertError } = await supabase.from("assignments").insert(newReleaseEntry);
    if (insertError) {
      addPendingId("assignments", newReleaseEntry.id);
    } else {
      clearPendingIds("assignments", [newReleaseEntry.id]);
    }
  } else {
    addPendingId("assignments", newReleaseEntry.id);
  }
}

export async function getAvailableDrivers(): Promise<Driver[]> {
  const { getDrivers } = await import("./drivers");
  const { getVehicles } = await import("./vehicles");
  const drivers = await getDrivers();
  const vehicles = await getVehicles();
  const assignedDriverIds = new Set(vehicles.filter((v) => v.active_driver_id).map((v) => v.active_driver_id));
  return drivers.filter((d) => !assignedDriverIds.has(d.id));
}
