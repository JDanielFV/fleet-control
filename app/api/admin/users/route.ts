import { NextRequest, NextResponse } from "next/server";
import { requireSystemAdminFromRequest, ADMIN_OWNED_TABLES } from "@/lib/admin-server";
import { getSessionFromRequest } from "@/lib/session-server";
import { hashPasswordServer } from "@/lib/password-server";

/**
 * External admin panel — user management.
 * All routes are guarded server-side via the HttpOnly session cookie: only
 * the system admin may call them (the client can't forge the role).
 */

async function guard(req: NextRequest) {
  return requireSystemAdminFromRequest(req);
}

/** The caller's user id, from the signed session cookie (never the client). */
async function getCurrentUserId(req: NextRequest): Promise<string | null> {
  return (await getSessionFromRequest(req))?.userId ?? null;
}

export async function GET(req: NextRequest) {
  const g = await guard(req);
  if (!g.ok) {
    return g.reason === "local"
      ? NextResponse.json({ localFallback: true })
      : NextResponse.json({ error: "No autorizado. Solo el administrador del sistema puede acceder." }, { status: 401 });
  }

  const { data: users, error } = await g.supabase
    .from("users")
    .select("id, display_name, email, role, metadata, is_active, last_login_at, created_at, updated_at, webauthn_credentials")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[Admin] users GET error:", error.message);
    return NextResponse.json({ error: "Error al consultar usuarios." }, { status: 500 });
  }

  // Per-user record counts across every owned table (lightweight: only owner_id).
  const counts: Record<string, Record<string, number>> = {};
  for (const table of ADMIN_OWNED_TABLES) {
    const { data: rows } = await g.supabase.from(table).select("owner_id");
    counts[table] = {};
    for (const row of rows ?? []) {
      const key = String(row.owner_id ?? "sin_dueño");
      counts[table][key] = (counts[table][key] ?? 0) + 1;
    }
  }

  return NextResponse.json({ users: users ?? [], counts });
}

export async function POST(req: NextRequest) {
  const g = await guard(req);
  if (!g.ok) {
    return g.reason === "local"
      ? NextResponse.json({ localFallback: true })
      : NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const display_name = typeof body.display_name === "string" ? body.display_name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!display_name || !email || !password) {
    return NextResponse.json({ error: "Nombre, correo y contraseña son obligatorios." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres." }, { status: 400 });
  }

  const password_hash = await hashPasswordServer(password);
  const { data, error } = await g.supabase
    .from("users")
    .insert({
      display_name,
      email,
      password_hash,
      role: "owner", // El panel crea dueños; solo el admin del sistema es 'admin'
      webauthn_credentials: [],
      metadata: {},
      is_active: true,
      last_login_at: null,
    })
    .select("id, display_name, email, role, metadata, is_active, last_login_at, created_at, updated_at, webauthn_credentials")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Ya existe un usuario con ese correo." }, { status: 409 });
    }
    console.error("[Admin] user create error:", error.message);
    return NextResponse.json({ error: "Error al crear el usuario." }, { status: 500 });
  }

  return NextResponse.json({ user: data });
}

export async function PATCH(req: NextRequest) {
  const g = await guard(req);
  if (!g.ok) {
    return g.reason === "local"
      ? NextResponse.json({ localFallback: true })
      : NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "id es obligatorio." }, { status: 400 });

  const currentUserId = await getCurrentUserId(req);
  // Never allow the system admin to lock themselves out (deactivate or remove
  // their own passkeys): requireSystemAdmin rejects inactive users, so there
  // would be no way back in.
  if (id === currentUserId) {
    if (body.is_active === false) {
      return NextResponse.json({ error: "No puedes desactivar tu propia cuenta desde el panel." }, { status: 400 });
    }
    if (typeof body.remove_credential_id === "string" && body.remove_credential_id) {
      return NextResponse.json({ error: "No puedes quitarte una passkey a ti mismo desde el panel." }, { status: 400 });
    }
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.display_name === "string" && body.display_name.trim()) {
    patch.display_name = body.display_name.trim();
  }
  if (typeof body.email === "string") {
    patch.email = body.email.trim().toLowerCase() || null;
  }
  if (typeof body.is_active === "boolean") {
    patch.is_active = body.is_active;
  }
  if (typeof body.password === "string" && body.password) {
    if (body.password.length < 6) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres." }, { status: 400 });
    }
    patch.password_hash = await hashPasswordServer(body.password);
  }
  if (typeof body.remove_credential_id === "string" && body.remove_credential_id) {
    const { data: user } = await g.supabase
      .from("users")
      .select("webauthn_credentials")
      .eq("id", id)
      .single();
    const creds = (user?.webauthn_credentials as { id?: string }[] | null) ?? [];
    patch.webauthn_credentials = creds.filter((c) => c.id !== body.remove_credential_id);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No hay campos por actualizar." }, { status: 400 });
  }
  patch.updated_at = new Date().toISOString();

  const { data, error } = await g.supabase
    .from("users")
    .update(patch)
    .eq("id", id)
    .select("id, display_name, email, role, metadata, is_active, last_login_at, created_at, updated_at, webauthn_credentials")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Ya existe otro usuario con ese correo." }, { status: 409 });
    }
    console.error("[Admin] user update error:", error.message);
    return NextResponse.json({ error: "Error al actualizar el usuario." }, { status: 500 });
  }

  return NextResponse.json({ user: data });
}

export async function DELETE(req: NextRequest) {
  const g = await guard(req);
  if (!g.ok) {
    return g.reason === "local"
      ? NextResponse.json({ localFallback: true })
      : NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "id es obligatorio." }, { status: 400 });

  const currentUserId = await getCurrentUserId(req);
  if (id === currentUserId) {
    return NextResponse.json({ error: "No puedes eliminar tu propia cuenta desde el panel." }, { status: 400 });
  }

  // Optionally delete the user's owned data too.
  if (body.delete_data === true) {
    for (const table of ADMIN_OWNED_TABLES) {
      const { error } = await g.supabase.from(table).delete().eq("owner_id", id);
      if (error) console.error(`[Admin] cleanup ${table} error:`, error.message);
    }
  }

  // Remove tokens created by this user, then the user.
  await g.supabase.from("registration_tokens").delete().eq("created_by", id);
  const { error } = await g.supabase.from("users").delete().eq("id", id);
  if (error) {
    console.error("[Admin] user delete error:", error.message);
    return NextResponse.json({ error: "Error al eliminar el usuario." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
