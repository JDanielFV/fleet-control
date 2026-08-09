"use client";

import type { Session } from "@/lib/db/types";

export { hashPassword, verifyPassword } from "./password";

const SESSION_KEY = "fleet_session";

/**
 * Get today's 23:59 as ISO string for session expiry.
 */
function getEndOfDayISO(): string {
  const now = new Date();
  const eod = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return eod.toISOString();
}

/**
 * Check if the session has expired (past 23:59 today).
 */
function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() < Date.now();
}

/**
 * Save a session to localStorage.
 */
export function saveSession(userId: string, email: string, displayName: string, role: "admin" | "owner"): void {
  const session: Session = {
    userId,
    email,
    displayName,
    role,
    expiresAt: getEndOfDayISO(),
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

/**
 * Get the current session, or null if expired / not logged in.
 */
export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session: Session = JSON.parse(raw);
    if (isExpired(session.expiresAt)) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

/**
 * Clear the session (logout).
 */
export function clearSession(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(SESSION_KEY);
  }
}

/**
 * The id of the currently logged-in user (owner), or null when not logged in.
 * Used by the data layer to scope every read/write to the user's own fleet.
 */
export function getOwnerId(): string | null {
  return getSession()?.userId ?? null;
}

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
