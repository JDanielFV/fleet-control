import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session-server";
import { getServiceRoleClient } from "@/lib/admin-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/doc?path={storagePath}
 *
 * Serve a document from the private `documentos` bucket to the browser:
 * validates the HttpOnly session cookie, checks the requested path belongs
 * to the caller's own owner folder, and redirects (307) to a short-lived
 * signed URL. The bucket stays private — clients never touch it directly.
 */
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const path = req.nextUrl.searchParams.get("path");
  if (!path || !path.startsWith(`${session.userId}/`)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const supabase = getServiceRoleClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Almacenamiento no configurado" },
      { status: 503 }
    );
  }

  const { data, error } = await supabase.storage
    .from("documentos")
    .createSignedUrl(path, 60);

  if (error || !data) {
    return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  }

  return NextResponse.redirect(data.signedUrl, { status: 307 });
}
