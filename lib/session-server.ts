/**
 * Server-only HttpOnly session cookie (fase 2.1 del plan de hardening).
 *
 * The authoritative session lives in an HttpOnly, SameSite=Lax cookie signed
 * as a JWT with SUPABASE_JWT_SECRET. The client can't read or forge it — the
 * role comes from here, never from the client.
 *
 * The client keeps its own mirror (lib/session.ts) for UI rendering and to
 * hold the Supabase bearer JWT, but the server never trusts it: every
 * privileged API route validates this cookie.
 *
 * Never import this module from client code (uses lib/jwt, which is
 * server-only).
 */

import { NextRequest, NextResponse } from "next/server";
import { signJwt, verifyJwt } from "@/lib/jwt";

export const SESSION_COOKIE = "fleet_session";

export interface ServerSession {
  userId: string;
  email: string | null;
  displayName: string;
  role: "admin" | "owner";
}

const SESSION_MAX_AGE = 60 * 60 * 24; // 24 h, matches the JWT exp

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

/**
 * Set the session cookie on the response. No-op when SUPABASE_JWT_SECRET
 * isn't configured (demo/transitional mode: the client keeps its local
 * mirror and there's no RLS yet to protect).
 */
export async function setSessionCookie(response: NextResponse, session: ServerSession): Promise<void> {
  if (!process.env.SUPABASE_JWT_SECRET) return;
  const token = await signJwt({
    sub: session.userId,
    email: session.email || undefined,
    display_name: session.displayName,
    app_role: session.role,
  });
  response.cookies.set(SESSION_COOKIE, token, {
    ...cookieOptions(),
    maxAge: SESSION_MAX_AGE,
  });
}

/**
 * Re-sign the session cookie with a fresh 24 h expiry (rolling session):
 * as long as the user keeps hitting protected routes, the session never
 * dies mid-use; once they stop, it expires 24 h after the last refresh.
 * Call after validating the session, before returning the response.
 */
export async function extendSessionCookie(response: NextResponse, session: ServerSession): Promise<void> {
  if (!process.env.SUPABASE_JWT_SECRET) return;
  const token = await signJwt({
    sub: session.userId,
    email: session.email || undefined,
    display_name: session.displayName,
    app_role: session.role,
  });
  response.cookies.set(SESSION_COOKIE, token, {
    ...cookieOptions(),
    maxAge: SESSION_MAX_AGE,
  });
}

/** Clear the session cookie (logout). */
export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", {
    ...cookieOptions(),
    maxAge: 0,
  });
}

/**
 * Read and verify the session cookie. Returns null when there's no cookie,
 * the signature is invalid, the token expired, or the secret isn't
 * configured.
 */
export async function getSessionFromRequest(req: NextRequest): Promise<ServerSession | null> {
  const raw = req.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const payload = await verifyJwt(raw);
  if (!payload) return null;
  const role = payload.app_role === "admin" ? "admin" : "owner";
  return {
    userId: payload.sub,
    email: typeof payload.email === "string" ? payload.email : null,
    displayName: typeof payload.display_name === "string" ? payload.display_name : "",
    role,
  };
}
