"use client";

import React, { useState, useEffect, useRef } from "react";
import { } from "@/lib/db";
import { getUserCount } from "@/lib/db/users";
import { createRegistrationToken, getRegistrationToken } from "@/lib/db/tokens";
import { getSession, saveSession, syncSessionFromServer } from "@/lib/auth";
import { Shield, KeyRound, Copy, CheckCircle2 } from "lucide-react";
import UserForm from "@/features/auth/components/UserForm";
import PasskeyRegistrationDialog from "@/features/auth/components/PasskeyRegistrationDialog";
import LoginScreen from "@/features/auth/components/LoginScreen";

type AuthMode = "loading" | "login" | "register" | "token_ready" | "passkey_setup";

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>("loading");
  const [token, setToken] = useState<string>("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [newUser, setNewUser] = useState<{ id: string; display_name: string; email: string | null } | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    // Only run once on mount
    if (initialized.current) return;
    initialized.current = true;

    (async () => {
      // If already logged in, go straight to dashboard
      const existingSession = getSession();
      if (existingSession) {
        window.location.href = "/";
        return;
      }
      // The HttpOnly cookie is authoritative: a valid cookie without a local
      // mirror (e.g. localStorage was cleared) means the user IS logged in.
      const synced = await syncSessionFromServer();
      if (synced) {
        window.location.href = "/";
        return;
      }

      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get("token");

      // User count + first-run setup token, resolved server-side (RLS keeps
      // the anon key away from `users`/`registration_tokens`).
      const statusRes = await fetch("/api/auth/status").catch(() => null);
      const status = statusRes ? await statusRes.json().catch(() => ({})) : {};

      if (status.localFallback) {
        // No Supabase configured → localStorage demo mode.
        const count = await getUserCount();
        if (count === 0 && !urlToken) {
          const t = await createRegistrationToken(null);
          setToken(t.token);
          setMode("token_ready");
        } else if (urlToken) {
          const rt = await getRegistrationToken(urlToken);
          if (!rt || rt.used_at || new Date(rt.expires_at) < new Date()) {
            setError("Token inválido, usado o expirado.");
            setMode("login");
          } else {
            setToken(urlToken);
            setMode("register");
          }
        } else {
          setMode("login");
        }
        return;
      }

      if (status.userCount === 0 && !urlToken) {
        // First run: show the setup link + form with the server-side token.
        setToken(status.setupToken || "");
        setMode("token_ready");
      } else if (urlToken) {
        // Validate the invitation token server-side before showing the form.
        const vRes = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ step: "validate", token: urlToken }),
        }).catch(() => null);
        const v = vRes ? await vRes.json().catch(() => ({})) : {};
        if (v.valid === true) {
          setToken(urlToken);
          setMode("register");
        } else {
          setError(v.error || "Token inválido, usado o expirado.");
          setMode("login");
        }
      } else {
        setMode("login");
      }
    })();
  }, []);

  const handleRegisterSuccess = (saved: {
    id: string;
    display_name: string;
    email: string | null;
    role: "admin" | "owner";
    token?: string | null;
  }) => {
    // The invitation token is consumed server-side by /api/auth/register
    // (or locally by UserForm in demo mode) — nothing to do here.
    // Save session so the user is logged in after passkey setup
    saveSession(saved.id, saved.email!, saved.display_name, saved.role, saved.token ?? null);
    // Store user info and show passkey registration dialog
    setNewUser({ id: saved.id, display_name: saved.display_name, email: saved.email });
    setMode("passkey_setup");
  };

  const handlePasskeySuccess = () => {
    window.location.href = "/";
  };

  const handlePasskeySkip = () => {
    // Don't skip — passkey is required
  };

  // Show LoginScreen when there are existing users
  if (mode === "login") {
    return <LoginScreen onLogin={() => { window.location.href = "/"; }} />;
  }

  return (
    <div className="flex items-center justify-center min-h-screen w-screen bg-background text-foreground p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-primary-glow mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">Fleet Control</h1>
          <p className="text-sm text-muted-foreground mt-1">Sistema de Control de Flotas</p>
        </div>

        {mode === "loading" && (
          <div className="text-center py-8 text-muted-foreground">Cargando...</div>
        )}

        {mode === "token_ready" && (
          <div className="space-y-4">
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold text-primary uppercase tracking-wider">Token de registro generado</span>
              </div>
              <p className="text-xs text-muted-foreground">
                No hay usuarios registrados. Comparte este enlace con el administrador para que cree su cuenta:
              </p>
              <div className="flex items-center gap-2 bg-background border border-border rounded-xl px-3 py-2">
                <code className="flex-1 text-[11px] font-mono text-foreground truncate">
                  {window.location.origin}/?token={token}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/?token=${token}`);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="p-1.5 rounded-md hover:bg-secondary transition-colors cursor-pointer shrink-0"
                >
                  {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                </button>
              </div>
            </div>

            <UserForm
              showPassword
              submitLabel="Crear cuenta"
              role="admin"
              registrationToken={token}
              onSuccess={handleRegisterSuccess}
            />
          </div>
        )}

        {mode === "register" && (
          <div className="space-y-4">
            <p className="text-sm text-center text-muted-foreground">
              Registra tu cuenta para acceder al sistema.
            </p>
            <UserForm
              showPassword
              submitLabel="Crear cuenta"
              registrationToken={token}
              onSuccess={handleRegisterSuccess}
            />
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-500 font-semibold text-center">
            {error}
          </div>
        )}
      </div>

      {/* Passkey registration after account creation — rendered outside the main container so it overlays everything */}
      {newUser && (
        <PasskeyRegistrationDialog
          open={mode === "passkey_setup"}
          onClose={handlePasskeySkip}
          userId={newUser.id}
          userName={newUser.email || newUser.id}
          userDisplayName={newUser.display_name}
          onSuccess={handlePasskeySuccess}
          required
        />
      )}
    </div>
  );
}
