/**
 * Local (demo-mode) registration-token storage.
 *
 * In production tokens are created and consumed server-side: GET
 * /api/auth/status (first-run setup token), POST /api/admin/tokens (admin
 * invitations) and POST /api/auth/register (validation + single-use
 * consumption). With RLS enabled the anon key can't touch
 * `registration_tokens` anymore, so this module only serves the no-Supabase
 * demo mode (localStorage).
 */

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
  const tokens: RegistrationToken[] = getLocalData<RegistrationToken>("registration_tokens", []);
  tokens.unshift(full);
  setLocalData("registration_tokens", tokens);
  return full;
}

export async function getRegistrationToken(token: string): Promise<RegistrationToken | null> {
  const tokens: RegistrationToken[] = getLocalData<RegistrationToken>("registration_tokens", []);
  return tokens.find((t) => t.token === token) || null;
}

export async function useRegistrationToken(tokenId: string): Promise<void> {
  const now = new Date().toISOString();
  const tokens: RegistrationToken[] = getLocalData<RegistrationToken>("registration_tokens", []);
  const t = tokens.find((t) => t.id === tokenId);
  if (t) t.used_at = now;
  setLocalData("registration_tokens", tokens);
}
