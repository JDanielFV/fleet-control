import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { getSessionFromRequest } from "@/lib/session-server";
import { getServiceRoleClient } from "@/lib/admin-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/push/send { title, body, url? }
 *
 * Envía una notificación push a todas las suscripciones del dueño
 * autenticado (VAPID + web-push). Requiere:
 *   - sesión válida (cookie HttpOnly)
 *   - VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / NEXT_PUBLIC_VAPID_PUBLIC_KEY
 *     configurados (ver README)
 */
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    body?: string;
    url?: string;
  };
  const title = typeof body.title === "string" ? body.title.slice(0, 200) : "";
  const text = typeof body.body === "string" ? body.body.slice(0, 500) : "";
  if (!title && !text) {
    return NextResponse.json({ error: "Falta título o cuerpo" }, { status: 400 });
  }

  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidContact = process.env.VAPID_SUBJECT || "mailto:admin@fleet-control.local";
  if (!vapidPublic || !vapidPrivate) {
    return NextResponse.json(
      {
        error:
          "VAPID no configurado. Genera las llaves con: npx web-push generate-vapid-keys",
      },
      { status: 503 }
    );
  }
  webpush.setVapidDetails(vapidContact, vapidPublic, vapidPrivate);

  const payload = JSON.stringify({
    title,
    body: text,
    url: typeof body.url === "string" ? body.url : "/",
  });

  const supabase = getServiceRoleClient();
  let subs: { endpoint: string; p256dh: string; auth: string }[] = [];
  if (supabase) {
    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("owner_id", session.userId);
    if (error) {
      return NextResponse.json({ error: "Error al consultar suscripciones" }, { status: 500 });
    }
    subs = data ?? [];
  }

  let sent = 0;
  let failed = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload
      );
      sent++;
    } catch (err) {
      failed++;
      // 404/410: suscripción muerta → limpiar (solo con Supabase).
      const status = (err as { statusCode?: number })?.statusCode;
      if (supabase && (status === 404 || status === 410)) {
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("owner_id", session.userId)
          .eq("endpoint", sub.endpoint);
      }
    }
  }

  return NextResponse.json({ sent, failed, total: subs.length });
}