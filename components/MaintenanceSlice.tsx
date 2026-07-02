"use client";

import React, { useState, useEffect } from "react";
import { db, Vehicle, Maintenance } from "@/lib/db";
import { getVehicleName } from "@/lib/lookups";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Wrench, Calendar as CalendarIcon, FileText } from "lucide-react";
import SliceHeader from "@/components/SliceHeader";

interface MaintenanceSliceProps {
  onRefreshAlerts: () => void;
}

export default function MaintenanceSlice({ onRefreshAlerts }: MaintenanceSliceProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  
  // Dialog & Form State
  const [isOpen, setIsOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [cost, setCost] = useState(0);
  const [description, setDescription] = useState("");
  const [maintenanceDate, setMaintenanceDate] = useState("");
  const [nextMaintenanceDate, setNextMaintenanceDate] = useState("");

  const loadData = async () => {
    const vList = await db.getVehicles();
    const mList = await db.getMaintenances();
    setVehicles(vList);
    setMaintenances(mList);
  };

  useEffect(() => {
    let isStale = false;
    (async () => {
      const [vList, mList] = await Promise.all([db.getVehicles(), db.getMaintenances()]);
      if (isStale) return;
      setVehicles(vList);
      setMaintenances(mList);
    })();
    return () => {
      isStale = true;
    };
  }, []);

  // Reload when parent signals a refresh.
  useEffect(() => {
    let isStale = false;
    (async () => {
      const [vList, mList] = await Promise.all([db.getVehicles(), db.getMaintenances()]);
      if (isStale) return;
      setVehicles(vList);
      setMaintenances(mList);
    })();
    return () => {
      isStale = true;
    };
  }, [onRefreshAlerts]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle || cost <= 0 || !maintenanceDate || !nextMaintenanceDate) return;

    await db.saveMaintenance({
      vehicle_id: selectedVehicle,
      cost: Number(cost),
      description,
      maintenance_date: maintenanceDate,
      next_maintenance_date: nextMaintenanceDate,
    });

    setIsOpen(false);
    setSelectedVehicle("");
    setCost(0);
    setDescription("");
    setMaintenanceDate("");
    setNextMaintenanceDate("");
    
    loadData();
    onRefreshAlerts();
  };

  return (
    <div className="space-y-4">
      {/* Header Row: Title on Left, Actions on Right */}
      <SliceHeader
        title="Servicios"
        action={
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-full bg-[#0088FF] hover:bg-[#0077EE] text-white text-xs font-bold px-5 h-10 border-none active:scale-95 transition-all cursor-pointer flex items-center justify-center shadow-xs">
                Registrar servicio
              </Button>
            </DialogTrigger>
            <DialogContent className="border border-border bg-background text-foreground rounded-2xl">
            <DialogHeader>
              <DialogTitle>Registrar Servicio Técnico</DialogTitle>
              <DialogDescription>
                Guarda los costos de taller y la fecha límite para la próxima inspección.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4 pt-2">
              <Tabs defaultValue="servicio" className="w-full">
                <TabsList>
                  <TabsTrigger value="servicio" icon={<Wrench className="w-3.5 h-3.5" />}>
                    Servicio
                  </TabsTrigger>
                  <TabsTrigger value="proximo" icon={<CalendarIcon className="w-3.5 h-3.5" />}>
                    Próximo
                  </TabsTrigger>
                  <TabsTrigger value="descripcion" icon={<FileText className="w-3.5 h-3.5" />}>
                    Detalles
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="servicio" className="space-y-3">
                  <div>
                    <Label>Auto / Unidad</Label>
                    <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona vehículo" />
                      </SelectTrigger>
                      <SelectContent>
                        {vehicles.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.brand} {v.vehicle_name} [{v.plate_number}]
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="maintCost">Costo del Servicio ($)</Label>
                    <Input
                      type="number"
                      id="maintCost"
                      value={cost || ""}
                      onChange={(e) => setCost(Number(e.target.value))}
                      placeholder="ej. 1800"
                      className="border-input bg-background rounded-xl w-full min-w-0"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="maintDate">Fecha del Servicio</Label>
                    <Input
                      type="date"
                      id="maintDate"
                      value={maintenanceDate}
                      onChange={(e) => setMaintenanceDate(e.target.value)}
                      className="border-input bg-background rounded-xl w-full min-w-0"
                      required
                    />
                  </div>
                </TabsContent>

                <TabsContent value="proximo" className="space-y-3">
                  <div>
                    <Label htmlFor="nextMaint">Fecha del Próximo Servicio</Label>
                    <Input
                      type="date"
                      id="nextMaint"
                      value={nextMaintenanceDate}
                      onChange={(e) => setNextMaintenanceDate(e.target.value)}
                      className="border-input bg-background rounded-xl w-full min-w-0"
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    El sistema te avisará cuando se acerque esta fecha.
                  </p>
                </TabsContent>

                <TabsContent value="descripcion" className="space-y-3">
                  <div>
                    <Label htmlFor="maintDesc">Descripción de Trabajos</Label>
                    <Input
                      id="maintDesc"
                      placeholder="Cambio de bujías, afinación, rectificación de discos..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="border-input bg-background rounded-xl w-full min-w-0"
                      required
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <Button type="submit" className="w-full rounded-xl">
                Guardar Registro
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {maintenances.map((maint) => (
          <Card key={maint.id} className="overflow-hidden">
            <div className="p-4 flex items-start justify-between">
              <div className="flex gap-3">
                <div className="p-2 bg-muted rounded-full h-fit">
                  <Wrench className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-foreground">
                    {getVehicleName(vehicles, maint.vehicle_id)}
                  </h4>
                  <p className="text-xs text-muted-foreground">{maint.description}</p>
                  <div className="flex gap-2 text-[10px] text-muted-foreground pt-1">
                    <span>Servicio: {maint.maintenance_date}</span>
                    <span>•</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">Próximo: {maint.next_maintenance_date}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-extrabold text-foreground">
                  ${maint.cost}
                </p>
              </div>
            </div>
          </Card>
        ))}

        {maintenances.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No se han registrado bitácoras de mantenimiento técnico.
          </div>
        )}
      </div>
    </div>
  );
}
