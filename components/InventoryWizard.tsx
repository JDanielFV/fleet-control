"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Check, X, ChevronLeft, ChevronRight, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface InventoryItem {
  name: string;
  quantity: number;
}

interface VehiclePhoto {
  angle: string;
  dataUrl: string | null;
}

const PHOTO_ANGLES = [
  { id: "front", label: "Frente" },
  { id: "right-front", label: "Costado Der. Del." },
  { id: "left-front", label: "Costado Izq. Del." },
  { id: "right-rear", label: "Costado Der. Tras." },
  { id: "left-rear", label: "Costado Izq. Tras." },
  { id: "rear", label: "Trasera" },
  { id: "engine", label: "Motor" },
  { id: "cabin-front", label: "Cabina Delantera" },
  { id: "cabin-rear", label: "Cabina Trasera" },
];

interface InventoryWizardProps {
  open: boolean;
  onClose: () => void;
  onSave: (photos: VehiclePhoto[], items: InventoryItem[]) => void;
}

export default function InventoryWizard({ open, onClose, onSave }: InventoryWizardProps) {
  const [step, setStep] = useState<"photos" | "items" | "review">("photos");
  const [photoIndex, setPhotoIndex] = useState(0);
  const [photos, setPhotos] = useState<VehiclePhoto[]>(PHOTO_ANGLES.map((a) => ({ angle: a.id, dataUrl: null })));
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState("1");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (e) {
      alert("No se pudo acceder a la cámara: " + e);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    setPhotos((prev) => prev.map((p, i) => (i === photoIndex ? { ...p, dataUrl } : p)));
    stopCamera();
  }, [photoIndex, stopCamera]);

  const nextPhoto = () => {
    if (photoIndex < PHOTO_ANGLES.length - 1) {
      setPhotoIndex(photoIndex + 1);
      startCamera();
    } else {
      setStep("items");
    }
  };

  const prevPhoto = () => {
    if (photoIndex > 0) {
      setPhotoIndex(photoIndex - 1);
    }
  };

  const addItem = () => {
    if (!newItemName.trim()) return;
    setItems((prev) => [...prev, { name: newItemName.trim(), quantity: parseInt(newItemQty) || 1 }]);
    setNewItemName("");
    setNewItemQty("1");
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onSave(photos, items);
    stopCamera();
    onClose();
  };

  if (!open) return null;

  const currentAngle = PHOTO_ANGLES[photoIndex];
  const currentPhoto = photos[photoIndex];

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/75 z-40 backdrop-blur-md"
        onClick={() => { stopCamera(); onClose(); }}
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-lg bg-card border border-border rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh] pointer-events-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border/40 shrink-0">
            <div>
              <h2 className="text-lg font-black text-foreground">Inventario del Auto</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {step === "photos" && `Foto ${photoIndex + 1} de ${PHOTO_ANGLES.length}: ${currentAngle.label}`}
                {step === "items" && "Agrega los objetos que tiene el auto"}
                {step === "review" && "Revisa antes de guardar"}
              </p>
            </div>
            <button onClick={() => { stopCamera(); onClose(); }} className="p-2 rounded-full text-foreground hover:bg-secondary cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 overflow-y-auto flex-1">
            {step === "photos" && (
              <div className="space-y-4">
                {/* Camera / Photo preview */}
                <div className="relative aspect-video w-full rounded-xl bg-muted overflow-hidden flex items-center justify-center border border-border">
                  {currentPhoto.dataUrl ? (
                    <img src={currentPhoto.dataUrl} alt={currentAngle.label} className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                      <canvas ref={canvasRef} className="hidden" />
                      {!streamRef.current && (
                        <button onClick={startCamera} className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted/80 cursor-pointer">
                          <Camera className="w-8 h-8 text-primary" />
                          <span className="text-xs font-bold text-foreground">Iniciar cámara</span>
                        </button>
                      )}
                    </>
                  )}
                  <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 text-white text-[10px] font-bold rounded-md">
                    {currentAngle.label}
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-3">
                  {streamRef.current && !currentPhoto.dataUrl && (
                    <Button onClick={capturePhoto} className="rounded-full h-12 px-6 bg-primary text-white font-bold">
                      <Camera className="w-5 h-5 mr-2" /> Capturar
                    </Button>
                  )}
                  {currentPhoto.dataUrl && (
                    <Button onClick={() => { setPhotos((prev) => prev.map((p, i) => (i === photoIndex ? { ...p, dataUrl: null } : p))); startCamera(); }} variant="outline" className="rounded-full h-12 px-4">
                      <Camera className="w-4 h-4 mr-2" /> Retomar
                    </Button>
                  )}
                </div>

                {/* Navigation */}
                <div className="flex justify-between">
                  <Button variant="ghost" onClick={prevPhoto} disabled={photoIndex === 0} className="text-xs">
                    <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
                  </Button>
                  <div className="flex gap-1">
                    {PHOTO_ANGLES.map((a, i) => (
                      <div key={a.id} className={`w-2 h-2 rounded-full ${photos[i].dataUrl ? "bg-emerald-500" : i === photoIndex ? "bg-primary" : "bg-muted-foreground/30"}`} />
                    ))}
                  </div>
                  <Button variant="ghost" onClick={nextPhoto} className="text-xs">
                    {photoIndex < PHOTO_ANGLES.length - 1 ? <>Siguiente <ChevronRight className="w-4 h-4 ml-1" /></> : "Continuar →"}
                  </Button>
                </div>
              </div>
            )}

            {step === "items" && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Objeto</Label>
                    <Input
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      placeholder="Ej: Llanta de refacción"
                      className="mt-1 rounded-xl"
                      onKeyDown={(e) => { if (e.key === "Enter") addItem(); }}
                    />
                  </div>
                  <div className="w-20">
                    <Label className="text-xs text-muted-foreground">Cant.</Label>
                    <Input
                      type="number"
                      min="1"
                      value={newItemQty}
                      onChange={(e) => setNewItemQty(e.target.value)}
                      className="mt-1 rounded-xl"
                    />
                  </div>
                  <Button onClick={addItem} disabled={!newItemName.trim()} className="mt-6 rounded-xl bg-primary text-white">
                    +
                  </Button>
                </div>

                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {items.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic text-center py-4">Sin objetos registrados</p>
                  ) : (
                    items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/20 border border-border/60">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-semibold text-foreground">{item.name}</span>
                          <span className="text-xs text-muted-foreground">x{item.quantity}</span>
                        </div>
                        <button onClick={() => removeItem(i)} className="p-1 text-red-500 hover:bg-red-500/10 rounded-lg cursor-pointer">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex justify-between pt-2">
                  <Button variant="ghost" onClick={() => setStep("photos")} className="text-xs">
                    <ChevronLeft className="w-4 h-4 mr-1" /> Volver a fotos
                  </Button>
                  <Button onClick={() => setStep("review")} className="text-xs bg-primary text-white rounded-xl">
                    Revisar y guardar
                  </Button>
                </div>
              </div>
            )}

            {step === "review" && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Fotos ({photos.filter((p) => p.dataUrl).length}/{PHOTO_ANGLES.length})</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {photos.map((p, i) => (
                      <div key={i} className={`aspect-video rounded-lg border flex items-center justify-center text-[10px] font-bold ${p.dataUrl ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-500" : "border-border/40 bg-muted/20 text-muted-foreground"}`}>
                        {p.dataUrl ? <Check className="w-4 h-4" /> : PHOTO_ANGLES[i].label}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Inventario ({items.length} objetos)</h4>
                  {items.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Sin objetos registrados</p>
                  ) : (
                    items.map((item, i) => (
                      <div key={i} className="flex justify-between text-xs py-1 px-2 rounded-lg bg-muted/20 mb-1">
                        <span className="font-semibold">{item.name}</span>
                        <span className="text-muted-foreground">x{item.quantity}</span>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={() => setStep("items")} className="flex-1 rounded-xl">
                    Volver
                  </Button>
                  <Button onClick={handleSave} className="flex-1 rounded-xl bg-primary text-white font-bold">
                    Guardar Inventario
                  </Button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </>
  );
}
