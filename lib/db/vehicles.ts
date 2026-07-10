import { supabase } from "./index";
import type { Vehicle } from "./types";
import { getLocalData, setLocalData, mergePendingLocal, addPendingId, clearPendingIds } from "./localStorage";
import { seedVehicles } from "./seed";
import { VEHICLE_DATE_KEYS, genId, normalizeEmptyDates } from "./utils";

export async function getVehicles(): Promise<Vehicle[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from("vehicles")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (!error) return mergePendingLocal("vehicles", data, seedVehicles);
  }
  return getLocalData("vehicles", seedVehicles).filter((v) => !v.deleted_at);
}

export async function getArchivedVehicles(): Promise<Vehicle[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from("vehicles")
      .select("*")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });
    if (!error) return data as Vehicle[];
  }
  return getLocalData("vehicles", seedVehicles).filter((v) => v.deleted_at);
}

export async function saveVehicle(
  vehicle: Omit<Vehicle, "id" | "created_at"> & { id?: string; created_at?: string }
): Promise<Vehicle> {
  const fullVehicle: Vehicle = normalizeEmptyDates(
    {
      ...vehicle,
      id: vehicle.id || genId(),
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
}

export async function deleteVehicle(id: string): Promise<boolean> {
  const vehicles = getLocalData("vehicles", seedVehicles);
  const filtered = vehicles.filter((v) => v.id !== id);
  setLocalData("vehicles", filtered);

  if (supabase) {
    const { error } = await supabase.from("vehicles").delete().eq("id", id);
    return !error;
  }
  return true;
}

export async function updateVehicleServiceSchedule(
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
}

export async function getAvailableVehicles(): Promise<Vehicle[]> {
  const vehicles = await getVehicles();
  return vehicles.filter((v) => !v.active_driver_id);
}
