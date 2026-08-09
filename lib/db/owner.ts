import { getOwnerId } from "@/lib/auth";

export { getOwnerId };

/**
 * Filter an in-memory (localStorage) list to the current user's records.
 * Returns [] when no session, so data is never visible to anonymous reads.
 */
export function ownerScoped<T extends { owner_id?: string | null }>(all: T[]): T[] {
  const ownerId = getOwnerId();
  if (!ownerId) return [];
  return all.filter((item) => item.owner_id === ownerId);
}

/**
 * Append an `owner_id` equality filter to a Supabase query when the user is
 * logged in. Keeps writes (deletes/updates by id) owner-scoped as well, so a
 * user can't mutate another user's rows through the open-RLS client.
 */
export function ownerEq<T extends { eq: (column: string, value: unknown) => T }>(
  query: T,
  ownerId: string | null
): T {
  if (!ownerId) return query;
  return query.eq("owner_id", ownerId);
}
