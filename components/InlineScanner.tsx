"use client";

import { motion } from "framer-motion";
import { Camera, CheckCircle2, Loader2 } from "lucide-react";
import type { UseOcrScannerResult } from "@/components/useOcrScanner";

interface InlineScannerProps<T extends string> {
  scanner: UseOcrScannerResult<T>;
  /** Human-readable name per scan target, shown in the processing indicator. */
  targetLabels: Partial<Record<T, string>>;
}

/**
 * Compact inline camera/processing preview used inside the registration
 * wizards (scan-first flow). Renders the live <video>, the scan-line
 * animation, corner marks, Capturar/Cancelar buttons, the file-processing
 * indicator and the hidden capture <canvas>.
 *
 * All refs are attached HERE — inside this child component's JSX — which is
 * what satisfies the React Compiler `react-hooks/refs` rule. Parent slices
 * only read plain state (ocrStep, scanTarget) from the scanner object.
 */
export default function InlineScanner<T extends string>({
  scanner,
  targetLabels,
}: InlineScannerProps<T>) {
  const {
    ocrStep,
    isCameraActive,
    scanTarget,
    videoRef,
    canvasRef,
    capturePhoto,
    cancelScan,
  } = scanner;

  if (!scanTarget) return null;

  return (
    <>
      <div className="rounded-xl border border-primary/40 bg-card overflow-hidden">
        {isCameraActive ? (
          /* Modo cámara — video en vivo */
          <div className="relative aspect-video w-full bg-muted">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            {ocrStep === "scan" && (
              <motion.div initial={{ y: -60 }} animate={{ y: 60 }} transition={{ repeat: Infinity, repeatType: "reverse", duration: 1.2 }} className="absolute left-0 right-0 h-0.5 bg-primary shadow-lg shadow-primary/60 z-10" />
            )}
            <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-white/60" />
            <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-white/60" />
            <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-white/60" />
            <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-white/60" />
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2 z-30">
              <button type="button" onClick={capturePhoto} className="bg-primary hover:bg-primary text-white font-bold rounded-full h-10 px-4 flex items-center justify-center gap-1.5 shadow-lg active:scale-90 text-xs cursor-pointer"><Camera className="w-4 h-4" /> Capturar</button>
              <button type="button" onClick={cancelScan} className="bg-red-500 hover:bg-red-600 text-white font-bold rounded-full h-10 px-4 flex items-center justify-center gap-1.5 shadow-lg active:scale-90 text-xs cursor-pointer">Cancelar</button>
            </div>
          </div>
        ) : (
          /* Modo archivo — indicador de procesamiento */
          <div className="flex items-center gap-3 p-4">
            <div className="shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              {ocrStep === "done" ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Loader2 className="w-5 h-5 text-primary animate-spin" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-foreground">
                {ocrStep === "align" && "Cargando archivo..."}
                {ocrStep === "scan" && "Analizando documento..."}
                {ocrStep === "extract" && "Extrayendo datos..."}
                {ocrStep === "done" && "¡Documento procesado!"}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{targetLabels[scanTarget] ?? String(scanTarget)}</p>
            </div>
            <button type="button" onClick={cancelScan} className="shrink-0 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer">Cancelar</button>
          </div>
        )}
      </div>

      {/* Canvas oculto para captura */}
      <canvas ref={canvasRef} className="hidden" />
    </>
  );
}
