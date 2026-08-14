import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionFromRequest } from "@/lib/session-server";
import { signJwt } from "@/lib/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/finances/credits?driverId=...
 * POST /api/finances/credits { driverId, delta }
 *
 * Créditos persistidos en `driver_credits` (RLS owner-scoped). El RPC
 * `adjust_driver_credit` hace el incremento de forma atómica.
 */
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const driverId = req.nextUrl.searchParams.get("driverId");
  if (!driverId) {
    return NextResponse.json({ error: "Falta driverId" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Supabase no configurado", localFallback: true }, { status: 503 });
  }

  try {
    const token = await signJwt({ sub: session.userId }, 300);
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data } = await client
      .from("driver_credits")
      .select("amount")
      .eq("driver_id", driverId)
      .maybeSingle();
    return NextResponse.json({ amount: data?.amount ?? 0 });
  } catch {
    return NextResponse.json({ error: "Supabase no configurado", localFallback: true }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    driverId?: string;
    delta?: number;
  };
  const delta = Number(body.delta);
  if (!body.driverId || !Number.isFinite(delta) || delta === 0) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Supabase no configurado", localFallback: true }, { status: 503 });
  }

  try {
    const token = await signJwt({ sub: session.userId }, 300);
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data, error } = await client.rpc("adjust_driver_credit", {
      p_driver_id: body.driverId,
      p_delta: delta,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ amount: data?.amount ?? 0 });
  } catch {
    return NextResponse.json({ error: "Supabase no configurado", localFallback: true }, { status: 503 });
  }
}