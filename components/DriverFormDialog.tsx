"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Stepper } from "@/components/ui/stepper";
import ScannerViewfinder from "@/components/ScannerViewfinder";
import { SearchableSelect } from "@/components/ui/searchable-select";
import Image from "next/image";
import { User, Camera, FolderOpen, Sparkles, Trash2, ChevronDown, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { MEXICAN_STATES } from "@/lib/ocr";
import { cn } from "@/lib/utils";
import type { useDrivers } from "@/features/drivers/hooks/useDrivers";

type DriversFormProps = ReturnType<typeof useDrivers>;

export default function DriverFormDialog(props: DriversFormProps) {
  const {
    isOpen,
    setIsOpen,
    resetForm,
    editingDriverId,
    activeSection,
    scrollToSection,
    isScanning,
    isSaving,
    scanner,
    handleSave,
    driverPhotoImg,
    setPreviewImage,
    setDriverPhotoImg,
    startCamera,
    photoFileRef,
    ineImg,
    setIneImg,
    ineFileRef,
    handleFileChange,
    licenseImg,
    setLicenseImg,
    licFileRef,
    addressProofImg,
    setAddressProofImg,
    addressProofCameraRef,
    addressProofFileRef,
    handleAddressProofFile,
    setShowManualFields,
    showManualFields,
    manualFieldsCount,
    MANUAL_FIELDS_TOTAL,
    firstName,
    setFirstName,
    paternalLastName,
    setPaternalLastName,
    maternalLastName,
    setMaternalLastName,
    suggestedCurp,
    applySuggestedCurp,
    licenseNumber,
    setLicenseNumber,
    licenseCurp,
    setLicenseCurp,
    licenseIsPermanent,
    setLicenseIsPermanent,
    licenseExpirationDate,
    setLicenseExpirationDate,
    ineCurp,
    setIneCurp,
    ineDob,
    setIneDob,
    ineElectorKey,
    setIneElectorKey,
    ineSex,
    setIneSex,
    birthState,
    setBirthState,
    ineAddress,
    setIneAddress,
  } = props;

  return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            setIsOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="rounded-full bg-[#0088FF] hover:bg-[#0077EE] text-white text-sm font-bold px-6 h-11 border-none active:scale-95 transition-all cursor-pointer flex items-center justify-center shadow-xs">
                Registrar conductor
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md md:max-w-2xl max-h-[90vh] overflow-y-auto border border-border bg-background text-foreground rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-foreground font-black text-lg">
                  {editingDriverId ? "Editar Conductor" : "Registro de Conductor"}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-xs">
                  {editingDriverId
                    ? "Modifica los datos del conductor. Los cambios se aplican al instante."
                    : "Crea el expediente escaneando documentos o llenando los campos."}
                </DialogDescription>
              </DialogHeader>

              <div className="pt-2 pb-1">
                <Stepper
                  steps={[
                    { id: "datos", label: "Datos" },
                    { id: "docs", label: "Documentos" },
                    { id: "review", label: "Revisión" },
                  ]}
                  currentStep={activeSection}
                  onStepClick={scrollToSection}
                />
              </div>

              <AnimatePresence mode="wait">
                {isScanning ? (
                  <ScannerViewfinder
                    scanner={scanner}
                    labels={{
                      scan: "Escaneando píxeles...",
                      extract: "Analizando caracteres...",
                      logsHeader: "LOGS DETALLADOS DEL FLUJO OCR",
                    }}
                  />
                ) : (
                  <form onSubmit={handleSave} className="space-y-4 pt-2 flex flex-col max-h-[78vh]">
                    <div className="flex-1 overflow-y-auto pr-1.5 space-y-4 max-h-[62vh]">
                      {/* PASO 1: Datos Básicos */}
                      <div id="section-datos" className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3 scroll-mt-2">
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground font-black">Datos del Conductor</h4>
                        <div className="space-y-3">
                          <div className="min-w-0">
                            <Label htmlFor="firstName" className="text-muted-foreground text-xs">Nombre(s) *</Label>
                            <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="ej. Juan Carlos" className="border-input bg-background rounded-xl w-full min-w-0" />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="min-w-0">
                              <Label htmlFor="patName" className="text-muted-foreground text-xs">Apellido Paterno *</Label>
                              <Input id="patName" value={paternalLastName} onChange={(e) => setPaternalLastName(e.target.value)} placeholder="ej. Pérez" className="border-input bg-background rounded-xl w-full min-w-0" />
                            </div>
                            <div className="min-w-0">
                              <Label htmlFor="matName" className="text-muted-foreground text-xs">Apellido Materno</Label>
                              <Input id="matName" value={maternalLastName} onChange={(e) => setMaternalLastName(e.target.value)} placeholder="ej. López" className="border-input bg-background rounded-xl w-full min-w-0" />
                            </div>
                          </div>
                          <div className="min-w-0">
                            <Label htmlFor="mainCurp" className="text-muted-foreground text-xs font-bold">CURP *</Label>
                            <Input
                              id="mainCurp"
                              value={licenseCurp || ineCurp}
                              onChange={(e) => {
                                const val = e.target.value.toUpperCase().trim();
                                setLicenseCurp(val);
                                setIneCurp(val);
                              }}
                              placeholder="18 caracteres (ej. ABCD123456HDFRRN01)"
                              maxLength={18}
                              className="border-input bg-background rounded-xl w-full min-w-0 uppercase font-mono"
                            />
                          </div>
                          {suggestedCurp && (
                            <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl space-y-2">
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-primary font-bold flex items-center gap-1 font-black"><Sparkles className="w-4 h-4" /> Sugerencia de CURP:</span>
                                <button type="button" onClick={applySuggestedCurp} className="text-xs font-black uppercase text-primary hover:text-primary/80 underline cursor-pointer">Aplicar</button>
                              </div>
                              <div className="font-mono text-sm text-foreground font-bold tracking-wider text-center">{suggestedCurp}</div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* PASO 2: Documentos */}
                      <div id="section-docs" className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3.5 scroll-mt-2">
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground font-black">Documentos</h4>
                        <div className="space-y-4">
                          {/* Foto de Perfil */}
                          <div className="flex flex-col items-center text-center">
                            <div
                              className="relative w-20 h-20 rounded-full border-2 border-primary/20 bg-muted overflow-hidden flex items-center justify-center shadow-inner group cursor-pointer"
                              onClick={() => { if (driverPhotoImg) setPreviewImage(driverPhotoImg); }}
                            >
                              {driverPhotoImg ? (
                                <Image src={driverPhotoImg} alt="Foto Chofer" fill className="object-cover" />
                              ) : (
                                <User className="w-10 h-10 text-muted-foreground/60" />
                              )}
                              {driverPhotoImg && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setDriverPhotoImg(""); }}
                                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-2xs font-bold transition-opacity duration-200 cursor-pointer"
                                >
                                  Eliminar
                                </button>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2 w-full mt-2">
                              <Button type="button" variant="outline" onClick={() => startCamera("CHOFER")}
                                className="border-border bg-card hover:bg-accent text-foreground text-xs rounded-xl flex items-center justify-center gap-1.5 h-10 cursor-pointer">
                                <Camera className="w-4 h-4 text-primary" /> Foto
                              </Button>
                              <Button type="button" variant="outline" onClick={() => photoFileRef.current?.click()}
                                className="border-border bg-card hover:bg-accent text-foreground text-xs rounded-xl flex items-center justify-center gap-1.5 h-10 cursor-pointer">
                                <FolderOpen className="w-4 h-4 text-primary" /> Subir
                              </Button>
                              <input type="file" accept="image/*" ref={photoFileRef} className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onload = (event) => { if (event.target?.result) setDriverPhotoImg(event.target.result as string); };
                                    reader.readAsDataURL(file);
                                  }
                                }} />
                            </div>
                          </div>

                          {/* INE */}
                          <div>
                            <h5 className="text-[11px] font-bold text-foreground mb-2">INE (Identificación) *</h5>
                            {ineImg && (
                              <div className="relative w-full h-14 rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center mb-2">
                                <Image src={ineImg} alt="INE" fill className="object-contain p-1" />
                                <button type="button" onClick={() => setIneImg("")}
                                  className="absolute top-1.5 right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md transition-all active:scale-90" title="Eliminar INE">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-2">
                              <Button type="button" variant="outline" onClick={() => startCamera("INE")}
                                className="border-border bg-card hover:bg-accent text-foreground text-xs rounded-xl flex items-center justify-center gap-1.5 h-11 cursor-pointer">
                                <Camera className="w-4 h-4 text-primary" /> Tomar Foto
                              </Button>
                              <Button type="button" variant="outline" onClick={() => ineFileRef.current?.click()}
                                className="border-border bg-card hover:bg-accent text-foreground text-xs rounded-xl flex items-center justify-center gap-1.5 h-11 cursor-pointer">
                                <FolderOpen className="w-4 h-4 text-primary" /> Subir Archivo
                              </Button>
                              <input type="file" accept="image/*" className="hidden" ref={ineFileRef} onChange={(e) => handleFileChange(e, "INE")} />
                            </div>
                          </div>

                          {/* Licencia */}
                          <div>
                            <h5 className="text-[11px] font-bold text-foreground mb-2">Licencia de Conducir *</h5>
                            {licenseImg && (
                              <div className="relative w-full h-14 rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center mb-2">
                                <Image src={licenseImg} alt="Licencia" fill className="object-contain p-1" />
                                <button type="button" onClick={() => setLicenseImg("")}
                                  className="absolute top-1.5 right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md transition-all active:scale-90" title="Eliminar Licencia">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-2">
                              <Button type="button" variant="outline" onClick={() => startCamera("LICENCIA")}
                                className="border-border bg-card hover:bg-accent text-foreground text-xs rounded-xl flex items-center justify-center gap-1.5 h-11 cursor-pointer">
                                <Camera className="w-4 h-4 text-primary" /> Tomar Foto
                              </Button>
                              <Button type="button" variant="outline" onClick={() => licFileRef.current?.click()}
                                className="border-border bg-card hover:bg-accent text-foreground text-xs rounded-xl flex items-center justify-center gap-1.5 h-11 cursor-pointer">
                                <FolderOpen className="w-4 h-4 text-primary" /> Subir Archivo
                              </Button>
                              <input type="file" accept="image/*" className="hidden" ref={licFileRef} onChange={(e) => handleFileChange(e, "LICENCIA")} />
                            </div>
                          </div>

                          {/* Comprobante de Domicilio */}
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <h5 className="text-[11px] font-bold text-foreground">Comprobante de Domicilio (opcional)</h5>
                              {addressProofImg && (
                                <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-md font-bold">Cargado</span>
                              )}
                            </div>
                            {addressProofImg && (
                              <div className="relative w-full h-14 rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center mb-2">
                                <Image src={addressProofImg} alt="Comprobante de Domicilio" fill className="object-contain p-1" />
                                <button type="button" onClick={() => setAddressProofImg("")}
                                  className="absolute top-1.5 right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md transition-all active:scale-90" title="Eliminar comprobante">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-2">
                              <Button type="button" variant="outline" onClick={() => addressProofCameraRef.current?.click()}
                                className="border-border bg-card hover:bg-accent text-foreground text-xs rounded-xl flex items-center justify-center gap-1.5 h-11 cursor-pointer">
                                <Camera className="w-4 h-4 text-primary" /> Tomar Foto
                              </Button>
                              <Button type="button" variant="outline" onClick={() => addressProofFileRef.current?.click()}
                                className="border-border bg-card hover:bg-accent text-foreground text-xs rounded-xl flex items-center justify-center gap-1.5 h-11 cursor-pointer">
                                <FolderOpen className="w-4 h-4 text-primary" /> Subir Archivo
                              </Button>
                              <input type="file" accept="image/*" capture="environment" className="hidden" ref={addressProofCameraRef} onChange={(e) => handleAddressProofFile(e)} />
                              <input type="file" accept="image/*" className="hidden" ref={addressProofFileRef} onChange={(e) => handleAddressProofFile(e)} />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* PASO 3: Revisión */}
                      <div id="section-review" className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3 scroll-mt-2">
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground font-black">Revisión</h4>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Nombre:</span>
                            <span className="font-semibold text-foreground">{firstName} {paternalLastName} {maternalLastName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">CURP:</span>
                            <span className="font-semibold text-foreground font-mono">{licenseCurp || ineCurp || "—"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Foto:</span>
                            <span className={`font-semibold ${driverPhotoImg ? "text-emerald-500" : "text-muted-foreground"}`}>{driverPhotoImg ? "✓ Cargada" : "No cargada"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">INE:</span>
                            <span className={`font-semibold ${ineImg ? "text-emerald-500" : "text-muted-foreground"}`}>{ineImg ? "✓ Cargado" : "No cargado"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Licencia:</span>
                            <span className={`font-semibold ${licenseImg ? "text-emerald-500" : "text-muted-foreground"}`}>{licenseImg ? "✓ Cargada" : "No cargada"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Domicilio:</span>
                            <span className={`font-semibold ${addressProofImg ? "text-emerald-500" : "text-muted-foreground"}`}>{addressProofImg ? "✓ Cargado" : "No cargado"}</span>
                          </div>
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
                          <Loader2 className="w-4 h-4 animate-spin" /> Guardando Conductor...
                        </span>
                      ) : (
                        "Guardar Conductor"
                      )}
                    </Button>
                  </form>
                )}
              </AnimatePresence>
            </DialogContent>
          </Dialog>
  );
}
