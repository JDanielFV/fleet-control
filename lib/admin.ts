/**
 * Client-side data layer for the external admin panel (/admin).
 *
 * Talks to /api/admin/* (server-side, guarded by the system-admin check).
 * When Supabase isn't configured the API answers `{ localFallback: true }`
 * and we operate directly on localStorage (single-device demo mode).
 */

import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { getSession } from "@/lib/auth";
import { getLocalData, setLocalData } from "@/lib/db/localStorage";

// Owned tables (mirror of lib/admin-server.ts — do not import that file here,
// it's server-only). Order matters for display.
export const ADMIN_TABLES = [
  "drivers",
  "vehicles",
  "assignments",
  "checklists",
  "weekly_rentals",
  "maintenances",
  "renewal_logs",
  "vehicle_inventories",
] as const;

export type AdminTableName = (typeof ADMIN_TABLES)[number];

export interface AdminUser {
  id: string;
  display_name: string;
  email: string | null;
  role: string;
  metadata: Record<string, unknown>;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  webauthn_credentials: { id?: string }[]; // full credential list (admin-only view)
}

export interface AuditRow {
  id: string;
  owner_id: string | null;
  label: string;
}

export interface AuditTable {
  table: AdminTableName;
  rows: AuditRow[];
}

export interface AuditData {
  users: { id: string; display_name: string; email: string | null; is_active: boolean; created_at: string }[];
  tables: AuditTable[];
}

export interface UsersPayload {
  users: AdminUser[];
  counts: Record<string, Record<string, number>>;
}

// --- Labels -----------------------------------------------------------------

function describeRow(table: string, r: Record<string, unknown>): string {
  switch (table) {
    case "drivers":
      return [r.first_name, r.paternal_last_name].filter(Boolean).join(" ") || String(r.id ?? "");
    case "vehicles":
      return [r.brand, r.vehicle_name, r.plate_number ? `(${r.plate_number})` : ""].filter(Boolean).join(" ") || String(r.id ?? "");
    case "assignments":
      return `Asignación · auto ${r.vehicle_id ?? "?"} → chofer ${r.driver_id ?? "?"}`;
    case "checklists":
      return `Checklist ${r.type ?? ""} · ${r.created_at ?? ""}`.trim();
    case "weekly_rentals":
      return `Renta · chofer ${r.driver_id ?? "?"} · ${r.week_start ?? ""}`;
    case "maintenances":
      return String(r.description ?? "") || `Mantenimiento · ${r.maintenance_date ?? ""}`;
    case "renewal_logs":
      return `Renovación ${r.type ?? ""} · auto ${r.vehicle_id ?? "?"}`;
    case "vehicle_inventories":
      return `Inventario · auto ${r.vehicle_id ?? "?"}`;
    default:
      return String(r.id ?? "");
  }
}

// --- Low-level fetch --------------------------------------------------------

type AdminFetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; unauthorized?: boolean };

async function adminFetch<T>(path: string, init?: RequestInit): Promise<AdminFetchResult<T>> {
  try {
    const session = getSession();
    const res = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "x-admin-user-id": session?.userId ?? "",
        ...(init?.headers ?? {}),
      },
    });
    const json = (await res.json().catch(() => ({}))) as T;
    if (res.status === 401) return { ok: false, unauthorized: true };
    return { ok: true, data: json };
  } catch {
    return { ok: false };
  }
}

function hasLocalFallback(data: { localFallback?: boolean } | undefined): boolean {
  return data?.localFallback === true;
}

// --- System admin -----------------------------------------------------------

/** Id of the system admin: the user marked in metadata, else the oldest one. */
export function systemAdminId(users: { id: string; created_at?: string; metadata?: Record<string, unknown> }[]): string | null {
  const marked = users.find((u) => u.metadata?.is_system_admin === true);
  if (marked) return marked.id;
  if (users.length === 0) return null;
  return [...users].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))[0].id;
}

// --- Users CRUD -------------------------------------------------------------

export async function adminGetUsers(): Promise<UsersPayload | "unauthorized" | null> {
  const res = await adminFetch<UsersPayload & { localFallback?: boolean }>("/api/admin/users");
  if (!res.ok) return res.unauthorized ? "unauthorized" : null;
  if (hasLocalFallback(res.data)) return adminGetUsersLocal();
  return { users: res.data.users ?? [], counts: res.data.counts ?? {} };
}

