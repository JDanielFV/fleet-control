"use client";

import { motion } from "framer-motion";
import { ClipboardList, Wrench, AlertTriangle, Package, DollarSign, X } from "lucide-react";
import type { Vehicle } from "@/lib/db";

interface ChecklistActionModalProps {
  open: boolean;
  vehicle: Vehicle | null;
  onClose: () => void;
  onChecklist: (vehicle: Vehicle) => void;
  onServiceOut: (vehicle: Vehicle) => void;
  onServiceReturn: (vehicle: Vehicle) => void;
  onWearPart: (vehicle: Vehicle) => void;
  onInventory: (vehicle: Vehicle) => void;
  onPayment: (vehicle: Vehicle) => void;
}

export default function ChecklistActionModal({
  open, vehicle, onClose, onChecklist, onServiceOut, onServiceReturn, onWearPart, onInventory, onPayment,
}: ChecklistActionModalProps) {
  if (!open || !vehicle) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="fixed inset-0 bg-black/75 z-40 backdrop-blur-md"
        onClick={onClose} aria-hidden="true"
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <motion.div
          role="dialog" aria-modal="true"
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="w-full max-w-sm bg-card border border-border rounded-3xl shadow-2xl flex flex-col overflow-hidden pointer-events-auto"
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border/40 shrink-0">
            <div>
              <h2 className="text-lg font-black text-foreground">Acción para Vehículo</h2>
              <p className="text-xs text-muted-foreground mt-0.5 font-semibold">
                {vehicle.brand} {vehicle.vehicle_name} · {vehicle.plate_number}
              </p>
            </div>
            <button onClick={onClose} className="p-2.5 rounded-full text-foreground hover:bg-secondary cursor-pointer transition-all active:scale-90" aria-label="Cerrar" style={{ minWidth: "40px", minHeight: "40px" }}>
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-3">
            <motion.button
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => { onChecklist(vehicle); onClose(); }}
              className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary transition-all cursor-pointer text-left active:scale-[0.98]"
            >
              <div className="p-2.5 rounded-xl bg-primary/20 shrink-0"><ClipboardList className="w-5 h-5" /></div>
              <div className="min-w-0 flex-1">
                <span className="block text-sm font-extrabold">Checklist Semanal</span>
                <span className="block text-[11px] text-muted-foreground mt-0.5">Registrar revisión técnica y kilometraje</span>
              </div>
            </motion.button>

            {vehicle.status === "in_service" ? (
              <motion.button
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                onClick={() => { onServiceReturn(vehicle); onClose(); }}
                className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-600  transition-all cursor-pointer text-left active:scale-[0.98]"
              >
                <div className="p-2.5 rounded-xl bg-emerald-500/20 shrink-0"><Wrench className="w-5 h-5" /></div>
                <div className="min-w-0 flex-1">
                  <span className="block text-sm font-extrabold">Devolver a Chofer</span>
                  <span className="block text-[11px] text-muted-foreground mt-0.5">Regresar vehículo del taller (aplica condonación)</span>
                </div>
              </motion.button>
            ) : (
              <motion.button
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                onClick={() => { onServiceOut(vehicle); onClose(); }}
                className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-600  transition-all cursor-pointer text-left active:scale-[0.98]"
              >
                <div className="p-2.5 rounded-xl bg-amber-500/20 shrink-0"><Wrench className="w-5 h-5" /></div>
                <div className="min-w-0 flex-1">
                  <span className="block text-sm font-extrabold">Retirar a Servicio</span>
                  <span className="block text-[11px] text-muted-foreground mt-0.5">Marcar vehículo como en taller (sin costo de renta)</span>
                </div>
              </motion.button>
            )}

            <motion.button
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => { onWearPart(vehicle); onClose(); }}
              className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-600  transition-all cursor-pointer text-left active:scale-[0.98]"
            >
              <div className="p-2.5 rounded-xl bg-red-500/20 shrink-0"><AlertTriangle className="w-5 h-5" /></div>
              <div className="min-w-0 flex-1">
                <span className="block text-sm font-extrabold">Reemplazo de Pieza de Desgaste</span>
                <span className="block text-[11px] text-muted-foreground mt-0.5">Reportar reemplazo de pieza (llantas, balatas, etc.)</span>
              </div>
            </motion.button>

            <motion.button
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => { onPayment(vehicle); onClose(); }}
              className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-600 dark:text-green-400 transition-all cursor-pointer text-left active:scale-[0.98]"
            >
              <div className="p-2.5 rounded-xl bg-green-500/20 shrink-0"><DollarSign className="w-5 h-5" /></div>
              <div className="min-w-0 flex-1">
                <span className="block text-sm font-extrabold">Cobrar Renta</span>
                <span className="block text-[11px] text-muted-foreground mt-0.5">Registrar pago de renta semanal</span>
              </div>
            </motion.button>

            <motion.button
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => { onInventory(vehicle); onClose(); }}
              className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-600  transition-all cursor-pointer text-left active:scale-[0.98]"
            >
              <div className="p-2.5 rounded-xl bg-blue-500/20 shrink-0"><Package className="w-5 h-5" /></div>
              <div className="min-w-0 flex-1">
                <span className="block text-sm font-extrabold">Inventario del Auto</span>
                <span className="block text-[11px] text-muted-foreground mt-0.5">Tomar fotos del auto y registrar objetos a bordo</span>
              </div>
            </motion.button>
          </div>

          <div className="px-5 pb-4">
            <button onClick={onClose} className="w-full py-3 rounded-xl bg-muted hover:bg-secondary text-foreground font-bold text-sm transition-all cursor-pointer border-none active:scale-[0.98]">
              Cancelar
            </button>
          </div>
        </motion.div>
      </div>
    </>
  );
}
