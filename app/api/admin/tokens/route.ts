import { NextRequest, NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/admin-server";

/**
 * External admin panel — registration tokens.
 * The system admin generates a shareable registration link (token) so the
 * invited user creates their own account (name, email, password, passkey).
 */

export async function POST(req: NextRequest) {
  const g = await requireSystemAdmin(req.headers.get("x-admin-user-id"));
  if (!g.ok) {
    return g.reason === "local"
      ? NextResponse.json({ localFallback: true })
      : NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const createdBy = req.headers.get("x-admin-user-id");
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const { data, error } = await g.supabase
    .from("registration_tokens")
    .insert({
      token,
      created_by: createdBy,
      used_at: null,
      expires_at: new Date(Date.now() + 86400000).toISOString(), // 24 h, mismo criterio que el flujo de la app
    })
    .select("token")
    .single();

  if (error) {
    console.error("[Admin] token create error:", error.message);
    return NextResponse.json({ error: "Error al generar el token." }, { status: 500 });
  }

  return NextResponse.json({ token: data.token });
}
