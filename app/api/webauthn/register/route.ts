import { NextRequest, NextResponse } from "next/server";
import { generateRegistrationOptions, verifyRegistrationResponse } from "@simplewebauthn/server";
import { createClient } from "@supabase/supabase-js";

const rpName = "Fleet Control";
const rpId = process.env.VERCEL_URL
  ? new URL(`https://${process.env.VERCEL_URL}`).hostname
  : "localhost";

const expectedOrigin = process.env.VERCEL_URL
  ? `https://${new URL(`https://${process.env.VERCEL_URL}`).hostname}`
  : "http://localhost:3000";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { step, userId, userName, userDisplayName } = body;

    if (step === "options") {
      if (!userId || !userName) {
        return NextResponse.json({ error: "userId and userName are required" }, { status: 400 });
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      let existingCredentials: { id: string }[] = [];

      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data: user } = await supabase.from("users").select("webauthn_credentials").eq("id", userId).single();
        if (user?.webauthn_credentials) {
          existingCredentials = (user.webauthn_credentials as { id: string }[]).map((c) => ({ id: c.id }));
        }
      }

      const options = await generateRegistrationOptions({
        rpName,
        rpID: rpId,
        userName,
        userDisplayName: userDisplayName || userName,
        attestationType: "none",
        excludeCredentials: existingCredentials.map((cred) => ({
          id: cred.id,
          type: "public-key" as const,
          transports: ["internal" as const],
        })),
        authenticatorSelection: {
          residentKey: "required",
          userVerification: "required",
        },
      });

      // Store challenge in a cookie so it survives serverless cold starts
      const response = NextResponse.json(options);
      response.cookies.set("wa_reg_challenge", options.challenge, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 120, // 2 minutes
      });
      response.cookies.set("wa_reg_userId", userId, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 120,
      });
      return response;
    }

    if (step === "verify") {
      if (!userId || !body.credential) {
        return NextResponse.json({ error: "userId and credential are required" }, { status: 400 });
      }

      // Read challenge from cookie
      const storedChallenge = req.cookies.get("wa_reg_challenge")?.value;
      const storedUserId = req.cookies.get("wa_reg_userId")?.value;

      if (!storedChallenge || storedUserId !== userId) {
        return NextResponse.json({ error: "No registration challenge found. Please refresh and try again." }, { status: 400 });
      }

      const verification = await verifyRegistrationResponse({
        response: body.credential,
        expectedChallenge: storedChallenge,
        expectedOrigin,
        expectedRPID: rpId,
      });

      if (!verification.verified || !verification.registrationInfo) {
        return NextResponse.json({ verified: false, error: "Verification failed" }, { status: 400 });
      }

      const { credential: regCred } = verification.registrationInfo;

      const newCred = {
        id: regCred.id,
        publicKey: Buffer.from(regCred.publicKey).toString("base64url"),
        counter: regCred.counter,
        transports: regCred.transports || ["internal"],
        createdAt: new Date().toISOString(),
      };

      // Save credential to Supabase
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data: user } = await supabase.from("users").select("webauthn_credentials").eq("id", userId).single();
        const existing = (user?.webauthn_credentials as any[]) || [];
        await supabase.from("users").update({
          webauthn_credentials: [...existing, newCred],
        }).eq("id", userId);
      }

      // Clear cookies
      const response = NextResponse.json({ verified: true, credential: newCred });
      response.cookies.set("wa_reg_challenge", "", { maxAge: 0, path: "/" });
      response.cookies.set("wa_reg_userId", "", { maxAge: 0, path: "/" });
      return response;
    }

    return NextResponse.json({ error: "Invalid step" }, { status: 400 });
  } catch (err: any) {
    console.error("WebAuthn register error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
