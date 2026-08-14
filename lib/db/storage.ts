import { getSupabase } from "./index";
import { genId } from "./utils";
import { getOwnerId } from "@/lib/session";

/**
 * Upload a base64 data URL to Supabase Storage bucket "documentos" under the
 * current owner's folder (`{ownerId}/{prefix}_{id}.ext`). The bucket is
 * private and RLS only allows the owner to touch objects under their own
 * folder (see migration 20260813000010_secure_document_storage.sql).
 *
 * Returns the **storage path** (not a public URL) so the bucket stays
 * private; renderers resolve it through `resolveDocUrl()` which produces a
 * short-lived signed URL via GET /api/doc.
 *
 * Falls back to returning the raw data URL if Supabase is not configured or
 * there is no session (local mode).
 */
export async function uploadDocumentImage(
  dataUrl: string,
  prefix: string
): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) return dataUrl;

  // Already a path/URL (not a data URL): return as-is.
  if (!dataUrl.startsWith("data:")) return dataUrl;

  const ownerId = getOwnerId();
  if (!ownerId) return dataUrl;

  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();

    const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
    const path = `${ownerId}/${prefix}_${genId()}.${ext}`;

    const { error } = await supabase.storage.from("documentos").upload(path, blob, {
      contentType: blob.type,
      upsert: false,
    });

    if (error) {
      console.error("[Storage] Upload error:", error.message);
      return dataUrl;
    }

    return path;
  } catch (err) {
    console.error("[Storage] Upload failed:", err);
    return dataUrl;
  }
}

/**
 * Delete a document image from Supabase Storage. Accepts a bare storage path
 * (current format), a legacy public URL, or a /api/doc link. No-op for data
 * URLs and when Supabase is not configured.
 */
export async function deleteDocumentImage(url: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !url || url.startsWith("data:")) return;

  try {
    let path = url;

    // /api/doc?path=... → extract the encoded path
    const docMatch = url.match(/\/api\/doc\?path=([^&]+)/);
    if (docMatch) {
      path = decodeURIComponent(docMatch[1]);
    } else if (url.startsWith("http")) {
      // Legacy public URL → strip the bucket base URL
      const baseUrl = supabase.storage.from("documentos").getPublicUrl("").data.publicUrl.replace(/\/$/, "");
      if (url.startsWith(baseUrl + "/")) {
        path = url.replace(baseUrl + "/", "");
      } else {
        return; // unrelated URL, leave it alone
      }
    }

    if (path && !path.startsWith("http")) {
      await supabase.storage.from("documentos").remove([path]);
    }
  } catch (err) {
    console.error("[Storage] Delete error:", err);
  }
}

/**
 * Resolve a stored document value for rendering:
 * - data URL → as-is (local mode)
 * - http(s) URL → as-is (legacy public URL, pre-migration data)
 * - bare storage path → GET /api/doc which checks the session and redirects
 *   to a short-lived signed URL (private bucket)
 */
export function resolveDocUrl(urlOrPath: string | null | undefined): string {
  if (!urlOrPath || urlOrPath.startsWith("data:")) return urlOrPath ?? "";
  if (urlOrPath.startsWith("http")) return urlOrPath;
  if (urlOrPath.startsWith("/api/doc?")) return urlOrPath;
  return `/api/doc?path=${encodeURIComponent(urlOrPath)}`;
}
