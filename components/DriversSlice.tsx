"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { db, Driver, Vehicle, WeeklyRental } from "@/lib/db";
import { parseOcrText, calculateCurp, MEXICAN_STATES } from "@/lib/ocr";
import Tesseract from "tesseract.js";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Stepper, type StepperStep } from "@/components/ui/stepper";
import { User, AlertTriangle, Search, Camera, FolderOpen, CheckCircle2, Sparkles, Trash2, Car, Pencil, RefreshCcw, Mic, ChevronDown, X, DollarSign, XCircle, Calendar, Plus, Minus, ArrowLeftRight, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import SliceHeader from "@/components/SliceHeader";
import { useOcrScanner } from "@/components/useOcrScanner";
import ScannerViewfinder from "@/components/ScannerViewfinder";
import { uploadDocumentImage } from "@/lib/db/storage";
import { requirePasskeyConfirmation } from "@/lib/webauthn";
import { DriversListSkeleton } from "@/components/ui/skeletons";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useDrivers } from "@/features/drivers/hooks/useDrivers";

interface DriversSliceProps {
  onRefreshAlerts: () => void;
  searchQuery?: string;
  onOpenActionSheet: (entity: Driver | Vehicle, type: "driver" | "vehicle") => void;
  autoOpen?: boolean;
  onAutoOpenConsumed?: () => void;
  weeklyRentals?: WeeklyRental[];
  onAssignDriver?: (driverId: string) => void;
}

