import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { getSessionFromRequest } from "./session-server";

/**
 * Server-only helpers for the external admin panel (/admin) and auth routes.
 * Never import this file from client components.
 */

/**
 * Server-only Supabase client with the service-role key (bypasses RLS).
 * Used by auth routes and the admin panel to read/write `users` and
 * `registration_tokens` — tables that RLS closes to the anon key.
 * Returns null when Supabase or the service-role key isn't configured; the
 * API then signals the client to fall back to local (localStorage) ops.
 */
export function getServiceRoleClient(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Create a Supabase client for admin operations. Requires the service-role
 * key (bypasses RLS) — with RLS enabled the anon key can't read `users`,
 * so falling back to it would break the panel.
 */
export function getAdminClient(): SupabaseClient | null {
  return getServiceRoleClient();
}

type GuardResult =
  | { ok: true; supabase: SupabaseClient }
  | { ok: false; reason: "local" | "unauthorized" };

/**
 * Verify the caller is the system administrator, reading the identity from
 * the HttpOnly session cookie (fase 2.1):
 *  1. The session cookie must be valid (signed, not expired).
 *  2. The user must exist and be active.
 *  3. The user must be marked `metadata.is_system_admin` — or, as fallback,
 *     be the oldest registered user (the owner who set everything up).
 * The client can't forge the cookie, so this is real server-side auth.
 */
export async function requireSystemAdminFromRequest(req: NextRequest): Promise<GuardResult> {
  const session = await getSessionFromRequest(req);
  if (!session) return { ok: false, reason: "unauthorized" };
  return requireSystemAdmin(session.userId);
}

/**
 * Verify a given user id is the system administrator (DB check shared by
 * the cookie guard). The id must come from a trusted source (the session
 * cookie) — never from a client-supplied header.
 */
export async function requireSystemAdmin(userId: string | null): Promise<GuardResult> {
  const supabase = getAdminClient();
  if (!supabase) return { ok: false, reason: "local" };
  if (!userId) return { ok: false, reason: "unauthorized" };

  const { data: user } = await supabase
    .from("users")
    .select("id, is_active, metadata, created_at")
    .eq("id", userId)
    .maybeSingle();

  if (!user || !user.is_active) return { ok: false, reason: "unauthorized" };

  if ((user.metadata as Record<string, unknown> | null)?.is_system_admin === true) {
    return { ok: true, supabase };
  }

  // Fallback: the oldest user counts as system admin.
  const { data: oldest } = await supabase
    .from("users")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (oldest && oldest.id === user.id) return { ok: true, supabase };

  return { ok: false, reason: "unauthorized" };
}

/** Tables whose rows belong to a user (have owner_id). */
export const ADMIN_OWNED_TABLES = [
  "drivers",
  "vehicles",
  "assignments",
  "checklists",
  "weekly_rentals",
  "maintenances",
  "renewal_logs",
  "vehicle_inventories",
] as const;

export function isOwnedTable(table: string): table is (typeof ADMIN_OWNED_TABLES)[number] {
  return (ADMIN_OWNED_TABLES as readonly string[]).includes(table);
}
