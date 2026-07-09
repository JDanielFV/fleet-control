import React, { useEffect, useState, useRef, useCallback } from "react";
import { db, Vehicle, Checklist } from "../lib/db";
import { motion } from "framer-motion";
import { Check, CheckCircle, Camera, X } from "lucide-react";

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
  const [irregularityPhoto, setIrregularityPhoto] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [showCamera, setShowCamera] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setShowCamera(true);
    } catch (e) {
      alert("No se pudo acceder a la cámara: " + e);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  }, []);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    setIrregularityPhoto(dataUrl);
    stopCamera();
  }, [stopCamera]);

  useEffect(() => {
    if (!isOpen) {
      Promise.resolve().then(() => {
        setMileage("");
        setItems(DEFAULT_ITEMS);
        setIrregularities("");
        setIrregularityPhoto(null);
        setSavedToast(false);
        stopCamera();
      });
    }
  }, [isOpen, stopCamera]);

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

                  {/* Photo capture for irregularity */}
                  <div className="mt-2">
                    {showCamera ? (
                      <div className="relative aspect-video w-full rounded-lg bg-muted overflow-hidden border border-border">
                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                        <canvas ref={canvasRef} className="hidden" />
                        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-3">
                          <button
                            onClick={capturePhoto}
                            className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-full shadow-lg cursor-pointer"
                          >
                            <Camera className="w-4 h-4 inline mr-1" /> Capturar
                          </button>
                          <button
                            onClick={stopCamera}
                            className="px-4 py-2 bg-red-500 text-white text-xs font-bold rounded-full shadow-lg cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : irregularityPhoto ? (
                      <div className="relative mt-2 rounded-lg overflow-hidden border border-border">
                        <img src={irregularityPhoto} alt="Evidencia" className="w-full h-32 object-cover" />
                        <button
                          onClick={() => setIrregularityPhoto(null)}
                          className="absolute top-2 right-2 p-1 bg-black/60 text-white rounded-full cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={startCamera}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border bg-muted/20 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all cursor-pointer w-full"
                      >
                        <Camera className="w-4 h-4" />
                        Agregar foto de evidencia
                      </button>
                    )}
                  </div>
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
