import { supabase } from "./index";
import type { Driver, Vehicle } from "./types";
import { getLocalData, setLocalData, mergePendingLocal, addPendingId, clearPendingIds } from "./localStorage";
import { seedDrivers } from "./seed";
import { DRIVER_DATE_KEYS, genId, normalizeEmptyDates } from "./utils";
import { getOwnerId, ownerScoped, ownerEq } from "./owner";

export async function getDrivers(): Promise<Driver[]> {
  const ownerId = getOwnerId();
  if (supabase) {
    let query = supabase.from("drivers").select("*").is("deleted_at", null);
    if (ownerId) query = query.eq("owner_id", ownerId);
    const { data, error } = await query.order("created_at", { ascending: false });
    if (!error) return mergePendingLocal("drivers", data, seedDrivers, ownerId);
  }
  return ownerScoped(getLocalData("drivers", seedDrivers)).filter((d) => !d.deleted_at);
}

export async function getArchivedDrivers(): Promise<Driver[]> {
  const ownerId = getOwnerId();
  if (supabase) {
    let query = supabase.from("drivers").select("*").not("deleted_at", "is", null);
    if (ownerId) query = query.eq("owner_id", ownerId);
    const { data, error } = await query.order("deleted_at", { ascending: false });
    if (!error) return data as Driver[];
  }
  return ownerScoped(getLocalData("drivers", seedDrivers)).filter((d) => d.deleted_at);
}

/**
 * Check for duplicate identity fields across ALL registered drivers (global
 * uniqueness: no two users may register the same chofer). Returns a friendly
 * message or null when the driver can be saved.
 */
function findDuplicateDriver(fullDriver: Driver): string | null {
  const all = getLocalData<Driver>("drivers", seedDrivers);
  const curp = (fullDriver.curp || "").toLowerCase().trim();
  const license = (fullDriver.license_number || "").toLowerCase().trim();
  const elector = (fullDriver.ine_elector_key || "").toLowerCase().trim();

  const dup = all.find(
    (d) =>
      d.id !== fullDriver.id &&
      ((curp && d.curp?.toLowerCase().trim() === curp) ||
        (license && d.license_number?.toLowerCase().trim() === license) ||
        (elector && d.ine_elector_key?.toLowerCase().trim() === elector))
  );
  if (dup) {
    return "Ya existe un chofer registrado con ese CURP, número de licencia o clave de elector.";
  }
  return null;
}

export async function saveDriver(
  driver: Omit<Driver, "id" | "created_at"> & { id?: string; created_at?: string }
): Promise<Driver> {
  const fullDriver: Driver = normalizeEmptyDates(
    {
      ...driver,
      id: driver.id || genId(),
      owner_id: driver.owner_id ?? getOwnerId() ?? undefined,
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
      if (error.code === "23505") {
        throw new Error("Ya existe un chofer registrado con ese CURP, número de licencia o clave de elector.");
      }
      throw new Error(error.message);
    }
  }

  const duplicate = findDuplicateDriver(fullDriver);
  if (duplicate) throw new Error(duplicate);

  const drivers = getLocalData("drivers", seedDrivers);
  const existingIndex = drivers.findIndex((d) => d.id === fullDriver.id);
  if (existingIndex >= 0) {
    drivers[existingIndex] = { ...drivers[existingIndex], ...fullDriver };
  } else {
    drivers.unshift(fullDriver);
  }
  setLocalData("drivers", drivers);
  addPendingId("drivers", fullDriver.id);
  return fullDriver;
}

export async function deleteDriver(id: string): Promise<boolean> {
  const ownerId = getOwnerId();

  // 1. Clear active_driver_id on any of the owner's vehicles assigned to this driver
  const { getLocalData: gLD, setLocalData: sLD } = await import("./localStorage");
  const { seedVehicles } = await import("./seed");
  const vehicles = gLD("vehicles", seedVehicles);
  let updatedAny = false;
  vehicles.forEach((v: Vehicle) => {
    if (v.active_driver_id === id && (ownerId ? v.owner_id === ownerId : true)) {
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

  // 3. Update Supabase if active (owner-scoped)
  if (supabase) {
    if (updatedAny) {
      await ownerEq(supabase.from("vehicles").update({ active_driver_id: null }).eq("active_driver_id", id), ownerId);
    }
    const { error } = await ownerEq(supabase.from("drivers").update({ deleted_at: now }), ownerId).eq("id", id);
    return !error;
  }
  return true;
}
