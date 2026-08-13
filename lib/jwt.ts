/**
 * Custom JWT minting for Supabase PostgREST.
 *
 * The app runs its own authentication (password + WebAuthn passkeys against
 * the `users` table) instead of Supabase Auth. To make RLS policies using
 * `auth.uid()` work, we sign a JWT with the project's `SUPABASE_JWT_SECRET`
 * containing `role: "authenticated"` and `sub: <user_id>`. PostgREST accepts
 * these tokens and resolves `auth.uid()` to `sub`.
 *
 * Server-only: never import this module from client code.
 */

const encoder = new TextEncoder();

function b64url(input: string | ArrayBuffer): string {
  const bytes =
    typeof input === "string" ? encoder.encode(input) : new Uint8Array(input);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(input: string): Uint8Array<ArrayBuffer> {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

export interface JwtPayload {
  sub: string; // user id — becomes auth.uid() in RLS
  email?: string;
  [claim: string]: unknown; // extra claims (e.g. session cookie: display_name, app_role)
}

/**
 * Sign a JWT for the given user. Expires in 24h by default.
 * Throws when SUPABASE_JWT_SECRET is not defined — callers must handle it
 * (e.g. degrade gracefully while the env var isn't configured).
 */
export async function signJwt(payload: JwtPayload, expiresInSec = 86400): Promise<string> {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    throw new Error("SUPABASE_JWT_SECRET is not defined — cannot sign session JWT");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const body = {
    iss: "fleet-control",
    role: "authenticated",
    iat: now,
    exp: now + expiresInSec,
    ...payload,
  };

  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(body))}`;
  const key = await getHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(signingInput));
  return `${signingInput}.${b64url(signature)}`;
}

/**
 * Verify a JWT's HS256 signature and expiry. Returns the payload, or null
 * when the token is malformed, tampered with, expired or the secret isn't
 * configured. Used to validate the HttpOnly session cookie server-side.
 */
export async function verifyJwt(token: string): Promise<JwtPayload | null> {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = parts;
  if (!headerB64 || !payloadB64 || !signatureB64) return null;

  try {
    const key = await getHmacKey(secret);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      b64urlDecode(signatureB64),
      encoder.encode(`${headerB64}.${payloadB64}`)
    );
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64))) as JwtPayload & { exp?: number };
    if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) return null;
    if (typeof payload.sub !== "string" || !payload.sub) return null;
    return payload;
  } catch {
    return null;
  }
}
