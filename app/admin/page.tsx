"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSession, clearSession } from "@/lib/auth";
import { adminGetUsers, systemAdminId, type UsersPayload } from "@/lib/admin";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Shield, ArrowLeft, LogOut, Loader2, Users, Database, Lock } from "lucide-react";
import UsersTab from "./components/UsersTab";
import AuditTab from "./components/AuditTab";

type Gate = "loading" | "ok" | "unauthorized" | "error";

export default function AdminPage() {
  const [gate, setGate] = useState<Gate>("loading");
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [payload, setPayload] = useState<UsersPayload | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = async () => {
    const session = getSession();
    if (!session) {
      window.location.href = "/";
      return;
    }
    setSessionUserId(session.userId);
    const res = await adminGetUsers();
    if (res === "unauthorized") {
      setGate("unauthorized");
      return;
    }
    if (res === null) {
      setGate("error");
      return;
    }
    // Only the system admin may use the panel.
    const adminId = systemAdminId(res.users);
    if (adminId && adminId !== session.userId) {
      setGate("unauthorized");
      return;
    }
    setPayload(res);
    setGate("ok");
  };

  useEffect(() => {
    Promise.resolve().then(() => { void load(); });
  }, [refreshKey]);

  const handleLogout = () => {
    clearSession();
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen w-screen bg-background text-foreground font-sans antialiased">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-primary-glow shrink-0">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-black tracking-tight leading-none">Panel de Administración</h1>
              <p className="text-[10px] text-muted-foreground mt-1 truncate">Gestión de usuarios y datos de Fleet Control</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 h-9 rounded-xl border border-border bg-background text-xs font-bold hover:bg-secondary transition-all cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Volver a la app</span>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 h-9 rounded-xl text-red-500 hover:bg-red-500/10 text-xs font-bold transition-all cursor-pointer border-none"
            >
              <LogOut className="w-3.5 h-3.5" /> Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-16">
        {gate === "loading" && (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Verificando acceso…
          </div>
        )}

        {gate === "unauthorized" && (
          <div className="max-w-sm mx-auto mt-24 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6 text-red-500" />
            </div>
            <h2 className="text-lg font-black">Acceso restringido</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Este panel es exclusivo del administrador del sistema (el primer usuario registrado).
              Inicia sesión con esa cuenta para administrar usuarios y datos.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-4 h-10 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Ir a la aplicación
            </Link>
          </div>
        )}

        {gate === "error" && (
          <div className="text-center py-24 text-sm text-red-500 font-semibold">
            No se pudo conectar con la base de datos. Intenta de nuevo.
          </div>
        )}

        {gate === "ok" && payload && sessionUserId && (
          <Tabs defaultValue="users">
            <TabsList>
              <TabsTrigger value="users" icon={<Users className="w-3.5 h-3.5" />}>Usuarios</TabsTrigger>
              <TabsTrigger value="audit" icon={<Database className="w-3.5 h-3.5" />}>Datos y Auditoría</TabsTrigger>
            </TabsList>
            <TabsContent value="users">
              <UsersTab payload={payload} currentUserId={sessionUserId} onChanged={() => setRefreshKey((k) => k + 1)} />
            </TabsContent>
            <TabsContent value="audit">
              <AuditTab onChanged={() => setRefreshKey((k) => k + 1)} />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
