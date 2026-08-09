import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only helpers for the external admin panel (/admin).
 * Never import this file from client components.
 */

/**
 * Create a Supabase client for admin operations. Prefers the service-role
 * key (bypasses RLS); falls back to the anon key, which is sufficient while
 * RLS stays open (demo mode). Returns null when Supabase isn't configured —
 * the API then signals the client to fall back to local (localStorage) ops.
 */
export function getAdminClient(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

type GuardResult =
  | { ok: true; supabase: SupabaseClient }
  | { ok: false; reason: "local" | "unauthorized" };

/**
 * Verify the caller (identified by the `x-admin-user-id` header, i.e. the
 * logged-in session) is the system administrator:
 *  1. The user must exist and be active.
 *  2. The user must be marked `metadata.is_system_admin` — or, as fallback,
 *     be the oldest registered user (the owner who set everything up).
 * The header can be forged, but the check is done server-side against the
 * real users table, so forging doesn't grant access.
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
