import { NextRequest, NextResponse } from "next/server";
import { generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server";
import { createClient } from "@supabase/supabase-js";

const rpId = process.env.VERCEL_URL
  ? new URL(`https://${process.env.VERCEL_URL}`).hostname
  : "localhost";

const expectedOrigin = process.env.VERCEL_URL
  ? `https://${new URL(`https://${process.env.VERCEL_URL}`).hostname}`
  : "http://localhost:3000";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { step, userId, credential } = body;

    if (step === "options") {
      if (!userId) {
        return NextResponse.json({ error: "userId is required" }, { status: 400 });
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      let userCredentials: { id: string; publicKey: string; counter: number; transports?: string[] }[] = [];

      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data: user } = await supabase.from("users").select("webauthn_credentials, display_name").eq("id", userId).single();
        if (user?.webauthn_credentials) {
          userCredentials = user.webauthn_credentials as any[];
        }
      }

      if (userCredentials.length === 0) {
        return NextResponse.json({ error: "No passkeys registered for this user" }, { status: 400 });
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
      const response = NextResponse.json(options);
      response.cookies.set("wa_login_challenge", options.challenge, {
        httpOnly: true,
        secure: isSecure,
        sameSite: "lax",
        path: "/",
        maxAge: 120,
      });
      response.cookies.set("wa_login_userId", userId, {
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
      let storedCredential: any = null;

      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data: user } = await supabase.from("users").select("webauthn_credentials, display_name").eq("id", userId).single();
        if (user?.webauthn_credentials) {
          const creds: any[] = user.webauthn_credentials as any[];
          storedCredential = creds.find((c) => c.id === credential.id);
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
          transports: storedCredential.transports || ["internal"],
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
          const creds: any[] = user.webauthn_credentials as any[];
          const idx = creds.findIndex((c) => c.id === storedCredential.id);
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
  } catch (err: any) {
    console.error("WebAuthn login error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
