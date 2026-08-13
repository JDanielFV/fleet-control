/**
 * Server-only password hashing with scrypt (Node crypto).
 *
 * Replaces the legacy SHA-256-with-fixed-salt scheme used for client-side
 * registration. scrypt uses a random per-user salt, is memory-hard and is
 * built into Node — no extra dependency. Format of a stored hash:
 *
 *   scrypt$<salt b64url>$<hash b64url>
 *
 * `verifyPasswordServer` also handles legacy hashes (raw SHA-256 hex, no
 * prefix): it verifies them and reports `needsUpgrade: true` so the caller
 * (e.g. the login route) can re-hash with scrypt on the next successful
 * login without forcing users to reset their password.
 *
 * Never import this module from client code (uses node:crypto).
 */

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { verifyPassword as verifyLegacyPassword } from "./password";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number }
) => Promise<Buffer>;

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;
const SCRYPT_PREFIX = "scrypt$";

export function isScryptHash(stored: string | null | undefined): boolean {
  return typeof stored === "string" && stored.startsWith(SCRYPT_PREFIX);
}

/** Hash a password with scrypt and a fresh random salt. */
export async function hashPasswordServer(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `${SCRYPT_PREFIX}${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

async function verifyScrypt(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3) return false;
  const salt = Buffer.from(parts[1], "base64url");
  const expected = Buffer.from(parts[2], "base64url");
  const actual = await scrypt(password, salt, expected.length, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export interface VerifyResult {
  ok: boolean;
  /** True when the stored hash uses the legacy SHA-256 scheme and should be re-hashed with scrypt. */
  needsUpgrade: boolean;
}

/**
 * Verify a plaintext password against a stored hash (scrypt or legacy
 * SHA-256). Returns `needsUpgrade: true` for legacy hashes that verified OK.
 */
export async function verifyPasswordServer(
  password: string,
  storedHash: string | null | undefined
): Promise<VerifyResult> {
  if (!storedHash) return { ok: false, needsUpgrade: false };
  if (isScryptHash(storedHash)) {
    return { ok: await verifyScrypt(password, storedHash), needsUpgrade: false };
  }
  // Legacy SHA-256 scheme (fixed salt, raw hex). Verified for compatibility.
  const ok = await verifyLegacyPassword(password, storedHash);
  return { ok, needsUpgrade: ok };
}
