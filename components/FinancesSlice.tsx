"use client";

import React, { useState, useEffect, useMemo } from "react";
import { db, Driver, WeeklyRental } from "@/lib/db";
import { sortByDateDesc, formatDate } from "@/lib/utils";
import { getDriverName } from "@/lib/lookups";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Plus, CheckCircle2, AlertTriangle, TrendingUp, Scale } from "lucide-react";
import { FinancesListSkeleton } from "@/components/ui/skeletons";
import SliceHeader from "@/components/SliceHeader";

export default function FinancesSlice() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [rentals, setRentals] = useState<WeeklyRental[]>([]);
  const [credits, setCredits] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState("");
  const [paymentAmount, setPaymentAmount] = useState<number>(0);

  const [isRentalOpen, setIsRentalOpen] = useState(false);
  const [newRentalDriver, setNewRentalDriver] = useState("");
  const [rentAmount, setRentAmount] = useState<number>(2500);
  const [weekStart, setWeekStart] = useState("");

  const loadData = async () => {
    const dList = await db.getDrivers();
    const rList = await db.getWeeklyRentals();
    setDrivers(dList);
    setRentals(rList);
    // Build a map of driver → credit (one fetch per driver is fine for the scale we're at).
    const map: Record<string, number> = {};
    for (const d of dList) {
      map[d.id] = await db.getDriverCredit(d.id);
    }
    setCredits(map);
  };

  useEffect(() => {
    let isStale = false;
    (async () => {
      const dList = await db.getDrivers();
      const rList = await db.getWeeklyRentals();
      if (isStale) return;
      setDrivers(dList);
      setRentals(rList);
      const map: Record<string, number> = {};
      for (const d of dList) {
        map[d.id] = await db.getDriverCredit(d.id);
      }
      if (isStale) return;
      setCredits(map);
      setIsLoading(false);
    })();
    return () => {
      isStale = true;
    };
  }, []);

  // Compute FIFO preview whenever the user types a new amount.
  // We use a derived value (computed during render) instead of a
  // useEffect to avoid the react-hooks/set-state-in-effect warning.
  const preview = useMemo(() => {
    if (!selectedDriver || paymentAmount <= 0) return [];
    const driverRentals = rentals.filter((r) => r.driver_id === selectedDriver);
    const ordered = [...driverRentals].sort(
      (a, b) => new Date(a.week_start).getTime() - new Date(b.week_start).getTime()
    );
    let remaining = paymentAmount;
    const out: { week_start: string; amount: number }[] = [];
    for (const r of ordered) {
      if (remaining <= 0) break;
      const pending = Math.max(0, r.rent_amount - r.paid_amount);
      if (pending <= 0) continue;
      const apply = Math.min(pending, remaining);
      remaining -= apply;
      out.push({ week_start: r.week_start, amount: apply });
    }
    return out;
  }, [paymentAmount, selectedDriver, rentals]);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDriver || paymentAmount <= 0) return;

    const result = await db.addPayment(selectedDriver, paymentAmount);

    setIsPaymentOpen(false);
    setSelectedDriver("");
    setPaymentAmount(0);
    loadData();

    if (result.leftover > 0) {
      // Could surface a toast here in the future; for now a console hint
      // and the credit appears in the per-driver summary.
      console.info(
        `[fleet] Payment exceeded total debt by $${result.leftover}; stored as driver credit.`
      );
    }
  };

  const handlePaymentOpenChange = (open: boolean) => {
    setIsPaymentOpen(open);
    if (!open) {
      setSelectedDriver("");
      setPaymentAmount(0);
    }
  };

  const handleCardClick = (rental: WeeklyRental) => {
    setSelectedDriver(rental.driver_id);
    // Default payment amount = total pending debt for this driver (FIFO will
    // spread it across all unpaid weeks, starting with the oldest).
    const totalPending = rentals
      .filter((r) => r.driver_id === rental.driver_id && r.status !== "PAID")
      .reduce((acc, r) => acc + Math.max(0, r.rent_amount - r.paid_amount), 0);
    setPaymentAmount(totalPending);
    setIsPaymentOpen(true);
  };

  const handleCreateRental = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRentalDriver || !weekStart || rentAmount <= 0) return;

    await db.createWeeklyRental({
      driver_id: newRentalDriver,
      week_start: weekStart,
      rent_amount: Number(rentAmount),
      paid_amount: 0,
      is_prorated: false,
      status: "UNPAID",
    });

    setIsRentalOpen(false);
    setNewRentalDriver("");
    setWeekStart("");
    setRentAmount(2500);
    loadData();
  };

  const totalCollected = rentals.reduce((acc, curr) => acc + curr.paid_amount, 0);
  const totalPending = rentals.reduce(
    (acc, curr) => acc + Math.max(0, curr.rent_amount - curr.paid_amount),
    0
  );
  const totalCredit = useMemo(
    () => Object.values(credits).reduce((acc, n) => acc + n, 0),
    [credits]
  );

  // Sort rentals newest first for the list display.
  const sortedRentals = sortByDateDesc(rentals, "week_start");

  return (
    <div className="space-y-4">
      {/* Header Row: Title on Left, Actions on Right */}
      <SliceHeader title="Finanzas" />

      {/* Finances Overview stats */}
      <Card className="p-5 relative overflow-hidden border-border bg-card">
        <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="flex justify-between items-center pb-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Rentas Cobradas</span>
          </div>
          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 border border-emerald-500/20 font-bold rounded-md">
            Total General
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4 pt-4 text-center">
          <div>
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground block font-bold">Recaudado</span>
            <p className="text-lg font-black text-emerald-400 font-mono">${totalCollected}</p>
          </div>
          <div>
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground block font-bold">Pendiente</span>
            <p className="text-lg font-black text-red-400 font-mono">${totalPending}</p>
          </div>
          <div>
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground block font-bold">Crédito</span>
            <p className="text-lg font-black text-amber-400 font-mono">${totalCredit}</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <Dialog open={isPaymentOpen} onOpenChange={handlePaymentOpenChange}>
          <DialogTrigger asChild>
            <Button className="w-full h-14 rounded-2xl bg-card border border-border hover:bg-accent hover:text-accent-foreground text-foreground transition-all shadow-md active:scale-95 flex flex-col gap-0.5 justify-center py-2 cursor-pointer" variant="outline">
              <DollarSign className="w-5 h-5 text-primary" />
              <span className="text-[11px] font-bold">Registrar Pago</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="border border-border bg-background text-foreground rounded-2xl">
            <DialogHeader>
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 shrink-0">
                  <DollarSign className="w-5 h-5 text-emerald-500" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-foreground font-black text-lg">
                    Registrar Pago
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground text-xs">
                    {selectedDriver
                      ? `Aplicando a ${getDriverName(drivers, selectedDriver)} (regla FIFO: primero a la semana más vieja)`
                      : "Aplica un pago parcial o total a la renta de un conductor."}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <form onSubmit={handlePayment} className="space-y-4 pt-2">
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Conductor</Label>
                <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                  <SelectTrigger className="border-input bg-background rounded-xl">
                    <SelectValue placeholder="Selecciona conductor" />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-popover text-popover-foreground">
                    {drivers.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.first_name} {d.paternal_last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Live FIFO preview */}
              {selectedDriver && preview.length > 0 && (
                <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Scale className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Aplicación FIFO</span>
                  </div>
                  {preview.map((p, i) => (
                    <div key={i} className="flex justify-between font-mono">
                      <span className="text-muted-foreground">Semana {p.week_start}</span>
                      <span className="font-bold text-foreground">${p.amount}</span>
                    </div>
                  ))}
                  {paymentAmount > sumPreview(preview) && (
                    <div className="flex justify-between font-mono pt-1.5 border-t border-border/60">
                      <span className="text-amber-500">Sobrante (crédito)</span>
                      <span className="font-bold text-amber-500">
                        ${paymentAmount - sumPreview(preview)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="payAmt" className="text-muted-foreground text-xs">Monto del Pago ($)</Label>
                <Input
                  type="number"
                  id="payAmt"
                  value={paymentAmount || ""}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  placeholder="ej. 1500"
                  className="border-input bg-background rounded-xl w-full min-w-0"
                  required
                />
              </div>

              <Button type="submit" className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all cursor-pointer">
                Aplicar Pago
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isRentalOpen} onOpenChange={setIsRentalOpen}>
          <DialogTrigger asChild>
            <Button className="w-full h-14 rounded-2xl bg-card border border-border hover:bg-accent hover:text-accent-foreground text-foreground transition-all shadow-md active:scale-95 flex flex-col gap-0.5 justify-center py-2 cursor-pointer" variant="outline">
              <Plus className="w-5 h-5 text-primary" />
              <span className="text-[11px] font-bold">Nueva Renta</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="border border-border bg-background text-foreground rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-foreground font-black text-lg">Nueva Renta Semanal</DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                Asigna un nuevo cobro semanal a un conductor.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateRental} className="space-y-4 pt-2">
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Conductor</Label>
                <Select value={newRentalDriver} onValueChange={setNewRentalDriver}>
                  <SelectTrigger className="border-input bg-background rounded-xl">
                    <SelectValue placeholder="Selecciona conductor" />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-popover text-popover-foreground">
                    {drivers.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.first_name} {d.paternal_last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Monto de Renta ($)</Label>
                <Input
                  type="number"
                  value={rentAmount || ""}
                  onChange={(e) => setRentAmount(Number(e.target.value))}
                  className="border-input bg-background rounded-xl w-full min-w-0"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Lunes de Inicio de Semana</Label>
                <Input
                  type="date"
                  value={weekStart}
                  onChange={(e) => setWeekStart(e.target.value)}
                  className="border-input bg-background rounded-xl w-full min-w-0"
                  required
                />
              </div>

              <Button type="submit" className="w-full rounded-xl bg-primary text-white font-bold hover:bg-primary transition-all cursor-pointer">
                Generar Cobro Renta
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Estado de Cuentas</h3>
        {isLoading ? (
          <FinancesListSkeleton count={3} />
        ) : (
          sortedRentals.map((rental) => {
            const isOverdue = rental.status !== "PAID";
            const pending = Math.max(0, rental.rent_amount - rental.paid_amount);
            return (
              <Card
                key={rental.id}
                role="button"
                tabIndex={0}
                onClick={() => handleCardClick(rental)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleCardClick(rental);
                  }
                }}
                className="border-border bg-card/30 overflow-hidden hover:bg-card/45 hover:border-border/80 transition-all duration-200 cursor-pointer active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="p-4 flex items-center justify-between">
                  <div className="space-y-1 min-w-0">
                    <h4 className="text-sm font-bold text-foreground truncate">
                      {getDriverName(drivers, rental.driver_id)}
                    </h4>
                    <p className="text-2xs text-muted-foreground font-medium">
                      Semana: <span className="font-mono">{rental.week_start}</span>
                      {rental.is_prorated && (
                        <span className="ml-1.5 inline-block px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20">
                          Proporcional · {rental.prorated_days}d
                        </span>
                      )}
                    </p>
                    <div className="flex gap-2 pt-1 text-[11px] text-muted-foreground">
                      <span>Cobro: ${rental.rent_amount}</span>
                      <span>•</span>
                      <span>Pagado: ${rental.paid_amount}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`inline-block px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider mb-1.5 border ${
                      rental.status === "PAID"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : rental.status === "PARTIAL"
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        : "bg-red-500/10 text-red-400 border-red-500/20"
                    }`}>
                      {rental.status === "PAID" ? "Pagado" : rental.status === "PARTIAL" ? "Parcial" : "Pendiente"}
                    </span>
                    <p className={`text-sm font-black font-mono leading-none ${isOverdue && pending > 0 ? "text-red-400" : "text-emerald-400"}`}>
                      ${pending}
                    </p>
                  </div>
                </div>

                {rental.payments_log.length > 0 && (
                  <div className="px-4 py-2.5 bg-muted/40 border-t border-border text-[10px] text-muted-foreground space-y-1.5">
                    <span className="font-bold block uppercase tracking-wider text-muted-foreground/80 text-[8px]">Historial de abonos:</span>
                    {rental.payments_log.map((log, index) => (
                      <div key={index} className="flex justify-between font-medium">
                        <span className="text-muted-foreground">• Recibido: ${log.amount}</span>
                        <span className="font-mono text-muted-foreground">{log.date}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })
        )}

        {!isLoading && sortedRentals.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No hay registros de rentas ni cobros.
          </div>
        )}
      </div>
    </div>
  );
}

/** Sum helper for the FIFO preview panel. */
function sumPreview(rows: { amount: number }[]): number {
  return rows.reduce((acc, r) => acc + r.amount, 0);
}
