"use client";

import React, { useState, useEffect } from "react";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { db, User } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Shield, Fingerprint, User as UserIcon, Plus } from "lucide-react";
import { motion } from "framer-motion";
import UserForm from "@/features/auth/components/UserForm";
import { useToast } from "@/components/ui/toast";

interface LoginScreenProps {
  onLogin: (user: User) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

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
      // Step 1: Get login options from server
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

      // Step 2: Use SimpleWebAuthn browser helper
      const credential = await startAuthentication({ optionsJSON: options });

      // Step 3: Send credential to server for verification
      const verifyRes = await fetch("/api/webauthn/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "verify",
          userId: selectedUser.id,
          credential,
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
      console.error("Login error:", err);
      setError(err.message || "Error al autenticar");
    }
  };

  const handleRegisterPasskey = async () => {
    if (!selectedUser) return;
    setError("");
    setIsRegistering(true);

    try {
      // Step 1: Get registration options from server
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

      // Step 2: Use SimpleWebAuthn browser helper
      const credential = await startRegistration({ optionsJSON: options });

      // Step 3: Send credential to server for verification
      const verifyRes = await fetch("/api/webauthn/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "verify",
          userId: selectedUser.id,
          credential,
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
        toast("Passkey registrada exitosamente", "success");
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
      console.error("Register passkey error:", err);
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
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
              <p className="text-xs text-amber-600 font-semibold text-center">
                No hay usuarios registrados. Crea el primer usuario para comenzar.
              </p>
            </div>
            <UserForm
              showPassword
              submitLabel="Crear cuenta"
              onSuccess={(saved) => {
                localStorage.setItem("fleet_session", JSON.stringify({
                  userId: saved.id,
                  displayName: saved.display_name,
                  role: saved.role,
                  loginAt: new Date().toISOString(),
                }));
                onLogin({
                  id: saved.id,
                  display_name: saved.display_name,
                  email: saved.email,
                  role: saved.role,
                  webauthn_credentials: [],
                  metadata: {},
                  is_active: true,
                  last_login_at: null,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                });
              }}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-center">
              Selecciona tu usuario
            </p>
            <div className="space-y-2">
              {users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => setSelectedUser(user)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer text-left ${
                    selectedUser?.id === user.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40 hover:bg-muted/20"
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <UserIcon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-foreground truncate">{user.display_name}</div>
                    <div className="text-[11px] text-muted-foreground">{user.role === "admin" ? "Administrador" : "Operador"}</div>
                  </div>
                  {selectedUser?.id === user.id && (
                    <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                  )}
                </button>
              ))}
            </div>

            {selectedUser && (
              <div className="space-y-2 pt-2">
                <Button
                  onClick={handleLoginWithPasskey}
                  className="w-full rounded-xl bg-primary text-white font-bold hover:bg-primary/90 h-12"
                >
                  <Fingerprint className="w-5 h-5 mr-2" /> Iniciar sesión
                </Button>
                <Button
                  variant="outline"
                  onClick={handleRegisterPasskey}
                  disabled={isRegistering}
                  className="w-full rounded-xl border-border h-10 text-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> Registrar nueva passkey
                </Button>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-500 font-semibold text-center">
                {error}
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
