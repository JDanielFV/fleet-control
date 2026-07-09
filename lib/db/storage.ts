import { supabase } from "./index";
import { genId } from "./utils";

/**
 * Upload a base64 data URL to Supabase Storage bucket "documentos".
 * Falls back to returning the raw data URL if Supabase is not configured.
 *
 * @param dataUrl - A base64 data URL string (e.g. "data:image/jpeg;base64,...")
 * @param prefix - A logical prefix for the file name (e.g. "ine", "license", "circulation")
 * @returns The public URL of the uploaded file, or the raw data URL as fallback.
 */
export async function uploadDocumentImage(
  dataUrl: string,
  prefix: string
): Promise<string> {
  // If no Supabase, store base64 inline (current behaviour)
  if (!supabase) return dataUrl;

  // If it's already a URL (not a data URL), return as-is
  if (!dataUrl.startsWith("data:")) return dataUrl;

  try {
    // Convert base64 data URL to a Blob
    const res = await fetch(dataUrl);
    const blob = await res.blob();

    const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
    const fileName = `${prefix}_${genId()}.${ext}`;

    const { data, error } = await supabase.storage
      .from("documentos")
      .upload(fileName, blob, {
        contentType: blob.type,
        upsert: false,
      });

    if (error) {
      console.error("[Storage] Upload error:", error.message);
      // Fall back to inline base64
      return dataUrl;
    }

    // Get the public URL
    const { data: publicUrlData } = supabase.storage
      .from("documentos")
      .getPublicUrl(data.path);

    console.log(`[Storage] Uploaded ${prefix} → ${publicUrlData.publicUrl}`);
    return publicUrlData.publicUrl;
  } catch (err) {
    console.error("[Storage] Upload failed:", err);
    return dataUrl;
  }
}

/**
 * Delete a document image from Supabase Storage.
 * No-op if the URL is a data URL (inline base64) or Supabase is not configured.
 */
export async function deleteDocumentImage(url: string): Promise<void> {
  if (!supabase || url.startsWith("data:")) return;

  try {
    // Extract the path from the public URL
    const storageUrl = supabase.storage.from("documentos").getPublicUrl("").data.publicUrl;
    const baseUrl = storageUrl.replace(/\/$/, "");
    const path = url.replace(baseUrl + "/", "");

    if (path) {
      await supabase.storage.from("documentos").remove([path]);
      console.log(`[Storage] Deleted ${path}`);
    }
  } catch (err) {
    console.error("[Storage] Delete error:", err);
  }
}
