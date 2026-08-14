import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionFromRequest } from "@/lib/session-server";
import { signJwt } from "@/lib/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/finances/payments
 *
 * Aplica pagos de forma atómica en el servidor (RPCs SECURITY DEFINER que
 * validan auth.uid()): elimina el read-modify-write del cliente y la
 * posibilidad de lost updates entre pestañas/dispositivos.
 *
 * Body:
 *   { rentalId, amount, paymentDate? }  → pago sobre un rental concreto (UI)
 *   { driverId, amount, paymentDate? }  → pago contra rentas pendientes del
 *                                          chofer, sobrante → crédito
 */
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    rentalId?: string;
    driverId?: string;
    amount?: number;
    paymentDate?: string;
  };

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
  }
  if (!body.rentalId && !body.driverId) {
    return NextResponse.json({ error: "Falta rentalId o driverId" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "Supabase no configurado", localFallback: true },
      { status: 503 }
    );
  }

  try {
    const token = await signJwt({ sub: session.userId, email: session.email ?? undefined }, 300);
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const paymentDate = body.paymentDate || new Date().toISOString().split("T")[0];

    if (body.rentalId) {
      const { data, error } = await client.rpc("apply_rental_payment", {
        p_rental_id: body.rentalId,
        p_amount: amount,
        p_payment_date: paymentDate,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ rental: data });
    }

    const { data, error } = await client.rpc("apply_payment", {
      p_driver_id: body.driverId,
      p_amount: amount,
      p_payment_date: paymentDate,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ applied: data?.applied ?? [], leftover: data?.leftover ?? 0 });
  } catch {
    return NextResponse.json(
      { error: "Supabase no configurado", localFallback: true },
      { status: 503 }
    );
  }
}