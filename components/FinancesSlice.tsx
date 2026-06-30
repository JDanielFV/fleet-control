"use client";

import React, { useState, useEffect } from "react";
import { db, Driver, WeeklyRental } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Plus, History, AlertCircle, FileSpreadsheet, CheckCircle2, AlertTriangle, TrendingUp } from "lucide-react";

export default function FinancesSlice() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [rentals, setRentals] = useState<WeeklyRental[]>([]);
  
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState("");
  const [selectedWeek, setSelectedWeek] = useState("");
  const [paymentAmount, setPaymentAmount] = useState<number>(0);

  const [isRentalOpen, setIsRentalOpen] = useState(false);
  const [newRentalDriver, setNewRentalDriver] = useState("");
  const [rentAmount, setRentAmount] = useState<number>(2500);
  const [weekStart, setWeekStart] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const dList = await db.getDrivers();
    const rList = await db.getWeeklyRentals();
    setDrivers(dList);
    setRentals(rList);
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDriver || !selectedWeek || paymentAmount <= 0) return;

    await db.addPayment(selectedDriver, selectedWeek, paymentAmount);
    
    setIsPaymentOpen(false);
    setSelectedDriver("");
    setSelectedWeek("");
    setPaymentAmount(0);
    loadData();
  };

  const handlePaymentOpenChange = (open: boolean) => {
    setIsPaymentOpen(open);
    if (!open) {
      setSelectedDriver("");
      setSelectedWeek("");
      setPaymentAmount(0);
    }
  };

  const handleCardClick = (rental: WeeklyRental) => {
    setSelectedDriver(rental.driver_id);
    setSelectedWeek(rental.week_start);
    setPaymentAmount(rental.accumulated_debt);
    setIsPaymentOpen(true);
  };

  const handleCreateRental = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRentalDriver || !weekStart || rentAmount <= 0) return;

    const driverRentals = rentals.filter((r) => r.driver_id === newRentalDriver);
    let prevDebt = 0;
    if (driverRentals.length > 0) {
      const sorted = [...driverRentals].sort((a, b) => new Date(b.week_start).getTime() - new Date(a.week_start).getTime());
      prevDebt = sorted[0].accumulated_debt;
    }

    await db.createWeeklyRental({
      driver_id: newRentalDriver,
      week_start: weekStart,
      rent_amount: Number(rentAmount),
      paid_amount: 0,
      accumulated_debt: prevDebt + Number(rentAmount),
      status: "UNPAID",
    });

    setIsRentalOpen(false);
    setNewRentalDriver("");
    setWeekStart("");
    setRentAmount(2500);
    loadData();
  };

  const getDriverName = (id: string) => {
    const d = drivers.find((drv) => drv.id === id);
    return d ? `${d.first_name} ${d.paternal_last_name}` : "Desconocido";
  };

  const getDriverWeeks = (driverId: string) => {
    return rentals.filter((r) => r.driver_id === driverId);
  };

  const totalCollected = rentals.reduce((acc, curr) => acc + curr.paid_amount, 0);
  const totalPending = rentals.reduce((acc, curr) => acc + curr.accumulated_debt, 0);

  return (
    <div className="space-y-4">
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
        <div className="grid grid-cols-2 gap-4 pt-4 text-center">
          <div>
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground block font-bold">Total Recaudado</span>
            <p className="text-xl font-black text-emerald-400 font-mono">${totalCollected}</p>
          </div>
          <div>
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground block font-bold">Deuda Pendiente</span>
            <p className="text-xl font-black text-red-400 font-mono">${totalPending}</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3.5">
        <Dialog open={isPaymentOpen} onOpenChange={handlePaymentOpenChange}>
          <DialogTrigger asChild>
            <Button className="w-full h-14 rounded-2xl bg-card border border-border hover:bg-accent hover:text-accent-foreground text-foreground transition-all shadow-md active:scale-95 flex flex-col gap-0.5 justify-center py-2 cursor-pointer" variant="outline">
              <DollarSign className="w-5 h-5 text-primary" />
              <span className="text-[11px] font-bold">Registrar Pago</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="border border-border bg-background text-foreground rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-foreground font-black text-lg">Registrar Pago de Renta</DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                Aplica un pago parcial o total a la renta de un conductor.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handlePayment} className="space-y-4 pt-2">
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Conductor</Label>
                <Select value={selectedDriver} onValueChange={(val) => {
                  setSelectedDriver(val);
                  setSelectedWeek("");
                }}>
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

              {selectedDriver && (
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Semana de Renta</Label>
                  <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                    <SelectTrigger className="border-input bg-background rounded-xl">
                      <SelectValue placeholder="Selecciona semana" />
                    </SelectTrigger>
                    <SelectContent className="border-border bg-popover text-popover-foreground">
                      {getDriverWeeks(selectedDriver).map((r) => (
                        <SelectItem key={r.id} value={r.week_start}>
                          Semana: {r.week_start} (Adeudo: ${r.accumulated_debt})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  className="border-input bg-background rounded-xl"
                  required
                />
              </div>

              <Button type="submit" className="w-full rounded-xl bg-primary text-white font-bold hover:bg-primary transition-all cursor-pointer">
                Aplicar Pago
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isRentalOpen} onOpenChange={setIsRentalOpen}>
          <DialogTrigger asChild>
            <Button className="w-full h-14 rounded-2xl bg-card border border-border hover:bg-accent hover:text-accent-foreground text-foreground transition-all shadow-md active:scale-95 flex flex-col gap-0.5 justify-center py-2 cursor-pointer">
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
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!newRentalDriver || !weekStart) return;
              await db.createWeeklyRental({
                driver_id: newRentalDriver,
                week_start: weekStart,
                rent_amount: rentAmount,
                paid_amount: 0,
                accumulated_debt: rentAmount,
                status: "UNPAID"
              });
              setIsRentalOpen(false);
              setNewRentalDriver("");
              setWeekStart("");
              loadData();
            }} className="space-y-4 pt-2">
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
                  className="border-input bg-background rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Lunes de Inicio de Semana</Label>
                <Input
                  type="date"
                  value={weekStart}
                  onChange={(e) => setWeekStart(e.target.value)}
                  className="border-input bg-background rounded-xl"
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
        {rentals.map((rental) => {
          const isOverdue = rental.status !== "PAID";
          return (
            <Card 
              key={rental.id} 
              onClick={() => handleCardClick(rental)}
              className="border-border bg-card/30 overflow-hidden hover:bg-card/45 hover:border-border/80 transition-all duration-200 cursor-pointer active:scale-[0.99]"
            >
              <div className="p-4 flex items-center justify-between">
                <div className="space-y-1 min-w-0">
                  <h4 className="text-sm font-bold text-foreground truncate">
                    {getDriverName(rental.driver_id)}
                  </h4>
                  <p className="text-2xs text-muted-foreground font-medium">
                    Semana: <span className="font-mono">{rental.week_start}</span>
                  </p>
                  <div className="flex gap-2 pt-1 text-[11px] text-muted-foreground">
                    <span>Monto: ${rental.rent_amount}</span>
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
                  <p className={`text-sm font-black font-mono leading-none ${isOverdue ? "text-red-400" : "text-emerald-400"}`}>
                    Deuda: ${rental.accumulated_debt}
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
        })}

        {rentals.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No hay registros de rentas ni cobros.
          </div>
        )}
      </div>
    </div>
  );
}
