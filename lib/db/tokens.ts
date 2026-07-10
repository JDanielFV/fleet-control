import { supabase } from "./index";
import type { RegistrationToken } from "./types";
import { getLocalData, setLocalData } from "./localStorage";
import { genId } from "./utils";

export async function createRegistrationToken(createdBy: string | null): Promise<RegistrationToken> {
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const full: RegistrationToken = {
    id: genId(),
    token,
    created_by: createdBy,
    used_at: null,
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    created_at: new Date().toISOString(),
  };
  if (supabase) {
    const { data, error } = await supabase.from("registration_tokens").insert(full).select().single();
    if (!error && data) return data as RegistrationToken;
    if (error) console.error("Supabase createRegistrationToken error:", error.message);
  }
  const tokens: RegistrationToken[] = getLocalData<RegistrationToken>("registration_tokens", []);
  tokens.unshift(full);
  setLocalData("registration_tokens", tokens);
  return full;
}

export async function getRegistrationToken(token: string): Promise<RegistrationToken | null> {
  if (supabase) {
    const { data, error } = await supabase
      .from("registration_tokens")
      .select("*")
      .eq("token", token)
      .maybeSingle();
    if (!error && data) return data as RegistrationToken;
  }
  const tokens: RegistrationToken[] = getLocalData<RegistrationToken>("registration_tokens", []);
  return tokens.find((t) => t.token === token) || null;
}

export async function useRegistrationToken(tokenId: string): Promise<void> {
  const now = new Date().toISOString();
  if (supabase) {
    await supabase.from("registration_tokens").update({ used_at: now }).eq("id", tokenId);
    return;
  }
  const tokens: RegistrationToken[] = getLocalData<RegistrationToken>("registration_tokens", []);
  const t = tokens.find((t) => t.id === tokenId);
  if (t) t.used_at = now;
  setLocalData("registration_tokens", tokens);
}
