"use client";

import React, { useState, useEffect, useCallback } from "react";
import { db, type WeeklyRental } from "@/lib/db";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface DriverPaymentHistoryProps {
  driverId: string;
}

export default function DriverPaymentHistory({ driverId }: DriverPaymentHistoryProps) {
  const [rentals, setRentals] = useState<WeeklyRental[]>([]);
  const [condoneOpen, setCondoneOpen] = useState(false);
  const [condoneRental, setCondoneRental] = useState<WeeklyRental | null>(null);
  const [condoneDays, setCondoneDays] = useState(0);

  const loadRentals = useCallback(async () => {
    const all = await db.getWeeklyRentals();
    setRentals(all.filter((r) => r.driver_id === driverId).sort((a, b) => new Date(b.week_start).getTime() - new Date(a.week_start).getTime()));
  }, [driverId]);

  useEffect(() => { Promise.resolve().then(() => { void loadRentals(); }); }, [loadRentals]);

  const totalDebt = rentals.reduce((acc, r) => acc + Math.max(0, r.rent_amount - r.paid_amount - (r.condoned_amount || 0)), 0);
  const totalPaid = rentals.reduce((acc, r) => acc + r.paid_amount, 0);
  const totalCondoned = rentals.reduce((acc, r) => acc + (r.condoned_amount || 0), 0);

  const openCondone = (r: WeeklyRental) => {
    setCondoneRental(r);
    setCondoneDays(r.condoned_days || 0);
    setCondoneOpen(true);
  };

  const submitCondone = async () => {
    if (!condoneRental || condoneDays < 0) return;
    const dailyRate = condoneRental.rent_amount / 7;
    const condonedAmount = Math.round(dailyRate * condoneDays);
    await db.saveWeeklyRental({ ...condoneRental, condoned_days: condoneDays, condoned_amount: condonedAmount });
    setCondoneOpen(false);
    setCondoneRental(null);
    loadRentals();
  };

  if (rentals.length === 0) return null;

  const statusIcon: Record<string, React.ReactNode> = {
    PAID: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
    PARTIAL: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />,
    UNPAID: <XCircle className="w-3.5 h-3.5 text-red-400" />,
  };

  const statusLabel: Record<string, string> = { PAID: "Pagado", PARTIAL: "Parcial", UNPAID: "Adeudo" };

  return (
    <>
      <div className="pt-4 border-t border-border/40">
        <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground/80 mb-3">Historial de Pagos</h4>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-3 gap-2 mb-3"
        >
          <div className="bg-muted/20 rounded-xl border border-border/60 p-3">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 block">Deuda Total</span>
            <strong className="text-sm text-emerald-400">${totalPaid.toLocaleString()}</strong>
          </div>
          <div className="bg-muted/20 rounded-xl border border-border/60 p-2.5 text-center">
            <span className="text-[10px] text-muted-foreground block">Condonado</span>
            <strong className="text-sm text-amber-400">${totalCondoned.toLocaleString()}</strong>
          </div>
          <div className="bg-muted/20 rounded-xl border border-border/60 p-2.5 text-center">
            <span className="text-[10px] text-muted-foreground block">Adeudo</span>
            <strong className="text-sm text-red-400">${totalDebt.toLocaleString()}</strong>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="bg-muted/20 rounded-xl border border-border/60 p-3 max-h-48 overflow-y-auto space-y-1.5"
        >
          {rentals.map((r) => {
            const debt = Math.max(0, r.rent_amount - r.paid_amount - (r.condoned_amount || 0));
            return (
              <div key={r.id} className="flex items-start gap-2.5 text-[10px] py-1.5 border-b border-border/30 last:border-0">
                <div className="mt-0.5 shrink-0">{statusIcon[r.status]}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-foreground">{r.week_start}</span>
                    <span className={`text-[9px] font-bold uppercase px-1 py-0.5 rounded ${
                      r.status === "PAID" ? "bg-emerald-500/10 text-emerald-400" :
                      r.status === "PARTIAL" ? "bg-amber-500/10 text-amber-400" : "bg-red-500/10 text-red-400"
                    }`}>{statusLabel[r.status]}</span>
                    <span className="text-muted-foreground/60 ml-auto">Renta: ${r.rent_amount.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-muted-foreground">
                    <span>Pagado: <strong className="text-foreground">${r.paid_amount.toLocaleString()}</strong></span>
                    {r.condoned_days > 0 && (
                      <span>Condonado: <strong className="text-amber-400">{r.condoned_days} día(s) (${(r.condoned_amount || 0).toLocaleString()})</strong></span>
                    )}
                    {debt > 0 && <span>Debe: <strong className="text-red-400">${debt.toLocaleString()}</strong></span>}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => openCondone(r)} className="text-[9px] h-6 px-1.5 text-muted-foreground hover:text-amber-400 shrink-0">Condonar</Button>
              </div>
            );
          })}
        </motion.div>
      </div>

      <Dialog open={condoneOpen} onOpenChange={(o) => { if (!o) setCondoneRental(null); }}>
        <DialogContent className="max-w-sm border border-border bg-background text-foreground rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground font-black text-lg">Condonar Días</DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              {condoneRental ? `Semana del ${condoneRental.week_start} — Renta: $${condoneRental.rent_amount.toLocaleString()}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-muted-foreground text-xs">Días a condonar</Label>
              <Input type="number" min="0" max="7" value={condoneDays} onChange={(e) => setCondoneDays(parseInt(e.target.value) || 0)} className="mt-1.5 border-input bg-background rounded-xl" />
            </div>
            {condoneRental && condoneDays > 0 && (
              <p className="text-xs text-muted-foreground">Monto a condonar: <strong className="text-amber-400">${Math.round((condoneRental.rent_amount / 7) * condoneDays).toLocaleString()}</strong></p>
            )}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setCondoneOpen(false)} className="flex-1 rounded-xl border-border">Cancelar</Button>
              <Button onClick={submitCondone} className="flex-1 rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-600">Guardar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
