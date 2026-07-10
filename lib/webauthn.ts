"use client";

/**
 * Check if the browser supports WebAuthn (passkeys).
 */
export function isWebAuthnSupported(): boolean {
  return typeof window !== "undefined" && typeof navigator.credentials !== "undefined" && typeof PublicKeyCredential !== "undefined";
}

/**
 * Request a passkey authentication (simple gesture, no server verification).
 * Returns true if the user successfully authenticated with their passkey.
 * Falls back to a simple confirm() if WebAuthn is not supported.
 */
export async function requirePasskeyConfirmation(message: string): Promise<boolean> {
  if (!isWebAuthnSupported()) {
    return confirm(message);
  }

  try {
    // We use a simple challenge — just a random array
    const challenge = crypto.getRandomValues(new Uint8Array(32));

    const credential = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: window.location.hostname,
        allowCredentials: [], // Any passkey registered on this device
        userVerification: "required",
        timeout: 60000,
      },
    });

    return credential !== null;
  } catch (err) {
    console.warn("[WebAuthn] Passkey authentication failed or cancelled:", err);
    // Fall back to confirm dialog
    return confirm(message);
  }
}