async function adminGetUsersLocal(): Promise<UsersPayload> {
  const users = (await db.getUsers()) as unknown as AdminUser[];
  const counts: Record<string, Record<string, number>> = {};
  for (const table of ADMIN_TABLES) {
    const rows = getLocalData<Record<string, unknown>>(table, []);
    counts[table] = {};
    for (const r of rows) {
      const key = String(r.owner_id ?? "sin_dueño");
      counts[table][key] = (counts[table][key] ?? 0) + 1;
    }
  }
  return { users, counts };
}

export async function adminCreateUser(p: { display_name: string; email: string; password: string }): Promise<AdminUser | string> {
  const res = await adminFetch<{ localFallback?: boolean; user?: AdminUser; error?: string }>("/api/admin/users", {
    method: "POST",
    body: JSON.stringify(p),
  });
  if (!res.ok) return "No se pudo conectar con el servidor.";
  if (!hasLocalFallback(res.data)) {
    return res.data.user ?? res.data.error ?? "Error al crear el usuario.";
  }
  // Local mode
  const password_hash = await hashPassword(p.password);
  try {
    const saved = await db.saveUser({
      display_name: p.display_name,
      email: p.email.trim().toLowerCase(),
      password_hash,
      role: "owner", // El panel crea dueños; solo el admin del sistema es 'admin'
      webauthn_credentials: [],
      metadata: {},
      is_active: true,
      last_login_at: null,
    });
    return saved as unknown as AdminUser;
  } catch (err) {
    return err instanceof Error ? err.message : "Error al crear el usuario.";
  }
}

export async function adminUpdateUser(
  id: string,
  patch: { display_name?: string; email?: string; is_active?: boolean; password?: string; remove_credential_id?: string }
): Promise<AdminUser | string> {
  const res = await adminFetch<{ localFallback?: boolean; user?: AdminUser; error?: string }>("/api/admin/users", {
    method: "PATCH",
    body: JSON.stringify({ id, ...patch }),
  });
  if (!res.ok) return "No se pudo conectar con el servidor.";
  if (!hasLocalFallback(res.data)) {
    return res.data.user ?? res.data.error ?? "Error al actualizar el usuario.";
  }
  // Local mode
  try {
    const users = await db.getUsers();
    const user = users.find((u) => u.id === id);
    if (!user) return "Usuario no encontrado.";
    const next: Record<string, unknown> = { ...user };
    if (patch.display_name) next.display_name = patch.display_name;
    if (patch.email !== undefined) next.email = patch.email || null;
    if (patch.is_active !== undefined) next.is_active = patch.is_active;
    if (patch.password) next.password_hash = await hashPassword(patch.password);
    if (patch.remove_credential_id) {
      next.webauthn_credentials = ((user.webauthn_credentials as { id?: string }[]) ?? []).filter(
        (c) => c.id !== patch.remove_credential_id
      );
    }
    const saved = await db.saveUser(next as Parameters<typeof db.saveUser>[0]);
    return saved as unknown as AdminUser;
  } catch (err) {
    return err instanceof Error ? err.message : "Error al actualizar el usuario.";
  }
}

export async function adminDeleteUser(id: string, deleteData: boolean): Promise<true | string> {
  const res = await adminFetch<{ localFallback?: boolean; error?: string }>("/api/admin/users", {
    method: "DELETE",
    body: JSON.stringify({ id, delete_data: deleteData }),
  });
  if (!res.ok) return "No se pudo conectar con el servidor.";

  // driver_credits live in localStorage even in Supabase mode — clean them locally.
  if (deleteData) {
    const credits = getLocalData<{ owner_id?: string | null }>("driver_credits", []);
    const filteredCredits = credits.filter((c) => c.owner_id !== id);
    if (filteredCredits.length !== credits.length) setLocalData("driver_credits", filteredCredits);
  }

  if (!hasLocalFallback(res.data)) {
    return res.data.error ?? true;
  }
  // Local mode
  try {
    if (deleteData) {
      for (const table of ADMIN_TABLES) {
        const rows = getLocalData<Record<string, unknown>>(table, []);
        const filtered = rows.filter((r) => r.owner_id !== id);
        if (filtered.length !== rows.length) setLocalData(table, filtered);
      }
    }
    await db.deleteUser(id);
    return true;
  } catch (err) {
    return err instanceof Error ? err.message : "Error al eliminar el usuario.";
  }
}

export async function adminCreateRegistrationToken(): Promise<string | null> {
  const res = await adminFetch<{ localFallback?: boolean; token?: string; error?: string }>("/api/admin/tokens", {
    method: "POST",
  });
  if (!res.ok) return null;
  if (hasLocalFallback(res.data)) {
    const session = getSession();
    const t = await db.createRegistrationToken(session?.userId ?? null);
    return t.token;
  }
  return res.data.token ?? null;
}

