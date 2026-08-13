"use client";

import type { Session } from "@/lib/db/types";

export { hashPassword, verifyPassword } from "./password";
export {
  saveSession,
  getSession,
  getSessionToken,
  clearSession,
  getOwnerId,
  syncSessionFromServer,
} from "./session";

/**
 * Generate a cryptographically secure random token.
 */
export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type { Session };
