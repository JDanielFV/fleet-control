"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ScannerViewfinder from "@/components/ScannerViewfinder";
import Image from "next/image";
import { RefreshCcw, Loader2 } from "lucide-react";
import type { useDrivers } from "@/features/drivers/hooks/useDrivers";

type DriversFormProps = ReturnType<typeof useDrivers>;

export default function LicenseRenewalDialogs(props: DriversFormProps) {
  const {
    isScanning,
    isRenewing,
    renewingDriver,
    stopCamera,
    setRenewingDriver,
    isRenewOpen,
    setIsRenewOpen,
    renewNumber,
    setRenewNumber,
    renewIssueDate,
    setRenewIssueDate,
    renewExpirationDate,
    setRenewExpirationDate,
    renewIsPermanent,
    setRenewIsPermanent,
    submitLicenseRenewal,
    scanner,
    previewImage,
    setPreviewImage,
  } = props;

  return (
    <>
      {/* License Renewal Scanner */}
      <Dialog open={isScanning && !!renewingDriver} onOpenChange={(o) => { if (!o) { stopCamera(); setRenewingDriver(null); } }}>
        <DialogContent className="max-w-sm md:max-w-md border border-border bg-background text-foreground rounded-2xl p-0 overflow-hidden">
          <ScannerViewfinder scanner={scanner} labels={{ scan: "Escaneando licencia...", extract: "Extrayendo datos...", logsHeader: "LOGS OCR RENOVACIÓN" }} />
        </DialogContent>
      </Dialog>

      {/* License Renewal Dialog */}
      <Dialog open={isRenewOpen} onOpenChange={(o) => { setIsRenewOpen(o); if (!o) setRenewingDriver(null); }}>
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
                  {renewingDriver ? `${renewingDriver.first_name} ${renewingDriver.paternal_last_name} ${renewingDriver.maternal_last_name}` : "Cargando..."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div><Label className="text-muted-foreground text-xs">Número de Licencia</Label><Input value={renewNumber} onChange={(e) => setRenewNumber(e.target.value)} placeholder="ej. 12345678" className="mt-1.5 border-input bg-background rounded-xl" /></div>
            <div className="space-y-3">
              <div><Label className="text-muted-foreground text-xs">Fecha Expedición</Label><Input type="date" value={renewIssueDate} onChange={(e) => setRenewIssueDate(e.target.value)} className="mt-1.5 border-input bg-background rounded-xl w-full min-w-0" /></div>
              <div><Label className="text-muted-foreground text-xs">Fecha Vigencia</Label><Input type="date" value={renewExpirationDate} onChange={(e) => setRenewExpirationDate(e.target.value)} disabled={renewIsPermanent} className="mt-1.5 border-input bg-background rounded-xl w-full min-w-0 disabled:opacity-50" /></div>
            </div>
            <label className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/40 cursor-pointer">
              <span className="text-xs font-semibold text-foreground">Licencia Permanente</span>
              <Switch checked={renewIsPermanent} onCheckedChange={setRenewIsPermanent} />
            </label>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => { setIsRenewOpen(false); setRenewingDriver(null); }} className="flex-1 rounded-xl border-border">Cancelar</Button>
              <Button
                onClick={submitLicenseRenewal}
                disabled={!renewNumber || isRenewing}
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

      {/* Document Preview Modal */}
      <Dialog open={!!previewImage} onOpenChange={(o) => { if (!o) setPreviewImage(null); }}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-auto h-auto border border-border bg-black/95 text-foreground rounded-2xl p-2">
          <div className="relative w-full h-full flex items-center justify-center">
            {previewImage && (
              <Image src={previewImage} alt="Documento" width={1200} height={1600} className="object-contain max-w-full max-h-[85vh] rounded-lg" style={{ width: 'auto', height: 'auto' }} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
