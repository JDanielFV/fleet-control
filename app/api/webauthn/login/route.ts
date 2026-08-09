import { NextRequest, NextResponse } from "next/server";
import { generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server";
import { createClient } from "@supabase/supabase-js";

const rpId = process.env.NEXT_PUBLIC_RP_ID || "localhost";
const expectedOrigin = process.env.NEXT_PUBLIC_RP_ORIGIN || "http://localhost:3000";

interface StoredCred {
  id: string;
  publicKey: string;
  counter: number;
  transports?: string[];
}

async function lookupUserByEmail(email: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return { supabase: null, user: null };
  const supabase = createClient(supabaseUrl, supabaseKey);
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

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // No Supabase → passkeys can't be verified server-side; signal the
      // client to fall back to password login.
      if (!supabaseUrl || !supabaseKey) {
        return NextResponse.json({ localFallback: true });
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

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

      // Fetch the stored credential
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      let storedCredential: StoredCred | null = null;

      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data: user } = await supabase.from("users").select("webauthn_credentials, display_name").eq("id", userId).single();
        if (user?.webauthn_credentials) {
          const creds: StoredCred[] = user.webauthn_credentials as StoredCred[];
          storedCredential = creds.find((c) => c.id === credential.id) || null;
        }
      }

      if (!storedCredential) {
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
        return NextResponse.json({ verified: false, error: "Authentication failed" }, { status: 400 });
      }

      // Clear cookies
      const response = NextResponse.json({ verified: true, userId });
      response.cookies.set("wa_login_challenge", "", { maxAge: 0, path: "/" });
      response.cookies.set("wa_login_userId", "", { maxAge: 0, path: "/" });

      // Update counter
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data: user } = await supabase.from("users").select("webauthn_credentials").eq("id", userId).single();
        if (user?.webauthn_credentials) {
          const creds: StoredCred[] = user.webauthn_credentials as StoredCred[];
          const idx = creds.findIndex((c) => c.id === storedCredential!.id);
          if (idx >= 0) {
            creds[idx].counter = verification.authenticationInfo.newCounter;
            await supabase.from("users").update({
              webauthn_credentials: creds,
              last_login_at: new Date().toISOString(),
            }).eq("id", userId);
          }
        }
      }

      return NextResponse.json({ verified: true, userId });
    }

    return NextResponse.json({ error: "Invalid step" }, { status: 400 });
  } catch (err: unknown) {
    console.error("WebAuthn login error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
