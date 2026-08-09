import { supabase } from "./index";
import type { Checklist } from "./types";
import { getLocalData, setLocalData, mergePendingLocal, addPendingId, clearPendingIds } from "./localStorage";
import { seedChecklists } from "./seed";
import { genId } from "./utils";
import { getOwnerId, ownerScoped } from "./owner";

export async function getChecklists(): Promise<Checklist[]> {
  const ownerId = getOwnerId();
  if (supabase) {
    let query = supabase.from("checklists").select("*");
    if (ownerId) query = query.eq("owner_id", ownerId);
    const { data, error } = await query.order("created_at", { ascending: false });
    if (!error) return mergePendingLocal("checklists", data, seedChecklists, ownerId);
  }
  return ownerScoped(getLocalData<Checklist>("checklists", seedChecklists));
}

export async function saveChecklist(checklist: Omit<Checklist, "id" | "created_at">): Promise<Checklist> {
  const fullChecklist: Checklist = {
    id: genId(),
    owner_id: getOwnerId() ?? undefined,
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
}

export async function autoGenerateMondayChecklists(): Promise<number> {
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

  const { getVehicles } = await import("./vehicles");
  const vehicles = await getVehicles();
  const checklists = await getChecklists();
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

        await saveChecklist({
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
}
