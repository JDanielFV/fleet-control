import { supabase } from "./index";
import type { RenewalLog } from "./types";
import { getLocalData, setLocalData, mergePendingLocal, addPendingId, clearPendingIds } from "./localStorage";
import { genId } from "./utils";

export async function saveRenewalLog(log: Omit<RenewalLog, "id" | "created_at">): Promise<RenewalLog> {
  const fullLog: RenewalLog = {
    id: genId(),
    created_at: new Date().toISOString(),
    ...log,
  };
  if (supabase) {
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
  if (supabase) {
    let query = supabase.from("renewal_logs").select("*").order("created_at", { ascending: false });
    if (vehicleId) query = query.eq("vehicle_id", vehicleId);
    const { data, error } = await query;
    if (!error) return mergePendingLocal("renewal_logs", data, []);
  }
  const logs = getLocalData("renewal_logs", [] as RenewalLog[]);
  if (vehicleId) return logs.filter((l) => l.vehicle_id === vehicleId);
  return logs;
}
