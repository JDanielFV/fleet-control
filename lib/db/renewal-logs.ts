import { getSupabase } from "./index";
import type { RenewalLog } from "./types";
import { getLocalData, setLocalData, mergePendingLocal, addPendingId, clearPendingIds } from "./localStorage";
import { genId } from "./utils";
import { getOwnerId, ownerScoped } from "./owner";
import { getSession } from "@/lib/session";

const EMPTY_SEED: RenewalLog[] = [];

export async function saveRenewalLog(log: Omit<RenewalLog, "id" | "created_at">): Promise<RenewalLog> {
  const fullLog: RenewalLog = {
    id: genId(),
    owner_id: getOwnerId() ?? undefined,
    created_at: new Date().toISOString(),
    ...log,
  };
  const supabase = getSupabase(); if (supabase) {
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
}

export async function getRenewalLogs(vehicleId?: string): Promise<RenewalLog[]> {
  const session = getSession();
  const ownerId = session?.userId;
  const isAdmin = session?.role === "admin";
  const supabase = getSupabase(); if (supabase) {
    let query = supabase.from("renewal_logs").select("*");
    if (ownerId && !isAdmin) query = query.or(`owner_id.eq.${ownerId},owner_id.is.null`);
    if (vehicleId) query = query.eq("vehicle_id", vehicleId);
    const { data, error } = await query.order("created_at", { ascending: false });
    if (!error) return mergePendingLocal("renewal_logs", data, EMPTY_SEED, ownerId);
  }
  const logs = ownerScoped(getLocalData<RenewalLog>("renewal_logs", EMPTY_SEED));
  if (vehicleId) return logs.filter((l) => l.vehicle_id === vehicleId);
  return logs;
}
