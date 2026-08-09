import { NextRequest, NextResponse } from "next/server";
import { requireSystemAdmin, ADMIN_OWNED_TABLES, isOwnedTable } from "@/lib/admin-server";

/**
 * External admin panel — data audit & manual correction.
 *
 * GET  → dump of every owned table (light columns) + users, so the panel can
 *        compute per-user counts and orphan records (owner_id null or pointing
 *        to a missing user).
 * POST → actions: "reassign" (change owner of records), "delete" (remove
 *        orphaned records), "transfer_all" (move all of a user's data to
 *        another user).
 */

// Light columns per table — enough to identify a record without hauling
// base64 images around.
const TABLE_COLUMNS: Record<string, string> = {
  drivers: "id, owner_id, first_name, paternal_last_name",
  vehicles: "id, owner_id, brand, vehicle_name, plate_number",
  assignments: "id, owner_id, vehicle_id, driver_id, created_at",
  checklists: "id, owner_id, vehicle_id, type, created_at",
  weekly_rentals: "id, owner_id, driver_id, week_start",
  maintenances: "id, owner_id, vehicle_id, description, maintenance_date",
  renewal_logs: "id, owner_id, vehicle_id, type",
  vehicle_inventories: "id, owner_id, vehicle_id",
};

async function guard(req: NextRequest) {
  return requireSystemAdmin(req.headers.get("x-admin-user-id"));
}

export async function GET(req: NextRequest) {
  const g = await guard(req);
  if (!g.ok) {
    return g.reason === "local"
      ? NextResponse.json({ localFallback: true })
      : NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { data: users, error: usersError } = await g.supabase
    .from("users")
    .select("id, display_name, email, is_active, created_at")
    .order("created_at", { ascending: true });
  if (usersError) {
    console.error("[Admin] audit users error:", usersError.message);
    return NextResponse.json({ error: "Error al consultar la auditoría." }, { status: 500 });
  }

  const tables: { table: string; rows: Record<string, unknown>[] }[] = [];
  for (const table of ADMIN_OWNED_TABLES) {
    const { data, error } = await g.supabase.from(table).select(TABLE_COLUMNS[table]);
    if (error) {
      console.error(`[Admin] audit ${table} error:`, error.message);
      return NextResponse.json({ error: `Error al consultar ${table}.` }, { status: 500 });
    }
    tables.push({ table, rows: (data as unknown as Record<string, unknown>[] | null) ?? [] });
  }

  return NextResponse.json({ users: users ?? [], tables });
}

export async function POST(req: NextRequest) {
  const g = await guard(req);
  if (!g.ok) {
    return g.reason === "local"
      ? NextResponse.json({ localFallback: true })
      : NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action as string;

  // --- Reassign specific records to another owner ---
  if (action === "reassign") {
    const table = body.table as string;
    const ids: unknown = body.ids;
    const toOwnerId = body.to_owner_id as string;
    if (!isOwnedTable(table) || !Array.isArray(ids) || ids.length === 0 || !toOwnerId) {
      return NextResponse.json({ error: "Parámetros inválidos." }, { status: 400 });
    }
    const { error } = await g.supabase
      .from(table)
      .update({ owner_id: toOwnerId })
      .in("id", ids as string[]);
    if (error) {
      console.error("[Admin] reassign error:", error.message);
      return NextResponse.json({ error: "Error al reasignar registros." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // --- Delete records (typically orphans) ---
  if (action === "delete") {
    const table = body.table as string;
    const ids: unknown = body.ids;
    if (!isOwnedTable(table) || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Parámetros inválidos." }, { status: 400 });
    }
    const { error } = await g.supabase.from(table).delete().in("id", ids as string[]);
    if (error) {
      console.error("[Admin] delete records error:", error.message);
      return NextResponse.json({ error: "Error al eliminar registros." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // --- Transfer every record of one user to another user ---
  if (action === "transfer_all") {
    const fromOwnerId = body.from_owner_id as string;
    const toOwnerId = body.to_owner_id as string;
    if (!fromOwnerId || !toOwnerId) {
      return NextResponse.json({ error: "Parámetros inválidos." }, { status: 400 });
    }
    for (const table of ADMIN_OWNED_TABLES) {
      const { error } = await g.supabase
        .from(table)
        .update({ owner_id: toOwnerId })
        .eq("owner_id", fromOwnerId);
      if (error) {
        console.error(`[Admin] transfer_all ${table} error:`, error.message);
        return NextResponse.json({ error: `Error al transferir ${table}.` }, { status: 500 });
      }
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
}
