import { NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/admin-server";
import { setSessionCookie } from "@/lib/session-server";
import { verifyPasswordServer, hashPasswordServer } from "@/lib/password-server";
import { signJwt } from "@/lib/jwt";
import {
  checkLoginRateLimit,
  recordLoginFailure,
  resetLoginRateLimit,
  getClientIp,
  loginRateLimitKey,
  LOGIN_LOCKED_MESSAGE,
} from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json({ error: "Correo y contraseña son obligatorios." }, { status: 400 });
    }

    // Rate limit: 5 failed attempts per email+IP in 15 min, then a temporary
    // lockout. Checked before any credential work, so locked keys can't even
    // be probed; the response is generic (no email or attempt-count leak).
    const rlKey = loginRateLimitKey(email, getClientIp(request));
    const rl = checkLoginRateLimit(rlKey);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: LOGIN_LOCKED_MESSAGE },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
      );
    }

    // The login runs with the service-role key: RLS closes the `users` table
    // to the anon key, so this route (and the passkey routes) must use a
    // privileged client. Without Supabase configured, users live in
    // localStorage — the client falls back to local verification (demo mode).
    const supabase = getServiceRoleClient();
    if (!supabase) {
      return NextResponse.json({ localFallback: true });
    }
    // Escape LIKE wildcards so a crafted email can't match unrelated rows.
    const safeEmail = email.replace(/[\\%_]/g, (c: string) => "\\" + c);
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .ilike("email", safeEmail)
      .maybeSingle();

    if (error) {
      console.error("[Auth] login lookup error:", error.message);
      return NextResponse.json({ error: "Error interno al iniciar sesión." }, { status: 500 });
    }

    if (!user || !user.is_active) {
      // Generic message: never reveal whether the email exists.
      recordLoginFailure(rlKey);
      return NextResponse.json({ error: "Correo o contraseña incorrectos." }, { status: 401 });
    }

    const { ok, needsUpgrade } = await verifyPasswordServer(password, user.password_hash);
    if (!ok) {
      recordLoginFailure(rlKey);
      return NextResponse.json({ error: "Correo o contraseña incorrectos." }, { status: 401 });
    }

    // Successful login clears the failure counter for this email+IP.
    resetLoginRateLimit(rlKey);

    // Best-effort housekeeping: last_login_at + re-hash legacy SHA-256
    // hashes with scrypt on the next successful login (no password reset
    // required for existing users).
    const updates: Record<string, unknown> = { last_login_at: new Date().toISOString() };
    if (needsUpgrade) {
      updates.password_hash = await hashPasswordServer(password);
    }
    await supabase.from("users").update(updates).eq("id", user.id);

    // Mint a session JWT so the client can talk to PostgREST as
    // `authenticated` (auth.uid() = user.id) once RLS is enabled.
    let token: string | null = null;
    if (process.env.SUPABASE_JWT_SECRET) {
      try {
        token = await signJwt({ sub: user.id, email: user.email || undefined });
      } catch (err: unknown) {
        console.warn("[Auth] JWT signing failed:", err instanceof Error ? err.message : err);
      }
    }

    const response = NextResponse.json({
      userId: user.id,
      displayName: user.display_name,
      email: user.email,
      role: user.role || "owner",
      token,
    });
    // Authoritative session: HttpOnly signed cookie (the client mirror is
    // only for UI). No-op when SUPABASE_JWT_SECRET isn't configured.
    await setSessionCookie(response, {
      userId: user.id,
      email: user.email,
      displayName: user.display_name,
      role: (user.role === "admin" ? "admin" : "owner"),
    });
    return response;
  } catch (err: unknown) {
    console.error("[Auth] login error:", err);
    return NextResponse.json({ error: "Error interno al iniciar sesión." }, { status: 500 });
  }
}
