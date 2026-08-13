import { NextRequest, NextResponse } from "next/server";
import { generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server";
import { getServiceRoleClient } from "@/lib/admin-server";
import { setSessionCookie } from "@/lib/session-server";
import { signJwt } from "@/lib/jwt";
import {
  checkLoginRateLimit,
  recordLoginFailure,
  resetLoginRateLimit,
  getClientIp,
  loginRateLimitKey,
  LOGIN_LOCKED_MESSAGE,
} from "@/lib/rate-limit";

const rpId = process.env.NEXT_PUBLIC_RP_ID || "localhost";
const expectedOrigin = process.env.NEXT_PUBLIC_RP_ORIGIN || "http://localhost:3000";

interface StoredCred {
  id: string;
  publicKey: string;
  counter: number;
  transports?: string[];
}

async function lookupUserByEmail(email: string) {
  // Service-role client: RLS closes `users` to the anon key.
  const supabase = getServiceRoleClient();
  if (!supabase) return { supabase: null, user: null };
  // Escape LIKE wildcards so a crafted email can't match unrelated rows.
  const safeEmail = email.replace(/[\\%_]/g, (c: string) => "\\" + c);
  const { data: user, error } = await supabase
    .from("users")
    .select("id, display_name, email, role, webauthn_credentials, is_active")
    .ilike("email", safeEmail)
    .maybeSingle();
  if (error) {
    console.error("[WebAuthn] user lookup error:", error.message);
    return { supabase, user: null };
  }
  return { supabase, user };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { step, userId, credential, email } = body;

    if (step === "options") {
      // Look up the user by email (preferred) or by explicit userId.
      let resolvedUserId = typeof userId === "string" ? userId : "";
      let displayName = "";
      let role = "owner";
      let userCredentials: StoredCred[] = [];

      // No Supabase → passkeys can't be verified server-side; signal the
      // client to fall back to password login.
      const supabase = getServiceRoleClient();
      if (!supabase) {
        return NextResponse.json({ localFallback: true });
      }

      if (typeof email === "string" && email.trim()) {
        const { user } = await lookupUserByEmail(email.trim().toLowerCase());
        if (!user) {
          return NextResponse.json({ error: "No existe un usuario con ese correo." }, { status: 404 });
        }
        if (!user.is_active) {
          return NextResponse.json({ error: "Este usuario está inactivo." }, { status: 403 });
        }
        resolvedUserId = user.id;
        displayName = user.display_name;
        role = user.role || "owner";
        userCredentials = (user.webauthn_credentials as StoredCred[]) || [];
      } else {
        if (!resolvedUserId) {
          return NextResponse.json({ error: "email o userId son requeridos" }, { status: 400 });
        }
        const { data: user } = await supabase
          .from("users")
          .select("webauthn_credentials, display_name, role")
          .eq("id", resolvedUserId)
          .single();
        if (user) {
          displayName = user.display_name;
          role = user.role || "owner";
          userCredentials = (user.webauthn_credentials as StoredCred[]) || [];
        }
      }

      // No passkeys → tell the client to use password / register a passkey.
      if (userCredentials.length === 0) {
        return NextResponse.json({
          userId: resolvedUserId,
          displayName,
          role,
          hasPasskeys: false,
        });
      }

      const options = await generateAuthenticationOptions({
        rpID: rpId,
        allowCredentials: userCredentials.map((cred) => ({
          id: cred.id,
          type: "public-key" as const,
          transports: (cred.transports || ["internal"]) as AuthenticatorTransport[],
        })),
        userVerification: "required",
      });

      // Store challenge in cookie
      const isSecure = !!process.env.VERCEL_URL;
      const response = NextResponse.json({
        userId: resolvedUserId,
        displayName,
        role,
        hasPasskeys: true,
        options,
      });
      response.cookies.set("wa_login_challenge", options.challenge, {
        httpOnly: true,
        secure: isSecure,
        sameSite: "lax",
        path: "/",
        maxAge: 120,
      });
      response.cookies.set("wa_login_userId", resolvedUserId, {
        httpOnly: true,
        secure: isSecure,
        sameSite: "lax",
        path: "/",
        maxAge: 120,
      });
      return response;
    }

    if (step === "verify") {
      if (!userId || !credential) {
        return NextResponse.json({ error: "userId and credential are required" }, { status: 400 });
      }

      const storedChallenge = req.cookies.get("wa_login_challenge")?.value;
      const storedUserId = req.cookies.get("wa_login_userId")?.value;

      if (!storedChallenge || storedUserId !== userId) {
        return NextResponse.json({ error: "No login challenge found. Please refresh and try again." }, { status: 400 });
      }

      // Fetch the stored credential (service-role: RLS closes `users`).
      let storedCredential: StoredCred | null = null;
      let sessionUser: { display_name?: string; email?: string | null; role?: string } | null = null;
      const supabase = getServiceRoleClient();
      if (supabase) {
        const { data: user } = await supabase.from("users").select("webauthn_credentials, display_name, email, role").eq("id", userId).single();
        sessionUser = user ?? null;
        if (user?.webauthn_credentials) {
          const creds: StoredCred[] = user.webauthn_credentials as StoredCred[];
          storedCredential = creds.find((c) => c.id === credential.id) || null;
        }
      }

      // Rate limit by email+IP (same policy as password login): locked keys
      // can't even attempt verification, and failed verifications count
      // toward the lock. Skipped only in demo mode (no Supabase → no email).
      const rlEmail = sessionUser?.email?.trim().toLowerCase() || "";
      const rlKey = rlEmail ? loginRateLimitKey(rlEmail, getClientIp(req)) : null;
      const rl = rlKey ? checkLoginRateLimit(rlKey) : { allowed: true, retryAfterSeconds: 0 };
      if (rlKey && !rl.allowed) {
        return NextResponse.json(
          { error: LOGIN_LOCKED_MESSAGE },
          { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
        );
      }

      if (!storedCredential) {
        if (rlKey) recordLoginFailure(rlKey);
        return NextResponse.json({ error: "Credential not found" }, { status: 400 });
      }

      const verification = await verifyAuthenticationResponse({
        response: credential,
        expectedChallenge: storedChallenge,
        expectedOrigin,
        expectedRPID: rpId,
        credential: {
          id: storedCredential.id,
          publicKey: Buffer.from(storedCredential.publicKey, "base64url"),
          counter: storedCredential.counter,
          transports: (storedCredential.transports || ["internal"]) as AuthenticatorTransport[],
        },
      });

      if (!verification.verified) {
        if (rlKey) recordLoginFailure(rlKey);
        return NextResponse.json({ verified: false, error: "Authentication failed" }, { status: 400 });
      }

      // Successful verification clears the failure counter.
      if (rlKey) resetLoginRateLimit(rlKey);

      // Mint a session JWT: the passkey just verified, so the user is
      // authenticated and can talk to PostgREST as `authenticated`.
      let token: string | null = null;
      if (process.env.SUPABASE_JWT_SECRET) {
        try {
          token = await signJwt({ sub: userId });
        } catch (err: unknown) {
          console.warn("[WebAuthn] JWT signing failed:", err instanceof Error ? err.message : err);
        }
      }

      // Clear cookies + set the authoritative HttpOnly session cookie.
      const response = NextResponse.json({ verified: true, userId, token });
      await setSessionCookie(response, {
        userId,
        email: sessionUser?.email ?? null,
        displayName: sessionUser?.display_name ?? "",
        role: sessionUser?.role === "admin" ? "admin" : "owner",
      });
      response.cookies.set("wa_login_challenge", "", { maxAge: 0, path: "/" });
      response.cookies.set("wa_login_userId", "", { maxAge: 0, path: "/" });

      // Update counter
      const counterSupabase = getServiceRoleClient();
      if (counterSupabase) {
        const { data: user } = await counterSupabase.from("users").select("webauthn_credentials").eq("id", userId).single();
        if (user?.webauthn_credentials) {
          const creds: StoredCred[] = user.webauthn_credentials as StoredCred[];
          const idx = creds.findIndex((c) => c.id === storedCredential!.id);
          if (idx >= 0) {
            creds[idx].counter = verification.authenticationInfo.newCounter;
            await counterSupabase.from("users").update({
              webauthn_credentials: creds,
              last_login_at: new Date().toISOString(),
            }).eq("id", userId);
          }
        }
      }

      // ⚠️ Return the response built above: it carries the session cookie,
      // the bearer JWT and the challenge-cookie cleanup. Returning a fresh
      // NextResponse here used to discard all of them, logging the user out.
      return response;
    }

    return NextResponse.json({ error: "Invalid step" }, { status: 400 });
  } catch (err: unknown) {
    console.error("WebAuthn login error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
