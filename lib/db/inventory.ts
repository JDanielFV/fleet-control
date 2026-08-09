import { supabase } from "./index";
import type { VehicleInventory } from "./types";
import { getLocalData, setLocalData } from "./localStorage";
import { genId } from "./utils";
import { getOwnerId } from "./owner";

export async function getVehicleInventory(vehicleId: string): Promise<VehicleInventory | null> {
  const ownerId = getOwnerId();
  if (supabase) {
    let query = supabase.from("vehicle_inventories").select("*").eq("vehicle_id", vehicleId);
    if (ownerId) query = query.eq("owner_id", ownerId);
    const { data, error } = await query.maybeSingle();
    if (!error && data) return data;
  }
  const inventories: VehicleInventory[] = getLocalData("vehicle_inventories", []);
  if (!ownerId) return null;
  return inventories.find((i) => i.vehicle_id === vehicleId && i.owner_id === ownerId) || null;
}

export async function saveVehicleInventory(
  inventory: Omit<VehicleInventory, "id" | "created_at" | "updated_at"> & { id?: string }
): Promise<VehicleInventory> {
  const now = new Date().toISOString();
  const full: VehicleInventory = {
    id: inventory.id || genId(),
    owner_id: getOwnerId() ?? undefined,
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
}
