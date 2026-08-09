"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { adminDeleteUser, adminCreateRegistrationToken, ADMIN_TABLES, type AdminUser, type UsersPayload } from "@/lib/admin";
import { UserPlus, Pencil, Trash2, Search, User as UserIcon, KeyRound, Copy, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import UserDialog from "./UserDialog";

interface UsersTabProps {
  payload: UsersPayload;
  currentUserId: string;
  onChanged: () => void;
}

export default function UsersTab({ payload, currentUserId, onChanged }: UsersTabProps) {
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<{ open: boolean; user: AdminUser | null }>({ open: false, user: null });
  const [tokenUrl, setTokenUrl] = useState("");
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const { confirm: showConfirm } = useConfirm();
  const { toast } = useToast();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return payload.users;
    return payload.users.filter(
      (u) =>
        u.display_name.toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q)
    );
  }, [payload.users, search]);

  const totalRecords = (user: AdminUser): number =>
    ADMIN_TABLES.reduce((acc, t) => acc + (payload.counts[t]?.[user.id] ?? 0), 0);

  const handleNewUser = async () => {
    setGenerating(true);
    const token = await adminCreateRegistrationToken();
    setGenerating(false);
    if (!token) {
      toast("No se pudo generar el token. Intenta de nuevo.", "error");
      return;
    }
    setTokenUrl(`${window.location.origin}/?token=${token}`);
    setTokenDialogOpen(true);
  };

  const copyToken = () => {
    navigator.clipboard.writeText(tokenUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async (user: AdminUser) => {
    const confirmed = await showConfirm({
      title: "Eliminar usuario",
      message: `¿Eliminar a "${user.display_name}"? Su flota (choferes, autos, rentas…) se conservará y podrás transferirla o limpiarla en la pestaña "Datos".`,
      confirmLabel: "Eliminar",
      variant: "danger",
    });
    if (!confirmed) return;
    const result = await adminDeleteUser(user.id, false);
    if (result === true) {
      toast("Usuario eliminado (sus datos se conservaron)", "success");
      onChanged();
    } else {
      toast(typeof result === "string" ? result : "No se pudo eliminar", "error");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-muted-foreground/50 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o correo…"
            className="border-input bg-background rounded-xl pl-10 h-11"
          />
        </div>
        <Button
          type="button"
          onClick={handleNewUser}
          disabled={generating}
          className="rounded-xl bg-primary text-white font-bold hover:bg-primary/90 h-11 px-5 cursor-pointer active:scale-95 transition-all disabled:opacity-50"
        >
          {generating ? (
            <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Generando…</>
          ) : (
            <><UserPlus className="w-4 h-4 mr-1.5" /> Nuevo usuario</>
          )}
        </Button>
      </div>

      <div className="w-full overflow-x-auto pb-4">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/40">
              <th className="text-left py-2.5 px-2 whitespace-nowrap">Usuario</th>
              <th className="text-left py-2.5 px-2 whitespace-nowrap">Correo</th>
              <th className="text-center py-2.5 px-2 whitespace-nowrap">Estado</th>
              <th className="text-center py-2.5 px-2 whitespace-nowrap">Passkeys</th>
              <th className="text-right py-2.5 px-2 whitespace-nowrap">Registros</th>
              <th className="text-right py-2.5 px-2 whitespace-nowrap">Último acceso</th>
              <th className="text-right py-2.5 px-2 whitespace-nowrap">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-muted-foreground italic">
                  No hay usuarios que coincidan.
                </td>
              </tr>
            ) : (
              filtered.map((user) => {
                const isSelf = user.id === currentUserId;
                return (
                  <tr key={user.id} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <UserIcon className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <span className="font-bold text-foreground">
                          {user.display_name}
                          {isSelf && <span className="ml-1.5 text-[10px] font-bold text-primary uppercase">Tú</span>}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-muted-foreground">{user.email || "—"}</td>
                    <td className="py-2.5 px-2 text-center">
                      <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md ${user.is_active ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-500"}`}>
                        {user.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <span className="inline-flex items-center gap-1 text-muted-foreground font-semibold">
                        <KeyRound className="w-3 h-3" />
                        {user.webauthn_credentials?.length ?? 0}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono font-bold text-foreground">
                      {totalRecords(user).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-2 text-right text-muted-foreground whitespace-nowrap">
                      {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString("es-MX") : "Nunca"}
                    </td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDialog({ open: true, user })}
                          className="text-foreground hover:text-primary hover:bg-primary/10 text-xs gap-1 h-7 px-2"
                          aria-label={`Editar ${user.display_name}`}
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(user)}
                          disabled={isSelf}
                          className="text-red-500 hover:text-red-400 hover:bg-red-500/10 text-xs gap-1 h-7 px-2 disabled:opacity-30"
                          aria-label={`Eliminar ${user.display_name}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-muted/30 border border-border/60 rounded-xl px-3 py-2.5">
        <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
        El botón Nuevo usuario genera un enlace de invitación: el usuario registra su propia cuenta (nombre, correo y contraseña) y administra exclusivamente su flota.
      </div>

      <UserDialog
        open={dialog.open}
        onClose={() => setDialog({ open: false, user: null })}
        onSaved={onChanged}
        user={dialog.user}
      />

      <Dialog open={tokenDialogOpen} onOpenChange={(o) => { if (!o) { setTokenDialogOpen(false); setTokenUrl(""); } }}>
        <DialogContent className="max-w-sm border border-border bg-background text-foreground rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground font-black text-lg flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" /> Enlace de invitación
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
    </div>
  );
}
