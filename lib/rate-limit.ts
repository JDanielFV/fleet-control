/**
 * Login rate limiter (per email + IP) with temporary lockout.
 *
 * Policy: max 5 failed attempts per email+IP in a 15-minute sliding window;
 * after the 5th failure the key is locked for 15 minutes. Locked keys answer
 * a generic 429 — never reveal whether the email exists, how many attempts
 * remain, or how long the lock lasts.
 *
 * Two stores:
 *  - In-memory (`checkLoginRateLimit` etc.): per process. Used as a fallback
 *    and in tests. On serverless deploys each warm instance keeps its own
 *    counters, so it throttles per instance rather than globally.
 *  - Shared (`checkLoginRateLimitGlobal` etc.): backed by the `rate_limits`
 *    Supabase table via the service-role client, so counters are global
 *    across instances. Falls back to the in-memory store when Supabase is
 *    not configured or the table is missing.
 *
 * Server-only module. Never import from client code.
 */

import { getServiceRoleClient } from "@/lib/admin-server";

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 min
const LOCK_MS = 15 * 60 * 1000; // 15 min lockout

interface AttemptRecord {
  /** Timestamps (ms) of failures still inside the current window. */
  failures: number[];
  /** Lock expiry timestamp (ms); 0 = not locked. */
  lockedUntil: number;
}

const store = new Map<string, AttemptRecord>();

export interface RateLimitState {
  allowed: boolean;
  /** Seconds until the lock lifts (0 when allowed). */
  retryAfterSeconds: number;
  /** Attempts left before locking (informational; not exposed to clients). */
  remaining: number;
}

/** Generic lockout message: no email, no attempt count, no lock duration. */
export const LOGIN_LOCKED_MESSAGE =
  "Demasiados intentos de inicio de sesión. Inténtalo de nuevo más tarde.";

/**
 * Best-effort client IP from the request headers.
 *
 * Prefers `x-real-ip` (set by Vercel to the real client IP). For
 * `x-forwarded-for`, the LAST entry is the one appended by the edge proxy
 * closest to the client — the FIRST entry can be client-supplied and is
 * trivially spoofed, which would let an attacker reset the rate counter by
 * rotating it.
 */
export function getClientIp(req: Request): string {
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const last = fwd.split(",").at(-1)?.trim();
    if (last) return last;
  }
  return "unknown";
}

/** Composite key: normalized email + IP (per the lockout policy). */
export function loginRateLimitKey(email: string, ip: string): string {
  return `${email.trim().toLowerCase()}|${ip}`;
}

/** Drop failures outside the window and forget idle records. */
function prune(key: string, now: number): void {
  const rec = store.get(key);
  if (!rec) return;
  rec.failures = rec.failures.filter((t) => now - t < WINDOW_MS);
  if (rec.failures.length === 0 && rec.lockedUntil < now) {
    store.delete(key);
  }
}

function stateFromRecord(rec: AttemptRecord | undefined, now: number): RateLimitState {
  if (!rec) return { allowed: true, retryAfterSeconds: 0, remaining: MAX_FAILURES };
  if (rec.lockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((rec.lockedUntil - now) / 1000),
      remaining: 0,
    };
  }
  return {
    allowed: true,
    retryAfterSeconds: 0,
    remaining: Math.max(0, MAX_FAILURES - rec.failures.length),
  };
}

/** Check whether a login attempt is currently allowed for the key. */
export function checkLoginRateLimit(key: string): RateLimitState {
  const now = Date.now();
  prune(key, now);
  return stateFromRecord(store.get(key), now);
}

/** Record a failed attempt; locks the key when the window reaches the max. */
export function recordLoginFailure(key: string): void {
  const now = Date.now();
  prune(key, now);
  const rec = store.get(key) ?? { failures: [], lockedUntil: 0 };
  rec.failures.push(now);
  if (rec.failures.length >= MAX_FAILURES) {
    rec.lockedUntil = now + LOCK_MS;
  }
  store.set(key, rec);
}

/** Clear the counter for a key (successful login). */
export function resetLoginRateLimit(key: string): void {
  store.delete(key);
}

// ---------------------------------------------------------------------------
// Shared (global) store backed by the `rate_limits` Supabase table.
// ---------------------------------------------------------------------------

interface SharedRateLimitRow {
  failures: string[] | null;
  locked_until: string | null;
}

function toState(row: SharedRateLimitRow | null, nowMs: number): RateLimitState {
  if (!row) return { allowed: true, retryAfterSeconds: 0, remaining: MAX_FAILURES };
  const lockedUntil = row.locked_until ? Date.parse(row.locked_until) : 0;
  if (lockedUntil > nowMs) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((lockedUntil - nowMs) / 1000),
      remaining: 0,
    };
  }
  const failures = (row.failures ?? []).filter((t) => nowMs - Date.parse(t) < WINDOW_MS);
  return {
    allowed: true,
    retryAfterSeconds: 0,
    remaining: Math.max(0, MAX_FAILURES - failures.length),
  };
}

