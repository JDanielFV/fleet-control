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
    const d = drivers.find((x) => x.id === id);
    return d ? `${d.first_name} ${d.paternal_last_name}` : "Desconocido";
  };

  const getDriverWeeks = (driverId: string) => {
    return rentals.filter((r) => r.driver_id === driverId);
  };

  // Financial statistics
  const totalCollected = rentals.reduce((acc, curr) => acc + curr.paid_amount, 0);
  const totalDebt = rentals.reduce((acc, curr) => acc + curr.accumulated_debt, 0);
  const paidRentalsCount = rentals.filter((r) => r.status === "PAID").length;
  const totalRentalsCount = rentals.length || 1;
  const recoveryRate = Math.round((paidRentalsCount / totalRentalsCount) * 100);

  return (
    <div className="space-y-4">
      {/* Visual financial health widget */}
      <Card className="border-zinc-800 bg-zinc-900/30 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-500/5 rounded-full blur-3xl" />
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Resumen Contable
            </h4>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 border border-emerald-500/20 font-bold rounded-md">
              Tasa Cobro: {recoveryRate}%
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-1">
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Total Cobrado</span>
              <p className="text-xl font-black text-emerald-400 font-mono">${totalCollected}</p>
            </div>
            <div className="space-y-1 border-l border-zinc-800 pl-4">
              <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Cartera Vencida</span>
              <p className="text-xl font-black text-red-400 font-mono">${totalDebt}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3.5">
        <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
          <DialogTrigger asChild>
            <Button className="w-full h-14 rounded-2xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-200 transition-all shadow-md active:scale-95 flex flex-col gap-0.5 justify-center py-2 cursor-pointer" variant="outline">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              <span className="text-[11px] font-bold">Registrar Pago</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="border border-zinc-800 bg-zinc-950 text-zinc-50 rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-white font-black text-lg">Registrar Pago de Renta</DialogTitle>
              <DialogDescription className="text-zinc-400 text-xs">
                Aplica un pago parcial o total a la renta de un conductor.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handlePayment} className="space-y-4 pt-2">
              <div className="space-y-1">
                <Label className="text-zinc-400 text-xs">Conductor</Label>
                <Select value={selectedDriver} onValueChange={(val) => {
                  setSelectedDriver(val);
                  setSelectedWeek("");
                }}>
                  <SelectTrigger className="border-zinc-800 bg-zinc-900 rounded-xl">
                    <SelectValue placeholder="Selecciona conductor" />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-850 bg-zinc-900 text-zinc-50">
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
                  <Label className="text-zinc-400 text-xs">Semana de Renta</Label>
                  <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                    <SelectTrigger className="border-zinc-800 bg-zinc-900 rounded-xl">
                      <SelectValue placeholder="Selecciona semana" />
                    </SelectTrigger>
                    <SelectContent className="border-zinc-850 bg-zinc-900 text-zinc-50">
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
                <Label htmlFor="payAmt" className="text-zinc-400 text-xs">Monto del Pago ($)</Label>
                <Input
                  type="number"
                  id="payAmt"
                  value={paymentAmount || ""}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  placeholder="ej. 1500"
                  className="border-zinc-800 bg-zinc-900 rounded-xl"
                  required
                />
              </div>

              <Button type="submit" className="w-full rounded-xl bg-emerald-500 text-zinc-950 font-bold hover:bg-emerald-400 transition-all cursor-pointer">
                Aplicar Pago
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isRentalOpen} onOpenChange={setIsRentalOpen}>
          <DialogTrigger asChild>
            <Button className="w-full h-14 rounded-2xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-200 transition-all shadow-md active:scale-95 flex flex-col gap-0.5 justify-center py-2 cursor-pointer">
              <Plus className="w-5 h-5 text-emerald-400" />
              <span className="text-[11px] font-bold">Nueva Renta</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="border border-zinc-800 bg-zinc-950 text-zinc-50 rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-white font-black text-lg">Establecer Nueva Renta</DialogTitle>
              <DialogDescription className="text-zinc-400 text-xs">
                Crea el cobro semanal para un conductor, arrastrando deuda acumulada anterior.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateRental} className="space-y-4 pt-2">
              <div className="space-y-1">
                <Label className="text-zinc-400 text-xs">Conductor</Label>
                <Select value={newRentalDriver} onValueChange={setNewRentalDriver}>
                  <SelectTrigger className="border-zinc-800 bg-zinc-900 rounded-xl">
                    <SelectValue placeholder="Selecciona conductor" />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-850 bg-zinc-900 text-zinc-50">
                    {drivers.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.first_name} {d.paternal_last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="weekStart" className="text-zinc-400 text-xs">Fecha Inicio (Lunes)</Label>
                  <Input
                    type="date"
                    id="weekStart"
                    value={weekStart}
                    onChange={(e) => setWeekStart(e.target.value)}
                    className="border-zinc-800 bg-zinc-900 rounded-xl text-xs"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="rentAmt" className="text-zinc-400 text-xs">Renta Semanal ($)</Label>
                  <Input
                    type="number"
                    id="rentAmt"
                    value={rentAmount || ""}
                    onChange={(e) => setRentAmount(Number(e.target.value))}
                    className="border-zinc-800 bg-zinc-900 rounded-xl"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full rounded-xl bg-emerald-500 text-zinc-950 font-bold hover:bg-emerald-400 transition-all cursor-pointer">
                Generar Cobro Renta
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Estado de Cuentas</h3>
        {rentals.map((rental) => {
          const isOverdue = rental.status !== "PAID";
          return (
            <Card key={rental.id} className="border-zinc-800 bg-zinc-900/30 overflow-hidden hover:bg-zinc-900/40 hover:border-zinc-700 transition-all duration-200">
              <div className="p-4 flex items-center justify-between">
                <div className="space-y-1 min-w-0">
                  <h4 className="text-sm font-bold text-white truncate">
                    {getDriverName(rental.driver_id)}
                  </h4>
                  <p className="text-2xs text-zinc-500 font-medium">
                    Semana: <span className="font-mono">{rental.week_start}</span>
                  </p>
                  <div className="flex gap-2 pt-1 text-[11px] text-zinc-400">
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
                <div className="px-4 py-2.5 bg-zinc-950/40 border-t border-zinc-900 text-[10px] text-zinc-500 space-y-1.5">
                  <span className="font-bold block uppercase tracking-wider text-zinc-600 text-[8px]">Historial de abonos:</span>
                  {rental.payments_log.map((log, index) => (
                    <div key={index} className="flex justify-between font-medium">
                      <span className="text-zinc-400">• Recibido: ${log.amount}</span>
                      <span className="font-mono text-zinc-500">{log.date}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}

        {rentals.length === 0 && (
          <div className="text-center py-8 text-zinc-500">
            No hay registros de rentas ni cobros.
          </div>
        )}
      </div>
    </div>
  );
}
