"use client";

import type { Session } from "@/lib/db/types";

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
export function saveSession(userId: string, email: string, displayName: string, role: "admin" | "operator"): void {
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
 * Hash a password using the Web Crypto API (SHA-256 based).
 * This is a client-side hash for simplicity. In production you'd hash server-side.
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "fleet-control-salt");
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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
