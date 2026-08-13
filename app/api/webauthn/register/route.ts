import { NextRequest, NextResponse } from "next/server";
import { generateRegistrationOptions, verifyRegistrationResponse } from "@simplewebauthn/server";
import { getServiceRoleClient } from "@/lib/admin-server";
import { setSessionCookie } from "@/lib/session-server";
import { signJwt } from "@/lib/jwt";

const rpName = "Fleet Control";
const rpId = process.env.NEXT_PUBLIC_RP_ID || "localhost";
const expectedOrigin = process.env.NEXT_PUBLIC_RP_ORIGIN || "http://localhost:3000";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { step, userId, userName, userDisplayName } = body;

    if (step === "options") {
      if (!userId || !userName) {
        return NextResponse.json({ error: "userId and userName are required" }, { status: 400 });
      }

      // Service-role client: RLS closes `users` to the anon key.
      let existingCredentials: { id: string }[] = [];
      const supabase = getServiceRoleClient();
      if (supabase) {
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
      const isSecure = !!process.env.VERCEL_URL;
      const response = NextResponse.json(options);
      response.cookies.set("wa_reg_challenge", options.challenge, {
        httpOnly: true,
        secure: isSecure,
        sameSite: "lax",
        path: "/",
        maxAge: 120, // 2 minutes
      });
      response.cookies.set("wa_reg_userId", userId, {
        httpOnly: true,
        secure: isSecure,
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

      // Save credential to Supabase (service-role: RLS closes `users`).
      let user: { display_name?: string; email?: string | null; role?: string } | null = null;
      const supabase = getServiceRoleClient();
      if (supabase) {
        const { data: u } = await supabase
          .from("users")
          .select("webauthn_credentials, display_name, email, role")
          .eq("id", userId)
          .single();
        user = u ?? null;
        const existing = (u?.webauthn_credentials as Record<string, unknown>[] | null) || [];
        await supabase.from("users").update({
          webauthn_credentials: [...existing, newCred],
        }).eq("id", userId);
      }

      // Mint a session JWT: the user just proved possession of the new
      // credential, so treat this as an authenticated login event.
      let token: string | null = null;
      if (process.env.SUPABASE_JWT_SECRET) {
        try {
          token = await signJwt({ sub: userId });
        } catch (err: unknown) {
          console.warn("[WebAuthn] JWT signing failed:", err instanceof Error ? err.message : err);
        }
      }

      // Clear cookies + set the authoritative HttpOnly session cookie.
      const response = NextResponse.json({ verified: true, credential: newCred, token });
      await setSessionCookie(response, {
        userId,
        email: user?.email ?? null,
        displayName: user?.display_name ?? "",
        role: user?.role === "admin" ? "admin" : "owner",
      });
      response.cookies.set("wa_reg_challenge", "", { maxAge: 0, path: "/" });
      response.cookies.set("wa_reg_userId", "", { maxAge: 0, path: "/" });
      return response;
    }

    return NextResponse.json({ error: "Invalid step" }, { status: 400 });
  } catch (err: unknown) {
    console.error("WebAuthn register error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
