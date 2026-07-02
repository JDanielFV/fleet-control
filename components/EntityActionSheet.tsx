import React, { useEffect, useState } from "react";
import { db, Driver, Vehicle } from "../lib/db";
import { ActionItem } from "./ui/ActionItem";
import { AssignmentSelector } from "./ui/AssignmentSelector";
import { motion } from "framer-motion";

interface EntityActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  entity: Driver | Vehicle | null;
  type: "driver" | "vehicle";
  isAssigned: boolean;
  onActionComplete?: () => void;
  onRequestChecklist?: (vehicle: Vehicle) => void;
}

type View = "main" | "assign" | "remove";

export const EntityActionSheet = ({ isOpen, onClose, entity, type, isAssigned, onActionComplete, onRequestChecklist }: EntityActionSheetProps) => {
  const [view, setView] = useState<View>("main");
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Reset state when the sheet closes so the next session starts clean.
  useEffect(() => {
    if (!isOpen) {
      setView("main");
      setReason("");
    }
  }, [isOpen]);

  if (!isOpen || !entity) return null;

  const handleAssign = () => setView("assign");
  const handleRemove = () => setView("remove");

  const executeAssignment = async (targetId: string) => {
    setIsLoading(true);
    try {
      if (type === "driver") {
        const driver = entity as Driver;
        await db.createAssignment(targetId, driver.id, "ASSIGN", "Asignación rápida desde Action Sheet");
      } else {
        const vehicle = entity as Vehicle;
        await db.createAssignment(vehicle.id, targetId, "ASSIGN", "Asignación rápida desde Action Sheet");
      }
      setView("main");
      onActionComplete?.();
    } catch (err) {
      alert("Error al asignar: " + err);
    } finally {
      setIsLoading(false);
    }
  };

  const executeRemoval = async () => {
    if (!reason.trim()) return;
    setIsLoading(true);
    try {
      const assignments = await db.getAssignments();
      const current = assignments.find(a => {
        if (type === "driver") {
          const driver = entity as Driver;
          return a.driver_id === driver.id && a.action_type === "ASSIGN";
        } else {
          const vehicle = entity as Vehicle;
          return a.vehicle_id === vehicle.id && a.action_type === "ASSIGN";
        }
      });

      if (!current) throw new Error("No se encontró asignación activa");

      await db.removeAssignment(current.id, reason);
      setReason("");
      setView("main");
      onActionComplete?.();
    } catch (err) {
      alert("Error al retirar: " + err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChecklist = () => {
    if (type === "vehicle" && onRequestChecklist) {
      onRequestChecklist(entity as Vehicle);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
        className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet — auto-sized to content, capped at 92dvh with safe-area padding */}
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border rounded-t-3xl shadow-2xl flex flex-col overflow-hidden max-h-[min(92dvh,calc(100dvh-env(safe-area-inset-top)))]"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        {/* Drag handle */}
        <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mt-3 mb-4 cursor-pointer shrink-0" onClick={onClose} />

        {/* Scrollable content area */}
        <div className="px-6 overflow-y-auto overflow-x-hidden flex-1 overscroll-contain">
          {view === "main" && (
            <div className="pb-2">
              <div className="mb-5">
                <h2 className="text-2xl font-bold text-foreground">
                  {type === "driver" ? "Chofer" : "Auto"}
                </h2>
                <p className="text-muted-foreground text-lg break-words">
                  {type === "driver"
                    ? `${(entity as Driver).first_name} ${(entity as Driver).paternal_last_name}`
                    : `${(entity as Vehicle).brand} ${(entity as Vehicle).vehicle_name}`}
                </p>
              </div>

              <div className="space-y-2">
                {!isAssigned ? (
                  <ActionItem
                    label={type === "driver" ? "Asignar Auto" : "Asignar Chofer"}
                    onClick={handleAssign}
                    icon="🚗"
                  />
                ) : (
                  <ActionItem
                    label={type === "driver" ? "Retirar Auto" : "Retirar Chofer"}
                    onClick={handleRemove}
                    variant="danger"
                    icon="🚫"
                  />
                )}

                {type === "vehicle" && (
                  <ActionItem
                    label="Registrar Checklist"
                    onClick={handleChecklist}
                    icon="📋"
                  />
                )}

                <ActionItem
                  label="Cerrar"
                  onClick={onClose}
                  variant="secondary"
                  icon="✕"
                />
              </div>
            </div>
          )}

          {view === "assign" && (
            <div className="pb-2">
              <AssignmentSelector
                selecting={type === "driver" ? "vehicle" : "driver"}
                onSelect={executeAssignment}
                onCancel={() => setView("main")}
              />
            </div>
          )}

          {view === "remove" && (
            <div className="pb-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-foreground">Retirar Asignación</h3>
                <button
                  onClick={() => setView("main")}
                  className="text-muted-foreground hover:text-foreground p-2 -mr-2 cursor-pointer"
                  aria-label="Volver"
                >
                  ←
                </button>
              </div>
              <p className="text-muted-foreground text-sm mb-3">
                ¿Estás seguro de retirar {type === "driver" ? "el auto" : "al chofer"} de {type === "driver"
                  ? `${(entity as Driver).first_name} ${(entity as Driver).paternal_last_name}`
                  : `${(entity as Vehicle).brand} ${(entity as Vehicle).vehicle_name}`}?
              </p>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Motivo
              </label>
              <textarea
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all resize-none"
                rows={3}
                placeholder="Explique el motivo del retiro..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <div className="flex gap-2 pt-4 pb-2">
                <button
                  onClick={() => setView("main")}
                  className="flex-1 px-4 py-2 text-foreground bg-muted hover:bg-secondary font-medium rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  disabled={!reason.trim() || isLoading}
                  onClick={executeRemoval}
                  className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  Confirmar
                </button>
              </div>
            </div>
          )}
        </div>

        {isLoading && (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center z-[60]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}
      </motion.div>
    </>
  );
};