// --- Audit & data correction ------------------------------------------------

interface AuditRaw {
  users: { id: string; display_name: string; email: string | null; is_active: boolean; created_at: string }[];
  tables: { table: string; rows: Record<string, unknown>[] }[];
}

export async function adminAudit(): Promise<AuditData | "unauthorized" | null> {
  const res = await adminFetch<AuditRaw & { localFallback?: boolean }>("/api/admin/data");
  if (!res.ok) return res.unauthorized ? "unauthorized" : null;
  if (hasLocalFallback(res.data)) return adminAuditLocal();
  return {
    users: res.data.users ?? [],
    tables: (res.data.tables ?? []).map((t) => ({
      table: t.table as AdminTableName,
      rows: t.rows.map((r) => ({
        id: String(r.id),
        owner_id: (r.owner_id as string | null) ?? null,
        label: describeRow(t.table, r),
      })),
    })),
  };
}

async function adminAuditLocal(): Promise<AuditData> {
  const users = (await db.getUsers()).map((u) => ({
    id: u.id,
    display_name: u.display_name,
    email: u.email,
    is_active: u.is_active,
    created_at: u.created_at,
  }));
  const tables: AuditTable[] = ADMIN_TABLES.map((table) => {
    const rows = getLocalData<Record<string, unknown>>(table, []);
    return {
      table,
      rows: rows.map((r) => ({
        id: String(r.id),
        owner_id: (r.owner_id as string | null) ?? null,
        label: describeRow(table, r),
      })),
    };
  });
  return { users, tables };
}

export async function adminReassign(table: AdminTableName, ids: string[], toOwnerId: string): Promise<true | string> {
  const res = await adminFetch<{ localFallback?: boolean; error?: string }>("/api/admin/data", {
    method: "POST",
    body: JSON.stringify({ action: "reassign", table, ids, to_owner_id: toOwnerId }),
  });
  if (!res.ok) return "No se pudo conectar con el servidor.";
  if (!hasLocalFallback(res.data)) return res.data.error ?? true;
  try {
    const rows = getLocalData<Record<string, unknown>>(table, []);
    for (const r of rows) if (ids.includes(String(r.id))) r.owner_id = toOwnerId;
    setLocalData(table, rows);
    return true;
  } catch (err) {
    return err instanceof Error ? err.message : "Error al reasignar.";
  }
}

export async function adminDeleteRecords(table: AdminTableName, ids: string[]): Promise<true | string> {
  const res = await adminFetch<{ localFallback?: boolean; error?: string }>("/api/admin/data", {
    method: "POST",
    body: JSON.stringify({ action: "delete", table, ids }),
  });
  if (!res.ok) return "No se pudo conectar con el servidor.";
  if (!hasLocalFallback(res.data)) return res.data.error ?? true;
  try {
    const rows = getLocalData<Record<string, unknown>>(table, []);
    setLocalData(
      table,
      rows.filter((r) => !ids.includes(String(r.id)))
    );
    return true;
  } catch (err) {
    return err instanceof Error ? err.message : "Error al eliminar registros.";
  }
}

export async function adminTransferAll(fromOwnerId: string, toOwnerId: string): Promise<true | string> {
  const res = await adminFetch<{ localFallback?: boolean; error?: string }>("/api/admin/data", {
    method: "POST",
    body: JSON.stringify({ action: "transfer_all", from_owner_id: fromOwnerId, to_owner_id: toOwnerId }),
  });
  if (!res.ok) return "No se pudo conectar con el servidor.";

  // driver_credits live in localStorage even in Supabase mode — remap them locally.
  try {
    const credits = getLocalData<{ owner_id?: string | null }>("driver_credits", []);
    let creditsChanged = false;
    for (const c of credits) {
      if (c.owner_id === fromOwnerId) {
        c.owner_id = toOwnerId;
        creditsChanged = true;
      }
    }
    if (creditsChanged) setLocalData("driver_credits", credits);
  } catch {
    // best effort — credits are a minor feature
  }

  if (!hasLocalFallback(res.data)) return res.data.error ?? true;
  try {
    for (const table of ADMIN_TABLES) {
      const rows = getLocalData<Record<string, unknown>>(table, []);
      let changed = false;
      for (const r of rows) {
        if (r.owner_id === fromOwnerId) {
          r.owner_id = toOwnerId;
          changed = true;
        }
      }
      if (changed) setLocalData(table, rows);
    }
    return true;
  } catch (err) {
    return err instanceof Error ? err.message : "Error al transferir datos.";
  }
}
