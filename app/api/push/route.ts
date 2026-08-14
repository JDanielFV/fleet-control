import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session-server";
import { getServiceRoleClient } from "@/lib/admin-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/push
 *   { subscription: PushSubscriptionJSON } → registra la suscripción del
 *     dueño autenticado (persistida en `push_subscriptions`, antes en
 *     memoria y sin autenticación).
 *   { endpoint } → elimina la suscripción (logout/desactivación).
 *
 * GET /api/push → { count } de suscripciones del dueño autenticado.
 * Requiere sesión válida (cookie HttpOnly). Sin Supabase configurado usa un
 * store en memoria como fallback transicional.
 */

const memorySubscriptions = new Map<string, PushSubscriptionJSON[]>();

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    subscription?: PushSubscriptionJSON;
    endpoint?: string;
  };

  const supabase = getServiceRoleClient();

  if (body.subscription) {
    const sub = body.subscription;
    if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys.auth) {
      return NextResponse.json({ error: "Suscripción inválida" }, { status: 400 });
    }
    if (supabase) {
      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          owner_id: session.userId,
          endpoint: sub.endpoint,
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
        },
        { onConflict: "owner_id,endpoint", ignoreDuplicates: false }
      );
      if (error) {
        console.error("[Push] subscribe error:", error.message);
        return NextResponse.json({ error: "Error al guardar la suscripción" }, { status: 500 });
      }
    } else {
      const list = memorySubscriptions.get(session.userId) ?? [];
      if (!list.some((s) => s.endpoint === sub.endpoint)) list.push(sub);
      memorySubscriptions.set(session.userId, list);
    }
    return NextResponse.json({ ok: true });
  }

  if (body.endpoint) {
    if (supabase) {
      const { error } = await supabase
        .from("push_subscriptions")
        .delete()
        .eq("owner_id", session.userId)
        .eq("endpoint", body.endpoint);
      if (error) {
        console.error("[Push] unsubscribe error:", error.message);
        return NextResponse.json({ error: "Error al eliminar la suscripción" }, { status: 500 });
      }
    } else {
      const list = memorySubscriptions.get(session.userId) ?? [];
      memorySubscriptions.set(
        session.userId,
        list.filter((s) => s.endpoint !== body.endpoint)
      );
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = getServiceRoleClient();
  if (supabase) {
    const { count, error } = await supabase
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", session.userId);
    if (error) {
      return NextResponse.json({ error: "Error al consultar suscripciones" }, { status: 500 });
    }
    return NextResponse.json({ count: count ?? 0 });
  }

  return NextResponse.json({ count: (memorySubscriptions.get(session.userId) ?? []).length });
}