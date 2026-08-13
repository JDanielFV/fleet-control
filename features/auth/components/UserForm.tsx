"use client";

import { useState } from "react";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";

interface UserFormProps {
  initialValues?: {
    id?: string;
    display_name: string;
    email: string | null;
    role: "admin" | "owner";
  };
  onSuccess: (savedUser: {
    id: string;
    display_name: string;
    email: string | null;
    role: "admin" | "owner";
    /** Session JWT minted right after registration so the new user can query data post-RLS. */
    token?: string | null;
  }) => void;
  onCancel?: () => void;
  /** When true, shows password field (for first-run / token registration) */
  showPassword?: boolean;
  /** When true, auto-opens passkey dialog after save */
  openPasskeyAfterSave?: boolean;
  onOpenPasskey?: (data: { userId: string; userName: string; displayName: string }) => void;
  /** Optional submit label override */
  submitLabel?: string;
  /**
   * Rol del usuario nuevo. Por defecto "owner" (dueño): cada usuario
   * administra exclusivamente su propia flota. Solo el primer registro
   * del sistema (setup) debe crear el rol "admin".
   */
  role?: "admin" | "owner";
  /**
   * Token de invitación: cuando se provee, el registro se hace server-side
   * (POST /api/auth/register): valida el token, crea el usuario con scrypt
   * y emite el JWT de sesión. En modo demo (sin Supabase) cae al guardado
   * local y consume el token localmente.
   */
  registrationToken?: string;
}

export default function UserForm({
  initialValues,
  onSuccess,
  onCancel,
  showPassword = false,
  openPasskeyAfterSave = false,
  onOpenPasskey,
  submitLabel,
  role = "owner",
  registrationToken,
}: UserFormProps) {
  const [displayName, setDisplayName] = useState(initialValues?.display_name || "");
  const [email, setEmail] = useState(initialValues?.email || "");
  const [password, setPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName) return;
    if (showPassword && (!email || !password)) return;
    if (showPassword && password.length < 6) {
      toast("La contraseña debe tener al menos 6 caracteres.", "error");
      return;
    }
    setIsSaving(true);
    try {
      // Registration with an invitation token goes through the server-side
      // API (validates the token, hashes with scrypt, mints the session
      // JWT). Falls back to local storage when Supabase isn't configured.
      if (showPassword && registrationToken) {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: registrationToken,
            display_name: displayName,
            email: (email || "").trim().toLowerCase(),
            password,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (data?.localFallback) {
          // No Supabase → continue with the local path below.
        } else if (res.ok) {
          const savedId: string = data.userId;
          onSuccess({
            id: savedId,
            display_name: data.displayName || displayName,
            email: data.email ?? (email || null),
            role: data.role === "admin" ? "admin" : "owner",
            token: data.token ?? null,
          });
          if (openPasskeyAfterSave && onOpenPasskey) {
            onOpenPasskey({
              userId: savedId,
              userName: (email || "").trim().toLowerCase(),
              displayName,
            });
          }
          setIsSaving(false);
          return;
        } else {
          toast(data?.error || "Error al registrar el usuario.", "error");
          setIsSaving(false);
          return;
        }
      }

      const passwordHash = showPassword ? await hashPassword(password) : undefined;
      const saved = await db.saveUser({
        id: initialValues?.id || undefined,
        display_name: displayName,
        email: email || null,
        password_hash: passwordHash || null,
        role,
        webauthn_credentials: [],
        metadata: role === "admin" ? { is_system_admin: true } : {},
        is_active: true,
        last_login_at: null,
      });
      // Mint the session JWT right after creating the account so the new
      // user can query their data once RLS is enabled (the app expects a
      // logged-in session with a token after registration). Non-fatal:
      // without it, the session simply has no token yet.
      let token: string | null = null;
      if (showPassword) {
        try {
          const loginRes = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: (email || "").trim().toLowerCase(), password }),
          });
          if (loginRes.ok) {
            const loginData = await loginRes.json();
            token = loginData.token ?? null;
          }
        } catch {
          // Non-fatal: user can log in later with their credentials.
        }
      }
      // Local demo mode: consume the invitation token here (single use).
      if (registrationToken) {
        const rt = await db.getRegistrationToken(registrationToken);
        if (rt) await db.useRegistrationToken(rt.id);
      }
      onSuccess({ id: saved.id, display_name: saved.display_name, email: saved.email, role: saved.role, token });
      if (openPasskeyAfterSave && onOpenPasskey) {
        onOpenPasskey({
          userId: saved.id,
          userName: saved.email || saved.id,
          displayName: saved.display_name,
        });
      }
    } catch (err) {
      toast("Error al guardar usuario: " + err, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const label = submitLabel || (initialValues?.id ? "Guardar cambios" : "Registrar usuario");

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label className="text-muted-foreground text-xs">Nombre completo</Label>
        <Input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          placeholder="ej. Juan Vázquez"
          className="border-input bg-background rounded-xl mt-1"
        />
      </div>
      <div>
        <Label className="text-muted-foreground text-xs">Correo electrónico</Label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required={showPassword}
          placeholder="ej. juan@ejemplo.com"
          className="border-input bg-background rounded-xl mt-1"
        />
      </div>
      {showPassword && (
        <div>
          <Label className="text-muted-foreground text-xs">Contraseña</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            placeholder="Mínimo 6 caracteres"
            className="border-input bg-background rounded-xl mt-1"
          />
        </div>
      )}
      <div className="flex gap-2 pt-1">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1 rounded-xl border-border">
            Cancelar
          </Button>
        )}
        <Button
          type="submit"
          disabled={isSaving || !displayName}
          className="flex-1 rounded-xl bg-primary text-white font-bold hover:bg-primary transition-all cursor-pointer disabled:opacity-50"
        >
          {isSaving ? "Guardando..." : label}
        </Button>
      </div>
    </form>
  );
}
