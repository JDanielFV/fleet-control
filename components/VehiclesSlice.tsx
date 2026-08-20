"use client";

import React, { useState } from "react";
import { Vehicle, Driver, getVerificationSchedule, Checklist } from "@/lib/db";
import { computeUsageStats } from "@/lib/usageStats";
import { getDriverName } from "@/lib/lookups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Stepper } from "@/components/ui/stepper";
import { Car, CheckCircle2, Search, Trash2, Camera, FolderOpen, Pencil, RefreshCcw, Mic, AlertTriangle, Shield, Wrench, ArrowLeftRight, CheckCircle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import Image from "next/image";
import SliceHeader from "@/components/SliceHeader";
import { VehiclesListSkeleton } from "@/components/ui/skeletons";
import ScannerViewfinder from "@/components/ScannerViewfinder";
import VehicleHistory from "@/components/VehicleHistory";
import { resolveDocUrl } from "@/lib/db/storage";
import { useVehicles } from "@/features/vehicles/hooks/useVehicles";
import { MobileCard, MobileActionButton } from "@/components/ui/MobileCard";
import VehicleDetailDialog from "@/components/ui/VehicleDetailDialog";

interface VehiclesSliceProps {
  onRefreshAlerts: () => void;
  searchQuery?: string;
  onOpenActionSheet: (entity: Vehicle | Driver, type: "driver" | "vehicle") => void;
  autoOpen?: boolean;
  onAutoOpenConsumed?: () => void;
  onAssignVehicle?: (vehicleId: string) => void;
  externalWearPartVehicle?: Vehicle | null;
  refreshTrigger?: number;
  /** Initial data from parent store — skips internal fetch. */
  initialVehicles?: Vehicle[];
  initialDrivers?: Driver[];
  initialMaintenances?: import("@/lib/db").Maintenance[];
  initialAssignments?: import("@/lib/db").Assignment[];
  initialChecklists?: Checklist[];
  initialWeeklyRentals?: import("@/lib/db").WeeklyRental[];
}

export default function VehiclesSlice(props: VehiclesSliceProps) {
  // Detail dialog state for mobile
  const [detailDialogVehicle, setDetailDialogVehicle] = useState<Vehicle | null>(null);

  const {
  isOpen,
  setIsOpen,
  resetForm,
  editingVehicleId,
  activeSection,
  scrollToSection,
  isScanning,
  scanner,
  handleSave,
  isSaving,
  isRenewing,
  isSavingWearPart,
  isVerifying,
  brand,
  setBrand,
  vehicleName,
  setVehicleName,
  model,
  setModel,
  classType,
  setClassType,
  circulationExpirationDate,
  setCirculationExpirationDate,
  vin,
  setVin,
  plateNumber,
  setPlateNumber,
  isPlateLengthInvalid,
  isVinLengthInvalid,
  insurancePolicyImg,
  setInsurancePolicyImg,
  insurancePolicyFiles,
  insuranceExpirationDate,
  setInsuranceExpirationDate,
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
  setInsurancePolicyNumber,
  verificationExpirationDate,
  setVerificationExpirationDate,
  isLoading,
  filteredVehicles,
  expandedVehicleDetails,
  toggleVehicleDetails,
  search,
  setSearch,
  showArchived,
  setShowArchived,
  handleEditVehicle,
  handleDeleteVehicle,
  handleServiceOut,
  handleServiceReturn,
  handleReportWearPart,
  handleRenewDocument,
  setPreviewImage,
  drivers,
  onAssignVehicle,
  maintenances,
  assignments,
  checklists,
  weeklyRentals,
  renewingVehicle,
  renewTarget,
  stopCamera,
  setRenewingVehicle,
  isRenewOpen,
  setIsRenewOpen,
  renewPolicyImg,
  renewExpirationDate,
  setRenewExpirationDate,
  submitRenewal,
  wearPartOpen,
  setWearPartOpen,
  setWearPartVehicleState,
  wearPartVehicleState,
  wearPartName,
  setWearPartName,
  wearPartCost,
  setWearPartCost,
  wearPartDate,
  setWearPartDate,
  submitWearPart,
  verifOpen,
  setVerifVehicle,
  verifVehicle,
  verifFileRef,
  verifImg,
  setVerifImg,
  setVerifOpen,
  submitVerification,
  previewImage,
} = useVehicles(props);

  return (
    <div className="space-y-4">
      {/* Header */}
      <SliceHeader
        title="Vehículos"
        action={
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

              <div className="pt-2 pb-1">
                <Stepper steps={[{ id: "data", label: "Datos" }, { id: "docs", label: "Escaneo" }, { id: "review", label: "Revisión" }]}
                  currentStep={activeSection} onStepClick={scrollToSection} />
              </div>

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
                          <div className="rounded-xl border border-primary/40 bg-card overflow-hidden">
                            {scanner.isCameraActive ? (
                              /* Modo cámara — video en vivo */
                              <div className="relative aspect-video w-full bg-muted">
                                <video ref={scanner.videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                                {scanner.ocrStep === "scan" && (
                                  <motion.div initial={{ y: -60 }} animate={{ y: 60 }} transition={{ repeat: Infinity, repeatType: "reverse", duration: 1.2 }} className="absolute left-0 right-0 h-0.5 bg-primary shadow-lg shadow-primary/60 z-10" />
                                )}
                                <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-white/60" />
                                <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-white/60" />
                                <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-white/60" />
                                <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-white/60" />
                                <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2 z-30">
                                  <button type="button" onClick={scanner.capturePhoto} className="bg-primary hover:bg-primary text-white font-bold rounded-full h-10 px-4 flex items-center justify-center gap-1.5 shadow-lg active:scale-90 text-xs cursor-pointer"><Camera className="w-4 h-4" /> Capturar</button>
                                  <button type="button" onClick={scanner.cancelScan} className="bg-red-500 hover:bg-red-600 text-white font-bold rounded-full h-10 px-4 flex items-center justify-center gap-1.5 shadow-lg active:scale-90 text-xs cursor-pointer">Cancelar</button>
                                </div>
                              </div>
                            ) : (
                              /* Modo archivo — indicador de procesamiento */
                              <div className="flex items-center gap-3 p-4">
                                <div className="shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                  {scanner.ocrStep === "done" ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Loader2 className="w-5 h-5 text-primary animate-spin" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-foreground">
                                    {scanner.ocrStep === "align" && "Cargando archivo..."}
                                    {scanner.ocrStep === "scan" && "Analizando documento..."}
                                    {scanner.ocrStep === "extract" && "Extrayendo datos..."}
                                    {scanner.ocrStep === "done" && "¡Documento procesado!"}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">{scanner.scanTarget === "CIRCULACION" ? "Tarjeta de Circulación" : scanner.scanTarget === "SEGURO" ? "Póliza de Seguro" : scanner.scanTarget}</p>
                                </div>
                                <button type="button" onClick={scanner.cancelScan} className="shrink-0 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer">Cancelar</button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Canvas oculto para captura */}
                        <canvas ref={scanner.canvasRef} className="hidden" />

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
                              <span className="flex items-center gap-1 inline-flex">
                                <span className="w-2 h-2 rounded-full border border-black/20 inline-block shrink-0" style={{ backgroundColor: getVerificationSchedule(plateNumber || "0").color === "Amarillo" ? "#eab308" : getVerificationSchedule(plateNumber || "0").color === "Rosa" ? "#ec4899" : getVerificationSchedule(plateNumber || "0").color === "Rojo" ? "#ef4444" : getVerificationSchedule(plateNumber || "0").color === "Verde" ? "#22c55e" : "#3b82f6" }} />
                                <strong className="text-foreground">{getVerificationSchedule(plateNumber || "0").color}</strong>
                              </span>
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
        }
      />

      {/* Search */}
      <div className="bg-[#ECECEC] rounded-full h-11 px-4 flex items-center gap-2 w-full shadow-inner mb-4 mt-2">
        <Search className="w-4 h-4 text-muted-foreground/60 shrink-0" />
        <input type="text" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 bg-transparent border-none text-foreground text-sm placeholder:text-muted-foreground/60 focus:outline-hidden py-3 md:py-0" />
        <Mic className="w-4 h-4 text-muted-foreground/60 shrink-0 cursor-pointer" />
        <button type="button" onClick={() => setShowArchived(!showArchived)}
          className={`text-[11px] font-bold px-2.5 py-3.5 md:py-1 rounded-lg transition-all cursor-pointer shrink-0 ${showArchived ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
          {showArchived ? "Activos" : "Archivo"}
        </button>
      </div>

      {/* Table (≥768px) */}
      <div className="hidden md:block w-full overflow-x-auto pb-6">
        {isLoading ? (
          <VehiclesListSkeleton count={4} />
        ) : (
          <table className="w-full text-xs border-collapse" aria-label="Lista de vehículos">
            <thead>
              <tr className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/40">
                <th scope="col" className="text-left py-2.5 px-2 whitespace-nowrap">Auto</th>
                <th scope="col" className="text-left py-2.5 px-2 whitespace-nowrap">Placa</th>
                <th scope="col" className="text-left py-2.5 px-2 whitespace-nowrap">ID</th>
                <th scope="col" className="text-left py-2.5 px-2 whitespace-nowrap">Chofer</th>
                <th scope="col" className="text-right py-2.5 px-2 whitespace-nowrap">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredVehicles.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 text-muted-foreground italic">No se encontraron vehículos.</td></tr>
              ) : (
                filteredVehicles.map((vehicle) => {
                  const vehicleId = vehicle.vin?.slice(-6).toUpperCase() || "—";
                  const schedule = getVerificationSchedule(vehicle.plate_number);
                  const vehicleChecklists = [] as Checklist[];
                  const lastChecklist = null as Checklist | null;
                  const { weeks: usageWeeks, monthlyAverage: monthlyUsageAverage } = computeUsageStats(vehicleChecklists);
                  const latestWeek = usageWeeks.length > 0 ? usageWeeks[usageWeeks.length - 1] : null;
                  const currentKm = lastChecklist ? lastChecklist.mileage : 0;
                  const targetKm = vehicle.next_service_mileage || null;
                  let nextServiceText = "No programado";
                  let nextServiceEstimate = "N/D";
                  let isServiceOverdue = false;
                  if (targetKm) {
                    nextServiceText = `${targetKm.toLocaleString()} km`;
                    if (currentKm >= targetKm) { isServiceOverdue = true; nextServiceEstimate = `Excedido por ${(currentKm - targetKm).toLocaleString()} km`; }
                    else { const remainingKm = targetKm - currentKm; const daysToService = Math.ceil(remainingKm / 80); const estDate = new Date(); estDate.setDate(estDate.getDate() + daysToService); nextServiceEstimate = estDate.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }); }
                  }
                  const lastServiceDate = "Sin registros";
                  const mileage = "Sin registros";
                  const rentStatusText = "Sin chofer";
                  const rentStatusColor = "text-muted-foreground";

                  return (
                    <React.Fragment key={vehicle.id}>
                      <tr role="button" tabIndex={0} aria-expanded={!!expandedVehicleDetails[vehicle.id]} onClick={() => toggleVehicleDetails(vehicle.id)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleVehicleDetails(vehicle.id); } }}
                        className={`border-b border-border/20 hover:bg-muted/30 transition-colors cursor-pointer ${filteredVehicles.indexOf(vehicle) % 2 === 0 ? "bg-card" : "bg-muted/5"}`}>
                        <td className="py-2.5 px-2"><span className="font-bold text-foreground">{`${vehicle.brand} ${vehicle.vehicle_name} ${vehicle.model}`}</span></td>
                        <td className="py-2.5 px-2 font-mono font-bold text-foreground">{vehicle.plate_number}</td>
                        <td className="py-2.5 px-2 font-mono text-muted-foreground">{vehicleId}</td>
                        <td className="py-2.5 px-2">
                          {vehicle.active_driver_id ? <span className="text-primary font-semibold">{getDriverName(drivers, vehicle.active_driver_id)}</span> : <span className="text-amber-500 font-semibold">Disponible</span>}
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.stopPropagation(); }} role="button" tabIndex={-1}>
                            {!vehicle.active_driver_id && onAssignVehicle && (
                              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onAssignVehicle!(vehicle.id); }}
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs gap-1 h-11 px-2.5" title="Asignar a chofer">
                                <ArrowLeftRight className="w-3 h-3" /><span className="sr-only">Asignar a chofer</span>
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleEditVehicle(vehicle); }}
                              className="text-muted-foreground hover:text-primary text-xs gap-1 h-11 px-2.5"><Pencil className="w-3 h-3" /><span className="sr-only">Editar</span></Button>
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDeleteVehicle(vehicle.id); }}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs gap-1 h-11 px-2.5"><Trash2 className="w-3 h-3" /><span className="sr-only">Eliminar</span></Button>
                          </div>
                        </td>
                      </tr>
                      {expandedVehicleDetails[vehicle.id] && (
                        <motion.tr initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="border-b border-border/20 bg-muted/10 overflow-hidden">
                          <td colSpan={5} className="p-4">
                            <div className="space-y-5">
                              {/* Info + Actions */}
                              <div>
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5"><Car className="w-3.5 h-3.5" /> Información del Auto</h4>
                                  <div className="flex items-center gap-1.5">
                                    {vehicle.status === "active" ? (
                                      <>
                                        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleServiceOut(vehicle); }}
                                          className="text-[11px] h-10 px-2.5 rounded-lg border-amber-500/40 text-amber-600 hover:bg-amber-500/10 gap-1"><Wrench className="w-3 h-3" /> Retirar a Servicio</Button>
                                        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleReportWearPart(vehicle); }}
                                          className="text-[11px] h-10 px-2.5 rounded-lg border-border gap-1"><AlertTriangle className="w-3 h-3" /> Pieza de Desgaste</Button>
                                      </>
                                    ) : (
                                      <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleServiceReturn(vehicle); }}
                                        className="text-[11px] h-10 px-2.5 rounded-lg border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 gap-1"><ArrowLeftRight className="w-3 h-3" /> Regresar a Chofer</Button>
                                    )}
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-xs">
                                  <div><span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Clase / Tipo</span><span className="block text-foreground font-medium">{vehicle.class_type || "Sedán"}</span></div>
                                  <div><span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Color</span><span className="block text-foreground font-medium">{vehicle.color || "Sin registrar"}</span></div>
                                  <div><span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Engomado</span>
                                    <span className="flex items-center gap-1.5 font-semibold text-foreground">
                                      <span className="w-2.5 h-2.5 rounded-full border border-black/20 inline-block shrink-0" style={{ backgroundColor: schedule.color === "Amarillo" ? "#eab308" : schedule.color === "Rosa" ? "#ec4899" : schedule.color === "Rojo" ? "#ef4444" : schedule.color === "Verde" ? "#22c55e" : "#3b82f6" }} />
                                      <span>{schedule.color}</span>
                                    </span>
                                  </div>
                                  <div><span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Estado</span>
                                    <span className={`block font-bold ${vehicle.status === "in_service" ? "text-amber-500" : "text-emerald-500"}`}>
                                      {vehicle.status === "in_service" ? <><Wrench className="w-3 h-3 inline text-amber-400" /> En Servicio</> : <><CheckCircle className="w-3 h-3 inline text-emerald-400" /> Activo</>}
                                    </span>
                                  </div>
                                  <div><span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Últ. Servicio</span><span className="block text-foreground font-medium">{lastServiceDate}</span></div>
                                  <div><span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Kilometraje</span><span className="block text-foreground font-medium">{mileage}</span></div>
                                  <div><span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Próx. Servicio</span><span className={`block font-semibold ${isServiceOverdue ? "text-amber-500 animate-pulse" : "text-foreground"}`}>{nextServiceText}</span></div>
                                  <div><span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Est. Fecha</span>
                                    <span className={`flex items-center gap-1 ${isServiceOverdue ? "text-red-400 font-extrabold" : "text-foreground"}`}>
                                      {isServiceOverdue && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}<span>{nextServiceEstimate}</span>
                                    </span>
                                  </div>
                                  <div><span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Renta</span><span className={`block ${rentStatusColor}`}>{rentStatusText}</span></div>
                                  <div><span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Uso Semanal</span><span className="block text-foreground font-medium">{latestWeek ? `${Math.round(latestWeek.kmPerDay).toLocaleString()} km/día` : "—"}</span></div>
                                  <div><span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Media Mensual</span><span className="block text-foreground font-medium">{monthlyUsageAverage !== null ? `${Math.round(monthlyUsageAverage).toLocaleString()} km/día` : "—"}</span></div>
                                </div>
                              </div>

                              {/* Documents */}
                              <div className="pt-4 border-t border-border/40">
                                <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground/80 mb-3">Documentos</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                  <div className="bg-muted/20 rounded-xl border border-border/60 p-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground/80">Circulación</span>
                                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleRenewDocument(vehicle, "CIRCULACION"); }} className="text-[10px] h-9 px-2 gap-1 text-muted-foreground hover:text-primary"><RefreshCcw className="w-3 h-3" /> Renovar</Button>
                                    </div>
                                    <div className="flex items-start gap-2.5">
                                      {vehicle.circulation_img ? (
                                        <div className="relative w-14 h-10 rounded-lg overflow-hidden border border-border bg-card shrink-0 cursor-pointer" onClick={(e) => { e.stopPropagation(); setPreviewImage(resolveDocUrl(vehicle.circulation_img)); }}>
                                          <Image src={resolveDocUrl(vehicle.circulation_img)} alt="Tarjeta de Circulación" fill className="object-cover hover:scale-105 transition-transform" />
                                        </div>
                                      ) : (
                                        <div className="w-14 h-10 rounded-lg border border-dashed border-border/50 bg-muted/30 flex items-center justify-center shrink-0"><Camera className="w-4 h-4 text-muted-foreground/40" /></div>
                                      )}
                                      <div className="text-[10px] space-y-0.5 min-w-0">
                                        <div><span className="text-muted-foreground/70">Vence: </span><strong className={vehicle.circulation_expiration_date && new Date(vehicle.circulation_expiration_date) < new Date() ? "text-red-400" : "text-foreground"}>{vehicle.circulation_expiration_date || "—"}</strong></div>
                                        <div><span className="text-muted-foreground/70">Placas: </span><strong className="text-foreground font-mono">{vehicle.plate_number}</strong></div>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="bg-muted/20 rounded-xl border border-border/60 p-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground/80">Seguro</span>
                                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleRenewDocument(vehicle, "SEGURO"); }} className="text-[10px] h-9 px-2 gap-1 text-muted-foreground hover:text-primary"><RefreshCcw className="w-3 h-3" /> Renovar</Button>
                                    </div>
                                    <div className="flex items-start gap-2.5">
                                      {vehicle.insurance_policy_img ? (
                                        <div className="relative w-14 h-10 rounded-lg overflow-hidden border border-border bg-card shrink-0 cursor-pointer" onClick={(e) => { e.stopPropagation(); setPreviewImage(resolveDocUrl(vehicle.insurance_policy_img)); }}>
                                          <Image src={resolveDocUrl(vehicle.insurance_policy_img)} alt="Póliza de Seguro" fill className="object-cover hover:scale-105 transition-transform" />
                                        </div>
                                      ) : (
                                        <div className="w-14 h-10 rounded-lg border border-dashed border-border/50 bg-muted/30 flex items-center justify-center shrink-0"><Camera className="w-4 h-4 text-muted-foreground/40" /></div>
                                      )}
                                      <div className="text-[10px] space-y-0.5 min-w-0">
                                        <div><span className="text-muted-foreground/70">Póliza: </span><strong className="text-foreground font-mono truncate block">{vehicle.insurance_policy_number || "—"}</strong></div>
                                        <div><span className="text-muted-foreground/70">Vence: </span><strong className={vehicle.insurance_expiration_date && new Date(vehicle.insurance_expiration_date) < new Date() ? "text-red-400" : "text-foreground"}>{vehicle.insurance_expiration_date || "—"}</strong></div>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="bg-muted/20 rounded-xl border border-border/60 p-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground/80">Verificación</span>
                                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleRenewDocument(vehicle, "VERIFICACION"); }} className="text-[10px] h-9 px-2 gap-1 text-muted-foreground hover:text-primary"><RefreshCcw className="w-3 h-3" /> Renovar</Button>
                                    </div>
                                    <div className="text-[10px] space-y-0.5">
                                      <div><span className="text-muted-foreground/70">Vence: </span><strong className={vehicle.verification_expiration_date && new Date(vehicle.verification_expiration_date) < new Date() ? "text-red-400" : "text-foreground"}>{vehicle.verification_expiration_date || "—"}</strong></div>
                                      <div><span className="text-muted-foreground/70">Engomado: </span>
                                        <span className="flex items-center gap-1 font-semibold text-foreground">
                                          <span className="w-2 h-2 rounded-full border border-black/20 inline-block shrink-0" style={{ backgroundColor: schedule.color === "Amarillo" ? "#eab308" : schedule.color === "Rosa" ? "#ec4899" : schedule.color === "Rojo" ? "#ef4444" : schedule.color === "Verde" ? "#22c55e" : "#3b82f6" }} />
                                          <span>{schedule.color} · {schedule.months}</span>
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Vehicle History */}
                              <VehicleHistory vehicle={vehicle} maintenances={maintenances} assignments={assignments} drivers={drivers} checklists={checklists} weeklyRentals={weeklyRentals} />
                            </div>
                          </td>
                        </motion.tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Card list móvil (<768px) — misma data que la tabla */}
      <div className="md:hidden space-y-3 pb-2">
        {isLoading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-border/60 bg-card p-3.5 space-y-2.5 animate-pulse">
              <div className="h-4 w-2/3 bg-muted rounded-full" />
              <div className="h-3 w-1/2 bg-muted rounded-full" />
              <div className="h-9 w-full bg-muted rounded-xl" />
            </div>
          ))
        ) : filteredVehicles.length === 0 ? (
          <p className="text-center py-10 text-muted-foreground italic text-sm">No se encontraron vehículos.</p>
        ) : (
          filteredVehicles.map((vehicle) => {
            const vehicleId = vehicle.vin?.slice(-6).toUpperCase() || "—";
            const schedule = getVerificationSchedule(vehicle.plate_number);
            const driverName = vehicle.active_driver_id ? getDriverName(drivers, vehicle.active_driver_id) : null;
            const isInService = vehicle.status === "in_service";
            return (
              <MobileCard
                key={vehicle.id}
                onClick={() => setDetailDialogVehicle(vehicle)}
                statusClass={isInService ? "border-l-4 border-l-blue-500" : !vehicle.active_driver_id ? "border-l-4 border-l-amber-500" : "border-l-4 border-l-transparent"}
                header={
                  <>
                    <div className="min-w-0 flex-1">
                      <span className="block text-base font-extrabold text-foreground leading-tight">{vehicle.brand} {vehicle.vehicle_name} {vehicle.model}</span>
                      <span className="block text-[11px] text-muted-foreground font-semibold mt-0.5 font-mono">{vehicle.plate_number} · {vehicleId}</span>
                    </div>
                    <span className={`shrink-0 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${isInService ? "bg-blue-500/10 text-blue-500" : vehicle.active_driver_id ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-500"}`}>
                      {isInService ? "Servicio" : vehicle.active_driver_id ? "Asignado" : "Disponible"}
                    </span>
                  </>
                }
                rows={[
                  { label: "Chofer", value: driverName ? <span className="text-primary font-semibold">{driverName}</span> : <span className="text-amber-500 font-semibold">Sin chofer</span> },
                ]}
                actions={
                  <div className="grid grid-cols-2 gap-2">
                    {!vehicle.active_driver_id && onAssignVehicle && (
                      <MobileActionButton variant="danger" onClick={(e) => { e.stopPropagation(); onAssignVehicle!(vehicle.id); }}>
                        <ArrowLeftRight className="w-4 h-4" /> Asignar
                      </MobileActionButton>
                    )}
                    <MobileActionButton onClick={(e) => { e.stopPropagation(); handleEditVehicle(vehicle); }}>
                      <Pencil className="w-4 h-4" /> Editar
                    </MobileActionButton>
                    <MobileActionButton variant="danger" onClick={(e) => { e.stopPropagation(); handleDeleteVehicle(vehicle.id); }}>
                      <Trash2 className="w-4 h-4" /> Eliminar
                    </MobileActionButton>
                  </div>
                }
              >
                {expandedVehicleDetails[vehicle.id] && (
                  <div className="pt-2 border-t border-border/40 space-y-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Estado</span>
                      <span className={`text-xs font-bold ${isInService ? "text-amber-500" : "text-emerald-600"}`}>{isInService ? "En Servicio" : "Activo"}</span>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Engomado</span>
                      <span className="text-xs font-semibold flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full border border-black/20 inline-block shrink-0" style={{ backgroundColor: schedule.color === "Amarillo" ? "#eab308" : schedule.color === "Rosa" ? "#ec4899" : schedule.color === "Rojo" ? "#ef4444" : schedule.color === "Verde" ? "#22c55e" : "#3b82f6" }} />
                        {schedule.color} · {schedule.months}
                      </span>
                    </div>
                    {vehicle.next_service_mileage && (
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Próx. Servicio</span>
                        <span className="text-xs font-semibold">{vehicle.next_service_mileage.toLocaleString()} km</span>
                      </div>
                    )}
                  </div>
                )}
              </MobileCard>
            );
          })
        )}
      </div>

      {/* Scanner Dialog for Renewals */}
      <Dialog open={isScanning && !!renewingVehicle && renewTarget !== "VERIFICACION"} onOpenChange={(o) => { if (!o) { stopCamera(); setRenewingVehicle(null); } }}>
        <DialogContent className="max-w-sm md:max-w-md border border-border bg-background text-foreground rounded-2xl p-0 overflow-hidden">
          <ScannerViewfinder scanner={scanner} labels={{ scan: "Escaneando documento...", extract: "Extrayendo datos...", logsHeader: "LOGS OCR RENOVACIÓN" }} />
        </DialogContent>
      </Dialog>

      {/* Renewal Dialog */}
      <Dialog open={isRenewOpen} onOpenChange={(o) => { setIsRenewOpen(o); if (!o) setRenewingVehicle(null); }}>
        <DialogContent className="max-w-sm md:max-w-md border border-border bg-background text-foreground rounded-2xl">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 shrink-0"><RefreshCcw className="w-5 h-5 text-primary" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-foreground font-black text-lg">Renovar {renewTarget === "CIRCULACION" ? "Tarjeta de Circulación" : renewTarget === "SEGURO" ? "Póliza de Seguro" : "Verificación Vehicular"}</DialogTitle>
                  <span className="text-[11px] font-black uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-md">Actualización</span>
                </div>
                <DialogDescription className="text-muted-foreground text-xs">
                  {renewingVehicle ? `${renewingVehicle.brand} ${renewingVehicle.vehicle_name} · ${renewingVehicle.plate_number}` : "Cargando..."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {renewTarget === "SEGURO" && (
              <div>
                <Label className="text-muted-foreground text-xs">Foto de Póliza</Label>
                <div className="mt-1.5 border border-dashed border-border rounded-xl p-3 text-center">
                  {renewPolicyImg ? (
                    <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400 font-semibold"><CheckCircle2 className="w-4 h-4" /> Póliza Cargada</div>
                  ) : (
                    <div className="text-muted-foreground text-xs"><Shield className="w-5 h-5 mx-auto mb-1 opacity-60" />Sin cambios en imagen</div>
                  )}
                </div>
              </div>
            )}
            <div>
              <Label className="text-muted-foreground text-xs">Nueva fecha de vigencia {renewTarget === "CIRCULACION" ? "de circulación" : "del seguro"}</Label>
              <Input type="date" value={renewExpirationDate} onChange={(e) => setRenewExpirationDate(e.target.value)} className="mt-1.5 border-input bg-background rounded-xl" />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => { setIsRenewOpen(false); setRenewingVehicle(null); }} className="flex-1 rounded-xl border-border">Cancelar</Button>
              <Button
                onClick={submitRenewal}
                disabled={!renewExpirationDate || isRenewing}
                className="flex-1 rounded-xl bg-primary text-white font-bold hover:bg-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRenewing ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Guardando...
                  </span>
                ) : (
                  "Guardar"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Wear Part Dialog */}
      <Dialog open={wearPartOpen} onOpenChange={(o) => { setWearPartOpen(o); if (!o) setWearPartVehicleState(null); }}>
        <DialogContent className="max-w-sm md:max-w-md border border-border bg-background text-foreground rounded-2xl">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 shrink-0"><AlertTriangle className="w-5 h-5 text-amber-500" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-foreground font-black text-lg">Reemplazo de Pieza de Desgaste</DialogTitle>
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-md">Reporte</span>
                </div>
                <DialogDescription className="text-muted-foreground text-xs">
                  {wearPartVehicleState ? `${wearPartVehicleState.brand} ${wearPartVehicleState.vehicle_name} · ${wearPartVehicleState.plate_number}` : "Cargando..."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div><Label className="text-muted-foreground text-xs">Pieza *</Label><Input type="text" placeholder="Ej: Frenos, Llantas, Batería, Embrague" value={wearPartName} onChange={(e) => setWearPartName(e.target.value)} className="mt-1.5 border-input bg-background rounded-xl" /></div>
            <div><Label className="text-muted-foreground text-xs">Costo estimado ($)</Label><Input type="number" min="0" step="0.01" placeholder="0.00" value={wearPartCost} onChange={(e) => setWearPartCost(e.target.value)} className="mt-1.5 border-input bg-background rounded-xl" /></div>
            <div><Label className="text-muted-foreground text-xs">Fecha de reparación</Label><Input type="date" value={wearPartDate} onChange={(e) => setWearPartDate(e.target.value)} className="mt-1.5 border-input bg-background rounded-xl" /></div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => { setWearPartOpen(false); setWearPartVehicleState(null); }} className="flex-1 rounded-xl border-border">Cancelar</Button>
              <Button
                onClick={submitWearPart}
                disabled={!wearPartName.trim() || isSavingWearPart}
                className="flex-1 rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingWearPart ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Guardando...
                  </span>
                ) : (
                  "Reportar"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Verification Dialog */}
      <Dialog open={verifOpen} onOpenChange={(o) => { if (!o) setVerifVehicle(null); }}>
        <DialogContent className="max-w-sm md:max-w-md border border-border bg-background text-foreground rounded-2xl">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 shrink-0"><CheckCircle2 className="w-5 h-5 text-emerald-500" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-foreground font-black text-lg">Verificación Vehicular</DialogTitle>
                  <span className="text-[11px] font-black uppercase tracking-wider text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-md">Evidencia</span>
                </div>
                <DialogDescription className="text-muted-foreground text-xs">
                  {verifVehicle ? `${verifVehicle.brand} ${verifVehicle.vehicle_name} · ${verifVehicle.plate_number}` : "Cargando..."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-muted-foreground text-xs">Foto de evidencia (engomado/comprobante)</Label>
              <div className="border border-dashed border-border rounded-xl p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors mt-1.5" onClick={() => verifFileRef.current?.click()}>
                {verifImg ? (
                  <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400 font-semibold"><CheckCircle2 className="w-4 h-4" /> Evidencia cargada</div>
                ) : (
                  <div className="text-muted-foreground text-xs flex flex-col items-center gap-1"><Camera className="w-5 h-5 text-muted-foreground/60 mb-1" /><span>Subir foto del comprobante</span></div>
                )}
              </div>
              <input type="file" accept="image/*" className="hidden" ref={verifFileRef} onChange={(e) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = (ev) => { if (ev.target?.result) setVerifImg(ev.target.result as string); }; reader.readAsDataURL(file); } }} />
            </div>
            {verifVehicle && (
              <p className="text-xs text-muted-foreground bg-muted/20 rounded-lg p-3 leading-relaxed">
                Al guardar se marcará la verificación como completada y se calculará automáticamente la próxima fecha de vencimiento según el calendario de verificación para placas con terminación <strong className="text-foreground">{verifVehicle.plate_number?.slice(-1) || "?"}</strong>.
              </p>
            )}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => { setVerifOpen(false); setVerifVehicle(null); }} className="flex-1 rounded-xl border-border">Cancelar</Button>
              <Button
                onClick={submitVerification}
                disabled={!verifImg || isVerifying}
                className="flex-1 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isVerifying ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Guardando...
                  </span>
                ) : (
                  "Marcar como Verificada"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Vehicle Detail Dialog (Mobile) */}
      <VehicleDetailDialog
        vehicle={detailDialogVehicle}
        open={!!detailDialogVehicle}
        onClose={() => setDetailDialogVehicle(null)}
        onEdit={handleEditVehicle}
        onDelete={handleDeleteVehicle}
        onRenewDocument={handleRenewDocument}
        onServiceOut={handleServiceOut}
        onServiceReturn={handleServiceReturn}
        onReportWearPart={handleReportWearPart}
        drivers={drivers}
        maintenances={maintenances}
        assignments={assignments}
        checklists={checklists}
        weeklyRentals={weeklyRentals}
        setPreviewImage={setPreviewImage}
      />

      {/* Document Preview */}
      <Dialog open={!!previewImage} onOpenChange={(o) => { if (!o) setPreviewImage(null); }}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-auto h-auto border border-border bg-black/95 text-foreground rounded-2xl p-2">
          <div className="relative w-full h-full flex items-center justify-center">
            {previewImage && <Image src={previewImage} alt="Documento" width={1200} height={1600} className="object-contain max-w-full max-h-[85vh] rounded-lg" style={{ width: 'auto', height: 'auto' }} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
