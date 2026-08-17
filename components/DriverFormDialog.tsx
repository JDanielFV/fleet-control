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
import { User, Camera, FolderOpen, Sparkles, Trash2, ChevronDown } from "lucide-react";
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
                    { id: "foto", label: "Foto" },
                    { id: "doc", label: "Documentos" },
                    { id: "dom", label: "Domicilio" },
                    { id: "datos", label: "Datos" },
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
                      {/* Foto de Perfil */}
                      <div id="section-foto" className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3.5 flex flex-col items-center text-center scroll-mt-2">
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground font-black self-start">Foto de Perfil del Chofer</h4>
                        <div
                          className="relative w-24 h-24 rounded-full border-2 border-primary/20 bg-muted overflow-hidden flex items-center justify-center shadow-inner group cursor-pointer"
                          onClick={() => { if (driverPhotoImg) setPreviewImage(driverPhotoImg); }}
                        >
                          {driverPhotoImg ? (
                            <Image src={driverPhotoImg} alt="Foto Chofer" fill className="object-cover" />
                          ) : (
                            <User className="w-12 h-12 text-muted-foreground/60" />
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
                        <div className="grid grid-cols-2 gap-2 w-full">
                          <Button type="button" variant="outline" onClick={() => startCamera("CHOFER")}
                            className="border-border bg-card hover:bg-accent text-foreground text-xs rounded-xl flex items-center justify-center gap-1.5 h-11 cursor-pointer">
                            <Camera className="w-4 h-4 text-primary" /> Tomar Foto
                          </Button>
                          <Button type="button" variant="outline" onClick={() => photoFileRef.current?.click()}
                            className="border-border bg-card hover:bg-accent text-foreground text-xs rounded-xl flex items-center justify-center gap-1.5 h-11 cursor-pointer">
                            <FolderOpen className="w-4 h-4 text-primary" /> Subir Foto
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
                      <div id="section-doc" className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3.5 scroll-mt-2">
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground font-black">Escanear INE (Identificación)</h4>
                        {ineImg && (
                          <div className="relative w-full h-14 rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center">
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
                      <div className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3.5">
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground font-black">Escanear Licencia de Conducir</h4>
                        {licenseImg && (
                          <div className="relative w-full h-14 rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center">
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
                      <div id="section-dom" className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3.5 scroll-mt-2">
                        <div className="flex justify-between items-center">
                          <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground font-black">Comprobante de Domicilio</h4>
                          {addressProofImg && (
                            <span className="text-[11px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-md font-bold">Cargado</span>
                          )}
                        </div>
                        {addressProofImg && (
                          <div className="relative w-full h-14 rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center">
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

                      {/* Datos Manuales */}
                      <div id="section-datos" className="bg-muted/40 rounded-xl border border-border/80 overflow-hidden scroll-mt-2">
                        <button type="button" onClick={() => setShowManualFields((v: boolean) => !v)}
                          className="w-full p-3.5 flex items-center justify-between gap-2 cursor-pointer hover:bg-muted/60 transition-colors" aria-expanded={showManualFields}>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <ChevronDown className={cn("w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-300", !showManualFields && "-rotate-90")} />
                            <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground font-black">Datos Manuales</h4>
                            <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded-md border",
                              manualFieldsCount === MANUAL_FIELDS_TOTAL ? "bg-primary/10 text-primary border-primary/20" :
                              manualFieldsCount > 0 ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-muted text-muted-foreground border-border")}>
                              {manualFieldsCount}/{MANUAL_FIELDS_TOTAL} campos
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground italic shrink-0">Opcional — solo para correcciones</span>
                        </button>

                        <AnimatePresence initial={false}>
                          {showManualFields && (
                            <motion.div key="manual-fields" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
                              <div className="p-4 pt-1 space-y-3 border-t border-border/60">
                                <div className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3">
                                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground font-black">Datos Personales</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="min-w-0 md:col-span-2">
                                      <Label htmlFor="firstName" className="text-muted-foreground text-xs">Nombres</Label>
                                      <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="border-input bg-background rounded-xl w-full min-w-0" />
                                    </div>
                                    <div className="min-w-0">
                                      <Label htmlFor="patName" className="text-muted-foreground text-xs">Apellido Paterno</Label>
                                      <Input id="patName" value={paternalLastName} onChange={(e) => setPaternalLastName(e.target.value)} className="border-input bg-background rounded-xl w-full min-w-0" />
                                    </div>
                                    <div className="min-w-0">
                                      <Label htmlFor="matName" className="text-muted-foreground text-xs">Apellido Materno</Label>
                                      <Input id="matName" value={maternalLastName} onChange={(e) => setMaternalLastName(e.target.value)} className="border-input bg-background rounded-xl w-full min-w-0" />
                                    </div>
                                  </div>
                                </div>

                                {suggestedCurp && (
                                  <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl space-y-2">
                                    <div className="flex justify-between items-center text-xs">
                                      <span className="text-primary font-bold flex items-center gap-1 font-black"><Sparkles className="w-4 h-4" /> Sugerencia de CURP Calculada:</span>
                                      <button type="button" onClick={applySuggestedCurp} className="text-xs font-black uppercase text-primary hover:text-primary/80 underline cursor-pointer">Autocompletar</button>
                                    </div>
                                    <div className="font-mono text-sm text-foreground font-bold tracking-wider text-center">{suggestedCurp}</div>
                                  </div>
                                )}

                                <div className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3">
                                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground font-black">Licencia de Conducir</h4>
                                  <div className="space-y-3">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      <div className="min-w-0"><Label htmlFor="licNo" className="text-muted-foreground text-xs">No. Licencia</Label><Input id="licNo" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} className="border-input bg-background rounded-xl w-full min-w-0" /></div>
                                      <div className="min-w-0"><Label htmlFor="licCurp" className="text-muted-foreground text-xs">CURP Licencia</Label><Input id="licCurp" value={licenseCurp} onChange={(e) => setLicenseCurp(e.target.value)} className="border-input bg-background rounded-xl w-full min-w-0" /></div>
                                    </div>
                                    <div className="flex items-center justify-between pt-1">
                                      <Label htmlFor="permanentLic" className="cursor-pointer text-foreground">¿Licencia Permanente?</Label>
                                      <Switch id="permanentLic" checked={licenseIsPermanent} onCheckedChange={setLicenseIsPermanent} />
                                    </div>
                                    {!licenseIsPermanent && (
                                      <div className="min-w-0"><Label htmlFor="licExp" className="text-muted-foreground text-xs">F. Vencimiento</Label><Input type="date" id="licExp" value={licenseExpirationDate} onChange={(e) => setLicenseExpirationDate(e.target.value)} className="border-input bg-background rounded-xl w-full min-w-0" /></div>
                                    )}
                                  </div>
                                </div>

                                <div className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3">
                                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground font-black">Datos INE</h4>
                                  <div className="space-y-3">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      <div className="min-w-0"><Label htmlFor="ineCurp" className="text-muted-foreground text-xs">CURP INE</Label><Input id="ineCurp" value={ineCurp} onChange={(e) => setIneCurp(e.target.value)} className="border-input bg-background rounded-xl w-full min-w-0" /></div>
                                      <div className="min-w-0"><Label htmlFor="ineDob" className="text-muted-foreground text-xs">F. Nacimiento (INE)</Label><Input type="date" id="ineDob" value={ineDob} onChange={(e) => setIneDob(e.target.value)} className="border-input bg-background rounded-xl w-full min-w-0" /></div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      <div className="min-w-0"><Label htmlFor="electorKey" className="text-muted-foreground text-xs">Clave Elector</Label><Input id="electorKey" value={ineElectorKey} onChange={(e) => setIneElectorKey(e.target.value)} className="border-input bg-background rounded-xl w-full min-w-0" /></div>
                                      <div className="min-w-0">
                                        <Label className="text-muted-foreground text-xs">Sexo</Label>
                                        <Select value={ineSex} onValueChange={(val: "M" | "F" | "X") => setIneSex(val)}>
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
                                        <SearchableSelect options={MEXICAN_STATES.map((st) => ({ value: st.code, label: st.name }))} value={birthState} onValueChange={setBirthState} placeholder="Estado de nacimiento" label="Estado de Nacimiento (Para cálculo CURP)" />
                                      </div>
                                      <div className="min-w-0"><Label htmlFor="ineAddr" className="text-muted-foreground text-xs">Domicilio</Label><Input id="ineAddr" value={ineAddress} onChange={(e) => setIneAddress(e.target.value)} className="border-input bg-background rounded-xl w-full min-w-0" /></div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    <Button type="submit" className="w-full rounded-xl bg-primary text-white font-bold hover:bg-primary transition-all cursor-pointer shrink-0" disabled={isScanning}>
                      Guardar Conductor
                    </Button>
                  </form>
                )}
              </AnimatePresence>
            </DialogContent>
          </Dialog>
  );
}
