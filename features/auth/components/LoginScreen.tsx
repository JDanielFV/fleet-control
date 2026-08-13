"use client";

import React, { useState } from "react";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { saveSession } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { db, User } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Fingerprint, Mail, Lock, AlertTriangle, KeyRound, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

interface LoginScreenProps {
  onLogin: (user: User) => void;
}

type Mode = "passkey" | "password";

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [mode, setMode] = useState<Mode>("passkey");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  // User resolved from the email (used to offer passkey registration).
  const [resolvedUser, setResolvedUser] = useState<{ userId: string; displayName: string; role: string } | null>(null);

  const finishLogin = (userId: string, userEmail: string, displayName: string, role: string, token: string | null = null) => {
    saveSession(userId, userEmail, displayName, role as "admin" | "owner", token);
    onLogin({
      id: userId,
      display_name: displayName,
      email: userEmail,
      role: (role as "admin" | "owner") || "owner",
      webauthn_credentials: [],
      metadata: {},
      is_active: true,
      last_login_at: new Date().toISOString(),
      created_at: "",
      updated_at: "",
    });
  };

  // --- Passkey flow: resolve the email and trigger the authenticator ---
  const handleContinueWithPasskey = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError("Ingresa tu correo para continuar.");
      return;
    }
    setError("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/webauthn/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "options", email: cleanEmail }),
      });

      // No Supabase configured → fall back to password login.
      if (res.status === 200) {
        const data = await res.json();
        if (data.localFallback) {
          setMode("password");
          setError("");
          return;
        }
        setResolvedUser({ userId: data.userId, displayName: data.displayName, role: data.role });

        if (data.hasPasskeys) {
          const credential = await startAuthentication({ optionsJSON: data.options });
          const verifyRes = await fetch("/api/webauthn/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ step: "verify", userId: data.userId, credential }),
          });
          const result = await verifyRes.json();
          if (!result.verified) {
            setError(result.error || "No se pudo verificar tu passkey.");
            return;
          }
          finishLogin(data.userId, cleanEmail, data.displayName, data.role, result.token ?? null);
        } else {
          // User exists but has no passkeys → use password or register one.
          setMode("password");
          setError("No tienes una passkey registrada en este dispositivo. Inicia con tu contraseña o registra una passkey.");
        }
      } else {
        const err = await res.json();
        setError(err.error || "No se encontró un usuario con ese correo.");
        setMode("password");
      }
    } catch (err: unknown) {
      console.error("Passkey login error:", err);
      setError(err instanceof Error ? err.message : "Error al autenticar con passkey.");
      setMode("password");
    } finally {
      setIsLoading(false);
    }
  };

  // --- Password login (server-side verification) ---
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError("Ingresa tu correo y contraseña.");
      return;
    }
    setError("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, password }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.localFallback) {
          // localStorage-only deployment: verify client-side against local users.
          const user = await db.getUserByEmail(cleanEmail);
          if (!user || !(await verifyPassword(password, user.password_hash)) || !user.is_active) {
            setError("Correo o contraseña incorrectos.");
            return;
          }
          finishLogin(user.id, user.email || cleanEmail, user.display_name, user.role);
          return;
        }
        finishLogin(data.userId, data.email || cleanEmail, data.displayName, data.role, data.token ?? null);
        return;
      }

      const err = await res.json();
      setError(err.error || "Correo o contraseña incorrectos.");
    } catch (err: unknown) {
      console.error("Password login error:", err);
      setError("Error al iniciar sesión. Intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- Register a passkey for the resolved user (no passkeys yet) ---
  const handleRegisterPasskey = async () => {
    if (!resolvedUser) return;
    setError("");
    setIsLoading(true);
    try {
      const optionsRes = await fetch("/api/webauthn/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "options",
          userId: resolvedUser.userId,
          userName: email.trim().toLowerCase(),
          userDisplayName: resolvedUser.displayName,
        }),
      });
      if (!optionsRes.ok) {
        const err = await optionsRes.json();
        setError(err.error || "Error al iniciar el registro de la passkey.");
        return;
      }
      const options = await optionsRes.json();
      const credential = await startRegistration({ optionsJSON: options });
      const verifyRes = await fetch("/api/webauthn/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "verify", userId: resolvedUser.userId, credential }),
      });
      const result = await verifyRes.json();
      if (!result.verified) {
        setError(result.error || "No se pudo verificar la passkey.");
        return;
      }
      finishLogin(resolvedUser.userId, email.trim().toLowerCase(), resolvedUser.displayName, resolvedUser.role, result.token ?? null);
    } catch (err: unknown) {
      console.error("Passkey registration error:", err);
      setError(err instanceof Error ? err.message : "Error al registrar la passkey.");
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError("");
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

        {/* Mode selector */}
        <div className="flex bg-muted/50 rounded-xl p-1 mb-5">
          <button
            type="button"
            onClick={() => switchMode("passkey")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              mode === "passkey" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
            }`}
          >
            <Fingerprint className="w-4 h-4" /> Passkey
          </button>
          <button
            type="button"
            onClick={() => switchMode("password")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              mode === "password" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
            }`}
          >
            <Lock className="w-4 h-4" /> Contraseña
          </button>
        </div>

        {mode === "passkey" ? (
          <form onSubmit={handleContinueWithPasskey} className="space-y-4">
            <div>
              <Label className="text-muted-foreground text-xs">Correo electrónico</Label>
              <div className="relative mt-1">
                <Mail className="w-4 h-4 text-muted-foreground/50 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ej. juan@ejemplo.com"
                  autoComplete="email"
                  className="border-input bg-background rounded-xl pl-10 h-12"
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-primary text-white font-bold hover:bg-primary/90 h-12 disabled:opacity-50"
            >
              {isLoading ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Verificando…</>
              ) : (
                <><Fingerprint className="w-5 h-5 mr-2" /> Continuar</>
              )}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
              Si tu usuario tiene una passkey registrada, se abrirá automáticamente la verificación con tu huella o rostro.
            </p>
          </form>
        ) : (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <Label className="text-muted-foreground text-xs">Correo electrónico</Label>
              <div className="relative mt-1">
                <Mail className="w-4 h-4 text-muted-foreground/50 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ej. juan@ejemplo.com"
                  autoComplete="email"
                  className="border-input bg-background rounded-xl pl-10 h-12"
                />
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Contraseña</Label>
              <div className="relative mt-1">
                <Lock className="w-4 h-4 text-muted-foreground/50 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tu contraseña"
                  autoComplete="current-password"
                  className="border-input bg-background rounded-xl pl-10 h-12"
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-primary text-white font-bold hover:bg-primary/90 h-12 disabled:opacity-50"
            >
              {isLoading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Verificando…</> : <>Iniciar sesión</>}
            </Button>

            {resolvedUser && (
              <Button
                type="button"
                variant="outline"
                onClick={handleRegisterPasskey}
                disabled={isLoading}
                className="w-full rounded-xl border-border h-11 text-xs"
              >
                <KeyRound className="w-3.5 h-3.5 mr-1.5" /> Registrar passkey para este usuario
              </Button>
            )}
          </form>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-500 font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </motion.div>
    </div>
  );
}
