import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/admin-server";
import { setSessionCookie } from "@/lib/session-server";
import { hashPasswordServer } from "@/lib/password-server";
import { signJwt } from "@/lib/jwt";

/**
 * POST /api/auth/register
 *
 * Server-side registration for the invitation flow. Replaces the old
 * client-side `db.saveUser` + `db.useRegistrationToken` path:
 *
 *   - `{ step: "validate", token }` → validates the invitation token
 *     (exists, unused, not expired) without creating anything.
 *   - `{ token, display_name, email, password }` → creates the account with
 *     scrypt, consumes the token (single use) and mints the session JWT.
 *
 * The very first user of the system (database empty) becomes the `admin`
 * with `metadata.is_system_admin = true`; everyone else is created as
 * `owner` (each owner administers only their own fleet). The role is decided
 * server-side — a client-supplied role is never trusted.
 *
 * Runs with the service-role key so it keeps working once RLS closes the
 * `users` and `registration_tokens` tables. Without Supabase configured it
 * answers `{ localFallback: true }` and the client falls back to the
 * localStorage demo mode.
 */

async function findValidToken(token: string) {
  const supabase = getServiceRoleClient();
  if (!supabase) return { supabase: null as ReturnType<typeof getServiceRoleClient>, rt: null };

  const now = new Date().toISOString();
  const { data: rt, error } = await supabase
    .from("registration_tokens")
    .select("*")
    .eq("token", token)
    .is("used_at", null)
    .gt("expires_at", now)
    .maybeSingle();

  if (error) {
    console.error("[Auth] token lookup error:", error.message);
  }
  return { supabase, rt };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body.token === "string" ? body.token.trim() : "";

    // --- Step: validate the invitation token (no side effects) -----------
    if (body.step === "validate") {
      if (!token) {
        return NextResponse.json({ valid: false, error: "Falta el token de invitación." }, { status: 400 });
      }
      const { supabase, rt } = await findValidToken(token);
      if (!supabase) return NextResponse.json({ localFallback: true });
      if (!rt) {
        return NextResponse.json({ valid: false, error: "Token inválido, usado o expirado." }, { status: 400 });
      }
      return NextResponse.json({ valid: true });
    }

    // --- Full registration ------------------------------------------------
    const display_name = typeof body.display_name === "string" ? body.display_name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!display_name || !email || !password) {
      return NextResponse.json({ error: "Nombre, correo y contraseña son obligatorios." }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres." }, { status: 400 });
    }
    if (!token) {
      return NextResponse.json({ error: "Falta el token de invitación." }, { status: 400 });
    }

    const { supabase, rt } = await findValidToken(token);
    if (!supabase) return NextResponse.json({ localFallback: true });
    if (!rt) {
      return NextResponse.json({ error: "Token inválido, usado o expirado." }, { status: 400 });
    }

    // First user of the system becomes the admin; everyone else is an owner.
    const { count } = await supabase.from("users").select("*", { count: "exact", head: true });
    const role: "admin" | "owner" = count === 0 ? "admin" : "owner";

    const password_hash = await hashPasswordServer(password);
    const { data: created, error: insertError } = await supabase
      .from("users")
      .insert({
        display_name,
        email,
        password_hash,
        role,
        webauthn_credentials: [],
        metadata: role === "admin" ? { is_system_admin: true } : {},
        is_active: true,
        last_login_at: null,
      })
      .select("id, display_name, email, role")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json({ error: "Ya existe un usuario con ese correo." }, { status: 409 });
      }
      console.error("[Auth] register insert error:", insertError.message);
      return NextResponse.json({ error: "Error al crear la cuenta." }, { status: 500 });
    }

    // Consume the one-time token.
    await supabase
      .from("registration_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", rt.id);

    // Mint the session JWT so the new user can query their fleet once RLS
    // is enabled. Non-fatal: without the secret the session has no token yet.
    let jwt: string | null = null;
    if (process.env.SUPABASE_JWT_SECRET) {
      try {
        jwt = await signJwt({ sub: created.id, email: created.email ?? undefined });
      } catch (err: unknown) {
        console.warn("[Auth] JWT signing failed:", err instanceof Error ? err.message : err);
      }
    }

    const response = NextResponse.json({
      userId: created.id,
      displayName: created.display_name,
      email: created.email,
      role: created.role,
      token: jwt,
    });
    // Authoritative session: HttpOnly signed cookie (the client mirror is
    // only for UI). No-op when SUPABASE_JWT_SECRET isn't configured.
    await setSessionCookie(response, {
      userId: created.id,
      email: created.email,
      displayName: created.display_name,
      role: created.role === "admin" ? "admin" : "owner",
    });
    return response;
  } catch (err: unknown) {
    console.error("[Auth] register error:", err);
    return NextResponse.json({ error: "Error interno al registrar la cuenta." }, { status: 500 });
  }
}
