import React, { useEffect, useState, useMemo } from "react";
import { db, Driver, Vehicle } from "../lib/db";
import { ActionItem } from "./ui/ActionItem";
import { AssignmentSelector } from "./ui/AssignmentSelector";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { motion } from "framer-motion";
import { Car, Ban, ClipboardList, CheckCircle2, X, User } from "lucide-react";

interface EntityActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  driver?: Driver | null;
  vehicle?: Vehicle | null;
  isInline?: boolean;

  entity?: Driver | Vehicle | null;
  type?: "driver" | "vehicle";
  isAssigned?: boolean;

  onActionComplete?: () => void;
  onRequestChecklist?: (vehicle: Vehicle) => void;
  onVehicleAssigned?: (vehicle: Vehicle) => void;
}

type View = "main" | "assign" | "remove";

export const EntityActionSheet = ({
  isOpen,
  onClose,
  driver,
  vehicle,
  isInline = false,
  entity,
  type,
  isAssigned,
  onActionComplete,
  onRequestChecklist,
  onVehicleAssigned,
}: EntityActionSheetProps) => {
  const [view, setView] = useState<View>("main");
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [resolvedDriver, setResolvedDriver] = useState<Driver | null>(null);
  const [resolvedVehicle, setResolvedVehicle] = useState<Vehicle | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const resolveEntities = async () => {
      if (driver !== undefined || vehicle !== undefined) {
        setResolvedDriver(driver || null);
        setResolvedVehicle(vehicle || null);
        return;
      }

      if (entity) {
        if (type === "driver") {
          const d = entity as Driver;
          setResolvedDriver(d);
          const vehicles = await db.getVehicles();
          const v = vehicles.find((x) => x.active_driver_id === d.id) || null;
          setResolvedVehicle(v);
        } else {
          const v = entity as Vehicle;
          setResolvedVehicle(v);
          const drivers = await db.getDrivers();
          const d = drivers.find((x) => x.id === v.active_driver_id) || null;
          setResolvedDriver(d);
        }
      }
    };

    resolveEntities();
  }, [isOpen, driver, vehicle, entity, type]);

  useEffect(() => {
    if (!isOpen) {
      Promise.resolve().then(() => {
        setView("main");
        setReason("");
        setResolvedDriver(null);
        setResolvedVehicle(null);
      });
    }
  }, [isOpen]);

  if (!isOpen || (!resolvedDriver && !resolvedVehicle)) return null;

  const hasActiveAssignment = !!resolvedDriver && !!resolvedVehicle;

  const handleAssign = () => setView("assign");
  const handleRemove = () => setView("remove");

  const executeAssignment = async (targetId: string) => {
    setIsLoading(true);
    try {
      if (resolvedDriver) {
        await db.createAssignment(targetId, resolvedDriver.id, "ASSIGN", "Asignación rápida desde Action Sheet");
        onActionComplete?.();
        if (onVehicleAssigned) {
          const vehicles = await db.getVehicles();
          const vehicleObj = vehicles.find((v) => v.id === targetId);
          if (vehicleObj) onVehicleAssigned(vehicleObj);
        }
      } else if (resolvedVehicle) {
        await db.createAssignment(resolvedVehicle.id, targetId, "ASSIGN", "Asignación rápida desde Action Sheet");
        onActionComplete?.();
        if (onVehicleAssigned) {
          onVehicleAssigned(resolvedVehicle);
        }
      }
      setView("main");
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
      const vId = resolvedVehicle?.id;
      const dId = resolvedDriver?.id;

      if (!vId || !dId) {
        throw new Error("No hay una asignación activa para este elemento.");
      }

      await db.removeAssignment(vId, dId, reason);
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
    if (resolvedVehicle && onRequestChecklist) {
      onRequestChecklist(resolvedVehicle);
    }
  };

  const handleMarkVerification = async () => {
    if (!resolvedVehicle) return;
    if (!confirm("¿Marcar la verificación vehicular como completada?")) return;
    setIsLoading(true);
    try {
      await db.dismissAlert(`alert-ver-${resolvedVehicle.id}`);
      onActionComplete?.();
    } catch (err) {
      alert("Error al marcar verificación: " + err);
    } finally {
      setIsLoading(false);
    }
  };

  const renderSheetContents = () => (
    <>
      <div className="flex items-center justify-end px-6 pt-4 pb-2 shrink-0 border-b border-border/40">
        <div className="w-12 h-1.5 bg-muted rounded-full md:hidden mr-auto" aria-hidden="true" />
        {onClose && (
          <button
            onClick={onClose}
            className="p-3 -mr-2 rounded-full text-foreground hover:bg-secondary/80 focus-visible:ring-4 focus-visible:ring-primary focus-visible:outline-hidden cursor-pointer transition-all active:scale-90"
            aria-label="Cerrar panel de acciones"
            style={{ minWidth: "48px", minHeight: "48px" }}
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="px-6 overflow-y-auto overflow-x-hidden flex-1 overscroll-contain pb-6">
        {view === "main" && (
          <div className="space-y-6 pt-4">
            <div>
              <h2 id="sheet-title" className="text-[20px] font-black text-foreground tracking-tight leading-tight mb-2">
                Detalles de Operación
              </h2>

              <div className="space-y-3 mt-4">
                {resolvedDriver ? (
                  <div className="flex items-start gap-3 p-3 bg-secondary/40 dark:bg-muted/30 rounded-2xl border border-border/50">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <User className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Chofer</span>
                      <span className="block text-base font-extrabold text-foreground truncate">
                        {`${resolvedDriver.first_name} ${resolvedDriver.paternal_last_name}`}
                      </span>
                      <span className="block text-xs text-muted-foreground mt-0.5">
                        Lic: <strong className="text-foreground">{resolvedDriver.license_number}</strong>
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 rounded-2xl border border-yellow-500/20 text-xs font-semibold">
                    Sin chofer asignado a esta operación
                  </div>
                )}

                {resolvedVehicle ? (
                  <div className="flex items-start gap-3 p-3 bg-secondary/40 dark:bg-muted/30 rounded-2xl border border-border/50">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Car className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Vehículo</span>
                      <span className="block text-base font-extrabold text-foreground truncate">
                        {`${resolvedVehicle.brand} ${resolvedVehicle.vehicle_name}`}
                      </span>
                      <span className="block text-xs text-muted-foreground mt-0.5">
                        Placas: <strong className="text-foreground">{resolvedVehicle.plate_number}</strong>
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 rounded-2xl border border-yellow-500/20 text-xs font-semibold">
                    Sin vehículo asignado actualmente
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3.5">
              <span className="block text-xs font-extrabold text-muted-foreground uppercase tracking-wider mb-2">Acciones</span>

              {hasActiveAssignment ? (
                <button
                  onClick={handleRemove}
                  className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-colors font-bold text-sm cursor-pointer focus-visible:ring-4 focus-visible:ring-red-500/50 focus-visible:outline-hidden"
                >
                  <Ban className="w-5 h-5 shrink-0" />
                  <span>Retirar Vehículo</span>
                </button>
              ) : (
                <button
                  onClick={handleAssign}
                  className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl border border-primary/20 bg-primary/10 hover:bg-primary/25 text-primary transition-colors font-bold text-sm cursor-pointer focus-visible:ring-4 focus-visible:ring-primary/50 focus-visible:outline-hidden"
                >
                  <Car className="w-5 h-5 shrink-0" />
                  <span>{resolvedDriver ? "Asignar Vehículo" : "Asignar Chofer"}</span>
                </button>
              )}

              {resolvedVehicle && (
                <>
                  <button
                    onClick={handleChecklist}
                    className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl bg-secondary hover:bg-secondary/80 text-foreground transition-all font-bold text-sm cursor-pointer border-none focus-visible:ring-4 focus-visible:ring-primary focus-visible:outline-hidden"
                  >
                    <ClipboardList className="w-5 h-5 text-primary shrink-0" />
                    <span>Registrar Checklist Semanal</span>
                  </button>

                  <button
                    onClick={handleMarkVerification}
                    className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl bg-secondary hover:bg-secondary/80 text-foreground transition-all font-bold text-sm cursor-pointer border-none focus-visible:ring-4 focus-visible:ring-primary focus-visible:outline-hidden"
                  >
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                    <span>Marcar Verificación como Completada</span>
                  </button>
                </>
              )}

              {!isInline && (
                <button
                  onClick={onClose}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-muted text-foreground hover:bg-secondary transition-all font-bold text-sm cursor-pointer border-none focus-visible:ring-4 focus-visible:ring-primary focus-visible:outline-hidden"
                >
                  <span>Cerrar</span>
                </button>
              )}
            </div>
          </div>
        )}

        {view === "assign" && (
          <div className="pt-4">
            <AssignmentSelector
              selecting={resolvedDriver ? "vehicle" : "driver"}
              onSelect={executeAssignment}
              onCancel={() => setView("main")}
            />
          </div>
        )}

        {view === "remove" && (
          <div className="pt-4 space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="text-lg font-bold text-foreground">Retirar Asignación</h3>
              <button
                onClick={() => setView("main")}
                className="text-primary font-bold hover:underline p-2 -mr-2 cursor-pointer text-sm"
                aria-label="Volver al menú anterior"
              >
                ← Volver
              </button>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              ¿Estás seguro de retirar el auto <strong className="text-foreground">{resolvedVehicle?.brand} {resolvedVehicle?.vehicle_name}</strong> de <strong className="text-foreground">{resolvedDriver?.first_name} {resolvedDriver?.paternal_last_name}</strong>?
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="removeReason" className="text-sm font-bold text-foreground">
                Motivo de Retiro (Requerido)
              </Label>
              <textarea
                id="removeReason"
                className="w-full px-4 py-3 border-2 border-border bg-background text-foreground rounded-2xl focus:ring-4 focus:ring-primary/50 focus:border-primary outline-hidden transition-all resize-none text-sm leading-normal"
                rows={3}
                placeholder="Escriba detalladamente el motivo del retiro..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setView("main")}
                className="flex-1 px-4 py-3.5 text-foreground bg-secondary hover:bg-secondary/80 font-bold text-sm rounded-2xl transition-colors cursor-pointer border-none"
              >
                Cancelar
              </button>
              <button
                disabled={!reason.trim() || isLoading}
                onClick={executeRemoval}
                className="flex-1 px-4 py-3.5 bg-red-600 text-white font-bold text-sm rounded-2xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer border-none focus-visible:ring-4 focus-visible:ring-red-500"
              >
                Confirmar Retiro
              </button>
            </div>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="absolute inset-0 bg-background/70 flex items-center justify-center z-[60]" aria-busy="true" aria-label="Cargando...">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent"></div>
        </div>
      )}
    </>
  );

  if (isInline) {
    return (
      <div
        role="dialog"
        aria-labelledby="sheet-title"
        className="h-full w-full bg-card flex flex-col overflow-hidden focus:outline-hidden"
      >
        {renderSheetContents()}
      </div>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="fixed inset-0 bg-black/75 z-40 backdrop-blur-md"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="sheet-title"
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="w-full max-w-md bg-card border border-border rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh] pointer-events-auto"
        >
          {renderSheetContents()}
        </motion.div>
      </div>
    </>
  );
};
