import {
  seedDrivers,
  seedVehicles,
  seedAssignments,
  seedChecklists,
  seedWeeklyRentals,
  seedMaintenances,
} from "./seed";

// Helper to initialize local storage
export function getLocalData<T>(key: string, seed: T[]): T[] {
  if (typeof window === "undefined") return seed;
  const stored = localStorage.getItem(`fleet_${key}`);
  if (!stored) {
    localStorage.setItem(`fleet_${key}`, JSON.stringify(seed));
    return seed;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    localStorage.setItem(`fleet_${key}`, JSON.stringify(seed));
    return seed;
  }

  // Schema reset: detect old `weekly_rentals` shape (had `accumulated_debt`
  // and no `is_prorated`). The new model derives total debt on the fly and
  // marks the first partial week as prorated. Per the user's request, we
  // discard old rentals rather than try to migrate them.
  if (key === "weekly_rentals" && Array.isArray(parsed) && parsed.length > 0) {
    const first = parsed[0] as Record<string, unknown>;
    if ("accumulated_debt" in first || !("is_prorated" in first)) {
      localStorage.setItem(`fleet_${key}`, JSON.stringify(seed));
      return seed;
    }

    // Deduplicate: if multiple rentals exist for the same driver + week,
    // keep the one with the highest paid_amount (most recent data) and
    // merge their payments_log. This fixes the duplicate-rental bug that
    // existed before the createWeeklyRental guard was added.
    const seen = new Map<string, number>();
    const deduped: Record<string, unknown>[] = [];
    for (const item of parsed as Record<string, unknown>[]) {
      const driverId = String(item.driver_id ?? "");
      const weekStart = String(item.week_start ?? "");
      const key_ = `${driverId}::${weekStart}`;
      const existingIdx = seen.get(key_);
      if (existingIdx !== undefined) {
        const existing = deduped[existingIdx];
        // Merge payments_log arrays.
        const existingLog = (existing.payments_log as unknown[]) ?? [];
        const itemLog = (item.payments_log as unknown[]) ?? [];
        existing.payments_log = [...existingLog, ...itemLog];
        // Keep the higher paid_amount.
        const existingPaid = Number(existing.paid_amount ?? 0);
        const itemPaid = Number(item.paid_amount ?? 0);
        if (itemPaid > existingPaid) {
          existing.paid_amount = itemPaid;
          existing.status = item.status;
        }
        console.warn(
          `[fleet] Merged duplicate weekly rental: driver=${driverId} week=${weekStart}`
        );
      } else {
        seen.set(key_, deduped.length);
        deduped.push(item);
      }
    }
    if (deduped.length !== (parsed as unknown[]).length) {
      localStorage.setItem(`fleet_${key}`, JSON.stringify(deduped));
    }
    return deduped as T[];
  }

  return parsed as T[];
}

export function setLocalData<T>(key: string, data: T[]): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(`fleet_${key}`, JSON.stringify(data));
  }
}

// --- Pending-sync tracking ---
// When Supabase is configured but a write fails, the record is stored in
// localStorage as a fallback. Without tracking, subsequent reads (which prefer
// Supabase) would mask that fallback record. We track the ids of records that
// only exist in localStorage so reads can merge them back in. Once a record
// reappears in Supabase, its pending id is cleared.
export function getPendingIds(table: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(`fleet_pending_${table}`) || "[]") as string[];
  } catch {
    return [];
  }
}

export function setPendingIds(table: string, ids: string[]): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(`fleet_pending_${table}`, JSON.stringify(ids));
  }
}

export function addPendingId(table: string, id: string): void {
  const ids = getPendingIds(table);
  if (!ids.includes(id)) {
    ids.push(id);
    setPendingIds(table, ids);
  }
}

export function clearPendingIds(table: string, idsToRemove: string[]): void {
  if (!idsToRemove.length) return;
  setPendingIds(table, getPendingIds(table).filter((id) => !idsToRemove.includes(id)));
}

// Merge any pending (fallback-only) localStorage records into the Supabase
// result. `remote` is the Supabase list (possibly empty); if null, Supabase
// failed entirely and we fall back to plain localStorage. Only records whose
// ids are marked pending AND absent from remote are prepended, so seed data is
// never injected into a live Supabase list.
//
// `ownerId` is REQUIRED for isolation: localStorage is shared per-device, so
// without filtering by owner a pending (offline) record of user A would leak
// into user B's reads. When no owner is provided we return an empty merge
// instead of unfiltered local data.
export function mergePendingLocal<T extends { id: string }>(
  table: string,
  remote: T[] | null,
  seed: T[],
  ownerId?: string | null
): T[] {
  const localAll = getLocalData(table, seed);
  const local = !ownerId
    ? localAll
    : localAll.filter((l) => !(l as { owner_id?: string | null }).owner_id || (l as { owner_id?: string | null }).owner_id === ownerId);
  if (!remote) return local;
  const pending = getPendingIds(table);
  if (!pending.length) return remote;
  const remoteIds = new Set(remote.map((r) => r.id));
  // Clear pending ids that have now appeared in Supabase (synced).
  const synced = pending.filter((id) => remoteIds.has(id));
  if (synced.length) clearPendingIds(table, synced);
  const orphans = local.filter((l) => getPendingIds(table).includes(l.id) && !remoteIds.has(l.id));
  return orphans.length ? [...orphans, ...remote] : remote;
}

// Seed map used by mergePendingLocal and legacy localStorage reads.
export const seedMap: Record<
  string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any[]
> = {
  drivers: seedDrivers,
  vehicles: seedVehicles,
  assignments: seedAssignments,
  checklists: seedChecklists,
  weekly_rentals: seedWeeklyRentals,
  maintenances: seedMaintenances,
};
