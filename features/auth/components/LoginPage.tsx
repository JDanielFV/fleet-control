"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/db";
import { hashPassword, saveSession, generateToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, UserPlus, LogIn, KeyRound, Copy, CheckCircle2 } from "lucide-react";

type AuthMode = "loading" | "login" | "register" | "token_ready";

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>("loading");
  const [token, setToken] = useState<string>("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const count = await db.getUserCount();
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get("token");

      if (count === 0 && !urlToken) {
        // No users and no token → generate one automatically
        const t = await db.createRegistrationToken(null);
        setToken(t.token);
        setMode("token_ready");
      } else if (urlToken) {
        // Token in URL → show registration
        const rt = await db.getRegistrationToken(urlToken);
        if (!rt || rt.used_at || new Date(rt.expires_at) < new Date()) {
          setError("Token inválido, usado o expirado.");
          setMode("login");
        } else {
          setToken(urlToken);
          setMode("register");
        }
      } else {
        // Users exist, no token → show login
        setMode("login");
      }
    })();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!displayName || !email || !password) {
      setError("Todos los campos son obligatorios.");
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    const existing = await db.getUserByEmail(email);
    if (existing) {
      setError("Ya existe un usuario con ese correo.");
      return;
    }
    const passwordHash = await hashPassword(password);
    const user = await db.saveUser({
      display_name: displayName,
      email,
      password_hash: passwordHash,
      role: "operator",
      webauthn_credentials: [],
      metadata: {},
      is_active: true,
      last_login_at: null,
    });
    // Mark token as used (even if registration fails, it's one-shot)
    if (token) {
      const rt = await db.getRegistrationToken(token);
      if (rt) await db.useRegistrationToken(rt.id);
    }
    saveSession(user.id, user.email!, user.display_name, user.role);
    window.location.href = "/";
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Correo y contraseña obligatorios.");
      return;
    }
    const user = await db.getUserByEmail(email);
    if (!user) {
      setError("Correo o contraseña incorrectos.");
      return;
    }
    const passwordHash = await hashPassword(password);
    if (user.password_hash !== passwordHash) {
      setError("Correo o contraseña incorrectos.");
      return;
    }
    saveSession(user.id, user.email!, user.display_name, user.role);
    window.location.href = "/";
  };

  const copyToken = () => {
    navigator.clipboard.writeText(`${window.location.origin}/?token=${token}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (mode === "loading") {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-background">
        <div className="animate-pulse text-muted-foreground text-sm">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-screen w-screen bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mx-auto shadow-primary-glow">
            <span className="text-white text-xl font-black">F</span>
          </div>
          <h1 className="text-2xl font-black text-foreground">Fleet Control</h1>
          <p className="text-xs text-muted-foreground">Sistema de Control de Flotas</p>
        </div>

        {mode === "token_ready" && (
          <div className="space-y-4">
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-primary">
                <KeyRound className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Token de registro generado</span>
              </div>
              <p className="text-xs text-muted-foreground">
                No hay usuarios registrados. Comparte este enlace con el administrador para que cree su cuenta:
              </p>
              <div className="flex gap-2">
                <code className="flex-1 text-[10px] font-mono bg-muted border border-border rounded-lg px-2 py-1.5 truncate">
                  {window.location.origin}/?token={token}
                </code>
                <Button type="button" variant="outline" size="sm" onClick={copyToken} className="shrink-0 h-8 px-2">
                  {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>
            <div className="text-center">
              <span className="text-xs text-muted-foreground">o</span>
            </div>
            <form onSubmit={handleRegister} className="space-y-3">
              <div>
                <Label className="text-muted-foreground text-xs">Nombre completo</Label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required placeholder="ej. Admin" className="border-input bg-background rounded-xl mt-1" />
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Correo electrónico</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="admin@ejemplo.com" className="border-input bg-background rounded-xl mt-1" />
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Contraseña</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Mínimo 6 caracteres" className="border-input bg-background rounded-xl mt-1" />
              </div>
              {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}
              <Button type="submit" className="w-full rounded-xl bg-primary text-white font-bold hover:bg-primary transition-all cursor-pointer h-11">
                <UserPlus className="w-4 h-4 mr-1.5" /> Crear cuenta
              </Button>
            </form>
          </div>
        )}

        {mode === "register" && (
          <form onSubmit={handleRegister} className="space-y-3">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Registro con token de invitación</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Nombre completo</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required placeholder="ej. Juan Vázquez" className="border-input bg-background rounded-xl mt-1" />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Correo electrónico</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="juan@ejemplo.com" className="border-input bg-background rounded-xl mt-1" />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Contraseña</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Mínimo 6 caracteres" className="border-input bg-background rounded-xl mt-1" />
            </div>
            {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}
            <Button type="submit" className="w-full rounded-xl bg-primary text-white font-bold hover:bg-primary transition-all cursor-pointer h-11">
              <UserPlus className="w-4 h-4 mr-1.5" /> Crear cuenta
            </Button>
          </form>
        )}

        {mode === "login" && (
          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <Label className="text-muted-foreground text-xs">Correo electrónico</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="admin@ejemplo.com" className="border-input bg-background rounded-xl mt-1" />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Contraseña</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••" className="border-input bg-background rounded-xl mt-1" />
            </div>
            {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}
            <Button type="submit" className="w-full rounded-xl bg-primary text-white font-bold hover:bg-primary transition-all cursor-pointer h-11">
              <LogIn className="w-4 h-4 mr-1.5" /> Iniciar sesión
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
