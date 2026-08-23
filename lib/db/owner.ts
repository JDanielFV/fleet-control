import { getOwnerId, getSession } from "@/lib/auth";

export { getOwnerId };

/**
 * Legacy-visibility flag. Before the owner_id backfill migration
 * (20260822000000), rows created before multi-tenant had owner_id NULL and
 * every user could see them. The migration reassigns those rows to the
 * oldest admin, so the window is now closed — flip this to false only if
 * you need a one-release grace period on a fresh deployment.
 */
const ALLOW_LEGACY_NULL_OWNER = false;

/**
 * Filter an in-memory (localStorage) list to the current user's records.
 * - If admin or no active session restriction, returns all records.
 * - If regular owner, returns only records owned by the user.
 */
export function ownerScoped<T extends { owner_id?: string | null }>(all: T[]): T[] {
  const session = getSession();
  if (!session || session.role === "admin") return all;
  const ownerId = session.userId;
  if (!ownerId) return all;
  return all.filter((item) => item.owner_id === ownerId || (ALLOW_LEGACY_NULL_OWNER && !item.owner_id));
}

/**
 * Append an `owner_id` filter to a Supabase query when the user is logged in.
 * Non-admin users only ever match their own rows.
 */
export function ownerEq<T extends { eq: (column: string, value: unknown) => T; or?: (filter: string) => T }>(
  query: T,
  ownerId: string | null
): T {
  const session = getSession();
  if (!ownerId || session?.role === "admin") return query;
  if (ALLOW_LEGACY_NULL_OWNER && typeof query.or === "function") {
    return query.or(`owner_id.eq.${ownerId},owner_id.is.null`);
  }
  return query.eq("owner_id", ownerId);
}
