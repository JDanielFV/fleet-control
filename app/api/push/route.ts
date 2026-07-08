import { NextRequest, NextResponse } from "next/server";

// VAPID keys should be stored in env vars in production.
// For now we use a simple in-memory subscription store (resets on deploy).
// In production, persist to Supabase or localStorage-compatible store.

let subscriptions: PushSubscriptionJSON[] = [];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Subscribe
    if (body.subscription) {
      const sub = body.subscription as PushSubscriptionJSON;
      // Avoid duplicates
      const exists = subscriptions.some(
        (s) => s.endpoint === sub.endpoint
      );
      if (!exists) {
        subscriptions.push(sub);
      }
      return NextResponse.json({ ok: true, count: subscriptions.length });
    }

    // Unsubscribe
    if (body.endpoint) {
      subscriptions = subscriptions.filter((s) => s.endpoint !== body.endpoint);
      return NextResponse.json({ ok: true, count: subscriptions.length });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({
    count: subscriptions.length,
    subscriptions: subscriptions.map((s) => s.endpoint),
  });
}
