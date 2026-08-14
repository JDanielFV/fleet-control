/**
 * Client-side session mirror (fase 2.1 del plan de hardening).
 *
 * The AUTHORITATIVE session lives server-side in an HttpOnly signed cookie
 * (`fleet_session`, see lib/session-server.ts). The client can't read or
 * forge it, so the role can't be spoofed: every privileged API route
 * validates the cookie.
 *
 * This module keeps a *mirror* of that session — in memory + localStorage —
 * so the UI can render (user name, role-gated tabs) and so supabase-js has
 * the bearer JWT for RLS-scoped queries. The mirror is only for display and
 * data access; the server never trusts it. `syncSessionFromServer()`
 * re-reads the cookie via /api/auth/me and corrects the mirror (role
 * changes, server-side logout, deactivated accounts).
 *
 * Plain module (no "use client") so the data layer (lib/db/index.ts) can
 * read the JWT for the Supabase client.
 */

import type { Session } from "@/lib/db/types";

const SESSION_KEY = "fleet_session";

/** In-memory session, keeps the mirror fresh across SPA navigation. */
let memorySession: Session | null = null;

/** Avoid spamming /api/auth/logout when clearSession is called repeatedly. */
let logoutInFlight = false;

/** Get a rolling expiry 24 h from now (ISO string). */
function getRollingExpiryISO(): string {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
}

/** Check if the session has expired (past 23:59 today). */
function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() < Date.now();
}

/** Persist the mirror locally. */
function persist(session: Session): void {
  memorySession = session;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // storage full/unavailable — memory mirror still works
  }
}

/** Save the session mirror (the server already set the HttpOnly cookie). */
export function saveSession(
  userId: string,
  email: string,
  displayName: string,
  role: "admin" | "owner",
  token: string | null = null
): void {
  persist({
    userId,
    email,
    displayName,
    role,
    expiresAt: getRollingExpiryISO(),
    token,
  });
}

/** Get the current session mirror, or null if expired / not logged in. */
export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  if (memorySession) {
    if (isExpired(memorySession.expiresAt)) {
      clearSession();
      return null;
    }
    return memorySession;
  }
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session: Session = JSON.parse(raw);
    if (isExpired(session.expiresAt)) {
      clearSession();
      return null;
    }
    memorySession = session;
    return session;
  } catch {
    return null;
  }
}

/** The JWT of the current session (Bearer token for Supabase), or null. */
export function getSessionToken(): string | null {
  return getSession()?.token ?? null;
}

/**
 * Clear the session mirror AND ask the server to clear the HttpOnly cookie
 * (fire-and-forget: the cookie is the authoritative session, so this is the
 * actual logout). Safe to call repeatedly.
 */
export function clearSession(): void {
  memorySession = null;
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
    if (!logoutInFlight) {
      logoutInFlight = true;
      void fetch("/api/auth/logout", { method: "POST", keepalive: true })
        .catch(() => {})
        .finally(() => {
          logoutInFlight = false;
        });
    }
  }
}

/**
 * The id of the currently logged-in user (owner), or null when not logged
 * in. Used by the data layer to scope every read/write to the user's own
 * fleet. The real isolation comes from RLS (auth.uid() from the JWT) — this
 * is a UI/data convenience, not the security boundary.
 */
export function getOwnerId(): string | null {
  return getSession()?.userId ?? null;
}

/**
 * Re-sync the mirror with the authoritative server session (HttpOnly
 * cookie) via /api/auth/me. Returns the corrected session, or null when the
 * server has no valid session (callers should redirect to login).
 *
 * In demo mode (no SUPABASE_JWT_SECRET) the API answers `localFallback` and
 * the mirror is kept as-is.
 */
export async function syncSessionFromServer(): Promise<Session | null> {
  if (typeof window === "undefined") return getSession();
  try {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (data?.localFallback) {
      return getSession();
    }
    if (data?.session?.userId) {
      const s: Session = {
        userId: data.session.userId,
        email: data.session.email ?? "",
        displayName: data.session.displayName ?? "",
        role: data.session.role === "admin" ? "admin" : "owner",
        expiresAt: getRollingExpiryISO(),
        token: typeof data.token === "string" ? data.token : null,
      };
      persist(s);
      return s;
    }
    // Server has no valid session → clear the mirror.
    clearSession();
    return null;
  } catch {
    // Network error: keep the mirror (offline); the server still guards APIs.
    return getSession();
  }
}
