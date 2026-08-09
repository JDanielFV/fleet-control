import { supabase } from "./index";
import type { Maintenance } from "./types";
import { getLocalData, setLocalData, mergePendingLocal, addPendingId, clearPendingIds } from "./localStorage";
import { seedMaintenances } from "./seed";
import { genId } from "./utils";
import { getOwnerId, ownerScoped } from "./owner";

export async function getMaintenances(): Promise<Maintenance[]> {
  const ownerId = getOwnerId();
  if (supabase) {
    let query = supabase.from("maintenances").select("*");
    if (ownerId) query = query.eq("owner_id", ownerId);
    const { data, error } = await query.order("created_at", { ascending: false });
    if (!error) return mergePendingLocal("maintenances", data, seedMaintenances, ownerId);
  }
  return ownerScoped(getLocalData<Maintenance>("maintenances", seedMaintenances));
}

export async function saveMaintenance(maintenance: Omit<Maintenance, "id" | "created_at">): Promise<Maintenance> {
  const fullMaint: Maintenance = {
    id: genId(),
    owner_id: getOwnerId() ?? undefined,
    created_at: new Date().toISOString(),
    ...maintenance,
  };

  // Auto-update the vehicle's next_service_mileage (owner-scoped read)
  const { getChecklists } = await import("./checklists");
  const checklists = await getChecklists();
  const vChecklists = checklists.filter((c) => c.vehicle_id === maintenance.vehicle_id);
  if (vChecklists.length > 0) {
    const sorted = [...vChecklists].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const latestMileage = sorted[0].mileage;
    const newServiceMileage = latestMileage + 10000;
    const { updateVehicleServiceSchedule } = await import("./vehicles");
    await updateVehicleServiceSchedule(maintenance.vehicle_id, newServiceMileage, maintenance.next_maintenance_date);
  } else {
    const { updateVehicleServiceSchedule } = await import("./vehicles");
    await updateVehicleServiceSchedule(maintenance.vehicle_id, null, maintenance.next_maintenance_date);
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
}
