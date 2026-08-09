/**
 * Shared password hashing + verification.
 *
 * Isomorphic (no "use client"): used by the client during registration
 * (UserForm) and by the server during password login (/api/auth/login).
 * Keeps the same algorithm used historically (SHA-256 with a fixed salt) so
 * existing password_hash rows remain valid.
 */

const SALT = "fleet-control-salt";

/**
 * Hash a password using the Web Crypto API (SHA-256 based).
 * Note: this is a lightweight client/server-compatible scheme; if the app
 * moves to Supabase Auth, these hashes would be replaced by Auth's own.
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + SALT);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Verify a plaintext password against a stored hash. Returns false for
 * null/empty hashes so users without a password can't authenticate.
 */
export async function verifyPassword(password: string, storedHash: string | null | undefined): Promise<boolean> {
  if (!storedHash) return false;
  const candidate = await hashPassword(password);
  // Constant-time comparison to avoid trivial timing side-channels.
  if (candidate.length !== storedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < candidate.length; i++) {
    diff |= candidate.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return diff === 0;
}
