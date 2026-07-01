import React, { useEffect, useState } from "react";
import { db, Vehicle, Driver, Checklist } from "../lib/db";

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
      alert("Este vehículo no tiene un conductor asignado. Asigna uno antes de registrar el checklist.");
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
      <div
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl transition-transform duration-300 max-h-[min(92dvh,calc(100dvh-env(safe-area-inset-top)))] flex flex-col overflow-hidden"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mt-3 mb-4 cursor-pointer shrink-0" onClick={onClose} />

        <div className="px-6 overflow-y-auto overflow-x-hidden flex-1 overscroll-contain">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Checklist</h2>
              <p className="text-slate-500 text-sm">
                {vehicle.brand} {vehicle.vehicle_name} · {vehicle.plate_number}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-2 -mr-2"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>

          {savedToast ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                <span className="text-3xl">✓</span>
              </div>
              <p className="text-lg font-bold text-emerald-700">Checklist guardado</p>
              <p className="text-sm text-slate-500">Cerrando...</p>
            </div>
          ) : (
            <div className="space-y-5 pb-2">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Kilometraje actual
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={mileage}
                  onChange={(e) => setMileage(e.target.value)}
                  placeholder="ej. 12345"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Nivel de gasolina
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {GASOLINE_LEVELS.map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setGasoline(level)}
                      className={`py-2 text-xs font-bold rounded-lg border transition-colors ${
                        gasoline === level
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Revisión
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
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                          items[key]
                            ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                            : "bg-red-50 border-red-300 text-red-700"
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
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Irregularidades (opcional)
                </label>
                <textarea
                  value={irregularities}
                  onChange={(e) => setIrregularities(e.target.value)}
                  rows={2}
                  placeholder="Describe cualquier detalle adicional..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {isLoading ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
