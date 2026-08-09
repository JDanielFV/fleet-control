"use client";

import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Camera, X, ChevronLeft, ChevronRight, Package, Plus, ImageIcon } from "lucide-react";
import Image from "next/image";
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
  /** Existing photos to show on open */
  initialPhotos?: VehiclePhoto[];
  /** Existing items to show on open */
  initialItems?: InventoryItem[];
}

export default function InventoryWizard({ open, onClose, onSave, initialPhotos, initialItems }: InventoryWizardProps) {
  const [view, setView] = useState<"main" | "camera" | "items">("main");
  const [photoIndex, setPhotoIndex] = useState(0);
  const [photos, setPhotos] = useState<VehiclePhoto[]>(initialPhotos || PHOTO_ANGLES.map((a) => ({ angle: a.id, dataUrl: null })));
  const [items, setItems] = useState<InventoryItem[]>(initialItems || []);
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState("1");
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setIsStreaming(true);
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
    setIsStreaming(false);
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

  const openCamera = () => {
    setPhotoIndex(0);
    setView("camera");
    startCamera();
  };

  const takenCount = photos.filter((p) => p.dataUrl).length;

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
                {view === "main" && `${takenCount} fotos · ${items.length} objetos`}
                {view === "camera" && `Foto ${photoIndex + 1} de ${PHOTO_ANGLES.length}: ${currentAngle.label}`}
                {view === "items" && "Agrega los objetos que tiene el auto"}
              </p>
            </div>
            <button onClick={() => { stopCamera(); onClose(); }} className="p-2 rounded-full text-foreground hover:bg-secondary cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 overflow-y-auto flex-1">
            {view === "main" && (
              <div className="space-y-5">
                {/* Photo gallery section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Fotos del Auto</h4>
                    <button onClick={openCamera} className="text-xs font-bold text-primary hover:underline cursor-pointer">
                      {takenCount > 0 ? "Editar fotos" : "Añadir fotos"}
                    </button>
                  </div>

                  {takenCount === 0 ? (
                    <div className="aspect-video w-full rounded-xl bg-muted/30 border-2 border-dashed border-border/60 flex flex-col items-center justify-center gap-3">
                      <ImageIcon className="w-10 h-10 text-muted-foreground/40" />
                      <p className="text-xs text-muted-foreground italic">Sin fotos del auto</p>
                      <button
                        onClick={openCamera}
                        className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl shadow-sm hover:bg-primary/90 transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Camera className="w-4 h-4" /> Añadir fotos
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {photos.map((p, i) => (
                        <button
                          key={i}
                          onClick={() => p.dataUrl && setPreviewPhoto(p.dataUrl)}
                          className={`aspect-video rounded-lg border overflow-hidden relative ${
                            p.dataUrl ? "border-border/60 hover:border-primary/50 cursor-pointer" : "border-dashed border-border/30 bg-muted/10"
                          }`}
                        >
                          {p.dataUrl ? (
                            <Image src={p.dataUrl} alt={PHOTO_ANGLES[i].label} fill className="object-cover" unoptimized />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-[11px] text-muted-foreground/50 font-bold text-center leading-tight px-1">
                                {PHOTO_ANGLES[i].label}
                              </span>
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-1 pb-0.5 pt-3">
                            <span className="text-[11px] text-white/80 font-semibold">{PHOTO_ANGLES[i].label}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Inventory items section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Objetos a Bordo</h4>
                    <button onClick={() => setView("items")} className="text-xs font-bold text-primary hover:underline cursor-pointer">
                      {items.length > 0 ? "Editar" : "Añadir objetos"}
                    </button>
                  </div>

                  {items.length === 0 ? (
                    <div className="p-4 rounded-xl bg-muted/20 border border-dashed border-border/60 flex flex-col items-center gap-2">
                      <Package className="w-6 h-6 text-muted-foreground/40" />
                      <p className="text-xs text-muted-foreground italic">Sin objetos registrados</p>
                      <button
                        onClick={() => setView("items")}
                        className="px-3 py-1.5 bg-primary text-white text-[11px] font-bold rounded-lg cursor-pointer flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Añadir objeto
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {items.map((item, i) => (
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
                      ))}
                    </div>
                  )}
                </div>

                {/* Save button */}
                <Button onClick={handleSave} className="w-full rounded-xl bg-primary text-white font-bold">
                  Guardar Inventario
                </Button>
              </div>
            )}

            {view === "camera" && (
              <div className="space-y-4">
                <div className="relative aspect-video w-full rounded-xl bg-muted overflow-hidden flex items-center justify-center border border-border">
                  {currentPhoto.dataUrl ? (
                    <Image src={currentPhoto.dataUrl} alt={currentAngle.label} fill className="object-cover" unoptimized />
                  ) : (
                    <>
                      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                      <canvas ref={canvasRef} className="hidden" />
                      {!isStreaming && (
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

                <div className="flex items-center justify-center gap-3">
                  {isStreaming && !currentPhoto.dataUrl && (
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

                <div className="flex justify-between">
                  <Button variant="ghost" onClick={prevPhoto} disabled={photoIndex === 0} className="text-xs">
                    <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
                  </Button>
                  <div className="flex gap-1">
                    {PHOTO_ANGLES.map((a, i) => (
                      <div key={a.id} className={`w-2 h-2 rounded-full ${photos[i].dataUrl ? "bg-emerald-500" : i === photoIndex ? "bg-primary" : "bg-muted-foreground/30"}`} />
                    ))}
                  </div>
                  <Button variant="ghost" onClick={nextPhoto} disabled={photoIndex >= PHOTO_ANGLES.length - 1} className="text-xs">
                    Siguiente <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>

                <Button variant="outline" onClick={() => { stopCamera(); setView("main"); }} className="w-full rounded-xl">
                  Volver al inventario
                </Button>
              </div>
            )}

            {view === "items" && (
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

                <Button variant="outline" onClick={() => setView("main")} className="w-full rounded-xl">
                  Volver al inventario
                </Button>
              </div>
            )}
          </div>

          {/* Photo preview modal */}
          {previewPhoto && (
            <div
              className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
              onClick={() => setPreviewPhoto(null)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPreviewPhoto(null); } }}
              role="button"
              tabIndex={0}
              aria-label="Cerrar vista previa"
            >
              <Image src={previewPhoto} alt="Vista previa" width={800} height={600} className="max-w-full max-h-full object-contain w-auto h-auto" unoptimized />
              <button onClick={() => setPreviewPhoto(null)} className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </>
  );
}
