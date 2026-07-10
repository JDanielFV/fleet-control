import { supabase } from "./index";
import type { Driver } from "./types";
import { getLocalData, setLocalData, mergePendingLocal, addPendingId, clearPendingIds } from "./localStorage";
import { seedDrivers } from "./seed";
import { DRIVER_DATE_KEYS, genId, normalizeEmptyDates } from "./utils";

export async function getDrivers(): Promise<Driver[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from("drivers")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (!error) return mergePendingLocal("drivers", data, seedDrivers);
  }
  return getLocalData("drivers", seedDrivers).filter((d) => !d.deleted_at);
}

export async function getArchivedDrivers(): Promise<Driver[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from("drivers")
      .select("*")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });
    if (!error) return data as Driver[];
  }
  return getLocalData("drivers", seedDrivers).filter((d) => d.deleted_at);
}

export async function saveDriver(
  driver: Omit<Driver, "id" | "created_at"> & { id?: string; created_at?: string }
): Promise<Driver> {
  const fullDriver: Driver = normalizeEmptyDates(
    {
      ...driver,
      id: driver.id || genId(),
      created_at: driver.created_at || new Date().toISOString(),
    },
    DRIVER_DATE_KEYS
  ) as Driver;
  if (supabase) {
    const { data, error } = await supabase.from("drivers").upsert(fullDriver).select().single();
    if (!error && data) {
      clearPendingIds("drivers", [fullDriver.id]);
      return data;
    }
    if (error) {
      console.error("Supabase saveDriver error:", error.message, error.details, error.hint);
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
}

export async function deleteDriver(id: string): Promise<boolean> {
  // 1. Clear active_driver_id on any vehicles that are assigned to this driver
  const { getLocalData: gLD, setLocalData: sLD } = await import("./localStorage");
  const { seedVehicles } = await import("./seed");
  const vehicles = gLD("vehicles", seedVehicles);
  let updatedAny = false;
  vehicles.forEach((v: any) => {
    if (v.active_driver_id === id) {
      v.active_driver_id = null;
      updatedAny = true;
    }
  });
  if (updatedAny) {
    sLD("vehicles", vehicles);
  }

  // 2. Soft delete: set deleted_at instead of removing
  const now = new Date().toISOString();
  const drivers = gLD("drivers", seedDrivers);
  const driver = drivers.find((d: Driver) => d.id === id);
  if (driver) {
    driver.deleted_at = now;
    sLD("drivers", drivers);
  }

  // 3. Update Supabase if active
  if (supabase) {
    if (updatedAny) {
      await supabase.from("vehicles").update({ active_driver_id: null }).eq("active_driver_id", id);
    }
    const { error } = await supabase.from("drivers").update({ deleted_at: now }).eq("id", id);
    return !error;
  }
  return true;
}
