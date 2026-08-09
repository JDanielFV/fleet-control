"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { adminCreateUser, adminUpdateUser, type AdminUser } from "@/lib/admin";
import { Loader2, User as UserIcon } from "lucide-react";

interface UserDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: (saved: AdminUser) => void;
  user?: AdminUser | null; // edit mode when provided
}

export default function UserDialog({ open, onClose, onSaved, user }: UserDialogProps) {
  const isEdit = !!user;
  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [isActive, setIsActive] = useState(user?.is_active ?? true);
  const [removeCredId, setRemoveCredId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const credentials = user?.webauthn_credentials ?? [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    if (!isEdit && (!email.trim() || !password)) {
      setError("Correo y contraseña son obligatorios.");
      return;
    }
    if (password && password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setSaving(true);
    setError("");

    const result = isEdit
      ? await adminUpdateUser(user.id, {
          display_name: displayName.trim(),
          ...(email.trim() ? { email: email.trim().toLowerCase() } : {}),
          is_active: isActive,
          ...(password ? { password } : {}),
          ...(removeCredId ? { remove_credential_id: removeCredId } : {}),
        })
      : await adminCreateUser({ display_name: displayName.trim(), email: email.trim(), password });

    setSaving(false);
    if (typeof result === "string") {
      setError(result);
      return;
    }
    toast(isEdit ? "Usuario actualizado" : "Usuario creado correctamente", "success");
    onSaved(result);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !saving) onClose(); }}>
      <DialogContent className="max-w-sm border border-border bg-background text-foreground rounded-2xl">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 shrink-0">
              <UserIcon className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-foreground font-black text-lg">
                {isEdit ? "Editar usuario" : "Nuevo usuario"}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                {isEdit
                  ? "Actualiza los datos de la cuenta. El usuario mantiene su flota y accesos."
                  : "Crea la cuenta directamente (no necesita token de registro)."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
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
              required={!isEdit}
              placeholder="ej. juan@ejemplo.com"
              className="border-input bg-background rounded-xl mt-1"
            />
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">
              {isEdit ? "Nueva contraseña (opcional)" : "Contraseña"}
            </Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={!isEdit}
              minLength={6}
              placeholder={isEdit ? "Dejar vacío para no cambiar" : "Mínimo 6 caracteres"}
              className="border-input bg-background rounded-xl mt-1"
            />
          </div>

          {isEdit && (
            <div className="flex items-center justify-between rounded-xl bg-muted/30 border border-border/60 px-3 py-2.5">
              <div>
                <Label className="text-muted-foreground text-xs font-bold">Cuenta activa</Label>
                <p className="text-[10px] text-muted-foreground/70">Un usuario inactivo no puede iniciar sesión.</p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} aria-label="Cuenta activa" />
            </div>
          )}

          {isEdit && credentials.length > 0 && (
            <div>
              <Label className="text-muted-foreground text-xs">Quitar una passkey</Label>
              <Select value={removeCredId} onValueChange={setRemoveCredId}>
                <SelectTrigger className="mt-1 border-input bg-background rounded-xl">
                  <SelectValue placeholder="Selecciona una passkey para quitar…" />
                </SelectTrigger>
                <SelectContent>
                  {credentials.map((c, i) => {
                    const created = (c as { createdAt?: string }).createdAt;
                    return (
                      <SelectItem key={c.id ?? i} value={c.id ?? String(i)}>
                        Passkey #{i + 1}{created ? ` · ${created.slice(0, 10)}` : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-500 font-semibold">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving} className="flex-1 rounded-xl border-border">
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="flex-1 rounded-xl bg-primary text-white font-bold hover:bg-primary transition-all cursor-pointer disabled:opacity-50">
              {saving ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Guardando…</> : (isEdit ? "Guardar cambios" : "Crear usuario")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
