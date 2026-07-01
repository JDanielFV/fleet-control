import React, { useState } from "react";
import { db, Driver, Vehicle } from "../lib/db";
import { ActionItem } from "./ui/ActionItem";
import { ConfirmationDialog } from "./ui/ConfirmationDialog";
import { AssignmentSelector } from "./ui/AssignmentSelector";

interface EntityActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  entity: Driver | Vehicle | null;
  type: "driver" | "vehicle";
  isAssigned: boolean;
  onActionComplete?: () => void;
}

export const EntityActionSheet = ({ isOpen, onClose, entity, type, isAssigned, onActionComplete }: EntityActionSheetProps) => {
  const [view, setView] = useState<"main" | "assign" | "remove">("main");
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen || !entity) return null;

  const handleAssign = () => setView("assign");
  const handleRemove = () => {
    setView("remove");
    setConfirmingRemoval(true);
  };

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

  const executeRemoval = async (reason: string) => {
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
      setConfirmingRemoval(false);
      setView("main");
      onActionComplete?.();
    } catch (err) {
      alert("Error al retirar: " + err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChecklist = () => {
    // Use a custom event or simple window.location.hash for the launcher
    const id = type === "vehicle" ? (entity as Vehicle).id : (entity as Driver).id;
    window.location.hash = `checklist/${id}`;
    onClose();
  };

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl transition-transform duration-300 transform translate-y-0 max-h-[90vh] flex flex-col overflow-hidden">
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mt-3 mb-6 cursor-pointer" onClick={onClose} />
        
        <div className="px-6 pb-8 overflow-y-auto">
          {view === "main" && (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900">
                  {type === "driver" ? "Conductor" : "Vehículo"}
                </h2>
                <p className="text-slate-500 text-lg">
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
            </>
          )}

          {view === "assign" && (
            <AssignmentSelector 
              selecting={type === "driver" ? "vehicle" : "driver"} 
              onSelect={executeAssignment} 
              onCancel={() => setView("main")} 
            />
          )}

          {view === "remove" && confirmingRemoval && (
            <ConfirmationDialog 
              title="Retirar Asignación"
              message={`¿Estás seguro de retirar el ${type === "driver" ? 'vehículo' : 'conductor'}?`}
              onConfirm={executeRemoval}
              onCancel={() => {
                setConfirmingRemoval(false);
                setView("main");
              }}
            />
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
