import React, { useEffect, useState } from "react";
import { db, Vehicle, Checklist } from "../lib/db";
import { motion } from "framer-motion";
import { FuelSlider } from "./ui/FuelSlider";

interface ChecklistSheetProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle: Vehicle | null;
  onComplete?: () => void;
}

const DEFAULT_ITEMS: Checklist["checklist_items"] = {
  lights: true,
  brakes: true,
  tires: true,
  bodywork: true,
  documents: true,
};

export const ChecklistSheet = ({ isOpen, onClose, vehicle, onComplete }: ChecklistSheetProps) => {
  const [mileage, setMileage] = useState<string>("");
  const [gasoline, setGasoline] = useState<string>("8/8");
  const [items, setItems] = useState<Checklist["checklist_items"]>(DEFAULT_ITEMS);
  const [irregularities, setIrregularities] = useState("");
  // Optional next-service schedule — captured in the same flow as the
  // initial checklist so the vehicle's service reminders stay accurate.
  const [nextServiceMileage, setNextServiceMileage] = useState<string>("");
  const [nextServiceDate, setNextServiceDate] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  // Reset on close so the next session starts clean. The resets are scheduled
  // in a microtask to avoid cascading renders that the React 19
  // `react-hooks/set-state-in-effect` rule flags.
  useEffect(() => {
    if (!isOpen) {
      Promise.resolve().then(() => {
        setMileage("");
        setGasoline("8/8");
        setItems(DEFAULT_ITEMS);
        setIrregularities("");
        setNextServiceMileage("");
        setNextServiceDate("");
        setSavedToast(false);
      });
    }
  }, [isOpen]);

  if (!isOpen || !vehicle) return null;

  const assignedDriver = vehicle.active_driver_id;

  const toggleItem = (key: keyof Checklist["checklist_items"]) => {
    setItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async () => {
    if (!assignedDriver) {
      alert("Este auto no tiene un chofer asignado. Asigna uno antes de registrar el checklist.");
      return;
    }
    if (!mileage || isNaN(Number(mileage))) {
      alert("Ingresa un kilometraje válido.");
      return;
    }

    // If a service schedule was provided, validate it before saving.
    const trimmedMileage = nextServiceMileage.trim();
    const trimmedDate = nextServiceDate.trim();
    const parsedNextMileage = trimmedMileage ? Number(trimmedMileage) : null;
    if (trimmedMileage && (isNaN(parsedNextMileage as number) || (parsedNextMileage as number) < 0)) {
      alert("El kilometraje del próximo servicio no es válido.");
      return;
    }

    setIsLoading(true);
    try {
      await db.saveChecklist({
        vehicle_id: vehicle.id,
        driver_id: assignedDriver,
        type: "DELIVERY",
        mileage: Number(mileage),
        gasoline_level: gasoline,
        checklist_items: items,
        irregularities: irregularities.trim(),
      });

      // Persist the optional next-service schedule on the vehicle. We only
      // touch the vehicle if at least one field was provided so we don't
      // wipe existing values when the user leaves the form blank.
      if (parsedNextMileage !== null || trimmedDate) {
        await db.updateVehicleServiceSchedule(
          vehicle.id,
          parsedNextMileage,
          trimmedDate || null
        );
      }

      setSavedToast(true);
      onComplete?.();
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err) {
      alert("Error al guardar el checklist: " + err);
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

      {/* Bottom Sheet */}
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
        {/* Drag Handle */}
        <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mt-3 mb-4 cursor-pointer shrink-0" onClick={onClose} />

        <div className="px-6 overflow-y-auto overflow-x-hidden flex-1 overscroll-contain">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Revisión de Auto</h2>
              <p className="text-muted-foreground text-sm">
                {vehicle.brand} {vehicle.vehicle_name} · {vehicle.plate_number}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground p-2 -mr-2 cursor-pointer"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>

          {savedToast ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3">
                <span className="text-2xl text-emerald-500">✓</span>
              </div>
              <p className="text-lg font-bold text-emerald-500">Checklist guardado</p>
              <p className="text-sm text-muted-foreground">Cerrando...</p>
            </div>
          ) : (
            <div className="space-y-5 pb-2">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">
                  Kilometraje actual
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={mileage}
                  onChange={(e) => setMileage(e.target.value)}
                  placeholder="ej. 12345"
                  className="w-full px-3 py-2.5 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                />
              </div>

              <div>
                <FuelSlider value={gasoline} onChange={setGasoline} label="Nivel de gasolina" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">
                  Próximo servicio (opcional)
                </label>
                <p className="text-xs text-muted-foreground mb-2.5">
                  Define el recordatorio para el próximo mantenimiento de la unidad.
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                      Por kilometraje (km)
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={nextServiceMileage}
                      onChange={(e) => setNextServiceMileage(e.target.value)}
                      placeholder="ej. 25000"
                      className="w-full px-3 py-2.5 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                      Por fecha
                    </label>
                    <input
                      type="date"
                      value={nextServiceDate}
                      onChange={(e) => setNextServiceDate(e.target.value)}
                      className="w-full px-3 py-2.5 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">
                  Revisión Técnica
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(items) as (keyof Checklist["checklist_items"])[]).map((key) => {
                    const labels: Record<keyof Checklist["checklist_items"], string> = {
                      lights: "Luces",
                      brakes: "Frenos",
                      tires: "Llantas",
                      bodywork: "Carrocería",
                      documents: "Documentos",
                    };
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleItem(key)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-semibold transition-colors cursor-pointer ${
                          items[key]
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                            : "bg-red-500/10 border-red-500/30 text-red-500"
                        }`}
                      >
                        <span className="text-base">{items[key] ? "✓" : "✕"}</span>
                        <span>{labels[key]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">
                  Irregularidades (opcional)
                </label>
                <textarea
                  value={irregularities}
                  onChange={(e) => setIrregularities(e.target.value)}
                  rows={2}
                  placeholder="Describe cualquier detalle adicional..."
                  className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2 pb-1">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 text-foreground bg-muted hover:bg-secondary font-medium rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2.5 bg-primary text-white font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {isLoading ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
};
