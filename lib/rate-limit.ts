/**
 * Login rate limiter (per email + IP) with temporary lockout.
 *
 * Policy: max 5 failed attempts per email+IP in a 15-minute sliding window;
 * after the 5th failure the key is locked for 15 minutes. Locked keys answer
 * a generic 429 — never reveal whether the email exists, how many attempts
 * remain, or how long the lock lasts.
 *
 * Server-only module. Never import from client code.
 *
 * NOTE: the store is in-memory, so it is per process. On serverless /
 * multi-instance deploys (Vercel) each warm instance keeps its own counters,
 * which throttles per instance rather than globally. It still raises the
 * cost of a brute-force attack substantially; a shared store (e.g. a
 * Supabase table) would make it global.
 */

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
 * Best-effort client IP from the request headers (Vercel sets
 * x-forwarded-for). Falls back to x-real-ip, then "unknown".
 */
export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
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

/** Check whether a login attempt is currently allowed for the key. */
export function checkLoginRateLimit(key: string): RateLimitState {
  const now = Date.now();
  prune(key, now);
  const rec = store.get(key);
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
