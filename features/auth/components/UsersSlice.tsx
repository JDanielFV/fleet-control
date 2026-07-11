"use client";

import React, { useState, useEffect } from "react";
import { db, User } from "@/lib/db";
import { getSession, clearSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { User as UserIcon, Shield, Trash2, KeyRound, Copy, CheckCircle2, LogOut } from "lucide-react";
import SliceHeader from "@/components/SliceHeader";
import PasskeyRegistrationDialog from "@/features/auth/components/PasskeyRegistrationDialog";

export default function UsersSlice() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tokenUrl, setTokenUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [passkeyDialog, setPasskeyDialog] = useState<{ userId: string; userName: string; displayName: string } | null>(null);
  const session = getSession();
  const isAdmin = session?.role === "admin";

  const loadUsers = async () => {
    const list = await db.getUsers();
    setUsers(list);
    setIsLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleDelete = async (id: string) => {
    if (confirm("¿Eliminar este usuario?")) {
      await db.deleteUser(id);
      loadUsers();
    }
  };

  const generateToken = async () => {
    const t = await db.createRegistrationToken(session?.userId || null);
    setTokenUrl(`${window.location.origin}/?token=${t.token}`);
  };

  const copyToken = () => {
    navigator.clipboard.writeText(tokenUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogout = () => {
    clearSession();
    window.location.href = "/";
  };

  return (
    <div className="space-y-4">
      <SliceHeader
        title="Usuarios"
        action={
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Dialog open={!!tokenUrl} onOpenChange={(o) => { if (!o) setTokenUrl(""); }}>
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    onClick={generateToken}
                    className="rounded-full bg-[#0088FF] hover:bg-[#0077EE] text-white text-sm font-bold px-6 h-11 border-none active:scale-95 transition-all cursor-pointer flex items-center justify-center shadow-xs"
                  >
                    <KeyRound className="w-4 h-4 mr-1.5" /> Registrar usuario
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-sm border border-border bg-background text-foreground rounded-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-foreground font-black text-lg flex items-center gap-2">
                      <KeyRound className="w-5 h-5 text-primary" /> Token de registro
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground text-xs">
                      Comparte este enlace con el nuevo usuario para que cree su cuenta. El token expira en 24 horas y es de un solo uso.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 pt-2">
                    <div className="bg-muted border border-border rounded-xl p-3">
                      <code className="text-[11px] font-mono break-all text-foreground">{tokenUrl}</code>
                    </div>
                    <Button type="button" onClick={copyToken} className="w-full rounded-xl bg-primary text-white font-bold hover:bg-primary transition-all cursor-pointer h-11">
                      {copied ? <><CheckCircle2 className="w-4 h-4 mr-1.5" /> Copiado</> : <><Copy className="w-4 h-4 mr-1.5" /> Copiar enlace</>}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-red-500 text-xs font-bold h-11 px-3"
            >
              <LogOut className="w-4 h-4 mr-1" /> Salir
            </Button>
          </div>
        }
      />

      <div className="w-full overflow-x-auto pb-6">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Cargando...</div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/40">
                <th className="text-left py-2.5 px-2 whitespace-nowrap">Nombre</th>
                <th className="text-left py-2.5 px-2 whitespace-nowrap">Correo</th>
                <th className="text-left py-2.5 px-2 whitespace-nowrap">Rol</th>
                <th className="text-left py-2.5 px-2 whitespace-nowrap">Estado</th>
                <th className="text-right py-2.5 px-2 whitespace-nowrap">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-muted-foreground italic">
                    No hay usuarios registrados.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <UserIcon className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <span className="font-bold text-foreground">{user.display_name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-muted-foreground">{user.email || "—"}</td>
                    <td className="py-2.5 px-2">
                      {user.role === "admin" ? (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-primary">
                          <Shield className="w-3 h-3" /> Admin
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Operador</span>
                      )}
                    </td>
                    <td className="py-2.5 px-2">
                      <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md ${user.is_active ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-500"}`}>
                        {user.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(user.id)} className="text-red-500 hover:text-red-400 hover:bg-red-500/10 text-xs gap-1 h-7 px-2">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      <PasskeyRegistrationDialog
        open={!!passkeyDialog}
        onClose={() => setPasskeyDialog(null)}
        userId={passkeyDialog?.userId || ""}
        userName={passkeyDialog?.userName || ""}
        userDisplayName={passkeyDialog?.displayName || ""}
        onSuccess={() => {}}
      />
    </div>
  );
}
