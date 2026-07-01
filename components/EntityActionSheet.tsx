import React, { useEffect, useRef, useState } from "react";
import { db, Driver, Vehicle } from "../lib/db";
import { ActionItem } from "./ui/ActionItem";
import { AssignmentSelector } from "./ui/AssignmentSelector";

interface EntityActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  entity: Driver | Vehicle | null;
  type: "driver" | "vehicle";
  isAssigned: boolean;
  onActionComplete?: () => void;
}

type View = "main" | "assign" | "remove";

export const EntityActionSheet = ({ isOpen, onClose, entity, type, isAssigned, onActionComplete }: EntityActionSheetProps) => {
  const [view, setView] = useState<View>("main");
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  // Reset state when opening fresh so the next session starts clean.
  useEffect(() => {
    if (isOpen) {
      setView("main");
      setReason("");
    }
  }, [isOpen, entity?.id]);

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
    const id = type === "vehicle" ? (entity as Vehicle).id : (entity as Driver).id;
    window.location.hash = `checklist/${id}`;
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet — auto-sized to content, capped at 92dvh with safe-area padding */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl transition-transform duration-300 max-h-[min(92dvh,calc(100dvh-env(safe-area-inset-top)))] flex flex-col overflow-hidden"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        {/* Drag handle */}
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mt-3 mb-4 cursor-pointer shrink-0" onClick={onClose} />

        {/* Scrollable content area */}
        <div className="px-6 overflow-y-auto overflow-x-hidden flex-1 overscroll-contain">
          {view === "main" && (
            <div className="pb-2">
              <div className="mb-5">
                <h2 className="text-2xl font-bold text-slate-900">
                  {type === "driver" ? "Conductor" : "Vehículo"}
                </h2>
                <p className="text-slate-500 text-lg break-words">
                  {type === "driver"
                    ? `${(entity as Driver).first_name} ${(entity as Driver).paternal_last_name}`
                    : `${(entity as Vehicle).brand} ${(entity as Vehicle).vehicle_name}`}
                </p>
              </div>

              <div className="space-y-2">
                {!isAssigned ? (
                  <ActionItem
                    label={type === "driver" ? "Asignar Vehículo" : "Asignar Conductor"}
                    onClick={handleAssign}
                    icon="🚗"
                  />
                ) : (
                  <ActionItem
                    label={type === "driver" ? "Retirar Vehículo" : "Retirar Conductor"}
                    onClick={handleRemove}
                    variant="danger"
                    icon="🚫"
                  />
                )}

                {type === "vehicle" && (
                  <ActionItem
                    label="Hacer Checklist"
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
                <h3 className="text-lg font-bold text-slate-900">Retirar Asignación</h3>
                <button
                  onClick={() => setView("main")}
                  className="text-slate-400 hover:text-slate-600 p-2 -mr-2"
                  aria-label="Volver"
                >
                  ←
                </button>
              </div>
              <p className="text-slate-500 text-sm mb-3">
                ¿Estás seguro de retirar {type === "driver" ? "el vehículo" : "al conductor"} de {type === "driver"
                  ? `${(entity as Driver).first_name} ${(entity as Driver).paternal_last_name}`
                  : `${(entity as Vehicle).brand} ${(entity as Vehicle).vehicle_name}`}?
              </p>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Motivo
              </label>
              <textarea
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none"
                rows={3}
                placeholder="Explique el motivo del retiro..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <div className="flex gap-2 pt-4 pb-2">
                <button
                  onClick={() => setView("main")}
                  className="flex-1 px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  disabled={!reason.trim() || isLoading}
                  onClick={executeRemoval}
                  className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Confirmar
                </button>
              </div>
            </div>
          )}
        </div>

        {isLoading && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-[60]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>
    </>
  );
};
