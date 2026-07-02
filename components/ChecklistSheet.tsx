import React, { useEffect, useState } from "react";
import { db, Vehicle, Driver, Checklist } from "../lib/db";
import { motion } from "framer-motion";

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

const GASOLINE_LEVELS = ["1/8", "2/8", "3/8", "4/8", "5/8", "6/8", "7/8", "8/8"];

export const ChecklistSheet = ({ isOpen, onClose, vehicle, onComplete }: ChecklistSheetProps) => {
  const [mileage, setMileage] = useState<string>("");
  const [gasoline, setGasoline] = useState<string>("8/8");
  const [items, setItems] = useState<Checklist["checklist_items"]>(DEFAULT_ITEMS);
  const [irregularities, setIrregularities] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  // Reset on open
  useEffect(() => {
    if (!isOpen) {
      setMileage("");
      setGasoline("8/8");
      setItems(DEFAULT_ITEMS);
      setIrregularities("");
      setSavedToast(false);
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
                <label className="block text-sm font-semibold text-foreground mb-1.5">
                  Nivel de gasolina
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {GASOLINE_LEVELS.map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setGasoline(level)}
                      className={`py-2 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                        gasoline === level
                          ? "bg-primary text-white border-primary"
                          : "bg-muted text-foreground border-border hover:bg-secondary"
                      }`}
                    >
                      {level}
                    </button>
                  ))}
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
