"use client";

import { useEffect, useMemo, useState } from "react";
import {
  adminAudit,
  adminReassign,
  adminDeleteRecords,
  adminTransferAll,
  ADMIN_TABLES,
  type AuditData,
  type AdminTableName,
} from "@/lib/admin";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { ShieldCheck, ShieldAlert, ArrowRightLeft, Trash2, Loader2, UserX, Database } from "lucide-react";

interface AuditTabProps {
  onChanged: () => void;
}

export default function AuditTab({ onChanged }: AuditTabProps) {
  const [audit, setAudit] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [bulkTarget, setBulkTarget] = useState<Record<string, string>>({});
  const [rowTarget, setRowTarget] = useState<Record<string, string>>({});
  const { confirm: showConfirm } = useConfirm();
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    setError("");
    setBulkTarget({});
    setRowTarget({});
    const res = await adminAudit();
    setLoading(false);
    if (res === "unauthorized") {
      setError("No autorizado.");
      return;
    }
    if (res === null) {
      setError("No se pudo cargar la auditoría.");
      return;
    }
    setAudit(res);
  };

  useEffect(() => {
    Promise.resolve().then(() => { void load(); });
  }, []);


  const userIds = useMemo(() => new Set((audit?.users ?? []).map((u) => u.id)), [audit]);
  const ownerName = (id: string | null | undefined): string => {
    if (!id) return "Sin dueño";
    const user = (audit?.users ?? []).find((u) => u.id === id);
    return user ? user.display_name : "Usuario eliminado";
  };

  const countsByUser = useMemo(() => {
    const m: Record<string, Record<string, number>> = {};
    for (const t of audit?.tables ?? []) {
      for (const r of t.rows) {
        if (!r.owner_id) continue;
        m[r.owner_id] = m[r.owner_id] ?? {};
        m[r.owner_id][t.table] = (m[r.owner_id][t.table] ?? 0) + 1;
      }
    }
    return m;
  }, [audit]);

  const orphansByTable = useMemo(() => {
    const m: Record<string, { id: string; label: string }[]> = {};
    for (const t of audit?.tables ?? []) {
      m[t.table] = t.rows.filter((r) => !r.owner_id || !userIds.has(r.owner_id)).map((r) => ({ id: r.id, label: r.label }));
    }
    return m;
  }, [audit, userIds]);

  const totalOrphans = useMemo(
    () => Object.values(orphansByTable).reduce((acc, rows) => acc + rows.length, 0),
    [orphansByTable]
  );

  const run = async (fn: () => Promise<true | string>, successMsg: string) => {
    setBusy(true);
    const result = await fn();
    setBusy(false);
    if (result === true) {
      toast(successMsg, "success");
      await load();
      onChanged();
    } else {
      toast(typeof result === "string" ? result : "Operación fallida", "error");
    }
  };

  // --- Transfer all data of one user to another ---
  const handleTransferAll = async (fromId: string) => {
    const target = bulkTarget[`transfer:${fromId}`];
    if (!target || target === fromId) {
      toast("Selecciona un usuario de destino válido.", "error");
      return;
    }
    const confirmed = await showConfirm({
      title: "Transferir toda la flota",
      message: `¿Mover TODOS los registros de "${ownerName(fromId)}" a "${ownerName(target)}"? Esta acción no se puede deshacer.`,
      confirmLabel: "Transferir",
    });
    if (!confirmed) return;
    await run(() => adminTransferAll(fromId, target), "Flota transferida correctamente");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Cargando auditoría…
      </div>
    );
  }

  if (error || !audit) {
    return <div className="text-center py-16 text-sm text-red-500 font-semibold">{error || "Sin datos."}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Isolation banner */}
      <div className={`flex items-start gap-3 rounded-2xl border p-4 ${totalOrphans === 0 ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"}`}>
        {totalOrphans === 0 ? (
          <ShieldCheck className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
        ) : (
          <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
        )}
        <div>
          <p className={`text-sm font-extrabold ${totalOrphans === 0 ? "text-green-600" : "text-red-500"}`}>
            {totalOrphans === 0
              ? "Aislamiento correcto: cada registro está ligado a un usuario válido."
              : `${totalOrphans} registro${totalOrphans === 1 ? "" : "s"} huérfano${totalOrphans === 1 ? "" : "s"} sin dueño válido.`}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Los registros huérfanos no se muestran a nadie. Asígnalos a un usuario o elimínalos para limpiar la base.
          </p>
        </div>
      </div>

      {/* Per-user matrix */}
      <section>
        <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2 mb-3">
          <Database className="w-4 h-4 text-primary" /> Registros por usuario
        </h3>
        <div className="w-full overflow-x-auto pb-2">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/40">
                <th className="text-left py-2.5 px-2 whitespace-nowrap">Usuario</th>
                {ADMIN_TABLES.map((t) => (
                  <th key={t} className="text-right py-2.5 px-2 whitespace-nowrap">{t.replace(/_/g, " ")}</th>
                ))}
                <th className="text-right py-2.5 px-2 whitespace-nowrap">Total</th>
                <th className="text-right py-2.5 px-2 whitespace-nowrap">Transferir a…</th>
              </tr>
            </thead>
            <tbody>
              {audit.users.map((u) => {
                const row = countsByUser[u.id] ?? {};
                const total = ADMIN_TABLES.reduce((acc, t) => acc + (row[t] ?? 0), 0);
                return (
                  <tr key={u.id} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-2">
                      <span className="font-bold text-foreground">{u.display_name}</span>
                      {!u.is_active && (
                        <span className="ml-1.5 text-[10px] font-bold uppercase text-red-500">Inactivo</span>
                      )}
                    </td>
                    {ADMIN_TABLES.map((t) => (
                      <td key={t} className="py-2.5 px-2 text-right font-mono text-muted-foreground">
                        {row[t] ?? 0}
                      </td>
                    ))}
                    <td className="py-2.5 px-2 text-right font-mono font-bold text-foreground">{total}</td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center justify-end gap-1.5">
                        <Select value={bulkTarget[`transfer:${u.id}`] ?? ""} onValueChange={(v) => setBulkTarget((p) => ({ ...p, [`transfer:${u.id}`]: v }))}>
                          <SelectTrigger className="h-8 w-36 border-input bg-background rounded-lg text-xs">
                            <SelectValue placeholder="Usuario…" />
                          </SelectTrigger>
                          <SelectContent>
                            {audit.users.filter((x) => x.id !== u.id).map((x) => (
                              <SelectItem key={x.id} value={x.id}>{x.display_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={busy || total === 0}
                          onClick={() => handleTransferAll(u.id)}
                          className="text-primary hover:text-primary hover:bg-primary/10 text-xs gap-1 h-8 px-2 disabled:opacity-30"
                          title="Transferir toda la flota a otro usuario"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Orphans */}
      <section className="space-y-4">
        <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2">
          <UserX className="w-4 h-4 text-amber-500" /> Registros huérfanos
        </h3>
        {totalOrphans === 0 ? (
          <p className="text-xs text-muted-foreground italic bg-muted/20 rounded-xl px-3 py-4 border border-border/40">
            No hay registros huérfanos. 🎉
          </p>
        ) : (
          ADMIN_TABLES.filter((t) => (orphansByTable[t]?.length ?? 0) > 0).map((table) => {
            const rows = orphansByTable[table];
            return (
              <div key={table} className="bg-muted/20 border border-border/60 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-foreground">{table.replace(/_/g, " ")}</span>
                    <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-600">{rows.length}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Select
                      value={bulkTarget[`bulk:${table}`] ?? ""}
                      onValueChange={(v) => setBulkTarget((p) => ({ ...p, [`bulk:${table}`]: v }))}
                    >
                      <SelectTrigger className="h-8 w-40 border-input bg-background rounded-lg text-xs">
                        <SelectValue placeholder="Asignar a…" />
                      </SelectTrigger>
                      <SelectContent>
                        {audit.users.map((x) => (
                          <SelectItem key={x.id} value={x.id}>{x.display_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy || !bulkTarget[`bulk:${table}`]}
                      onClick={() =>
                        run(() => adminReassign(table as AdminTableName, rows.map((r) => r.id), bulkTarget[`bulk:${table}`]!),
                          `${rows.length} registro(s) asignado(s)`)
                      }
                      className="h-8 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 disabled:opacity-40 cursor-pointer"
                    >
                      <ArrowRightLeft className="w-3 h-3 mr-1" /> Asignar todos
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={async () => {
                        const confirmed = await showConfirm({
                          title: "Eliminar registros huérfanos",
                          message: `¿Eliminar ${rows.length} registro(s) de "${table.replace(/_/g, " ")}"? Esta acción no se puede deshacer.`,
                          confirmLabel: "Eliminar",
                          variant: "danger",
                        });
                        if (!confirmed) return;
                        await run(() => adminDeleteRecords(table as AdminTableName, rows.map((r) => r.id)), "Registros eliminados");
                      }}
                      className="h-8 rounded-lg border-border text-red-500 text-xs font-bold hover:bg-red-500/10"
                    >
                      <Trash2 className="w-3 h-3 mr-1" /> Eliminar todos
                    </Button>
                  </div>
                </div>
                <ul className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {rows.map((r) => (
                    <li key={r.id} className="flex items-center gap-2 flex-wrap bg-background border border-border/50 rounded-xl px-3 py-2">
                      <span className="flex-1 min-w-0 text-xs text-foreground truncate">{r.label}</span>
                      <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[120px]">{r.id}</span>
                      <Select
                        value={rowTarget[`${table}:${r.id}`] ?? ""}
                        onValueChange={(v) => setRowTarget((p) => ({ ...p, [`${table}:${r.id}`]: v }))}
                      >
                        <SelectTrigger className="h-7 w-36 border-input bg-background rounded-lg text-xs">
                          <SelectValue placeholder="Asignar a…" />
                        </SelectTrigger>
                        <SelectContent>
                          {audit.users.map((x) => (
                            <SelectItem key={x.id} value={x.id}>{x.display_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy || !rowTarget[`${table}:${r.id}`]}
                        onClick={() =>
                          run(() => adminReassign(table as AdminTableName, [r.id], rowTarget[`${table}:${r.id}`]!), "Registro asignado")
                        }
                        className="h-7 px-2 rounded-lg bg-primary text-white text-[11px] font-bold hover:bg-primary/90 disabled:opacity-40 cursor-pointer"
                      >
                        Asignar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={async () => {
                          const confirmed = await showConfirm({
                            title: "Eliminar registro",
                            message: `¿Eliminar "${r.label}"?`,
                            confirmLabel: "Eliminar",
                            variant: "danger",
                          });
                          if (!confirmed) return;
                          await run(() => adminDeleteRecords(table as AdminTableName, [r.id]), "Registro eliminado");
                        }}
                        className="h-7 px-2 rounded-lg text-red-500 hover:text-red-400 hover:bg-red-500/10 text-[11px] font-bold"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
