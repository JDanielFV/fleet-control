import { getOwnerId, getSession } from "@/lib/auth";

export { getOwnerId };

/**
 * Filter an in-memory (localStorage) list to the current user's records.
 * - If admin or no active session restriction, returns all records.
 * - If regular owner, returns records owned by the user + legacy records where owner_id is null.
 */
export function ownerScoped<T extends { owner_id?: string | null }>(all: T[]): T[] {
  const session = getSession();
  if (!session || session.role === "admin") return all;
  const ownerId = session.userId;
  if (!ownerId) return all;
  return all.filter((item) => !item.owner_id || item.owner_id === ownerId);
}

/**
 * Append an `owner_id` filter to a Supabase query when the user is logged in.
 * Allows matching user's own records as well as legacy records where owner_id is null.
 */
export function ownerEq<T extends { eq: (column: string, value: unknown) => T; or?: (filter: string) => T }>(
  query: T,
  ownerId: string | null
): T {
  const session = getSession();
  if (!ownerId || session?.role === "admin") return query;
  if (typeof query.or === "function") {
    return query.or(`owner_id.eq.${ownerId},owner_id.is.null`);
  }
  return query.eq("owner_id", ownerId);
}
