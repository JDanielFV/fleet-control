import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyPassword } from "@/lib/password";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json({ error: "Correo y contraseña son obligatorios." }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // If Supabase isn't configured, users live in localStorage — the client
    // must fall back to local verification (single-device demo mode).
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ localFallback: true });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
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
      return NextResponse.json({ error: "Correo o contraseña incorrectos." }, { status: 401 });
    }

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      return NextResponse.json({ error: "Correo o contraseña incorrectos." }, { status: 401 });
    }

    // Update last_login_at (best effort)
    await supabase
      .from("users")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", user.id);

    return NextResponse.json({
      userId: user.id,
      displayName: user.display_name,
      email: user.email,
      role: user.role || "owner",
    });
  } catch (err: unknown) {
    console.error("[Auth] login error:", err);
    return NextResponse.json({ error: "Error interno al iniciar sesión." }, { status: 500 });
  }
}
