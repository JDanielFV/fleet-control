"use client";

import React, { useState, useEffect } from "react";
import { db, Vehicle, Driver, Assignment, Checklist } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Key, ArrowLeftRight, CheckSquare, ShieldAlert, ListChecks, Calendar, Gauge, Check } from "lucide-react";
import { motion } from "framer-motion";

interface AssignmentsSliceProps {
  onRefreshAll: () => void;
}

export default function AssignmentsSlice({ onRefreshAll }: AssignmentsSliceProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);

  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);

  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [selectedDriver, setSelectedDriver] = useState("");
  const [assignReason, setAssignReason] = useState("");
  const [assignType, setAssignType] = useState<"ASSIGN" | "RELEASE">("ASSIGN");

  const [checklistVehicle, setChecklistVehicle] = useState("");
  const [checklistDriver, setChecklistDriver] = useState("");
  const [checklistType, setChecklistType] = useState<"DELIVERY" | "WEEKLY_START">("DELIVERY");
  const [mileage, setMileage] = useState(0);
  const [gasolineLevel, setGasolineLevel] = useState("8/8");
  const [lights, setLights] = useState(true);
  const [brakes, setBrakes] = useState(true);
  const [tires, setTires] = useState(true);
  const [bodywork, setBodywork] = useState(true);
  const [documents, setDocuments] = useState(true);
  const [irregularities, setIrregularities] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const vList = await db.getVehicles();
    const dList = await db.getDrivers();
    const aList = await db.getAssignments();
    const cList = await db.getChecklists();
    setVehicles(vList);
    setDrivers(dList);
    setAssignments(aList);
    setChecklists(cList);
  };

  const handleAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle || (assignType === "ASSIGN" && !selectedDriver)) return;

    const vehicleObj = vehicles.find((v) => v.id === selectedVehicle);
    const driverId = assignType === "ASSIGN" ? selectedDriver : (vehicleObj?.active_driver_id || "");

    if (!driverId) return;

    await db.createAssignment(selectedVehicle, driverId, assignType, assignReason);
    
    setIsAssignOpen(false);
    setSelectedVehicle("");
    setSelectedDriver("");
    setAssignReason("");
    loadData();
    onRefreshAll();
  };

  const handleChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checklistVehicle || !checklistDriver) return;

    await db.saveChecklist({
      vehicle_id: checklistVehicle,
      driver_id: checklistDriver,
      type: checklistType,
      mileage: Number(mileage),
      gasoline_level: gasolineLevel,
      checklist_items: {
        lights,
        brakes,
        tires,
        bodywork,
        documents,
      },
      irregularities,
    });

    setIsChecklistOpen(false);
    setChecklistVehicle("");
    setChecklistDriver("");
    setMileage(0);
    setGasolineLevel("8/8");
    setLights(true);
    setBrakes(true);
    setTires(true);
    setBodywork(true);
    setDocuments(true);
    setIrregularities("");
    loadData();
    onRefreshAll();
  };

  const getDriverName = (id: string) => {
    const d = drivers.find((x) => x.id === id);
    return d ? `${d.first_name} ${d.paternal_last_name}` : "Desconocido";
  };

  const getVehicleName = (id: string) => {
    const v = vehicles.find((x) => x.id === id);
    return v ? `${v.brand} ${v.vehicle_name} (${v.plate_number})` : "Desconocido";
  };

  // Clickable Octave Fuel segments
  const fuelLevels = ["1/8", "2/8", "3/8", "4/8", "5/8", "6/8", "7/8", "8/8"];
  const getFuelColor = (level: string) => {
    const val = parseInt(level.split("/")[0], 10);
    if (val <= 2) return "bg-red-500 shadow-red-500/25";
    if (val <= 4) return "bg-orange-500 shadow-orange-500/25";
    if (val <= 6) return "bg-amber-500 shadow-amber-500/25";
    return "bg-emerald-500 shadow-emerald-500/25";
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3.5">
        <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
          <DialogTrigger asChild>
            <Button className="w-full h-14 rounded-2xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-200 transition-all shadow-md active:scale-95 flex flex-col gap-0.5 justify-center py-2 cursor-pointer" variant="outline">
              <ArrowLeftRight className="w-5 h-5 text-emerald-400" />
              <span className="text-[11px] font-bold">Asignación / Retiro</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="border border-zinc-800 bg-zinc-950 text-zinc-50 rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-black text-white">Manejo de Asignación</DialogTitle>
              <DialogDescription className="text-zinc-400 text-xs">
                Asigna un auto a un chofer o retíralo de circulación por un motivo específico.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAssignment} className="space-y-4 pt-2">
              <div className="space-y-1">
                <Label className="text-zinc-400 text-xs">Acción</Label>
                <Select value={assignType} onValueChange={(val: "ASSIGN" | "RELEASE") => setAssignType(val)}>
                  <SelectTrigger className="border-zinc-800 bg-zinc-900 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-850 bg-zinc-900 text-zinc-50">
                    <SelectItem value="ASSIGN">Asignar Auto</SelectItem>
                    <SelectItem value="RELEASE">Retirar Auto</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-zinc-400 text-xs">Auto / Vehículo</Label>
                <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                  <SelectTrigger className="border-zinc-800 bg-zinc-900 rounded-xl">
                    <SelectValue placeholder="Selecciona vehículo" />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-850 bg-zinc-900 text-zinc-50">
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.brand} {v.vehicle_name} [{v.plate_number}]
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {assignType === "ASSIGN" && (
                <div className="space-y-1">
                  <Label className="text-zinc-400 text-xs">Conductor</Label>
                  <Select value={selectedDriver} onValueChange={setSelectedDriver}>
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
              )}

              <div className="space-y-1">
                <Label htmlFor="reason" className="text-zinc-400 text-xs">Motivo / Notas</Label>
                <Input
                  id="reason"
                  placeholder="ej. Inicio de turno semanal, choque leve, mantenimiento"
                  value={assignReason}
                  onChange={(e) => setAssignReason(e.target.value)}
                  className="border-zinc-800 bg-zinc-900 rounded-xl"
                  required
                />
              </div>

              <Button type="submit" className="w-full rounded-xl bg-emerald-500 text-zinc-950 font-bold hover:bg-emerald-400 transition-all cursor-pointer">
                Confirmar Operación
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isChecklistOpen} onOpenChange={setIsChecklistOpen}>
          <DialogTrigger asChild>
            <Button className="w-full h-14 rounded-2xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-200 transition-all shadow-md active:scale-95 flex flex-col gap-0.5 justify-center py-2 cursor-pointer">
              <ListChecks className="w-5 h-5 text-emerald-400" />
              <span className="text-[11px] font-bold">Checklist Semanal</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto border border-zinc-800 bg-zinc-950 text-zinc-50 rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-black text-white">Checklist de Unidad</DialogTitle>
              <DialogDescription className="text-zinc-400 text-xs">
                Registra el kilometraje, octavos de gasolina y estado del auto de manera táctil.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleChecklist} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-zinc-400 text-xs">Tipo Checklist</Label>
                  <Select value={checklistType} onValueChange={(val: "DELIVERY" | "WEEKLY_START") => setChecklistType(val)}>
                    <SelectTrigger className="border-zinc-800 bg-zinc-900 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-zinc-850 bg-zinc-900 text-zinc-50">
                      <SelectItem value="DELIVERY">Entrega de Unidad</SelectItem>
                      <SelectItem value="WEEKLY_START">Inicio de Semana</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-zinc-400 text-xs">Auto</Label>
                  <Select value={checklistVehicle} onValueChange={setChecklistVehicle}>
                    <SelectTrigger className="border-zinc-800 bg-zinc-900 rounded-xl">
                      <SelectValue placeholder="Vehículo" />
                    </SelectTrigger>
                    <SelectContent className="border-zinc-850 bg-zinc-900 text-zinc-50">
                      {vehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.brand} {v.plate_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-zinc-400 text-xs">Conductor Responsable</Label>
                <Select value={checklistDriver} onValueChange={checklistDriver => setChecklistDriver(checklistDriver)}>
                  <SelectTrigger className="border-zinc-800 bg-zinc-900 rounded-xl">
                    <SelectValue placeholder="Chofer" />
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

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="mileage" className="text-zinc-400 text-xs">Kilometraje Actual</Label>
                  <div className="relative">
                    <Gauge className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
                    <Input
                      type="number"
                      id="mileage"
                      value={mileage || ""}
                      onChange={(e) => setMileage(Number(e.target.value))}
                      className="border-zinc-800 bg-zinc-900 rounded-xl pl-9"
                      required
                    />
                  </div>
                </div>

                {/* Tactile Fuel Gauge Selector */}
                <div className="space-y-1.5 pt-1">
                  <Label className="text-zinc-400 text-xs flex justify-between">
                    <span>Nivel Gasolina</span>
                    <span className="font-bold text-white uppercase tracking-wider text-[10px]">{gasolineLevel} ({gasolineLevel === "8/8" ? "Lleno" : gasolineLevel === "4/8" ? "Medio" : gasolineLevel === "1/8" ? "Reserva" : "Parcial"})</span>
                  </Label>
                  <div className="flex gap-1.5 h-10 w-full bg-zinc-900 rounded-xl p-1.5 border border-zinc-800 select-none">
                    {fuelLevels.map((lvl) => {
                      const isActive = parseInt(lvl.split("/")[0], 10) <= parseInt(gasolineLevel.split("/")[0], 10);
                      return (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setGasolineLevel(lvl)}
                          className={`flex-1 rounded-md transition-all duration-200 cursor-pointer ${
                            isActive
                              ? `${getFuelColor(lvl)} shadow-xs`
                              : "bg-zinc-800 hover:bg-zinc-700/60"
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Tactile Switch/Checkboxes */}
              <div className="bg-zinc-900/60 p-4 rounded-xl border border-zinc-800/80 space-y-3.5">
                <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500">Estado de Sistemas</h4>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Luces OK", state: lights, setter: setLights },
                    { label: "Frenos OK", state: brakes, setter: setBrakes },
                    { label: "Llantas OK", state: tires, setter: setTires },
                    { label: "Carrocería OK", state: bodywork, setter: setBodywork },
                  ].map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => item.setter(!item.state)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                        item.state
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                          : "bg-zinc-900 border-zinc-800 text-zinc-500"
                      }`}
                    >
                      <span className="text-xs font-semibold">{item.label}</span>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                        item.state ? "bg-emerald-500 border-emerald-400 text-zinc-950" : "border-zinc-700 bg-transparent"
                      }`}>
                        {item.state && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </button>
                  ))}
                  
                  <button
                    type="button"
                    onClick={() => setDocuments(!documents)}
                    className={`col-span-2 flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                      documents
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        : "bg-zinc-900 border-zinc-800 text-zinc-500"
                    }`}
                  >
                    <span className="text-xs font-semibold">Documentación a Bordo OK</span>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                      documents ? "bg-emerald-500 border-emerald-400 text-zinc-950" : "border-zinc-700 bg-transparent"
                    }`}>
                      {documents && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="irreg" className="text-zinc-400 text-xs">Irregularidades detectadas</Label>
                <Input
                  id="irreg"
                  placeholder="Detalles sobre ralladuras, ruidos o faltantes"
                  value={irregularities}
                  onChange={(e) => setIrregularities(e.target.value)}
                  className="border-zinc-800 bg-zinc-900 rounded-xl"
                />
              </div>

              <Button type="submit" className="w-full rounded-xl bg-emerald-500 text-zinc-950 font-bold hover:bg-emerald-400 transition-all cursor-pointer">
                Registrar Checklist
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Historial Reciente</h3>
        <div className="space-y-3">
          {assignments.slice(0, 5).map((asg) => (
            <Card key={asg.id} className="border-zinc-800 bg-zinc-900/30 overflow-hidden hover:bg-zinc-900/40 transition-colors">
              <div className="p-4 flex justify-between items-start">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {asg.action_type === "ASSIGN" ? (
                      <span className="px-2 py-0.5 text-[9px] font-bold rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Entrega / Asignación
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[9px] font-bold rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        Devolución / Retiro
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-zinc-200">{getVehicleName(asg.vehicle_id)}</h4>
                  <p className="text-xs text-zinc-400">Conductor: {getDriverName(asg.driver_id)}</p>
                  <p className="text-xs text-zinc-500 italic leading-snug border-l border-zinc-800 pl-2">“{asg.reason}”</p>
                </div>
                <span className="text-[10px] text-zinc-500 font-medium">{new Date(asg.created_at).toLocaleDateString()}</span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
