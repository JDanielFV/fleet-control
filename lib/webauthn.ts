"use client";

/**
 * WebAuthn client-side helpers for passkey registration and login.
 * Uses the Web Authentication API (navigator.credentials).
 */

export interface WebAuthnRegistrationOptions {
  challenge: string;
  rpId: string;
  rpName: string;
  userId: string;
  userName: string;
  userDisplayName: string;
}

export interface WebAuthnLoginOptions {
  challenge: string;
  rpId: string;
  allowCredentials: { id: string; type: "public-key"; transports?: AuthenticatorTransport[] }[];
}

/**
 * Convert a base64url string to an ArrayBuffer.
 */
function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Convert an ArrayBuffer to a base64url string.
 */
function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Start WebAuthn registration (create a new passkey).
 * Returns the credential to send to the server for verification.
 */
export async function startRegistration(options: WebAuthnRegistrationOptions): Promise<{
  credentialId: string;
  clientDataJSON: string;
  attestationObject: string;
}> {
  const publicKey: PublicKeyCredentialCreationOptions = {
    challenge: base64urlToBuffer(options.challenge),
    rp: {
      id: options.rpId,
      name: options.rpName,
    },
    user: {
      id: base64urlToBuffer(options.userId),
      name: options.userName,
      displayName: options.userDisplayName,
    },
    pubKeyCredParams: [
      { type: "public-key", alg: -7 }, // ES256
      { type: "public-key", alg: -257 }, // RS256
    ],
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      residentKey: "required",
      userVerification: "required",
    },
    timeout: 60000,
  };

  const credential = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential;
  const response = credential.response as AuthenticatorAttestationResponse;

  return {
    credentialId: bufferToBase64url(credential.rawId),
    clientDataJSON: bufferToBase64url(response.clientDataJSON),
    attestationObject: bufferToBase64url(response.attestationObject),
  };
}

/**
 * Start WebAuthn login (authenticate with an existing passkey).
 * Returns the assertion to send to the server for verification.
 */
export async function startLogin(options: WebAuthnLoginOptions): Promise<{
  credentialId: string;
  clientDataJSON: string;
  authenticatorData: string;
  signature: string;
  userHandle: string;
}> {
  const publicKey: PublicKeyCredentialRequestOptions = {
    challenge: base64urlToBuffer(options.challenge),
    rpId: options.rpId,
    allowCredentials: options.allowCredentials.map((cred) => ({
      id: base64urlToBuffer(cred.id),
      type: "public-key" as PublicKeyCredentialType,
      transports: cred.transports as AuthenticatorTransport[],
    })),
    userVerification: "required",
    timeout: 60000,
  };

  const assertion = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential;
  const response = assertion.response as AuthenticatorAssertionResponse;

  return {
    credentialId: bufferToBase64url(assertion.rawId),
    clientDataJSON: bufferToBase64url(response.clientDataJSON),
    authenticatorData: bufferToBase64url(response.authenticatorData),
    signature: bufferToBase64url(response.signature),
    userHandle: response.userHandle ? bufferToBase64url(response.userHandle) : "",
  };
}

/**
 * Generate a random challenge (base64url encoded).
 */
export function generateChallenge(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bufferToBase64url(bytes.buffer);
}
