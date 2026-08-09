import { supabase } from "./index";
import type { Vehicle } from "./types";
import { getLocalData, setLocalData, mergePendingLocal, addPendingId, clearPendingIds } from "./localStorage";
import { seedVehicles } from "./seed";
import { VEHICLE_DATE_KEYS, genId, normalizeEmptyDates } from "./utils";
import { getOwnerId, ownerScoped, ownerEq } from "./owner";

export async function getVehicles(): Promise<Vehicle[]> {
  const ownerId = getOwnerId();
  if (supabase) {
    let query = supabase.from("vehicles").select("*").is("deleted_at", null);
    if (ownerId) query = query.eq("owner_id", ownerId);
    const { data, error } = await query.order("created_at", { ascending: false });
    if (!error) return mergePendingLocal("vehicles", data, seedVehicles, ownerId);
  }
  return ownerScoped(getLocalData("vehicles", seedVehicles)).filter((v) => !v.deleted_at);
}

export async function getArchivedVehicles(): Promise<Vehicle[]> {
  const ownerId = getOwnerId();
  if (supabase) {
    let query = supabase.from("vehicles").select("*").not("deleted_at", "is", null);
    if (ownerId) query = query.eq("owner_id", ownerId);
    const { data, error } = await query.order("deleted_at", { ascending: false });
    if (!error) return data as Vehicle[];
  }
  return ownerScoped(getLocalData("vehicles", seedVehicles)).filter((v) => v.deleted_at);
}

/**
 * Check for duplicate plate / VIN across ALL registered vehicles (global
 * uniqueness: no two users may register the same auto). Returns a friendly
 * message or null when the vehicle can be saved.
 */
function findDuplicateVehicle(fullVehicle: Vehicle): string | null {
  const all = getLocalData<Vehicle>("vehicles", seedVehicles);
  const plate = (fullVehicle.plate_number || "").toLowerCase().trim();
  const vin = (fullVehicle.vin || "").toLowerCase().trim();

  const dup = all.find(
    (v) =>
      v.id !== fullVehicle.id &&
      ((plate && v.plate_number?.toLowerCase().trim() === plate) ||
        (vin && v.vin?.toLowerCase().trim() === vin))
  );
  if (dup) {
    return "Ya existe un auto registrado con esa placa o número de serie (VIN).";
  }
  return null;
}

export async function saveVehicle(
  vehicle: Omit<Vehicle, "id" | "created_at"> & { id?: string; created_at?: string }
): Promise<Vehicle> {
  const fullVehicle: Vehicle = normalizeEmptyDates(
    {
      ...vehicle,
      id: vehicle.id || genId(),
      owner_id: vehicle.owner_id ?? getOwnerId() ?? undefined,
      created_at: vehicle.created_at || new Date().toISOString(),
    },
    VEHICLE_DATE_KEYS
  ) as Vehicle;

  if (supabase) {
    const { data, error } = await supabase.from("vehicles").upsert(fullVehicle).select().single();
    if (!error && data) {
      clearPendingIds("vehicles", [fullVehicle.id]);
      return data;
    }
    if (error) {
      console.error("Supabase saveVehicle error:", error.message, error.details, error.hint);
      if (error.code === "23505") {
        throw new Error("Ya existe un auto registrado con esa placa o número de serie (VIN).");
      }
      throw new Error(error.message);
    }
  }

  const duplicate = findDuplicateVehicle(fullVehicle);
  if (duplicate) throw new Error(duplicate);

  const vehicles = getLocalData("vehicles", seedVehicles);
  const existingIndex = vehicles.findIndex((v) => v.id === fullVehicle.id);
  if (existingIndex >= 0) {
    vehicles[existingIndex] = { ...vehicles[existingIndex], ...fullVehicle };
  } else {
    vehicles.unshift(fullVehicle);
  }
  setLocalData("vehicles", vehicles);
  addPendingId("vehicles", fullVehicle.id);
  return fullVehicle;
}

export async function deleteVehicle(id: string): Promise<boolean> {
  const ownerId = getOwnerId();
  const vehicles = getLocalData("vehicles", seedVehicles);
  const filtered = vehicles.filter((v) => v.id !== id);
  setLocalData("vehicles", filtered);

  if (supabase) {
    const { error } = await ownerEq(supabase.from("vehicles").delete(), ownerId).eq("id", id);
    return !error;
  }
  return true;
}

export async function updateVehicleServiceSchedule(
  id: string,
  nextServiceMileage: number | null,
  _nextMaintenanceDate: string | null
): Promise<void> {
  const patch: Record<string, number | null> = {
    next_service_mileage: nextServiceMileage,
  };

  if (supabase) {
    const { error } = await ownerEq(supabase.from("vehicles").update(patch), getOwnerId()).eq("id", id);
    if (!error) return;
    console.error("Supabase updateVehicleServiceSchedule error:", error.message);
  }

  const vehicles = getLocalData("vehicles", seedVehicles);
  const idx = vehicles.findIndex((v) => v.id === id);
  if (idx >= 0) {
    vehicles[idx] = { ...vehicles[idx], ...patch };
    setLocalData("vehicles", vehicles);
  }
}

export async function getAvailableVehicles(): Promise<Vehicle[]> {
  const vehicles = await getVehicles();
  return vehicles.filter((v) => !v.active_driver_id);
}
