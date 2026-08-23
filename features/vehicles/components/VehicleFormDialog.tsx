"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import InlineScanner from "@/components/InlineScanner";
import { Car, Trash2, Camera, FolderOpen, AlertTriangle, Loader2 } from "lucide-react";
import Image from "next/image";
import { getVerificationSchedule } from "@/lib/db";
import type { useVehicles } from "@/features/vehicles/hooks/useVehicles";

type VehiclesFormProps = ReturnType<typeof useVehicles>;

/**
 * Registration/edit dialog for vehicles — scan-first 3-step flow:
 *   PASO 1 Datos (renta, color, placa opcional)
 *   PASO 2 Escaneo de documentos (OCR llena marca/modelo/VIN/vigencias)
 *   PASO 3 Revisión (resumen consolidado antes de guardar)
 *
 * Receives the whole `useVehicles()` return value via props spread.
 */
export default function VehicleFormDialog(props: VehiclesFormProps) {
  const {
    isOpen,
    setIsOpen,
    resetForm,
    editingVehicleId,
    isScanning,
    scanner,
    handleSave,
    isSaving,
    brand,
    vehicleName,
    model,
    circulationExpirationDate,
    vin,
    plateNumber,
    setPlateNumber,
    isPlateLengthInvalid,
    insurancePolicyFiles,
    insuranceExpirationDate,
    circulationImg,
    setCirculationImg,
    circFileRef,
    insFileRef,
    handleFileChange,
    startCamera,
    rentCost,
    setRentCost,
    nextServiceMileage,
    setNextServiceMileage,
    color,
    setColor,
    insurancePolicyNumber,
  } = props;

  return (
      <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="rounded-full bg-[#0088FF] hover:bg-[#0077EE] text-white text-sm font-bold px-6 h-11 border-none active:scale-95 transition-all cursor-pointer flex items-center justify-center shadow-xs">
                Registrar vehículo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md md:max-w-2xl max-h-[90vh] overflow-y-auto border border-border bg-background text-foreground rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-foreground font-black text-lg">{editingVehicleId ? "Editar Vehículo" : "Registro de Vehículo"}</DialogTitle>
                <DialogDescription className="text-muted-foreground text-xs">
                  {editingVehicleId ? "Modifica los datos del vehículo. Los cambios se aplican al instante." : "Ingresa datos o usa OCR de la tarjeta de circulación y póliza."}
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSave} className="space-y-4 pt-2 flex flex-col max-h-[78vh]">
                    <div className="flex-1 overflow-y-auto pr-1.5 space-y-4 max-h-[62vh]">
                      {/* PASO 1: Datos — solo lo que el OCR no puede saber */}
                      <div id="section-data" className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3 scroll-mt-2">
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground font-black">Datos del Auto</h4>
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="min-w-0">
                              <Label htmlFor="rentCost" className="text-muted-foreground text-xs font-bold">💰 Renta Semanal ($) *</Label>
                              <Input type="number" id="rentCost" value={rentCost || ""} onChange={(e) => setRentCost(Number(e.target.value))} className="border-input bg-background rounded-xl w-full min-w-0 text-lg font-bold" placeholder="2500" />
                            </div>
                            <div className="min-w-0">
                              <Label htmlFor="color" className="text-muted-foreground text-xs font-bold">🎨 Color *</Label>
                              <Input id="color" value={color} onChange={(e) => setColor(e.target.value)} className="border-input bg-background rounded-xl w-full min-w-0" placeholder="ej. Blanco, Rojo, Gris" />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="min-w-0">
                              <Label htmlFor="plate" className="text-muted-foreground text-xs">📋 Placa (opcional — el OCR la detecta)</Label>
                              <Input id="plate" value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)} placeholder="ej. 982-WXY" className="border-input bg-background rounded-xl w-full min-w-0 font-mono" />
                              {isPlateLengthInvalid && <span className="text-xs text-amber-400 flex items-center gap-1 mt-1"><AlertTriangle className="w-3.5 h-3.5" /> Placa corta o inusual.</span>}
                            </div>
                            <div className="min-w-0">
                              <Label htmlFor="nextService" className="text-muted-foreground text-xs">🚗 Kilometraje Próximo Servicio (opcional)</Label>
                              <Input type="number" id="nextService" value={nextServiceMileage} onChange={(e) => setNextServiceMileage(e.target.value)} className="border-input bg-background rounded-xl w-full min-w-0" placeholder="ej. 20000" />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* PASO 2: Escaneo — solo uploads, OCR llena el resto */}
                      <div id="section-docs" className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3.5 scroll-mt-2">
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground font-black">Escanea los Documentos</h4>
                        <p className="text-[11px] text-muted-foreground -mt-1">El OCR extrae marca, modelo, VIN, placas y vigencias automáticamente.</p>

                        {/* Preview inline — cámara o procesamiento de archivo */}
                        {isScanning && scanner.scanTarget && (
                          <InlineScanner
                            scanner={scanner}
                            targetLabels={{ CIRCULACION: "Tarjeta de Circulación", SEGURO: "Póliza de Seguro" }}
                          />
                        )}

                        <div className="space-y-4">
                          {/* Circulación */}
                          <div className="bg-card rounded-xl border border-border/60 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <h5 className="text-[11px] font-bold text-foreground flex items-center gap-1.5">📄 Tarjeta de Circulación</h5>
                              {circulationImg && <span className="text-[10px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-1.5 py-0.5 rounded-md font-bold">Cargada</span>}
                            </div>
                            {circulationImg && (
                              <div className="relative w-full h-16 rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center">
                                <Image src={circulationImg} alt="Tarjeta de Circulación" fill className="object-contain p-1" />
                                <button type="button" onClick={() => setCirculationImg("")} className="absolute top-1.5 right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md transition-all active:scale-90" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-2">
                              <Button type="button" variant="outline" onClick={() => startCamera("CIRCULACION")} disabled={isScanning && scanner.scanTarget !== "CIRCULACION"} className={`border-border text-xs rounded-xl flex items-center justify-center gap-1.5 h-11 cursor-pointer ${isScanning && scanner.scanTarget === "CIRCULACION" ? "bg-primary/10 border-primary/40 text-primary" : "bg-card hover:bg-accent text-foreground"}`}>
                                {isScanning && scanner.scanTarget === "CIRCULACION" ? (<><Loader2 className="w-4 h-4 animate-spin" /> Escaneando...</>) : (<><Camera className="w-4 h-4 text-primary" /> Tomar Foto</>)}
                              </Button>
                              <Button type="button" variant="outline" onClick={() => circFileRef.current?.click()} disabled={isScanning} className="border-border bg-card hover:bg-accent text-foreground text-xs rounded-xl flex items-center justify-center gap-1.5 h-11 cursor-pointer"><FolderOpen className="w-4 h-4 text-primary" /> Subir</Button>
                              <input type="file" accept="image/*" className="hidden" ref={circFileRef} onChange={(e) => handleFileChange(e, "CIRCULACION")} />
                            </div>
                            {circulationImg && (
                              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] pt-1 border-t border-border/40">
                                {plateNumber && <div><span className="text-muted-foreground/70">Placa: </span><strong className="text-foreground font-mono">{plateNumber}</strong></div>}
                                {vin && <div><span className="text-muted-foreground/70">VIN: </span><strong className="text-foreground font-mono truncate block">{vin}</strong></div>}
                                {brand && <div><span className="text-muted-foreground/70">Marca: </span><strong className="text-foreground">{brand}</strong></div>}
                                {model && <div><span className="text-muted-foreground/70">Modelo: </span><strong className="text-foreground">{model}</strong></div>}
                                {circulationExpirationDate && <div><span className="text-muted-foreground/70">Vence: </span><strong className="text-foreground">{circulationExpirationDate}</strong></div>}
                              </div>
                            )}
                          </div>

                          {/* Seguro */}
                          <div className="bg-card rounded-xl border border-border/60 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <h5 className="text-[11px] font-bold text-foreground flex items-center gap-1.5">🛡️ Póliza de Seguro</h5>
                              {insurancePolicyFiles.length > 0 && <span className="text-[10px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-1.5 py-0.5 rounded-md font-bold">{insurancePolicyFiles.length} pág.</span>}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <Button type="button" variant="outline" onClick={() => startCamera("SEGURO")} disabled={isScanning && scanner.scanTarget !== "SEGURO"} className={`border-border text-xs rounded-xl flex items-center justify-center gap-1.5 h-11 cursor-pointer ${isScanning && scanner.scanTarget === "SEGURO" ? "bg-primary/10 border-primary/40 text-primary" : "bg-card hover:bg-accent text-foreground"}`}>
                                {isScanning && scanner.scanTarget === "SEGURO" ? (<><Loader2 className="w-4 h-4 animate-spin" /> Escaneando...</>) : (<><Camera className="w-4 h-4 text-primary" /> Tomar Foto</>)}
                              </Button>
                              <Button type="button" variant="outline" onClick={() => insFileRef.current?.click()} disabled={isScanning} className="border-border bg-card hover:bg-accent text-foreground text-xs rounded-xl flex items-center justify-center gap-1.5 h-11 cursor-pointer"><FolderOpen className="w-4 h-4 text-primary" /> Subir</Button>
                              <input type="file" accept="image/*,application/pdf" multiple className="hidden" ref={insFileRef} onChange={(e) => handleFileChange(e, "SEGURO")} />
                            </div>
                            {insurancePolicyFiles.length > 0 && (
                              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] pt-1 border-t border-border/40">
                                {insurancePolicyNumber && <div><span className="text-muted-foreground/70">Póliza: </span><strong className="text-foreground font-mono">{insurancePolicyNumber}</strong></div>}
                                {insuranceExpirationDate && <div><span className="text-muted-foreground/70">Vence: </span><strong className="text-foreground">{insuranceExpirationDate}</strong></div>}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* PASO 3: Revisión — resumen visual consolidado */}
                      <div id="section-review" className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3 scroll-mt-2">
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground font-black">Revisión</h4>
                        {/* Resumen del vehículo */}
                        <div className="bg-card rounded-xl border border-border/60 p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <Car className="w-4 h-4 text-primary" />
                            <span className="text-sm font-bold text-foreground">
                              {brand || "—"} {vehicleName || "—"} {model || "—"}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                            <div><span className="text-muted-foreground/70">Placa: </span><strong className="text-foreground font-mono">{plateNumber || "—"}</strong></div>
                            <div><span className="text-muted-foreground/70">Color: </span><strong className="text-foreground">{color || "—"}</strong></div>
                            <div><span className="text-muted-foreground/70">Renta: </span><strong className="text-foreground">${rentCost?.toLocaleString() || "—"}/sem</strong></div>
                            {vin && <div><span className="text-muted-foreground/70">VIN: </span><strong className="text-foreground font-mono truncate block">{vin}</strong></div>}
                            {nextServiceMileage && <div><span className="text-muted-foreground/70">Próx. Serv: </span><strong className="text-foreground">{parseInt(nextServiceMileage).toLocaleString()} km</strong></div>}
                            <div>
                              <span className="text-muted-foreground/70">Engomado: </span>
                              <VerificationBadge plate={plateNumber} />
                            </div>
                          </div>
                        </div>
                        {/* Estado de documentos */}
                        <div className="space-y-1.5 text-[11px]">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">📄 Circulación</span>
                            <span className={`font-semibold ${circulationImg ? "text-emerald-500" : "text-muted-foreground"}`}>{circulationImg ? "✓ Cargada" : "Sin escanear"}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">🛡️ Seguro</span>
                            <span className={`font-semibold ${insurancePolicyFiles.length > 0 ? "text-emerald-500" : "text-muted-foreground"}`}>{insurancePolicyFiles.length > 0 ? `✓ ${insurancePolicyFiles.length} pág.` : "Sin escanear"}</span>
                          </div>
                          {circulationExpirationDate && new Date(circulationExpirationDate) < new Date() && (
                            <div className="flex items-center gap-1.5 text-amber-500 font-semibold"><AlertTriangle className="w-3 h-3" /> Vigencia de circulación vencida</div>
                          )}
                          {insuranceExpirationDate && new Date(insuranceExpirationDate) < new Date() && (
                            <div className="flex items-center gap-1.5 text-amber-500 font-semibold"><AlertTriangle className="w-3 h-3" /> Vigencia de seguro vencida</div>
                          )}
                        </div>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full rounded-xl bg-primary text-white font-bold hover:bg-primary transition-all cursor-pointer shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
                      disabled={isScanning || isSaving}
                    >
                      {isSaving ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" /> Guardando Vehículo...
                        </span>
                      ) : (
                        "Guardar Vehículo"
                      )}
                    </Button>
                  </form>
            </DialogContent>
          </Dialog>
  );
}

/** Colored dot + label for the plate's verification schedule color. */
export function VerificationBadge({ plate, showMonths }: { plate: string | null | undefined; showMonths?: boolean }) {
  const schedule = getVerificationSchedule(plate || "0");
  return (
    <span className="flex items-center gap-1 inline-flex">
      <span
        className="w-2 h-2 rounded-full border border-black/20 inline-block shrink-0"
        style={{ backgroundColor: schedule.color === "Amarillo" ? "#eab308" : schedule.color === "Rosa" ? "#ec4899" : schedule.color === "Rojo" ? "#ef4444" : schedule.color === "Verde" ? "#22c55e" : "#3b82f6" }}
      />
      <strong className="text-foreground">{schedule.color}{showMonths ? ` · ${schedule.months}` : ""}</strong>
    </span>
  );
}
