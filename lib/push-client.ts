/**
 * Cliente de notificaciones push (Web Push + VAPID).
 *
 * Solo debe usarse en componentes cliente ("use client"). El servidor
 * persiste las suscripciones por dueño en `push_subscriptions` (RLS
 * owner-scoped) — ver app/api/push/route.ts.
 */

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/** Estado actual de la suscripción push del navegador (o null). */
export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/**
 * Solicita permiso y suscribe el dispositivo a las notificaciones.
 * Returns true si el dispositivo quedó suscrito (o ya lo estaba).
 */
export async function enablePushNotifications(): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return false;
  }
  if (!VAPID_PUBLIC) return false;

  try {
    const reg = await navigator.serviceWorker.ready;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      });
    }

    const res = await fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
    return res.ok;
  } catch (err) {
    console.error("[Push] enable failed:", err);
    return false;
  }
}

/**
 * Desuscribe el dispositivo y elimina la suscripción del servidor.
 */
export async function disablePushNotifications(): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
    return true;
  } catch (err) {
    console.error("[Push] disable failed:", err);
    return false;
  }
}

/**
 * Manda una notificación propia vía el servidor (VAPID). Requiere
 * NEXT_PUBLIC_VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY configurados.
 */
export async function sendPushNotification(
  title: string,
  body: string,
  url = "/"
): Promise<boolean> {
  try {
    const res = await fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, url }),
    });
    return res.ok;
  } catch {
    return false;
  }
}