import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, clearSessionCookie } from "@/lib/session-server";
import { getServiceRoleClient } from "@/lib/admin-server";
import { signJwt } from "@/lib/jwt";

/**
 * GET /api/auth/me
 *
 * Returns the current session, resolved server-side from the HttpOnly
 * signed cookie — the client mirror in localStorage is never trusted.
 * Also mints a fresh Supabase bearer JWT so the client can query PostgREST
 * with RLS once RLS is enabled.
 *
 * - `{ session: null }` → no valid cookie (client clears its mirror).
 * - `{ localFallback: true }` → no SUPABASE_JWT_SECRET configured
 *   (demo/transitional mode: the client keeps its local mirror).
 */
export async function GET(req: NextRequest) {
  if (!process.env.SUPABASE_JWT_SECRET) {
    return NextResponse.json({ localFallback: true });
  }

  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ session: null });
  }

  // A deactivated (or deleted) user must not keep a working session: the
  // admin panel can disable accounts, so re-check against the real table.
  const supabase = getServiceRoleClient();
  if (supabase) {
    const { data: user } = await supabase
      .from("users")
      .select("id, is_active")
      .eq("id", session.userId)
      .maybeSingle();
    if (!user || !user.is_active) {
      const res = NextResponse.json({ session: null });
      clearSessionCookie(res);
      return res;
    }
  }

  let token: string | null = null;
  try {
    token = await signJwt({ sub: session.userId, email: session.email || undefined });
  } catch (err: unknown) {
    console.warn("[Auth] JWT signing failed:", err instanceof Error ? err.message : err);
  }

  return NextResponse.json({
    session: {
      userId: session.userId,
      email: session.email,
      displayName: session.displayName,
      role: session.role,
    },
    token,
  });
}
