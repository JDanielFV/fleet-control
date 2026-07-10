"use client";

import { useState } from "react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";

interface UserFormProps {
  /** If provided, the form is in edit mode */
  initialValues?: {
    id?: string;
    display_name: string;
    email: string | null;
    role: "admin" | "operator";
  };
  onSuccess: (savedUser: { id: string; display_name: string; email: string | null; role: "admin" | "operator" }) => void;
  onCancel?: () => void;
  /** When true, auto-opens passkey dialog after save */
  openPasskeyAfterSave?: boolean;
  /** Called with passkey dialog data after save */
  onOpenPasskey?: (data: { userId: string; userName: string; displayName: string }) => void;
}

export default function UserForm({ initialValues, onSuccess, onCancel, openPasskeyAfterSave, onOpenPasskey }: UserFormProps) {
  const [displayName, setDisplayName] = useState(initialValues?.display_name || "");
  const [email, setEmail] = useState(initialValues?.email || "");
  const [role, setRole] = useState<"admin" | "operator">(initialValues?.role || "operator");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName) return;
    setIsSaving(true);
    try {
      const saved = await db.saveUser({
        id: initialValues?.id || undefined,
        display_name: displayName,
        email: email || null,
        role,
        webauthn_credentials: [],
        metadata: {},
        is_active: true,
        last_login_at: null,
      });
      onSuccess({ id: saved.id, display_name: saved.display_name, email: saved.email, role: saved.role });
      if (openPasskeyAfterSave && onOpenPasskey) {
        onOpenPasskey({
          userId: saved.id,
          userName: saved.email || saved.id,
          displayName: saved.display_name,
        });
      }
    } catch (err) {
      alert("Error al guardar usuario: " + err);
    } finally {
      setIsSaving(false);
    }
  };

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
          placeholder="ej. juan@ejemplo.com"
          className="border-input bg-background rounded-xl mt-1"
        />
      </div>
      <div>
        <Label className="text-muted-foreground text-xs">Rol</Label>
        <Select value={role} onValueChange={(v: "admin" | "operator") => setRole(v)}>
          <SelectTrigger className="w-full border-input bg-background rounded-xl mt-1">
            <SelectValue placeholder="Selecciona un rol" />
          </SelectTrigger>
          <SelectContent className="border-border bg-popover text-popover-foreground">
            <SelectItem value="operator">Operador</SelectItem>
            <SelectItem value="admin">Administrador</SelectItem>
          </SelectContent>
        </Select>
      </div>
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
          {isSaving ? "Guardando..." : initialValues?.id ? "Guardar cambios" : "Registrar usuario"}
        </Button>
      </div>
    </form>
  );
}