async function readSharedRow(key: string, nowMs: number): Promise<SharedRateLimitRow> {
  const supabase = getServiceRoleClient();
  if (!supabase) return { failures: [], locked_until: null };
  const { data } = await supabase
    .from("rate_limits")
    .select("failures, locked_until")
    .eq("key", key)
    .maybeSingle();
  const failures = ((data?.failures as string[] | null) ?? []).filter(
    (t) => nowMs - Date.parse(t) < WINDOW_MS
  );
  return {
    failures,
    locked_until: (data?.locked_until as string | null) ?? null,
  };
}

async function writeSharedRow(key: string, row: SharedRateLimitRow): Promise<void> {
  const supabase = getServiceRoleClient();
  if (!supabase) return;
  const failures = row.failures ?? [];
  await supabase
    .from("rate_limits")
    .upsert(
      {
        key,
        failures: failures.length ? failures : [],
        locked_until: row.locked_until,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
}

/** Global variant of checkLoginRateLimit; falls back to the in-memory store. */
export async function checkLoginRateLimitGlobal(key: string): Promise<RateLimitState> {
  if (!getServiceRoleClient()) return checkLoginRateLimit(key);
  const nowMs = Date.now();
  const row = await readSharedRow(key, nowMs);
  if (!row.locked_until || Date.parse(row.locked_until) <= nowMs) {
    return stateFromRecord(store.get(key), nowMs);
  }
  return toState(row, nowMs);
}

/** Global variant of recordLoginFailure; falls back to the in-memory store. */
export async function recordLoginFailureGlobal(key: string): Promise<void> {
  if (!getServiceRoleClient()) {
    recordLoginFailure(key);
    return;
  }
  const nowMs = Date.now();
  const row = await readSharedRow(key, nowMs);
  const failures = row.failures ?? [];
  failures.push(new Date(nowMs).toISOString());
  let lockedUntil = row.locked_until ?? null;
  if (failures.length >= MAX_FAILURES) {
    lockedUntil = new Date(nowMs + LOCK_MS).toISOString();
  }
  await writeSharedRow(key, { failures, locked_until: lockedUntil });
}

/** Global variant of resetLoginRateLimit; falls back to the in-memory store. */
export async function resetLoginRateLimitGlobal(key: string): Promise<void> {
  resetLoginRateLimit(key);
  const supabase = getServiceRoleClient();
  if (supabase) {
    await supabase.from("rate_limits").delete().eq("key", key);
  }
}

// ---------------------------------------------------------------------------
// Generic sliding-window usage quota (e.g. per-user OCR calls).
// ---------------------------------------------------------------------------

export interface UsageState {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

const usageStore = new Map<string, number[]>();

function usageKeyFor(scope: string, key: string): string {
  return `${scope}:${key}`;
}

function checkUsageMemory(key: string, limit: number, windowMs: number, now: number): UsageState {
  const hits = usageStore.get(key)?.filter((t) => now - t < windowMs) ?? [];
  return {
    allowed: hits.length < limit,
    remaining: Math.max(0, limit - hits.length),
    retryAfterSeconds: hits.length >= limit ? Math.ceil((hits[0] + windowMs - now) / 1000) : 0,
  };
}

function recordUsageMemory(key: string, now: number): void {
  const hits = usageStore.get(key) ?? [];
  hits.push(now);
  usageStore.set(key, hits);
}

/**
 * Check a sliding-window usage quota for a key. Backed by the shared table
 * when Supabase is configured; otherwise in-memory.
 */
export async function checkUsageLimit(
  scope: string,
  key: string,
  limit: number,
  windowMs: number
): Promise<UsageState> {
  const now = Date.now();
  const k = usageKeyFor(scope, key);
  if (!getServiceRoleClient()) return checkUsageMemory(k, limit, windowMs, now);
  const supabase = getServiceRoleClient();
  if (!supabase) return checkUsageMemory(k, limit, windowMs, now);
  const { data } = await supabase
    .from("rate_limits")
    .select("failures")
    .eq("key", k)
    .maybeSingle();
  const hits = ((data?.failures as string[] | null) ?? []).filter((t) => now - Date.parse(t) < windowMs);
  return {
    allowed: hits.length < limit,
    remaining: Math.max(0, limit - hits.length),
    retryAfterSeconds: hits.length >= limit ? Math.ceil((Date.parse(hits[0]) + windowMs - now) / 1000) : 0,
  };
}

/** Record one usage event for a quota key (same backing store as checkUsageLimit). */
export async function recordUsage(scope: string, key: string): Promise<void> {
  const now = Date.now();
  const k = usageKeyFor(scope, key);
  const supabase = getServiceRoleClient();
  if (!supabase) {
    recordUsageMemory(k, now);
    return;
  }
  const { data } = await supabase
    .from("rate_limits")
    .select("failures")
    .eq("key", k)
    .maybeSingle();
  const hits = ((data?.failures as string[] | null) ?? []).slice();
  hits.push(new Date(now).toISOString());
  await supabase.from("rate_limits").upsert(
    { key: k, failures: hits, updated_at: new Date(now).toISOString() },
    { onConflict: "key" }
  );
}
