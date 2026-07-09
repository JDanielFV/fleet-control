import React, { useEffect, useState } from "react";
import { db, Vehicle, Checklist } from "../lib/db";
import { motion } from "framer-motion";
import { Check, CheckCircle, X } from "lucide-react";

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
  const [items, setItems] = useState<Checklist["checklist_items"]>(DEFAULT_ITEMS);
  const [irregularities, setIrregularities] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      Promise.resolve().then(() => {
        setMileage("");
        setItems(DEFAULT_ITEMS);
        setIrregularities("");
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

    setIsLoading(true);
    try {
      await db.saveChecklist({
        vehicle_id: vehicle.id,
        driver_id: assignedDriver,
        type: "DELIVERY",
        mileage: Number(mileage),
        gasoline_level: "8/8",
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
                  <CheckCircle className="w-8 h-8 text-emerald-500" />
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
                          <span className="text-base">{items[key] ? <Check className="w-4 h-4 inline" /> : <X className="w-4 h-4 inline" />}</span>
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
