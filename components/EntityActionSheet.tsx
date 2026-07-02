import React, { useEffect, useState } from "react";
import { db, Driver, Vehicle } from "../lib/db";
import { ActionItem } from "./ui/ActionItem";
import { AssignmentSelector } from "./ui/AssignmentSelector";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { motion } from "framer-motion";
import { Car, Ban, ClipboardList, Wrench, CheckCircle2, X } from "lucide-react";

interface EntityActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  entity: Driver | Vehicle | null;
  type: "driver" | "vehicle";
  isAssigned: boolean;
  onActionComplete?: () => void;
  onRequestChecklist?: (vehicle: Vehicle) => void;
  /**
   * Called after a successful vehicle-to-driver assignment from inside the sheet.
   * The Dashboard uses this to auto-open the ChecklistSheet so the user can
   * capture the initial state of the freshly assigned unit.
   */
  onVehicleAssigned?: (vehicle: Vehicle) => void;
}

type View = "main" | "assign" | "remove" | "service";

export const EntityActionSheet = ({ isOpen, onClose, entity, type, isAssigned, onActionComplete, onRequestChecklist, onVehicleAssigned }: EntityActionSheetProps) => {
  const [view, setView] = useState<View>("main");
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Service form state
  const [serviceCost, setServiceCost] = useState(0);
  const [serviceDescription, setServiceDescription] = useState("");
  const [serviceDate, setServiceDate] = useState("");
  const [nextServiceDate, setNextServiceDate] = useState("");

  // Reset state when the sheet closes so the next session starts clean.
  // The resets are scheduled in a microtask to avoid cascading renders that
  // the React 19 `react-hooks/set-state-in-effect` rule flags.
  useEffect(() => {
    if (!isOpen) {
      Promise.resolve().then(() => {
        setView("main");
        setReason("");
        setServiceCost(0);
        setServiceDescription("");
        setServiceDate("");
        setNextServiceDate("");
      });
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
      // For vehicle sheets, auto-open the ChecklistSheet so the user can
      // capture mileage, gas and the next service schedule right away.
      if (type === "vehicle" && onVehicleAssigned) {
        onVehicleAssigned(entity as Vehicle);
      }
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
      let vehicleId: string | null = null;
      let driverId: string | null = null;

      if (type === "driver") {
        const driver = entity as Driver;
        driverId = driver.id;
        // Find the vehicle currently assigned to this driver
        const vehicles = await db.getVehicles();
        const activeVehicle = vehicles.find(v => v.active_driver_id === driver.id);
        if (activeVehicle) {
          vehicleId = activeVehicle.id;
        } else {
          // Fallback: look for the most recent ASSIGN entry in the log
          const assignments = await db.getAssignments();
          const lastAssign = assignments.find(a => a.driver_id === driver.id && a.action_type === "ASSIGN");
          if (lastAssign) vehicleId = lastAssign.vehicle_id;
        }
      } else {
        const vehicle = entity as Vehicle;
        vehicleId = vehicle.id;
        driverId = vehicle.active_driver_id;
      }

      if (!vehicleId || !driverId) {
        throw new Error("No hay una asignación activa para este elemento.");
      }

      await db.removeAssignment(vehicleId, driverId, reason);
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

  const handleOpenService = () => {
    if (type === "vehicle") {
      setServiceDate(new Date().toISOString().slice(0, 10));
      setView("service");
    }
  };

  const handleMarkVerification = async () => {
    if (type !== "vehicle") return;
    if (!confirm("¿Marcar la verificación vehicular como completada?")) return;
    setIsLoading(true);
    try {
      const vehicle = entity as Vehicle;
      await db.dismissAlert(`alert-ver-${vehicle.id}`);
      onActionComplete?.();
    } catch (err) {
      alert("Error al marcar verificación: " + err);
    } finally {
      setIsLoading(false);
    }
  };

  const executeService = async () => {
    if (type !== "vehicle") return;
    if (serviceCost <= 0 || !serviceDate || !nextServiceDate || !serviceDescription.trim()) return;

    setIsLoading(true);
    try {
      const vehicle = entity as Vehicle;
      await db.saveMaintenance({
        vehicle_id: vehicle.id,
        cost: Number(serviceCost),
        description: serviceDescription.trim(),
        maintenance_date: serviceDate,
        next_maintenance_date: nextServiceDate,
      });
      setView("main");
      onActionComplete?.();
    } catch (err) {
      alert("Error al registrar servicio: " + err);
    } finally {
      setIsLoading(false);
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

      {/* Bottom Sheet on mobile / Side Panel on desktop — auto-sized to content, capped at 92dvh with safe-area padding */}
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ y: "100%", x: 0 }}
        animate={{ y: 0, x: 0 }}
        exit={{ y: "100%", x: 0 }}
        transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border rounded-t-3xl shadow-2xl flex flex-col overflow-hidden max-h-[min(92dvh,calc(100dvh-env(safe-area-inset-top)))]
          md:bottom-0 md:left-auto md:right-0 md:top-0 md:w-[420px] md:max-h-screen md:h-screen md:rounded-none md:rounded-l-3xl md:border-t-0 md:border-l md:border-r-0"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        {/* Drag handle (mobile) / Side grab (desktop) */}
        <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mt-3 mb-4 cursor-pointer shrink-0 md:mx-4 md:mt-4" onClick={onClose} />

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
                    icon={<Car className="w-5 h-5" />}
                  />
                ) : (
                  <ActionItem
                    label={type === "driver" ? "Retirar Auto" : "Retirar Chofer"}
                    onClick={handleRemove}
                    variant="danger"
                    icon={<Ban className="w-5 h-5" />}
                  />
                )}

                {type === "vehicle" && (
                  <ActionItem
                    label="Registrar Checklist"
                    onClick={handleChecklist}
                    icon={<ClipboardList className="w-5 h-5" />}
                  />
                )}

                {type === "vehicle" && (
                  <ActionItem
                    label="Registrar Servicio"
                    onClick={handleOpenService}
                    icon={<Wrench className="w-5 h-5" />}
                  />
                )}

                {type === "vehicle" && (
                  <ActionItem
                    label="Marcar Verificación como Lista"
                    onClick={handleMarkVerification}
                    icon={<CheckCircle2 className="w-5 h-5" />}
                  />
                )}

                <ActionItem
                  label="Cerrar"
                  onClick={onClose}
                  variant="secondary"
                  icon={<X className="w-5 h-5" />}
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

          {view === "service" && type === "vehicle" && (
            <div className="pb-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-foreground">Registrar Servicio</h3>
                <button
                  onClick={() => setView("main")}
                  className="text-muted-foreground hover:text-foreground p-2 -mr-2 cursor-pointer"
                  aria-label="Volver"
                >
                  ←
                </button>
              </div>
              <p className="text-muted-foreground text-sm mb-4">
                Para <span className="font-bold text-foreground">{(entity as Vehicle).brand} {(entity as Vehicle).vehicle_name}</span>. Guarda el costo y la fecha del próximo mantenimiento.
              </p>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="serviceCost" className="text-muted-foreground text-xs">Costo del Servicio ($)</Label>
                  <Input
                    id="serviceCost"
                    type="number"
                    value={serviceCost || ""}
                    onChange={(e) => setServiceCost(Number(e.target.value))}
                    placeholder="ej. 1800"
                    className="border-input bg-background rounded-xl w-full min-w-0"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="serviceDate" className="text-muted-foreground text-xs">Fecha del Servicio</Label>
                  <Input
                    id="serviceDate"
                    type="date"
                    value={serviceDate}
                    onChange={(e) => setServiceDate(e.target.value)}
                    className="border-input bg-background rounded-xl w-full min-w-0"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="nextServiceDate" className="text-muted-foreground text-xs">Próximo Servicio</Label>
                  <Input
                    id="nextServiceDate"
                    type="date"
                    value={nextServiceDate}
                    onChange={(e) => setNextServiceDate(e.target.value)}
                    className="border-input bg-background rounded-xl w-full min-w-0"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="serviceDescription" className="text-muted-foreground text-xs">Descripción de Trabajos</Label>
                  <Input
                    id="serviceDescription"
                    value={serviceDescription}
                    onChange={(e) => setServiceDescription(e.target.value)}
                    placeholder="ej. Cambio de bujías y afinación"
                    className="border-input bg-background rounded-xl w-full min-w-0"
                    required
                  />
                </div>

                <div className="flex gap-2 pt-2 pb-2">
                  <button
                    onClick={() => setView("main")}
                    className="flex-1 px-4 py-2 text-foreground bg-muted hover:bg-secondary font-medium rounded-lg transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    disabled={
                      isLoading ||
                      serviceCost <= 0 ||
                      !serviceDate ||
                      !nextServiceDate ||
                      !serviceDescription.trim()
                    }
                    onClick={executeService}
                    className="flex-1 px-4 py-2 bg-primary text-white font-medium rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    Guardar Servicio
                  </button>
                </div>
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
