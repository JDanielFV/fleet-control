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
export function mergePendingLocal<T extends { id: string }>(table: string, remote: T[] | null, seed: T[]): T[] {
  if (!remote) return getLocalData(table, seed);
  const pending = getPendingIds(table);
  if (!pending.length) return remote;
  const remoteIds = new Set(remote.map((r) => r.id));
  // Clear pending ids that have now appeared in Supabase (synced).
  const synced = pending.filter((id) => remoteIds.has(id));
  if (synced.length) clearPendingIds(table, synced);
  const local = getLocalData(table, seed);
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
