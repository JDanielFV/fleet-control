"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/db";
import { saveSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Shield, KeyRound, Copy, CheckCircle2 } from "lucide-react";
import UserForm from "@/features/auth/components/UserForm";
import PasskeyRegistrationDialog from "@/features/auth/components/PasskeyRegistrationDialog";

type AuthMode = "loading" | "login" | "register" | "token_ready" | "passkey_setup";

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>("loading");
  const [token, setToken] = useState<string>("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [newUser, setNewUser] = useState<{ id: string; display_name: string; email: string | null } | null>(null);

  useEffect(() => {
    (async () => {
      const count = await db.getUserCount();
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get("token");

      if (count === 0 && !urlToken) {
        const t = await db.createRegistrationToken(null);
        setToken(t.token);
        setMode("token_ready");
      } else if (urlToken) {
        const rt = await db.getRegistrationToken(urlToken);
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
    })();
  }, []);

  const handleRegisterSuccess = async (saved: { id: string; display_name: string; email: string | null; role: "admin" | "operator" }) => {
    if (token) {
      const rt = await db.getRegistrationToken(token);
      if (rt) await db.useRegistrationToken(rt.id);
    }
    // Save session so the user is logged in
    saveSession(saved.id, saved.email!, saved.display_name, saved.role);
    // Store user info and show passkey registration dialog
    setNewUser({ id: saved.id, display_name: saved.display_name, email: saved.email });
    setMode("passkey_setup");
  };

  const handlePasskeySuccess = () => {
    window.location.href = "/";
  };

  const handlePasskeySkip = () => {
    window.location.href = "/";
  };

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

      {/* Passkey registration after account creation */}
      {newUser && (
        <PasskeyRegistrationDialog
          open={mode === "passkey_setup"}
          onClose={handlePasskeySkip}
          userId={newUser.id}
          userName={newUser.email || newUser.id}
          userDisplayName={newUser.display_name}
          onSuccess={handlePasskeySuccess}
        />
      )}
    </div>
  );
}
