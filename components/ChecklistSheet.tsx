import React, { useEffect, useState } from "react";
import { db, Vehicle, Checklist } from "../lib/db";
import { motion } from "framer-motion";
import { FuelSlider } from "./ui/FuelSlider";
import { X } from "lucide-react";

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
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="fixed inset-0 bg-black/75 z-40 backdrop-blur-md"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <motion.div
          role="dialog"
          aria-modal="true"
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="w-full max-w-lg bg-card border border-border rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh] pointer-events-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-border/40 shrink-0">
            <div>
              <h2 className="text-xl font-bold text-foreground">Revisión de Auto</h2>
              <p className="text-muted-foreground text-xs mt-0.5 font-semibold">
                {vehicle.brand} {vehicle.vehicle_name} · {vehicle.plate_number}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-3 rounded-full text-foreground hover:bg-secondary cursor-pointer transition-all active:scale-90"
              aria-label="Cerrar modal"
              style={{ minWidth: "44px", minHeight: "44px" }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="px-6 py-4 overflow-y-auto overflow-x-hidden flex-1 overscroll-contain">
            {savedToast ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3">
                  <span className="text-2xl text-emerald-500">✓</span>
                </div>
                <h3 className="text-lg font-bold text-foreground">Checklist guardado</h3>
                <p className="text-sm text-muted-foreground">La revisión técnica ha sido registrada exitosamente.</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1">
                    Kilometraje actual
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={mileage}
                    onChange={(e) => setMileage(e.target.value)}
                    placeholder="Ingresa el kilometraje actual..."
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

                <div className="flex gap-3 pt-2 pb-1">
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
      </div>
    </>
  );
};
