import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/session-server";

/**
 * POST /api/auth/logout
 *
 * Clears the HttpOnly session cookie. The client clears its local mirror
 * first (or right after) — the cookie is the authoritative session, so
 * removing it logs the user out server-side.
 */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
