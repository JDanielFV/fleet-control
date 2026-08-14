import { NextRequest, NextResponse } from "next/server";
import { getUserCount } from "@/lib/db/users";
import { getServiceRoleClient } from "@/lib/admin-server";
import { getClientIp, checkUsageLimit, recordUsage } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/status
 *
 * Server-side replacement for the client's `getUserCount()` + first-run
 * token creation. Returns how many users exist and — when the database is
 * empty — a one-time setup token so the very first user can register as the
 * system admin.
 *
 * Protected by RLS: reads `users`/`registration_tokens` with the service-role
 * key (the anon key can't see these tables anymore once RLS is enabled).
 * When Supabase isn't configured it answers `{ localFallback: true }` and the
 * client falls back to the localStorage demo mode.
 *
 * Rate-limited (120 req/hora por IP): este endpoint expone si el sistema está
 * vacío (setup token), lo que alimenta enumeración de estado.
 */
export async function GET(req: NextRequest) {
  const ip = getClientIp(req);

  const { allowed, retryAfterSeconds } = await checkUsageLimit("setup_status", ip, 120, 3600000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Inténtalo más tarde." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }
  await recordUsage("setup_status", ip);

  const supabase = getServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ localFallback: true });
  }

  const { count, error } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error("[Auth] status count error:", error.message);
    return NextResponse.json({ error: "Error al consultar el estado del sistema." }, { status: 500 });
  }

  if (count === 0) {
    // Cleanup stale setup tokens (unused, expired, created without an admin).
    await supabase
      .from("registration_tokens")
      .delete()
      .is("created_by", null)
      .lt("expires_at", new Date().toISOString());

    // Reuse an existing valid setup token so refreshes don't spam new ones.
    const now = new Date().toISOString();
    const { data: existing } = await supabase
      .from("registration_tokens")
      .select("token")
      .is("created_by", null)
      .is("used_at", null)
      .gt("expires_at", now)
      .limit(1)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ userCount: 0, setupToken: existing.token });
    }

    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const { data, error: insertError } = await supabase
      .from("registration_tokens")
      .insert({
        token,
        created_by: null, // setup token: no admin exists yet
        used_at: null,
        expires_at: new Date(Date.now() + 86400000).toISOString(), // 24 h
      })
      .select("token")
      .single();

    if (insertError) {
      console.error("[Auth] setup token error:", insertError.message);
      return NextResponse.json({ error: "Error al preparar el registro inicial." }, { status: 500 });
    }
    return NextResponse.json({ userCount: 0, setupToken: data.token });
  }

  return NextResponse.json({ userCount: count });
}
