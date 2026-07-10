"use client";

import React, { useState, useEffect } from "react";
import { db, User } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Shield, Fingerprint, User as UserIcon, Plus } from "lucide-react";
import { motion } from "framer-motion";
import UserForm from "@/features/auth/components/UserForm";

interface LoginScreenProps {
  onLogin: (user: User) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    const list = await db.getUsers();
    setUsers(list);
    setIsLoading(false);
  };

  const handleLoginWithPasskey = async () => {
    if (!selectedUser) return;
    setError("");

    try {
      // Step 1: Get login options
      const optionsRes = await fetch("/api/webauthn/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "options", userId: selectedUser.id }),
      });

      if (!optionsRes.ok) {
        const err = await optionsRes.json();
        setError(err.error || "Error al iniciar login");
        return;
      }

      const options = await optionsRes.json();

      // Step 2: Get credential from authenticator
      const credential = await navigator.credentials.get({
        publicKey: options,
      }) as PublicKeyCredential;

      const response = credential.response as AuthenticatorAssertionResponse;

      // Step 3: Verify
      const verifyRes = await fetch("/api/webauthn/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "verify",
          userId: selectedUser.id,
          credential: {
            id: credential.id,
            rawId: arrayBufferToBase64url(credential.rawId),
            response: {
              clientDataJSON: arrayBufferToBase64url(response.clientDataJSON),
              authenticatorData: arrayBufferToBase64url(response.authenticatorData),
              signature: arrayBufferToBase64url(response.signature),
              userHandle: response.userHandle ? arrayBufferToBase64url(response.userHandle) : null,
            },
            type: "public-key",
          },
        }),
      });

      if (!verifyRes.ok) {
        const err = await verifyRes.json();
        setError(err.error || "Error al verificar passkey");
        return;
      }

      const result = await verifyRes.json();
      if (result.verified) {
        // Save session
        localStorage.setItem("fleet_session", JSON.stringify({
          userId: selectedUser.id,
          displayName: selectedUser.display_name,
          role: selectedUser.role,
          loginAt: new Date().toISOString(),
        }));
        onLogin(selectedUser);
      }
    } catch (err: any) {
      setError(err.message || "Error al autenticar");
    }
  };

  const handleRegisterPasskey = async () => {
    if (!selectedUser) return;
    setError("");
    setIsRegistering(true);

    try {
      // Step 1: Get registration options
      const optionsRes = await fetch("/api/webauthn/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "options",
          userId: selectedUser.id,
          userName: selectedUser.email || selectedUser.id,
          userDisplayName: selectedUser.display_name,
        }),
      });

      if (!optionsRes.ok) {
        const err = await optionsRes.json();
        setError(err.error || "Error al iniciar registro");
        setIsRegistering(false);
        return;
      }

      const options = await optionsRes.json();

      // Step 2: Create credential
      const credential = await navigator.credentials.create({
        publicKey: options,
      }) as PublicKeyCredential;

      const response = credential.response as AuthenticatorAttestationResponse;

      // Step 3: Verify
      const verifyRes = await fetch("/api/webauthn/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "verify",
          userId: selectedUser.id,
          credential: {
            id: credential.id,
            rawId: arrayBufferToBase64url(credential.rawId),
            response: {
              clientDataJSON: arrayBufferToBase64url(response.clientDataJSON),
              attestationObject: arrayBufferToBase64url(response.attestationObject),
            },
            type: "public-key",
          },
        }),
      });

      if (!verifyRes.ok) {
        const err = await verifyRes.json();
        setError(err.error || "Error al verificar passkey");
        setIsRegistering(false);
        return;
      }

      const result = await verifyRes.json();
      if (result.verified) {
        alert("✅ Passkey registrada exitosamente. Ahora puedes iniciar sesión.");
        // Auto-login
        localStorage.setItem("fleet_session", JSON.stringify({
          userId: selectedUser.id,
          displayName: selectedUser.display_name,
          role: selectedUser.role,
          loginAt: new Date().toISOString(),
        }));
        onLogin(selectedUser);
      }
    } catch (err: any) {
      setError(err.message || "Error al registrar passkey");
    }
    setIsRegistering(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen w-screen bg-background text-foreground p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-primary-glow mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">Fleet Control</h1>
          <p className="text-sm text-muted-foreground mt-1">Sistema de Control de Flotas</p>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Cargando...</div>
        ) : users.length === 0 ? (
          /* First run — no users registered: show the form inline */
          <div className="space-y-4">
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-center">
              <p className="text-sm font-semibold text-amber-600">No hay usuarios registrados</p>
              <p className="text-xs text-muted-foreground mt-1">Registra el primer administrador para comenzar.</p>
            </div>
            <UserForm
              onSuccess={(saved) => {
                // Auto-login after first user creation
                localStorage.setItem("fleet_session", JSON.stringify({
                  userId: saved.id,
                  displayName: saved.display_name,
                  role: "admin",
                  loginAt: new Date().toISOString(),
                }));
                onLogin({
                  id: saved.id,
                  display_name: saved.display_name,
                  email: saved.email,
                  role: "admin",
                  webauthn_credentials: [],
                  metadata: {},
                  is_active: true,
                  last_login_at: null,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                } as User);
              }}
              openPasskeyAfterSave={false}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {/* User selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Selecciona tu usuario
              </label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {users.filter(u => u.is_active).map((user) => (
                  <button
                    key={user.id}
                    onClick={() => setSelectedUser(user)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left cursor-pointer ${
                      selectedUser?.id === user.id
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border/60 bg-secondary/30 hover:bg-secondary/60 text-foreground"
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <UserIcon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-sm block truncate">{user.display_name}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {user.role === "admin" ? "Administrador" : "Operador"}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {selectedUser && (
              <div className="space-y-2">
                <Button
                  onClick={handleLoginWithPasskey}
                  className="w-full rounded-xl bg-primary text-white font-bold hover:bg-primary transition-all cursor-pointer h-12 text-sm"
                  disabled={isRegistering}
                >
                  <Fingerprint className="w-5 h-5 mr-2" />
                  Iniciar con passkey
                </Button>

                <Button
                  onClick={handleRegisterPasskey}
                  variant="outline"
                  className="w-full rounded-xl border-border text-foreground hover:bg-secondary/60 transition-all cursor-pointer h-11 text-sm"
                  disabled={isRegistering}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {isRegistering ? "Registrando..." : "Registrar nueva passkey"}
                </Button>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-500 font-semibold">
                {error}
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}

function arrayBufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
