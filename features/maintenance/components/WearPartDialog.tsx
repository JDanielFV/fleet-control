"use client";

import { useState, useEffect } from "react";
import { db, type Vehicle } from "@/lib/db";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

interface WearPartDialogProps {
  open: boolean;
  onClose: () => void;
  vehicle: Vehicle | null;
  onComplete: () => void;
}

export default function WearPartDialog({ open, onClose, vehicle, onComplete }: WearPartDialogProps) {
  const [partName, setPartName] = useState("");
  const [partCost, setPartCost] = useState("");
  const [partDate, setPartDate] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open && vehicle) {
      Promise.resolve().then(() => {
        setPartName("");
        setPartCost("");
        setPartDate(new Date().toISOString().split("T")[0]);
      });
    }
  }, [open, vehicle]);

  const handleSubmit = async () => {
    if (!vehicle || !partName.trim()) return;
    setIsLoading(true);
    try {
      await db.saveMaintenance({
        vehicle_id: vehicle.id,
        cost: parseFloat(partCost) || 0,
        description: `[REEMPLAZO PIEZA] ${partName.trim()}`,
        maintenance_date: partDate,
        next_maintenance_date: null,
      });
      onComplete();
      onClose();
    } catch (err) {
      alert("Error al guardar: " + err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm md:max-w-md border border-border bg-background text-foreground rounded-2xl">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-foreground font-black text-lg">
                  Reemplazo de Pieza de Desgaste
                </DialogTitle>
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-md">
                  Reporte
                </span>
              </div>
              <DialogDescription className="text-muted-foreground text-xs">
                {vehicle ? `${vehicle.brand} ${vehicle.vehicle_name} · ${vehicle.plate_number}` : "Cargando..."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-4 pt-2">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          >
            <Label className="text-muted-foreground text-xs">Pieza *</Label>
            <Input
              type="text"
              placeholder="Ej: Frenos, Llantas, Batería, Embrague"
              value={partName}
              onChange={(e) => setPartName(e.target.value)}
              className="mt-1.5 border-input bg-background rounded-xl"
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            <Label className="text-muted-foreground text-xs">Costo estimado ($)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={partCost}
              onChange={(e) => setPartCost(e.target.value)}
              className="mt-1.5 border-input bg-background rounded-xl"
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
          >
            <Label className="text-muted-foreground text-xs">Fecha de reparación</Label>
            <Input
              type="date"
              value={partDate}
              onChange={(e) => setPartDate(e.target.value)}
              className="mt-1.5 border-input bg-background rounded-xl"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="flex gap-2 pt-2"
          >
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 rounded-xl border-border active:scale-95 transition-transform"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!partName.trim() || isLoading}
              className="flex-1 rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-600 disabled:opacity-50 active:scale-95 transition-transform"
            >
              {isLoading ? "Guardando..." : "Guardar"}
            </Button>
          </motion.div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
