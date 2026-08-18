"use client";

import React from "react";
import { Vehicle, Driver, getVerificationSchedule, Checklist } from "@/lib/db";
import { computeUsageStats } from "@/lib/usageStats";
import { getDriverName } from "@/lib/lookups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Stepper } from "@/components/ui/stepper";
import { Car, CheckCircle2, Search, Trash2, Camera, FolderOpen, Pencil, RefreshCcw, Mic, AlertTriangle, Shield, Wrench, ArrowLeftRight, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import SliceHeader from "@/components/SliceHeader";
import { VehiclesListSkeleton } from "@/components/ui/skeletons";
import ScannerViewfinder from "@/components/ScannerViewfinder";
import VehicleHistory from "@/components/VehicleHistory";
import { resolveDocUrl } from "@/lib/db/storage";
import { useVehicles } from "@/features/vehicles/hooks/useVehicles";

interface VehiclesSliceProps {
  onRefreshAlerts: () => void;
  searchQuery?: string;
  onOpenActionSheet: (entity: Vehicle | Driver, type: "driver" | "vehicle") => void;
  autoOpen?: boolean;
  onAutoOpenConsumed?: () => void;
  onAssignVehicle?: (vehicleId: string) => void;
  externalWearPartVehicle?: Vehicle | null;
  refreshTrigger?: number;
}

export default function VehiclesSlice(props: VehiclesSliceProps) {
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
  circulationImg,
  setCirculationImg,
  startCamera,
  circFileRef,
  handleFileChange,
  insFileRef,
  brand,
  setBrand,
  vehicleName,
  setVehicleName,
  model,
  setModel,
  classType,
  setClassType,
  plateNumber,
  setPlateNumber,
  isPlateLengthInvalid,
  vin,
  setVin,
  isVinLengthInvalid,
  circulationExpirationDate,
  setCirculationExpirationDate,
  insuranceExpirationDate,
  setInsuranceExpirationDate,
  rentCost,
  setRentCost,
  nextServiceMileage,
  setNextServiceMileage,
  color,
  setColor,
  insurancePolicyFiles,
  search,
  setSearch,
  setShowArchived,
  showArchived,
  isLoading,
  filteredVehicles,
  toggleVehicleDetails,
  drivers,
  onAssignVehicle,
  handleEditVehicle,
  handleDeleteVehicle,
  expandedVehicleDetails,
  handleServiceOut,
  handleReportWearPart,
  handleServiceReturn,
  handleRenewDocument,
  setPreviewImage,
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
                <Stepper steps={[{ id: "circ", label: "Circulación" }, { id: "seguro", label: "Seguro" }, { id: "datos", label: "Datos" }, { id: "vig", label: "Vigencias" }]}
                  currentStep={activeSection} onStepClick={scrollToSection} />
              </div>

              <AnimatePresence mode="wait">
                {isScanning ? (
                  <ScannerViewfinder scanner={scanner} labels={{ scan: "Analizando marcas...", extract: "Generando bloques de texto...", logsHeader: "LOGS DETALLADOS VEHICULARES" }} />
                ) : (
                  <form onSubmit={handleSave} className="space-y-4 pt-2 flex flex-col max-h-[78vh]">
                    <div className="flex-1 overflow-y-auto pr-1.5 space-y-4 max-h-[62vh]">
                      {/* Circulación */}
                      <div id="section-circ" className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3.5 scroll-mt-2">
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground font-black">Tarjeta de Circulación (OCR)</h4>
                        {circulationImg && (
                          <div className="relative w-full h-14 rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center">
                            <Image src={circulationImg} alt="Tarjeta de Circulación" fill className="object-contain p-1" />
                            <button type="button" onClick={() => setCirculationImg("")} className="absolute top-1.5 right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md transition-all active:scale-90" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <Button type="button" variant="outline" onClick={() => startCamera("CIRCULACION")} className="border-border bg-card hover:bg-accent text-foreground text-xs rounded-xl flex items-center justify-center gap-1.5 h-11 cursor-pointer"><Camera className="w-4 h-4 text-primary" /> Tomar Foto</Button>
                          <Button type="button" variant="outline" onClick={() => circFileRef.current?.click()} className="border-border bg-card hover:bg-accent text-foreground text-xs rounded-xl flex items-center justify-center gap-1.5 h-11 cursor-pointer"><FolderOpen className="w-4 h-4 text-primary" /> Subir Archivo</Button>
                          <input type="file" accept="image/*" className="hidden" ref={circFileRef} onChange={(e) => handleFileChange(e, "CIRCULACION")} />
                        </div>
                      </div>

                      {/* Seguro */}
                      <div id="section-seguro" className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3.5 scroll-mt-2">
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground font-black">Póliza de Seguro (OCR)</h4>
                        <div className="grid grid-cols-2 gap-2">
                          <Button type="button" variant="outline" onClick={() => startCamera("SEGURO")} className="border-border bg-card hover:bg-accent text-foreground text-xs rounded-xl flex items-center justify-center gap-1.5 h-11 cursor-pointer"><Camera className="w-4 h-4 text-primary" /> Tomar Foto</Button>
                          <Button type="button" variant="outline" onClick={() => insFileRef.current?.click()} className="border-border bg-card hover:bg-accent text-foreground text-xs rounded-xl flex items-center justify-center gap-1.5 h-11 cursor-pointer"><FolderOpen className="w-4 h-4 text-primary" /> Subir Archivo</Button>
                          <input type="file" accept="image/*,application/pdf" multiple className="hidden" ref={insFileRef} onChange={(e) => handleFileChange(e, "SEGURO")} />
                        </div>
                      </div>

                      {/* Datos */}
                      <div id="section-datos" className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3 scroll-mt-2">
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground font-black">Datos del Vehículo</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="min-w-0"><Label htmlFor="brand" className="text-muted-foreground text-xs">Marca *</Label><Input id="brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="ej. Nissan" className="border-input bg-background rounded-xl w-full min-w-0" /></div>
                          <div className="min-w-0"><Label htmlFor="vName" className="text-muted-foreground text-xs">Vehículo / Submarca *</Label><Input id="vName" value={vehicleName} onChange={(e) => setVehicleName(e.target.value)} placeholder="ej. Versa" className="border-input bg-background rounded-xl w-full min-w-0" /></div>
                          <div className="min-w-0"><Label htmlFor="model" className="text-muted-foreground text-xs">Modelo (Año)</Label><Input id="model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="ej. 2022" className="border-input bg-background rounded-xl w-full min-w-0" /></div>
                          <div className="min-w-0"><Label htmlFor="classType" className="text-muted-foreground text-xs">Clase / Tipo</Label><Input id="classType" value={classType} onChange={(e) => setClassType(e.target.value)} placeholder="ej. Sedán" className="border-input bg-background rounded-xl w-full min-w-0" /></div>
                        </div>
                      </div>

                      {/* Vigencias */}
                      <div id="section-vig" className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3 scroll-mt-2">
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground font-black">Identificación & Vigencias</h4>
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="min-w-0">
                              <Label htmlFor="plate" className="text-muted-foreground text-xs">Placa *</Label>
                              <Input id="plate" value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)} placeholder="ej. 982-WXY" className="border-input bg-background rounded-xl w-full min-w-0" />
                              {isPlateLengthInvalid && <span className="text-xs text-amber-400 flex items-center gap-1 mt-1"><AlertTriangle className="w-3.5 h-3.5" /> Placa corta o inusual.</span>}
                            </div>
                            <div className="min-w-0">
                              <Label htmlFor="vin" className="text-muted-foreground text-xs">NIV / Serie</Label>
                              <Input id="vin" value={vin} onChange={(e) => setVin(e.target.value)} placeholder="17 caracteres" className="border-input bg-background rounded-xl w-full min-w-0" />
                              {isVinLengthInvalid && <span className="text-xs text-amber-400 flex items-center gap-1 mt-1 font-semibold"><AlertTriangle className="w-3.5 h-3.5" /> El NIV debe tener 17 caracteres (leídos: {vin.length}).</span>}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="min-w-0"><Label htmlFor="circExp" className="text-muted-foreground text-xs">Vigencia Tarjeta Circulación</Label><Input type="date" id="circExp" value={circulationExpirationDate} onChange={(e) => setCirculationExpirationDate(e.target.value)} className="border-input bg-background rounded-xl w-full min-w-0" /></div>
                            <div className="min-w-0"><Label htmlFor="insExp" className="text-muted-foreground text-xs">Vigencia del Seguro</Label><Input type="date" id="insExp" value={insuranceExpirationDate} onChange={(e) => setInsuranceExpirationDate(e.target.value)} className="border-input bg-background rounded-xl w-full min-w-0" /></div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="min-w-0"><Label htmlFor="rentCost" className="text-muted-foreground text-xs">Costo Renta Semanal ($)</Label><Input type="number" id="rentCost" value={rentCost || ""} onChange={(e) => setRentCost(Number(e.target.value))} className="border-input bg-background rounded-xl w-full min-w-0" placeholder="ej. 2500" /></div>
                            <div className="min-w-0"><Label htmlFor="nextService" className="text-muted-foreground text-xs">Kilometraje Próximo Servicio (km)</Label><Input type="number" id="nextService" value={nextServiceMileage} onChange={(e) => setNextServiceMileage(e.target.value)} className="border-input bg-background rounded-xl w-full min-w-0" placeholder="ej. 20000" /></div>
                          </div>
                          <div className="min-w-0"><Label htmlFor="color" className="text-muted-foreground text-xs">Color del Auto</Label><Input id="color" value={color} onChange={(e) => setColor(e.target.value)} className="border-input bg-background rounded-xl w-full min-w-0" placeholder="ej. Rojo, Blanco, Gris" /></div>
                        </div>
                      </div>

                      {/* Póliza */}
                      <div className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3">
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground font-black">Póliza de Seguro</h4>
                        <div>
                          <Label className="text-muted-foreground text-xs">Documentos de Póliza</Label>
                          <div className="border border-dashed border-border rounded-xl p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => insFileRef.current?.click()}>
                            {insurancePolicyFiles.length > 0 ? (
                              <div className="flex flex-col items-center gap-2">
                                <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400 font-semibold"><CheckCircle2 className="w-4 h-4" /> {insurancePolicyFiles.length} página(s) cargada(s)</div>
                                <div className="flex gap-1.5 flex-wrap justify-center">
                                  {insurancePolicyFiles.map((_, i) => (<span key={i} className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-md font-bold">Pág. {i + 1}</span>))}
                                </div>
                              </div>
                            ) : (
                              <div className="text-muted-foreground text-xs flex flex-col items-center gap-1"><Shield className="w-6 h-6 text-muted-foreground/80 mb-1" /><span>Subir PDF o imágenes (múltiples páginas)</span></div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <Button type="submit" className="w-full rounded-xl bg-primary text-white font-bold hover:bg-primary transition-all cursor-pointer shrink-0" disabled={isScanning}>Guardar Vehículo</Button>
                  </form>
                )}
              </AnimatePresence>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Search */}
      <div className="bg-[#ECECEC] rounded-full h-11 px-4 flex items-center gap-2 w-full shadow-inner mb-4 mt-2">
        <Search className="w-4 h-4 text-muted-foreground/60 shrink-0" />
        <input type="text" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 bg-transparent border-none text-foreground text-sm placeholder:text-muted-foreground/60 focus:outline-hidden" />
        <Mic className="w-4 h-4 text-muted-foreground/60 shrink-0 cursor-pointer" />
        <button type="button" onClick={() => setShowArchived(!showArchived)}
          className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer shrink-0 ${showArchived ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
          {showArchived ? "Activos" : "Archivo"}
        </button>
      </div>

      {/* Table */}
      <div className="w-full overflow-x-auto pb-6">
        {isLoading ? (
          <VehiclesListSkeleton count={4} />
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/40">
                <th className="text-left py-2.5 px-2 whitespace-nowrap">Auto</th>
                <th className="text-left py-2.5 px-2 whitespace-nowrap">Placa</th>
                <th className="text-left py-2.5 px-2 whitespace-nowrap">ID</th>
                <th className="text-left py-2.5 px-2 whitespace-nowrap">Chofer</th>
                <th className="text-right py-2.5 px-2 whitespace-nowrap">Acciones</th>
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
                      <tr role="button" tabIndex={0} onClick={() => toggleVehicleDetails(vehicle.id)}
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
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs gap-1 h-9 px-2.5" title="Asignar a chofer">
                                <ArrowLeftRight className="w-3 h-3" /><span className="sr-only">Asignar a chofer</span>
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleEditVehicle(vehicle); }}
                              className="text-muted-foreground hover:text-primary text-xs gap-1 h-9 px-2.5"><Pencil className="w-3 h-3" /><span className="sr-only">Editar</span></Button>
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDeleteVehicle(vehicle.id); }}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs gap-1 h-9 px-2.5"><Trash2 className="w-3 h-3" /><span className="sr-only">Eliminar</span></Button>
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
                                          className="text-[11px] h-7 px-2.5 rounded-lg border-amber-500/40 text-amber-600 hover:bg-amber-500/10 gap-1"><Wrench className="w-3 h-3" /> Retirar a Servicio</Button>
                                        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleReportWearPart(vehicle); }}
                                          className="text-[11px] h-7 px-2.5 rounded-lg border-border gap-1"><AlertTriangle className="w-3 h-3" /> Pieza de Desgaste</Button>
                                      </>
                                    ) : (
                                      <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleServiceReturn(vehicle); }}
                                        className="text-[11px] h-7 px-2.5 rounded-lg border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 gap-1"><ArrowLeftRight className="w-3 h-3" /> Regresar a Chofer</Button>
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
                                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleRenewDocument(vehicle, "CIRCULACION"); }} className="text-[10px] h-6 px-1.5 gap-0.5 text-muted-foreground hover:text-primary"><RefreshCcw className="w-2.5 h-2.5" /> Renovar</Button>
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
                                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleRenewDocument(vehicle, "SEGURO"); }} className="text-[10px] h-6 px-1.5 gap-0.5 text-muted-foreground hover:text-primary"><RefreshCcw className="w-2.5 h-2.5" /> Renovar</Button>
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
                                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleRenewDocument(vehicle, "VERIFICACION"); }} className="text-[10px] h-6 px-1.5 gap-0.5 text-muted-foreground hover:text-primary"><RefreshCcw className="w-2.5 h-2.5" /> Renovar</Button>
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
              <Button onClick={submitRenewal} disabled={!renewExpirationDate} className="flex-1 rounded-xl bg-primary text-white font-bold hover:bg-primary disabled:opacity-50">Guardar</Button>
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
              <Button onClick={submitWearPart} disabled={!wearPartName.trim()} className="flex-1 rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-600 disabled:opacity-50">Reportar</Button>
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
              <Button onClick={submitVerification} disabled={!verifImg} className="flex-1 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-600 disabled:opacity-50">Marcar como Verificada</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
