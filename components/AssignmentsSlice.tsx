"use client";

import React, { useState, useEffect } from "react";
import { db, Vehicle, Driver, Assignment, Checklist } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { getDriverName, getVehicleName } from "@/lib/lookups";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeftRight, ListChecks, Gauge, Check, Wrench, FileText } from "lucide-react";
import { FuelSlider } from "@/components/ui/FuelSlider";

import SliceHeader from "@/components/SliceHeader";

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
  const [assignSubtype, setAssignSubtype] = useState<"FIRST_TIME" | "CAR_CHANGE">("FIRST_TIME");

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

  useEffect(() => {
    let isStale = false;
    (async () => {
      const [vList, dList, aList, cList] = await Promise.all([
        db.getVehicles(),
        db.getDrivers(),
        db.getAssignments(),
        db.getChecklists(),
      ]);
      if (isStale) return;
      setVehicles(vList);
      setDrivers(dList);
      setAssignments(aList);
      setChecklists(cList);
    })();
    return () => {
      isStale = true;
    };
  }, []);

  const handleAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle || (assignType === "ASSIGN" && !selectedDriver)) return;

    const vehicleObj = vehicles.find((v) => v.id === selectedVehicle);
    const driverId = assignType === "ASSIGN" ? selectedDriver : (vehicleObj?.active_driver_id || "");

    if (!driverId) return;

    await db.createAssignment(selectedVehicle, driverId, assignType, assignReason);
    
    setIsAssignOpen(false);

    // Auto-trigger Checklist flow on-demand for pickups/deliveries
    setChecklistVehicle(selectedVehicle);
    setChecklistDriver(driverId);
    setChecklistType("DELIVERY");
    
    const vehicleChecklists = checklists.filter((c) => c.vehicle_id === selectedVehicle);
    const lastMileage = vehicleChecklists.length > 0
      ? Math.max(...vehicleChecklists.map((c) => c.mileage))
      : 0;
    setMileage(lastMileage);
    
    setIsChecklistOpen(true);

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

  // Fuel level is now handled by the shared FuelSlider component.

  return (
    <div className="space-y-5">
      {/* Header Row: Title on Left, Actions on Right */}
      <SliceHeader title="Asignaciones" />

      <div className="grid grid-cols-2 gap-3.5">
        <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
          <DialogTrigger asChild>
            <Button className="w-full h-14 rounded-2xl bg-card border border-border hover:bg-accent hover:text-accent-foreground text-foreground transition-all shadow-md active:scale-95 flex flex-col gap-0.5 justify-center py-2 cursor-pointer" variant="outline">
              <ArrowLeftRight className="w-5 h-5 text-primary" />
              <span className="text-[11px] font-bold">Asignación / Retiro</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="border border-border bg-background text-foreground rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-black text-foreground">Manejo de Asignación</DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                Asigna un auto a un chofer o retíralo de circulación por un motivo específico.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAssignment} className="space-y-4 pt-2">
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Acción</Label>
                <Select value={assignType} onValueChange={(val: "ASSIGN" | "RELEASE") => setAssignType(val)}>
                  <SelectTrigger className="border-input bg-background rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-popover text-popover-foreground">
                    <SelectItem value="ASSIGN">Asignar Auto</SelectItem>
                    <SelectItem value="RELEASE">Retirar Auto</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Auto / Vehículo</Label>
                <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                  <SelectTrigger className="border-input bg-background rounded-xl">
                    <SelectValue placeholder="Selecciona vehículo" />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-popover text-popover-foreground">
                    {vehicles
                      .filter((v) => assignType === "ASSIGN" ? v.active_driver_id === null : v.active_driver_id !== null)
                      .map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.brand} {v.vehicle_name} [{v.plate_number}]
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {assignType === "ASSIGN" && (
                <>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Conductor</Label>
                    <Select value={selectedDriver} onValueChange={(driverId) => {
                      setSelectedDriver(driverId);
                      if (driverId) {
                        const hasPriorAssignment = assignments.some(
                          (a) => a.driver_id === driverId && a.action_type === "ASSIGN"
                        );
                        setAssignSubtype(hasPriorAssignment ? "CAR_CHANGE" : "FIRST_TIME");
                      }
                    }}>
                      <SelectTrigger className="border-input bg-background rounded-xl">
                        <SelectValue placeholder="Selecciona conductor" />
                      </SelectTrigger>
                      <SelectContent className="border-border bg-popover text-popover-foreground">
                        {drivers
                          .filter((d) => !vehicles.some((v) => v.active_driver_id === d.id))
                          .map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.first_name} {d.paternal_last_name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Tipo de Asignación</Label>
                    <Select value={assignSubtype} onValueChange={(val: "FIRST_TIME" | "CAR_CHANGE") => setAssignSubtype(val)}>
                      <SelectTrigger className="border-input bg-background rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-border bg-popover text-popover-foreground">
                        <SelectItem value="FIRST_TIME">Primera Vez (Fianza + Renta)</SelectItem>
                        <SelectItem value="CAR_CHANGE">Cambio de Auto (Solo Renta)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground leading-snug">
                      {assignSubtype === "FIRST_TIME" 
                        ? "Carga una fianza de una semana ($2,500) más la renta inicial ($2,500). Total: $5,000 MXN."
                        : "Solo aplica el cobro normal de la renta semanal ($2,500 MXN)."}
                    </p>
                  </div>
                </>
              )}

              <div className="space-y-1">
                <Label htmlFor="reason" className="text-muted-foreground text-xs">Motivo / Notas</Label>
                <Input
                  id="reason"
                  placeholder="ej. Inicio de turno semanal, choque leve, mantenimiento"
                  value={assignReason}
                  onChange={(e) => setAssignReason(e.target.value)}
                  className="border-input bg-background rounded-xl w-full min-w-0"
                  required
                />
              </div>

              <Button type="submit" className="w-full rounded-xl bg-primary text-white font-bold hover:bg-primary transition-all cursor-pointer">
                Confirmar Operación
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isChecklistOpen} onOpenChange={setIsChecklistOpen}>
          <DialogTrigger asChild>
            <Button className="w-full h-14 rounded-2xl bg-card border border-border hover:bg-accent hover:text-accent-foreground text-foreground transition-all shadow-md active:scale-95 flex flex-col gap-0.5 justify-center py-2 cursor-pointer">
              <ListChecks className="w-5 h-5 text-primary" />
              <span className="text-[11px] font-bold">Checklist Semanal</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto border border-border bg-background text-foreground rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-black text-foreground">Checklist de Unidad</DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                Registra el kilometraje, octavos de gasolina y estado del auto de manera táctil.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleChecklist} className="space-y-4 pt-2">
              <Tabs defaultValue="general" className="w-full">
                <TabsList>
                  <TabsTrigger value="general" icon={<Gauge className="w-3.5 h-3.5" />}>
                    General
                  </TabsTrigger>
                  <TabsTrigger value="estado" icon={<Wrench className="w-3.5 h-3.5" />}>
                    Estado
                  </TabsTrigger>
                  <TabsTrigger value="notas" icon={<FileText className="w-3.5 h-3.5" />}>
                    Notas
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Tipo Checklist</Label>
                    <Select value={checklistType} onValueChange={(val: "DELIVERY" | "WEEKLY_START") => setChecklistType(val)}>
                      <SelectTrigger className="border-input bg-background rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-border bg-popover text-popover-foreground">
                        <SelectItem value="DELIVERY">Entrega de Unidad</SelectItem>
                        <SelectItem value="WEEKLY_START">Inicio de Semana</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Auto</Label>
                    <Select value={checklistVehicle} onValueChange={setChecklistVehicle}>
                      <SelectTrigger className="border-input bg-background rounded-xl">
                        <SelectValue placeholder="Vehículo" />
                      </SelectTrigger>
                      <SelectContent className="border-border bg-popover text-popover-foreground">
                        {vehicles.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.brand} {v.plate_number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Conductor Responsable</Label>
                    <Select value={checklistDriver} onValueChange={checklistDriver => setChecklistDriver(checklistDriver)}>
                      <SelectTrigger className="border-input bg-background rounded-xl">
                        <SelectValue placeholder="Chofer" />
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
                    <Label htmlFor="mileage" className="text-muted-foreground text-xs">Kilometraje Actual</Label>
                    <div className="relative">
                      <Gauge className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="number"
                        id="mileage"
                        value={mileage || ""}
                        onChange={(e) => setMileage(Number(e.target.value))}
                        className="border-input bg-background rounded-xl pl-9"
                        required
                      />
                    </div>
                  </div>
                  <FuelSlider value={gasolineLevel} onChange={setGasolineLevel} />
                </TabsContent>

                <TabsContent value="estado" className="space-y-3">
                  <div className="bg-muted/60 p-4 rounded-xl border border-border space-y-3.5">
                    <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Estado de Sistemas</h4>
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
                              ? "bg-primary/10 border-primary/30 text-primary"
                              : "bg-card border-border text-muted-foreground"
                          }`}
                        >
                          <span className="text-xs font-semibold">{item.label}</span>
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                            item.state ? "bg-primary border-primary text-white" : "border-border bg-transparent"
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
                            ? "bg-primary/10 border-primary/30 text-primary"
                            : "bg-card border-border text-muted-foreground"
                        }`}
                      >
                        <span className="text-xs font-semibold">Documentación a Bordo OK</span>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                          documents ? "bg-primary border-primary text-white" : "border-border bg-transparent"
                        }`}>
                          {documents && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="notas" className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="irreg" className="text-muted-foreground text-xs">Irregularidades detectadas</Label>
                    <Input
                      id="irreg"
                      placeholder="Detalles sobre ralladuras, ruidos o faltantes"
                      value={irregularities}
                      onChange={(e) => setIrregularities(e.target.value)}
                      className="border-input bg-background rounded-xl"
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <Button type="submit" className="w-full rounded-xl bg-primary text-white font-bold hover:bg-primary transition-all cursor-pointer">
                Registrar Checklist
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Historial Reciente</h3>
        <div className="space-y-3">
          {assignments.slice(0, 5).map((asg) => (
            <Card key={asg.id} className="border-border bg-card/30 overflow-hidden hover:bg-card/45 transition-colors">
              <div className="p-4 flex justify-between items-start">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {asg.action_type === "ASSIGN" ? (
                      <span className="px-2 py-0.5 text-[9px] font-bold rounded-md bg-primary/10 text-primary border border-primary/20">
                        Entrega / Asignación
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[9px] font-bold rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        Devolución / Retiro
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-foreground">{getVehicleName(vehicles, asg.vehicle_id)}</h4>
                  <p className="text-xs text-muted-foreground">Conductor: {getDriverName(drivers, asg.driver_id)}</p>
                  <p className="text-xs text-muted-foreground italic leading-snug border-l border-border pl-2">“{asg.reason}”</p>
                </div>
                <span className="text-[10px] text-muted-foreground font-medium">{formatDate(asg.created_at)}</span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