export default function DriversSlice(props: DriversSliceProps) {
  const ctx = useDrivers(props);

  return (
    <div className="space-y-4">
      {/* Header Row */}
      <SliceHeader
        title="Conductores"
        action={
          <Dialog open={ctx.isOpen} onOpenChange={(open) => {
            ctx.setIsOpen(open);
            if (!open) ctx.resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="rounded-full bg-[#0088FF] hover:bg-[#0077EE] text-white text-sm font-bold px-6 h-11 border-none active:scale-95 transition-all cursor-pointer flex items-center justify-center shadow-xs">
                Registrar conductor
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md md:max-w-2xl max-h-[90vh] overflow-y-auto border border-border bg-background text-foreground rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-foreground font-black text-lg">
                  {ctx.editingDriverId ? "Editar Conductor" : "Registro de Conductor"}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-xs">
                  {ctx.editingDriverId
                    ? "Modifica los datos del conductor. Los cambios se aplican al instante."
                    : "Crea el expediente escaneando documentos o llenando los campos."}
                </DialogDescription>
              </DialogHeader>

              <div className="pt-2 pb-1">
                <Stepper
                  steps={[
                    { id: "foto", label: "Foto" },
                    { id: "doc", label: "Documentos" },
                    { id: "dom", label: "Domicilio" },
                    { id: "datos", label: "Datos" },
                  ]}
                  currentStep={ctx.activeSection}
                  onStepClick={ctx.scrollToSection}
                />
              </div>

              <AnimatePresence mode="wait">
                {ctx.isScanning ? (
                  <ScannerViewfinder
                    scanner={ctx.scanner}
                    labels={{
                      scan: "Escaneando píxeles...",
                      extract: "Analizando caracteres...",
                      logsHeader: "LOGS DETALLADOS DEL FLUJO OCR",
                    }}
                  />
                ) : (
                  <form onSubmit={ctx.handleSave} className="space-y-4 pt-2 flex flex-col max-h-[78vh]">
                    <div className="flex-1 overflow-y-auto pr-1.5 space-y-4 max-h-[62vh]">
                      {/* Foto de Perfil */}
                      <div id="section-foto" className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3.5 flex flex-col items-center text-center scroll-mt-2">
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground font-black self-start">Foto de Perfil del Chofer</h4>
                        <div
                          className="relative w-24 h-24 rounded-full border-2 border-primary/20 bg-muted overflow-hidden flex items-center justify-center shadow-inner group cursor-pointer"
                          onClick={() => { if (ctx.driverPhotoImg) ctx.setPreviewImage(ctx.driverPhotoImg); }}
                        >
                          {ctx.driverPhotoImg ? (
                            <Image src={ctx.driverPhotoImg} alt="Foto Chofer" fill className="object-cover" />
                          ) : (
                            <User className="w-12 h-12 text-muted-foreground/60" />
                          )}
                          {ctx.driverPhotoImg && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); ctx.setDriverPhotoImg(""); }}
                              className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-2xs font-bold transition-opacity duration-200 cursor-pointer"
                            >
                              Eliminar
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 w-full">
                          <Button type="button" variant="outline" onClick={() => ctx.startCamera("CHOFER")}
                            className="border-border bg-card hover:bg-accent text-foreground text-xs rounded-xl flex items-center justify-center gap-1.5 h-11 cursor-pointer">
                            <Camera className="w-4 h-4 text-primary" /> Tomar Foto
                          </Button>
                          <Button type="button" variant="outline" onClick={() => ctx.photoFileRef.current?.click()}
                            className="border-border bg-card hover:bg-accent text-foreground text-xs rounded-xl flex items-center justify-center gap-1.5 h-11 cursor-pointer">
                            <FolderOpen className="w-4 h-4 text-primary" /> Subir Foto
                          </Button>
                          <input type="file" accept="image/*" ref={ctx.photoFileRef} className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (event) => { if (event.target?.result) ctx.setDriverPhotoImg(event.target.result as string); };
                                reader.readAsDataURL(file);
                              }
                            }} />
                        </div>
                      </div>

                      {/* INE */}
                      <div id="section-doc" className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3.5 scroll-mt-2">
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground font-black">Escanear INE (Identificación)</h4>
                        {ctx.ineImg && (
                          <div className="relative w-full h-14 rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center">
                            <Image src={ctx.ineImg} alt="INE" fill className="object-contain p-1" />
                            <button type="button" onClick={() => ctx.setIneImg("")}
                              className="absolute top-1.5 right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md transition-all active:scale-90" title="Eliminar INE">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <Button type="button" variant="outline" onClick={() => ctx.startCamera("INE")}
                            className="border-border bg-card hover:bg-accent text-foreground text-xs rounded-xl flex items-center justify-center gap-1.5 h-11 cursor-pointer">
                            <Camera className="w-4 h-4 text-primary" /> Tomar Foto
                          </Button>
                          <Button type="button" variant="outline" onClick={() => ctx.ineFileRef.current?.click()}
                            className="border-border bg-card hover:bg-accent text-foreground text-xs rounded-xl flex items-center justify-center gap-1.5 h-11 cursor-pointer">
                            <FolderOpen className="w-4 h-4 text-primary" /> Subir Archivo
                          </Button>
                          <input type="file" accept="image/*" className="hidden" ref={ctx.ineFileRef} onChange={(e) => ctx.handleFileChange(e, "INE")} />
                          <Button type="button" variant="ghost" onClick={() => ctx.fillDemoData("INE")}
                            className="col-span-2 text-xs text-muted-foreground hover:text-foreground font-bold uppercase tracking-wider text-center h-10">
                            Simular INE Demo
                          </Button>
                        </div>
                      </div>

                      {/* Licencia */}
                      <div className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3.5">
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground font-black">Escanear Licencia de Conducir</h4>
                        {ctx.licenseImg && (
                          <div className="relative w-full h-14 rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center">
                            <Image src={ctx.licenseImg} alt="Licencia" fill className="object-contain p-1" />
                            <button type="button" onClick={() => ctx.setLicenseImg("")}
                              className="absolute top-1.5 right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md transition-all active:scale-90" title="Eliminar Licencia">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <Button type="button" variant="outline" onClick={() => ctx.startCamera("LICENCIA")}
                            className="border-border bg-card hover:bg-accent text-foreground text-xs rounded-xl flex items-center justify-center gap-1.5 h-11 cursor-pointer">
                            <Camera className="w-4 h-4 text-primary" /> Tomar Foto
                          </Button>
                          <Button type="button" variant="outline" onClick={() => ctx.licFileRef.current?.click()}
                            className="border-border bg-card hover:bg-accent text-foreground text-xs rounded-xl flex items-center justify-center gap-1.5 h-11 cursor-pointer">
                            <FolderOpen className="w-4 h-4 text-primary" /> Subir Archivo
                          </Button>
                          <input type="file" accept="image/*" className="hidden" ref={ctx.licFileRef} onChange={(e) => ctx.handleFileChange(e, "LICENCIA")} />
                          <Button type="button" variant="ghost" onClick={() => ctx.fillDemoData("LICENCIA")}
                            className="col-span-2 text-xs text-muted-foreground hover:text-foreground font-bold uppercase tracking-wider text-center h-10">
                            Simular Licencia Demo
                          </Button>
                        </div>
                      </div>

                      {/* Comprobante de Domicilio */}
                      <div id="section-dom" className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3.5 scroll-mt-2">
                        <div className="flex justify-between items-center">
                          <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground font-black">Comprobante de Domicilio</h4>
                          {ctx.addressProofImg && (
                            <span className="text-[11px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-md font-bold">Cargado</span>
                          )}
                        </div>
                        {ctx.addressProofImg && (
                          <div className="relative w-full h-14 rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center">
                            <Image src={ctx.addressProofImg} alt="Comprobante de Domicilio" fill className="object-contain p-1" />
                            <button type="button" onClick={() => ctx.setAddressProofImg("")}
                              className="absolute top-1.5 right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md transition-all active:scale-90" title="Eliminar comprobante">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <Button type="button" variant="outline" onClick={() => ctx.addressProofCameraRef.current?.click()}
                            className="border-border bg-card hover:bg-accent text-foreground text-xs rounded-xl flex items-center justify-center gap-1.5 h-11 cursor-pointer">
                            <Camera className="w-4 h-4 text-primary" /> Tomar Foto
                          </Button>
                          <Button type="button" variant="outline" onClick={() => ctx.addressProofFileRef.current?.click()}
                            className="border-border bg-card hover:bg-accent text-foreground text-xs rounded-xl flex items-center justify-center gap-1.5 h-11 cursor-pointer">
                            <FolderOpen className="w-4 h-4 text-primary" /> Subir Archivo
                          </Button>
                          <input type="file" accept="image/*" capture="environment" className="hidden" ref={ctx.addressProofCameraRef} onChange={(e) => ctx.handleAddressProofFile(e)} />
                          <input type="file" accept="image/*" className="hidden" ref={ctx.addressProofFileRef} onChange={(e) => ctx.handleAddressProofFile(e)} />
                        </div>
                      </div>

                      {/* Datos Manuales */}
                      <div id="section-datos" className="bg-muted/40 rounded-xl border border-border/80 overflow-hidden scroll-mt-2">
                        <button type="button" onClick={() => ctx.setShowManualFields((v: boolean) => !v)}
                          className="w-full p-3.5 flex items-center justify-between gap-2 cursor-pointer hover:bg-muted/60 transition-colors" aria-expanded={ctx.showManualFields}>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <ChevronDown className={cn("w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-300", !ctx.showManualFields && "-rotate-90")} />
                            <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground font-black">Datos Manuales</h4>
                            <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded-md border",
                              ctx.manualFieldsCount === ctx.MANUAL_FIELDS_TOTAL ? "bg-primary/10 text-primary border-primary/20" :
                              ctx.manualFieldsCount > 0 ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-muted text-muted-foreground border-border")}>
                              {ctx.manualFieldsCount}/{ctx.MANUAL_FIELDS_TOTAL} campos
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground italic shrink-0">Opcional — solo para correcciones</span>
                        </button>

                        <AnimatePresence initial={false}>
                          {ctx.showManualFields && (
                            <motion.div key="manual-fields" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
                              <div className="p-4 pt-1 space-y-3 border-t border-border/60">
                                <div className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3">
                                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground font-black">Datos Personales</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="min-w-0 md:col-span-2">
                                      <Label htmlFor="firstName" className="text-muted-foreground text-xs">Nombres</Label>
                                      <Input id="firstName" value={ctx.firstName} onChange={(e) => ctx.setFirstName(e.target.value)} required className="border-input bg-background rounded-xl w-full min-w-0" />
                                    </div>
                                    <div className="min-w-0">
                                      <Label htmlFor="patName" className="text-muted-foreground text-xs">Apellido Paterno</Label>
                                      <Input id="patName" value={ctx.paternalLastName} onChange={(e) => ctx.setPaternalLastName(e.target.value)} required className="border-input bg-background rounded-xl w-full min-w-0" />
                                    </div>
                                    <div className="min-w-0">
                                      <Label htmlFor="matName" className="text-muted-foreground text-xs">Apellido Materno</Label>
                                      <Input id="matName" value={ctx.maternalLastName} onChange={(e) => ctx.setMaternalLastName(e.target.value)} className="border-input bg-background rounded-xl w-full min-w-0" />
                                    </div>
                                  </div>
                                </div>

                                {ctx.suggestedCurp && (
                                  <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl space-y-2">
                                    <div className="flex justify-between items-center text-xs">
                                      <span className="text-primary font-bold flex items-center gap-1 font-black"><Sparkles className="w-4 h-4" /> Sugerencia de CURP Calculada:</span>
                                      <button type="button" onClick={ctx.applySuggestedCurp} className="text-xs font-black uppercase text-primary hover:text-primary/80 underline cursor-pointer">Autocompletar</button>
                                    </div>
                                    <div className="font-mono text-sm text-foreground font-bold tracking-wider text-center">{ctx.suggestedCurp}</div>
                                  </div>
                                )}

                                <div className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3">
                                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground font-black">Licencia de Conducir</h4>
                                  <div className="space-y-3">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      <div className="min-w-0"><Label htmlFor="licNo" className="text-muted-foreground text-xs">No. Licencia</Label><Input id="licNo" value={ctx.licenseNumber} onChange={(e) => ctx.setLicenseNumber(e.target.value)} className="border-input bg-background rounded-xl w-full min-w-0" /></div>
                                      <div className="min-w-0"><Label htmlFor="licCurp" className="text-muted-foreground text-xs">CURP Licencia</Label><Input id="licCurp" value={ctx.licenseCurp} onChange={(e) => ctx.setLicenseCurp(e.target.value)} className="border-input bg-background rounded-xl w-full min-w-0" /></div>
                                    </div>
                                    <div className="flex items-center justify-between pt-1">
                                      <Label htmlFor="permanentLic" className="cursor-pointer text-foreground">¿Licencia Permanente?</Label>
                                      <Switch id="permanentLic" checked={ctx.licenseIsPermanent} onCheckedChange={ctx.setLicenseIsPermanent} />
                                    </div>
                                    {!ctx.licenseIsPermanent && (
                                      <div className="min-w-0"><Label htmlFor="licExp" className="text-muted-foreground text-xs">F. Vencimiento</Label><Input type="date" id="licExp" value={ctx.licenseExpirationDate} onChange={(e) => ctx.setLicenseExpirationDate(e.target.value)} className="border-input bg-background rounded-xl w-full min-w-0" /></div>
                                    )}
                                  </div>
                                </div>

                                <div className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3">
                                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground font-black">Datos INE</h4>
                                  <div className="space-y-3">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      <div className="min-w-0"><Label htmlFor="ineCurp" className="text-muted-foreground text-xs">CURP INE</Label><Input id="ineCurp" value={ctx.ineCurp} onChange={(e) => ctx.setIneCurp(e.target.value)} className="border-input bg-background rounded-xl w-full min-w-0" /></div>
                                      <div className="min-w-0"><Label htmlFor="ineDob" className="text-muted-foreground text-xs">F. Nacimiento (INE)</Label><Input type="date" id="ineDob" value={ctx.ineDob} onChange={(e) => ctx.setIneDob(e.target.value)} className="border-input bg-background rounded-xl w-full min-w-0" /></div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      <div className="min-w-0"><Label htmlFor="electorKey" className="text-muted-foreground text-xs">Clave Elector</Label><Input id="electorKey" value={ctx.ineElectorKey} onChange={(e) => ctx.setIneElectorKey(e.target.value)} className="border-input bg-background rounded-xl w-full min-w-0" /></div>
                                      <div className="min-w-0">
                                        <Label className="text-muted-foreground text-xs">Sexo</Label>
                                        <Select value={ctx.ineSex} onValueChange={(val: "M" | "F" | "X") => ctx.setIneSex(val)}>
                                          <SelectTrigger className="w-full border-input bg-background rounded-xl"><SelectValue placeholder="Sexo" /></SelectTrigger>
                                          <SelectContent className="border-border bg-popover text-popover-foreground">
                                            <SelectItem value="M">Masculino</SelectItem>
                                            <SelectItem value="F">Femenino</SelectItem>
                                            <SelectItem value="X">No Binario</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                      <div className="min-w-0">
                                        <SearchableSelect options={MEXICAN_STATES.map((st) => ({ value: st.code, label: st.name }))} value={ctx.birthState} onValueChange={ctx.setBirthState} placeholder="Estado de nacimiento" label="Estado de Nacimiento (Para cálculo CURP)" />
                                      </div>
                                      <div className="min-w-0"><Label htmlFor="ineAddr" className="text-muted-foreground text-xs">Domicilio</Label><Input id="ineAddr" value={ctx.ineAddress} onChange={(e) => ctx.setIneAddress(e.target.value)} className="border-input bg-background rounded-xl w-full min-w-0" /></div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    <Button type="submit" className="w-full rounded-xl bg-primary text-white font-bold hover:bg-primary transition-all cursor-pointer shrink-0" disabled={ctx.isScanning}>
                      Guardar Conductor
                    </Button>
                  </form>
                )}
              </AnimatePresence>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Search Bar */}
      <div className="bg-[#ECECEC] rounded-full h-11 px-4 flex items-center gap-2 w-full shadow-inner mb-4 mt-2">
        <Search className="w-4 h-4 text-muted-foreground/60 shrink-0" />
        <input type="text" placeholder="Search" value={ctx.search}
          onChange={(e) => ctx.setSearch(e.target.value)}
          className="flex-1 bg-transparent border-none text-foreground text-sm placeholder:text-muted-foreground/60 focus:outline-hidden" />
        <button type="button" onClick={() => ctx.setShowArchived(!ctx.showArchived)}
          className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer shrink-0 ${ctx.showArchived ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
          {ctx.showArchived ? "Activos" : "Archivo"}
        </button>
      </div>

      {/* Table */}
      <div className="w-full overflow-x-auto pb-6">
        {ctx.isLoading ? (
          <DriversListSkeleton count={4} />
        ) : (
          <>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/40">
                  <th className="text-left py-2.5 px-2 whitespace-nowrap">Foto</th>
                  <th className="text-left py-2.5 px-2 whitespace-nowrap">Nombre</th>
                  <th className="text-left py-2.5 px-2 whitespace-nowrap">CURP</th>
                  <th className="text-left py-2.5 px-2 whitespace-nowrap">Licencia</th>
                  <th className="text-left py-2.5 px-2 whitespace-nowrap">Vence</th>
                  <th className="text-left py-2.5 px-2 whitespace-nowrap">Auto</th>
                  <th className="text-right py-2.5 px-2 whitespace-nowrap">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ctx.filteredDrivers.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10 text-muted-foreground italic">No se encontraron conductores.</td></tr>
                ) : (
                  ctx.filteredDrivers.map((driver) => {
                    const assignedVehicle = ctx.vehicles.find((v) => v.active_driver_id === driver.id);
                    return (
                      <React.Fragment key={driver.id}>
                        <tr role="button" tabIndex={0} onClick={() => ctx.toggleDriverDetails(driver.id)}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ctx.toggleDriverDetails(driver.id); } }}
                          className={`border-b border-border/20 hover:bg-muted/30 transition-colors cursor-pointer ${ctx.filteredDrivers.indexOf(driver) % 2 === 0 ? "bg-card" : "bg-muted/5"}`}>
                          <td className="py-2.5 px-2">
                            <div className="relative w-8 h-8 rounded-full overflow-hidden bg-[#D8D8D8] flex items-center justify-center shrink-0 cursor-pointer"
                              onClick={(e) => { e.stopPropagation(); if (driver.driver_photo_img) ctx.setPreviewImage(driver.driver_photo_img); }}>
                              {driver.driver_photo_img ? <Image src={driver.driver_photo_img} alt="Foto" fill className="object-cover" /> : <User className="w-4 h-4 text-muted-foreground/60" />}
                            </div>
                          </td>
                          <td className="py-2.5 px-2"><span className="font-bold text-foreground">{`${driver.first_name} ${driver.paternal_last_name}`}</span></td>
                          <td className="py-2.5 px-2 font-mono text-muted-foreground">{driver.curp}</td>
                          <td className="py-2.5 px-2 font-mono text-muted-foreground">{driver.license_number || "—"}</td>
                          <td className="py-2.5 px-2">
                            {driver.license_is_permanent ? (
                              <span className="px-1.5 py-0.5 text-[11px] font-bold bg-primary/10 text-primary border border-primary/20 rounded-md">Permanente</span>
                            ) : (
                              <span className={`text-muted-foreground ${driver.license_expiration_date && new Date(driver.license_expiration_date) < new Date() ? "text-red-400 font-bold" : ""}`}>
                                {driver.license_expiration_date || "—"}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-2">
                            {assignedVehicle ? (
                              <span className="flex items-center gap-1 text-muted-foreground"><Car className="w-3.5 h-3.5 shrink-0" />{assignedVehicle.plate_number}</span>
                            ) : (
                              <span className="text-amber-500 font-semibold">Sin auto</span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-right">
                            <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.stopPropagation(); }} role="button" tabIndex={-1}>
                              {!assignedVehicle && ctx.onAssignDriver && (
                                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); ctx.onAssignDriver!(driver.id); }}
                                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs gap-1 h-9 px-2.5" title="Asignar auto">
                                  <ArrowLeftRight className="w-3 h-3" /><span className="sr-only">Asignar auto</span>
                                </Button>
                              )}
                              {!driver.license_is_permanent && (
                                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); ctx.handleRenewLicense(driver); }}
                                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs gap-1 h-9 px-2.5" title="Renovar licencia">
                                  <RefreshCcw className="w-3 h-3" /><span className="sr-only">Renovar licencia</span>
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); ctx.exportDriverPdf(driver); }}
                                className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 text-xs gap-1 h-9 px-2.5" title="Exportar datos del chofer">
                                <Download className="w-3 h-3" /><span className="sr-only">Exportar</span>
                              </Button>
                              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); ctx.handleEditDriver(driver); }}
                                className="text-muted-foreground hover:text-primary text-xs gap-1 h-9 px-2.5">
                                <Pencil className="w-3 h-3" /><span className="sr-only">Editar</span>
                              </Button>
                              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); ctx.handleDeleteDriver(driver.id); }}
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs gap-1 h-9 px-2.5">
                                <Trash2 className="w-3 h-3" /><span className="sr-only">Eliminar</span>
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {ctx.expandedDriverDetails[driver.id] && (
                          <motion.tr initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="border-b border-border/20 bg-muted/10 overflow-hidden">
                            <td colSpan={7} className="p-3">
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-xs">
                                <div><span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Clave Elector</span><span className="block text-foreground font-medium">{driver.ine_elector_key || "N/D"}</span></div>
                                <div><span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Domicilio INE</span><span className="block text-foreground leading-snug">{driver.ine_address || "N/D"}</span></div>
                                <div><span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Licencia Vence</span><span className="block text-foreground">{driver.license_expiration_date || (driver.license_is_permanent ? "Permanente" : "—")}</span></div>
                                {driver.driver_photo_img && (
                                  <div><span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Foto Chofer</span>
                                    <div className="relative h-12 w-20 rounded-lg overflow-hidden border border-border/70 mt-0.5 cursor-pointer" onClick={(e) => { e.stopPropagation(); ctx.setPreviewImage(driver.driver_photo_img!); }}>
                                      <Image src={driver.driver_photo_img} alt="Foto Chofer" fill className="object-cover hover:scale-105 transition-transform" />
                                    </div>
                                  </div>
                                )}
                                {driver.ine_img && (
                                  <div><span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">INE</span>
                                    <div className="relative h-12 w-20 rounded-lg overflow-hidden border border-border/70 mt-0.5 cursor-pointer" onClick={(e) => { e.stopPropagation(); ctx.setPreviewImage(driver.ine_img!); }}>
                                      <Image src={driver.ine_img} alt="INE" fill className="object-cover hover:scale-105 transition-transform" />
                                    </div>
                                  </div>
                                )}
                                {driver.license_img && (
                                  <div><span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Licencia</span>
                                    <div className="relative h-12 w-20 rounded-lg overflow-hidden border border-border/70 mt-0.5 cursor-pointer" onClick={(e) => { e.stopPropagation(); ctx.setPreviewImage(driver.license_img!); }}>
                                      <Image src={driver.license_img} alt="Licencia" fill className="object-cover hover:scale-105 transition-transform" />
                                    </div>
                                  </div>
                                )}
                                {driver.address_proof_img && (
                                  <div><span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Comprobante Domicilio</span>
                                    <div className="relative h-12 w-20 rounded-lg overflow-hidden border border-border/70 mt-0.5 cursor-pointer" onClick={(e) => { e.stopPropagation(); ctx.setPreviewImage(driver.address_proof_img!); }}>
                                      <Image src={driver.address_proof_img} alt="Comprobante" fill className="object-cover hover:scale-105 transition-transform" />
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Payment History */}
                              {(() => {
                                const driverRentals = ctx.weeklyRentals
                                  .filter((r) => r.driver_id === driver.id)
                                  .sort((a, b) => b.week_start.localeCompare(a.week_start));
                                if (driverRentals.length === 0) return null;
                                const totalDebt = driverRentals.reduce((sum, r) => sum + Math.max(0, r.rent_amount - r.paid_amount - (r.condoned_amount || 0)), 0);
                                const totalPaid = driverRentals.reduce((sum, r) => sum + r.paid_amount, 0);
                                const totalCondoned = driverRentals.reduce((sum, r) => sum + (r.condoned_amount || 0), 0);
                                return (
                                  <div className="mt-4">
                                    <div className="flex items-center gap-2 mb-3"><DollarSign className="w-3.5 h-3.5 text-muted-foreground" /><span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Historial de Pagos</span></div>
                                    <div className="grid grid-cols-3 gap-2 mb-3">
                                      <div className="bg-muted/20 rounded-xl border border-border/60 p-3"><span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 block">Deuda Total</span><span className="text-sm font-bold text-red-400">${totalDebt.toLocaleString()}</span></div>
                                      <div className="bg-muted/20 rounded-xl border border-border/60 p-3"><span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 block">Total Pagado</span><span className="text-sm font-bold text-green-400">${totalPaid.toLocaleString()}</span></div>
                                      <div className="bg-muted/20 rounded-xl border border-border/60 p-3"><span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 block">Total Condonado</span><span className="text-sm font-bold text-amber-400">${totalCondoned.toLocaleString()}</span></div>
                                    </div>
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-[10px]">
                                        <thead><tr className="border-b border-border/20 text-muted-foreground/60">
                                          <th className="text-left py-1.5 pr-2 font-medium">Semana</th>
                                          <th className="text-right pr-2 font-medium">Renta</th>
                                          <th className="text-right pr-2 font-medium">Cond.</th>
                                          <th className="text-right pr-2 font-medium">Pagado</th>
                                          <th className="text-right pr-2 font-medium">Deuda</th>
                                          <th className="text-center px-2 font-medium">Status</th>
                                          <th className="text-right font-medium"></th>
                                        </tr></thead>
                                        <tbody>
                                          {driverRentals.map((r) => {
                                            const debt = Math.max(0, r.rent_amount - r.paid_amount - (r.condoned_amount || 0));
                                            return (
                                              <tr key={r.id} className="border-b border-border/10 hover:bg-muted/10">
                                                <td className="py-1.5 pr-2 text-foreground whitespace-nowrap"><span className="flex items-center gap-1"><Calendar className="w-2.5 h-2.5 text-muted-foreground" />{new Date(r.week_start + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" })}</span></td>
                                                <td className="py-1.5 pr-2 text-right text-foreground">${r.rent_amount.toLocaleString()}</td>
                                                <td className="py-1.5 pr-2 text-right">{(r.condoned_days || 0) > 0 ? <span className="text-amber-400 font-medium">{r.condoned_days}d · ${(r.condoned_amount || 0).toLocaleString()}</span> : <span className="text-muted-foreground/40">—</span>}</td>
                                                <td className="py-1.5 pr-2 text-right text-foreground">${r.paid_amount.toLocaleString()}</td>
                                                <td className="py-1.5 pr-2 text-right">{debt > 0 ? <span className="text-red-400 font-medium">${debt.toLocaleString()}</span> : <span className="text-green-400">$0</span>}</td>
                                                <td className="py-1.5 px-2 text-center">
                                                  {r.status === "PAID" ? <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 font-medium"><CheckCircle2 className="w-2.5 h-2.5" />PAID</span>
                                                  : r.status === "PARTIAL" ? <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium"><AlertTriangle className="w-2.5 h-2.5" />PARTIAL</span>
                                                  : <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 font-medium"><XCircle className="w-2.5 h-2.5" />UNPAID</span>}
                                                </td>
                                                <td className="py-1.5 text-right">
                                                  <div className="flex items-center justify-end gap-1">
                                                    <button onClick={(e) => { e.stopPropagation(); ctx.setPaymentDialog({ rentalId: r.id, weekStart: r.week_start, amount: 0 }); }}
                                                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors text-[10px] font-medium">
                                                      <DollarSign className="w-2.5 h-2.5" />Pagar
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); ctx.setCondonationDialog({ rentalId: r.id, weekStart: r.week_start, days: 0 }); }}
                                                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors text-[10px] font-medium">
                                                      <Plus className="w-2.5 h-2.5" />Cond.
                                                    </button>
                                                  </div>
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>

                                    {/* Condonation Dialog */}
                                    {ctx.condonationDialog && (
                                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => ctx.setCondonationDialog(null)}>
                                        <div className="bg-background border border-border rounded-xl p-4 w-64 shadow-xl" onClick={(e) => e.stopPropagation()}>
                                          <div className="flex items-center gap-2 mb-3"><Minus className="w-4 h-4 text-amber-400" /><span className="text-xs font-semibold text-foreground">Condonar Días</span></div>
                                          <p className="text-[10px] text-muted-foreground mb-3">Semana del {new Date(ctx.condonationDialog.weekStart + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}</p>
                                          <div className="flex items-center gap-2 mb-3">
                                            <button onClick={() => ctx.setCondonationDialog((prev: any) => prev ? { ...prev, days: Math.max(0, prev.days - 1) } : prev)} className="w-7 h-7 rounded-md bg-muted/30 border border-border flex items-center justify-center text-foreground hover:bg-muted/50">−</button>
                                            <input type="number" min={0} max={7} value={ctx.condonationDialog.days} onChange={(e) => ctx.setCondonationDialog((prev: any) => prev ? { ...prev, days: Math.max(0, Math.min(7, parseInt(e.target.value) || 0)) } : prev)} className="w-14 text-center text-xs bg-muted/20 border border-border rounded-md py-1 text-foreground" />
                                            <button onClick={() => ctx.setCondonationDialog((prev: any) => prev ? { ...prev, days: Math.min(7, prev.days + 1) } : prev)} className="w-7 h-7 rounded-md bg-muted/30 border border-border flex items-center justify-center text-foreground hover:bg-muted/50">+</button>
                                            <span className="text-[10px] text-muted-foreground">días</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <button onClick={() => ctx.setCondonationDialog(null)} className="flex-1 text-[10px] py-1.5 rounded-md border border-border text-muted-foreground hover:bg-muted/20">Cancelar</button>
                                            <button onClick={() => { const rental = driverRentals.find((r) => r.id === ctx.condonationDialog!.rentalId); if (rental && ctx.condonationDialog!.days > 0) ctx.handleCondonation(rental, ctx.condonationDialog!.days); }}
                                              disabled={ctx.condonationDialog.days <= 0} className="flex-1 text-[10px] py-1.5 rounded-md bg-amber-500 text-white font-medium hover:bg-amber-600 disabled:opacity-50">Aplicar</button>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {/* Payment Dialog */}
                                    {ctx.paymentDialog && (
                                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => ctx.setPaymentDialog(null)}>
                                        <div className="bg-background border border-border rounded-xl p-4 w-64 shadow-xl" onClick={(e) => e.stopPropagation()}>
                                          <div className="flex items-center gap-2 mb-3"><DollarSign className="w-4 h-4 text-green-400" /><span className="text-xs font-semibold text-foreground">Registrar Pago</span></div>
                                          <p className="text-[10px] text-muted-foreground mb-3">Semana del {new Date(ctx.paymentDialog.weekStart + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}</p>
                                          <div className="flex items-center gap-2 mb-3">
                                            <span className="text-xs text-muted-foreground">$</span>
                                            <input type="number" min={0} value={ctx.paymentDialog.amount || ""} onChange={(e) => ctx.setPaymentDialog((prev: any) => prev ? { ...prev, amount: Math.max(0, parseInt(e.target.value) || 0) } : prev)}
                                              className="flex-1 text-xs bg-muted/20 border border-border rounded-md py-1.5 px-2 text-foreground text-center" placeholder="0" />
                                          </div>
                                          <div className="flex gap-2">
                                            <button onClick={() => ctx.setPaymentDialog(null)} className="flex-1 text-[10px] py-1.5 rounded-md border border-border text-muted-foreground hover:bg-muted/20">Cancelar</button>
                                            <button onClick={() => { const rental = driverRentals.find((r) => r.id === ctx.paymentDialog!.rentalId); if (rental && ctx.paymentDialog!.amount > 0) ctx.handlePayment(rental, ctx.paymentDialog!.amount); }}
                                              disabled={ctx.paymentDialog.amount <= 0} className="flex-1 text-[10px] py-1.5 rounded-md bg-green-500 text-white font-medium hover:bg-green-600 disabled:opacity-50">Pagar</button>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>
                          </motion.tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* License Renewal Scanner */}
      <Dialog open={ctx.isScanning && !!ctx.renewingDriver} onOpenChange={(o) => { if (!o) { ctx.stopCamera(); ctx.setRenewingDriver(null); } }}>
        <DialogContent className="max-w-sm md:max-w-md border border-border bg-background text-foreground rounded-2xl p-0 overflow-hidden">
          <ScannerViewfinder scanner={ctx.scanner} labels={{ scan: "Escaneando licencia...", extract: "Extrayendo datos...", logsHeader: "LOGS OCR RENOVACIÓN" }} />
        </DialogContent>
      </Dialog>

      {/* License Renewal Dialog */}
      <Dialog open={ctx.isRenewOpen} onOpenChange={(o) => { ctx.setIsRenewOpen(o); if (!o) ctx.setRenewingDriver(null); }}>
        <DialogContent className="max-w-sm md:max-w-md border border-border bg-background text-foreground rounded-2xl">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 shrink-0"><RefreshCcw className="w-5 h-5 text-primary" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-foreground font-black text-lg">Renovar Licencia</DialogTitle>
                  <span className="text-[11px] font-black uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-md">Actualización</span>
                </div>
                <DialogDescription className="text-muted-foreground text-xs">
                  {ctx.renewingDriver ? `${ctx.renewingDriver.first_name} ${ctx.renewingDriver.paternal_last_name} ${ctx.renewingDriver.maternal_last_name}` : "Cargando..."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div><Label className="text-muted-foreground text-xs">Número de Licencia</Label><Input value={ctx.renewNumber} onChange={(e) => ctx.setRenewNumber(e.target.value)} placeholder="ej. 12345678" className="mt-1.5 border-input bg-background rounded-xl" /></div>
            <div className="space-y-3">
              <div><Label className="text-muted-foreground text-xs">Fecha Expedición</Label><Input type="date" value={ctx.renewIssueDate} onChange={(e) => ctx.setRenewIssueDate(e.target.value)} className="mt-1.5 border-input bg-background rounded-xl w-full min-w-0" /></div>
              <div><Label className="text-muted-foreground text-xs">Fecha Vigencia</Label><Input type="date" value={ctx.renewExpirationDate} onChange={(e) => ctx.setRenewExpirationDate(e.target.value)} disabled={ctx.renewIsPermanent} className="mt-1.5 border-input bg-background rounded-xl w-full min-w-0 disabled:opacity-50" /></div>
            </div>
            <label className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/40 cursor-pointer">
              <span className="text-xs font-semibold text-foreground">Licencia Permanente</span>
              <Switch checked={ctx.renewIsPermanent} onCheckedChange={ctx.setRenewIsPermanent} />
            </label>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => { ctx.setIsRenewOpen(false); ctx.setRenewingDriver(null); }} className="flex-1 rounded-xl border-border">Cancelar</Button>
              <Button onClick={ctx.submitLicenseRenewal} disabled={!ctx.renewNumber} className="flex-1 rounded-xl bg-primary text-white font-bold hover:bg-primary disabled:opacity-50">Guardar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Document Preview Modal */}
      <Dialog open={!!ctx.previewImage} onOpenChange={(o) => { if (!o) ctx.setPreviewImage(null); }}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-auto h-auto border border-border bg-black/95 text-foreground rounded-2xl p-2">
          <div className="relative w-full h-full flex items-center justify-center">
            {ctx.previewImage && (
              <Image src={ctx.previewImage} alt="Documento" width={1200} height={1600} className="object-contain max-w-full max-h-[85vh] rounded-lg" style={{ width: 'auto', height: 'auto' }} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
