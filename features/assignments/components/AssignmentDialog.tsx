"use client";

import React, { useState, useEffect } from "react";
import { type Driver, type Vehicle } from "@/lib/db";
import { createAssignment } from "@/lib/db/assignments";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { User, Car, ArrowLeftRight, CheckCircle2, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

interface AssignmentDialogProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
  onAssign: (vehicleId: string, driverId: string) => void;
  drivers: Driver[];
  vehicles: Vehicle[];
  preselectDriver?: string | null;
  preselectVehicle?: string | null;
}

export default function AssignmentDialog({ open, onClose, onComplete, onAssign, drivers, vehicles, preselectDriver, preselectVehicle }: AssignmentDialogProps) {
  const [selectedDriver, setSelectedDriver] = useState<string | null>(preselectDriver || null);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(preselectVehicle || null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!open) {
      Promise.resolve().then(() => {
        setSelectedDriver(null);
        setSelectedVehicle(null);
        setSuccess(false);
      });
    }
  }, [open]);

  const availableDrivers = drivers.filter((d) => !vehicles.some((v) => v.active_driver_id === d.id));
  const availableVehicles = vehicles.filter((v) => !v.active_driver_id);

  const handleAssign = async () => {
    if (!selectedDriver || !selectedVehicle || isLoading) return;
    setIsLoading(true);
    try {
      await createAssignment(selectedVehicle, selectedDriver, "ASSIGN", "Asignación desde panel de checklists");
      setSuccess(true);
      setTimeout(() => {
        onAssign(selectedVehicle, selectedDriver);
        onComplete();
        onClose();
      }, 1200);
    } catch (err) {
      alert("Error al asignar: " + err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl border border-border bg-background text-foreground rounded-2xl">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 shrink-0">
              <ArrowLeftRight className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-foreground font-black text-lg">Asignar Auto a Chofer</DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                Selecciona un chofer y un vehículo disponible para asignarlos
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400" />
            <p className="text-sm font-bold text-foreground">¡Asignación exitosa!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 pt-2">
            {/* Drivers column */}
            <motion.div
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 min-w-0"
            >
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Choferes Disponibles
              </h3>
              <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                {availableDrivers.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-4 text-center">Todos los choferes tienen auto asignado</p>
                ) : (
                  availableDrivers.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => setSelectedDriver(d.id)}
                      className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all ${
                        selectedDriver === d.id
                          ? "border-primary bg-primary/10 text-primary font-bold"
                          : "border-border/60 bg-muted/20 hover:bg-muted/40 text-foreground"
                      }`}
                    >
                      <span className="block font-semibold">{d.first_name} {d.paternal_last_name}</span>
                      <span className="text-[10px] text-muted-foreground">{d.curp}</span>
                    </button>
                  ))
                )}
              </div>
            </motion.div>

            {/* Vehicles column */}
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 min-w-0"
            >
              <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground/80 mb-2 flex items-center gap-1.5">
                <Car className="w-3.5 h-3.5" /> Vehículos
              </h4>
              <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                {availableVehicles.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-4 text-center">Todos los autos están asignados</p>
                ) : (
                  availableVehicles.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVehicle(v.id)}
                      className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all ${
                        selectedVehicle === v.id
                          ? "border-primary bg-primary/10 text-primary font-bold"
                          : "border-border/60 bg-muted/20 hover:bg-muted/40 text-foreground"
                      }`}
                    >
                      <span className="block font-semibold">{v.brand} {v.vehicle_name}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{v.plate_number}</span>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}

        {!success && (
          <div className="flex gap-2 pt-4 border-t border-border/40">
            <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl border-border">
              Cancelar
            </Button>
            <Button
              onClick={handleAssign}
              disabled={!selectedDriver || !selectedVehicle || isLoading}
              className="flex-1 rounded-xl bg-primary text-white font-bold hover:bg-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Asignando...
                </span>
              ) : (
                "Asignar"
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
