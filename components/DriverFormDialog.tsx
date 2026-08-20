"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import ScannerViewfinder from "@/components/ScannerViewfinder";
import { SearchableSelect } from "@/components/ui/searchable-select";
import Image from "next/image";
import { User, Camera, FolderOpen, Sparkles, Trash2, ChevronDown, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
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
    // scanTarget is accessed via scanner.scanTarget
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

              <form onSubmit={handleSave} className="space-y-4 pt-2 flex flex-col max-h-[78vh]">
                    <div className="flex-1 overflow-y-auto pr-1.5 space-y-4 max-h-[62vh]">
                      {/* PASO 1: Datos — nombre + foto, CURP se llena desde INE */}
                      <div id="section-datos" className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3 scroll-mt-2">
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground font-black">Datos del Conductor</h4>
                        <div className="space-y-3">
                          {/* Foto de perfil — compacta en paso 1 */}
                          <div className="flex items-center gap-3">
                            <div
                              className="relative w-16 h-16 rounded-full border-2 border-primary/20 bg-muted overflow-hidden flex items-center justify-center shadow-inner shrink-0 cursor-pointer"
                              onClick={() => { if (driverPhotoImg) setPreviewImage(driverPhotoImg); }}
                            >
                              {driverPhotoImg ? (
                                <Image src={driverPhotoImg} alt="Foto Chofer" fill className="object-cover" />
                              ) : (
                                <User className="w-8 h-8 text-muted-foreground/60" />
                              )}
                              {driverPhotoImg && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setDriverPhotoImg(""); }}
                                  className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition-opacity duration-200 cursor-pointer"
                                >
                                  Eliminar
                                </button>
                              )}
                            </div>
                            <div className="flex-1 space-y-1.5">
                              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Foto de perfil (opcional)</span>
                              <div className="grid grid-cols-2 gap-1.5">
                                <Button type="button" variant="outline" onClick={() => startCamera("CHOFER")}
                                  className="border-border bg-card hover:bg-accent text-foreground text-[10px] rounded-lg flex items-center justify-center gap-1 h-8 cursor-pointer">
                                  <Camera className="w-3 h-3 text-primary" /> Foto
                                </Button>
                                <Button type="button" variant="outline" onClick={() => photoFileRef.current?.click()}
                                  className="border-border bg-card hover:bg-accent text-foreground text-[10px] rounded-lg flex items-center justify-center gap-1 h-8 cursor-pointer">
                                  <FolderOpen className="w-3 h-3 text-primary" /> Subir
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
                          </div>

                          <div className="min-w-0">
                            <Label htmlFor="firstName" className="text-muted-foreground text-xs font-bold">Nombre(s) *</Label>
                            <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="ej. Juan Carlos" className="border-input bg-background rounded-xl w-full min-w-0" />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="min-w-0">
                              <Label htmlFor="patName" className="text-muted-foreground text-xs font-bold">Apellido Paterno *</Label>
                              <Input id="patName" value={paternalLastName} onChange={(e) => setPaternalLastName(e.target.value)} placeholder="ej. Pérez" className="border-input bg-background rounded-xl w-full min-w-0" />
                            </div>
                            <div className="min-w-0">
                              <Label htmlFor="matName" className="text-muted-foreground text-xs">Apellido Materno</Label>
                              <Input id="matName" value={maternalLastName} onChange={(e) => setMaternalLastName(e.target.value)} placeholder="ej. López" className="border-input bg-background rounded-xl w-full min-w-0" />
                            </div>
                          </div>
                          {/* CURP — se llena automáticamente desde el INE, editable */}
                          {(licenseCurp || ineCurp) ? (
                            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-1">
                              <div className="flex items-center gap-1.5 text-xs">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                <span className="text-emerald-600 font-bold">CURP detectada desde INE</span>
                              </div>
                              <div className="font-mono text-sm text-foreground font-bold tracking-wider">{licenseCurp || ineCurp}</div>
                            </div>
                          ) : (
                            <div className="min-w-0">
                              <Label htmlFor="mainCurp" className="text-muted-foreground text-xs">CURP (se detecta al escanear INE)</Label>
                              <Input
                                id="mainCurp"
                                value={licenseCurp || ineCurp}
                                onChange={(e) => {
                                  const val = e.target.value.toUpperCase().trim();
                                  setLicenseCurp(val);
                                  setIneCurp(val);
                                }}
                                placeholder="Se llena automáticamente con el INE"
                                maxLength={18}
                                className="border-input bg-background rounded-xl w-full min-w-0 uppercase font-mono"
                              />
                            </div>
                          )}
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

                      {/* PASO 2: Documentos — INE llena CURP, Licencia llena No. y vigencia */}
                      <div id="section-docs" className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3.5 scroll-mt-2">
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground font-black">Documentos</h4>
                        <p className="text-[11px] text-muted-foreground -mt-1">El INE detecta CURP y clave electoral. La licencia llena número y vigencia.</p>

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
                                  <p className="text-[10px] text-muted-foreground mt-0.5">{scanner.scanTarget === "INE" ? "INE (Identificación)" : scanner.scanTarget === "LICENCIA" ? "Licencia de Conducir" : scanner.scanTarget === "CHOFER" ? "Foto de Perfil" : scanner.scanTarget === "DOMICILIO" ? "Comprobante de Domicilio" : scanner.scanTarget}</p>
                                </div>
                                <button type="button" onClick={scanner.cancelScan} className="shrink-0 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer">Cancelar</button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Canvas oculto para captura */}
                        <canvas ref={scanner.canvasRef} className="hidden" />

                        <div className="space-y-3">
                          {/* INE */}
                          <div className="bg-card rounded-xl border border-border/60 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <h5 className="text-[11px] font-bold text-foreground flex items-center gap-1.5">🪪 INE (Identificación) *</h5>
                              {ineImg && <span className="text-[10px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-1.5 py-0.5 rounded-md font-bold">Cargado</span>}
                            </div>
                            {ineImg && (
                              <div className="relative w-full h-16 rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center">
                                <Image src={ineImg} alt="INE" fill className="object-contain p-1" />
                                <button type="button" onClick={() => setIneImg("")}
                                  className="absolute top-1.5 right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md transition-all active:scale-90" title="Eliminar INE">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-2">
                              <Button type="button" variant="outline" onClick={() => startCamera("INE")} disabled={isScanning && scanner.scanTarget !== "INE"}
                                className={`border-border text-xs rounded-xl flex items-center justify-center gap-1.5 h-11 cursor-pointer ${isScanning && scanner.scanTarget === "INE" ? "bg-primary/10 border-primary/40 text-primary" : "bg-card hover:bg-accent text-foreground"}`}>
                                {isScanning && scanner.scanTarget === "INE" ? (<><Loader2 className="w-4 h-4 animate-spin" /> Escaneando...</>) : (<><Camera className="w-4 h-4 text-primary" /> Tomar Foto</>)}
                              </Button>
                              <Button type="button" variant="outline" onClick={() => ineFileRef.current?.click()} disabled={isScanning}
                                className="border-border bg-card hover:bg-accent text-foreground text-xs rounded-xl flex items-center justify-center gap-1.5 h-11 cursor-pointer">
                                <FolderOpen className="w-4 h-4 text-primary" /> Subir Archivo
                              </Button>
                              <input type="file" accept="image/*" className="hidden" ref={ineFileRef} onChange={(e) => handleFileChange(e, "INE")} />
                            </div>
                            {ineImg && (
                              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] pt-1 border-t border-border/40">
                                {(ineCurp || licenseCurp) && <div><span className="text-muted-foreground/70">CURP: </span><strong className="text-foreground font-mono truncate block">{ineCurp || licenseCurp}</strong></div>}
                                {ineElectorKey && <div><span className="text-muted-foreground/70">Clave Electoral: </span><strong className="text-foreground font-mono truncate block">{ineElectorKey}</strong></div>}
                              </div>
                            )}
                          </div>

                          {/* Licencia */}
                          <div className="bg-card rounded-xl border border-border/60 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <h5 className="text-[11px] font-bold text-foreground flex items-center gap-1.5">🪪 Licencia de Conducir *</h5>
                              {licenseImg && <span className="text-[10px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-1.5 py-0.5 rounded-md font-bold">Cargada</span>}
                            </div>
                            {licenseImg && (
                              <div className="relative w-full h-16 rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center">
                                <Image src={licenseImg} alt="Licencia" fill className="object-contain p-1" />
                                <button type="button" onClick={() => setLicenseImg("")}
                                  className="absolute top-1.5 right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md transition-all active:scale-90" title="Eliminar Licencia">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-2">
                              <Button type="button" variant="outline" onClick={() => startCamera("LICENCIA")} disabled={isScanning && scanner.scanTarget !== "LICENCIA"}
                                className={`border-border text-xs rounded-xl flex items-center justify-center gap-1.5 h-11 cursor-pointer ${isScanning && scanner.scanTarget === "LICENCIA" ? "bg-primary/10 border-primary/40 text-primary" : "bg-card hover:bg-accent text-foreground"}`}>
                                {isScanning && scanner.scanTarget === "LICENCIA" ? (<><Loader2 className="w-4 h-4 animate-spin" /> Escaneando...</>) : (<><Camera className="w-4 h-4 text-primary" /> Tomar Foto</>)}
                              </Button>
                              <Button type="button" variant="outline" onClick={() => licFileRef.current?.click()} disabled={isScanning}
                                className="border-border bg-card hover:bg-accent text-foreground text-xs rounded-xl flex items-center justify-center gap-1.5 h-11 cursor-pointer">
                                <FolderOpen className="w-4 h-4 text-primary" /> Subir Archivo
                              </Button>
                              <input type="file" accept="image/*" className="hidden" ref={licFileRef} onChange={(e) => handleFileChange(e, "LICENCIA")} />
                            </div>
                            {licenseImg && (
                              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] pt-1 border-t border-border/40">
                                {licenseNumber && <div><span className="text-muted-foreground/70">No. Licencia: </span><strong className="text-foreground font-mono">{licenseNumber}</strong></div>}
                                {licenseExpirationDate && <div><span className="text-muted-foreground/70">Vence: </span><strong className="text-foreground">{licenseExpirationDate}</strong></div>}
                                {licenseIsPermanent !== undefined && <div><span className="text-muted-foreground/70">Tipo: </span><strong className="text-foreground">{licenseIsPermanent ? "Permanente" : "Temporal"}</strong></div>}
                              </div>
                            )}
                          </div>

                          {/* Comprobante de Domicilio — 100% opcional */}
                          <div className="bg-card rounded-xl border border-border/60 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <h5 className="text-[11px] font-bold text-foreground flex items-center gap-1.5">📄 Comprobante de Domicilio <span className="text-muted-foreground font-normal">(opcional)</span></h5>
                              {addressProofImg && <span className="text-[10px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-1.5 py-0.5 rounded-md font-bold">Cargado</span>}
                            </div>
                            {addressProofImg && (
                              <div className="relative w-full h-16 rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center">
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

                      {/* PASO 3: Revisión — resumen visual con thumbnails */}
                      <div id="section-review" className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3 scroll-mt-2">
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground font-black">Revisión</h4>
                        {/* Datos del conductor */}
                        <div className="bg-card rounded-xl border border-border/60 p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-muted overflow-hidden flex items-center justify-center shrink-0">
                              {driverPhotoImg ? <Image src={driverPhotoImg} alt="" width={32} height={32} className="object-cover w-full h-full" /> : <User className="w-4 h-4 text-muted-foreground/60" />}
                            </div>
                            <div className="min-w-0">
                              <span className="block text-sm font-bold text-foreground truncate">{firstName} {paternalLastName} {maternalLastName}</span>
                              {(licenseCurp || ineCurp) && <span className="block text-[10px] font-mono text-muted-foreground truncate">{(licenseCurp || ineCurp)}</span>}
                            </div>
                          </div>
                        </div>
                        {/* Documentos — thumbnails */}
                        <div className="space-y-1.5 text-[11px]">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">🪪 INE</span>
                            <span className={`font-semibold ${ineImg ? "text-emerald-500" : "text-muted-foreground"}`}>{ineImg ? "✓ Cargado" : "Sin escanear"}</span>
                          </div>
                          {ineImg && ineCurp && (
                            <div className="flex items-center justify-between pl-3">
                              <span className="text-muted-foreground/70">CURP detectada</span>
                              <span className="font-mono text-foreground font-semibold">{ineCurp}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">🪪 Licencia</span>
                            <span className={`font-semibold ${licenseImg ? "text-emerald-500" : "text-muted-foreground"}`}>{licenseImg ? `✓ ${licenseNumber || "Cargada"}` : "Sin escanear"}</span>
                          </div>
                          {licenseImg && licenseExpirationDate && (
                            <div className="flex items-center justify-between pl-3">
                              <span className="text-muted-foreground/70">Vigencia</span>
                              <span className="text-foreground font-semibold">{licenseExpirationDate}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">📄 Domicilio</span>
                            <span className={`font-semibold ${addressProofImg ? "text-emerald-500" : "text-muted-foreground"}`}>{addressProofImg ? "✓ Cargado" : "Opcional"}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">📸 Foto</span>
                            <span className={`font-semibold ${driverPhotoImg ? "text-emerald-500" : "text-muted-foreground"}`}>{driverPhotoImg ? "✓ Cargada" : "Opcional"}</span>
                          </div>
                          {/* Validación cruzada CURP */}
                          {ineCurp && licenseCurp && ineCurp !== licenseCurp && (
                            <div className="flex items-center gap-1.5 text-amber-500 font-semibold mt-2"><AlertTriangle className="w-3 h-3" /> CURP de INE y Licencia no coinciden</div>
                          )}
                          {ineCurp && licenseCurp && ineCurp === licenseCurp && (
                            <div className="flex items-center gap-1.5 text-emerald-500 font-semibold mt-2"><CheckCircle2 className="w-3 h-3" /> CURP validada: INE = Licencia</div>
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
                          <Loader2 className="w-4 h-4 animate-spin" /> Guardando Conductor...
                        </span>
                      ) : (
                        "Guardar Conductor"
                      )}
                    </Button>
                  </form>
            </DialogContent>
          </Dialog>
  );
}
