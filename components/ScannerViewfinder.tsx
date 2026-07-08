"use client";

import { motion } from "framer-motion";
import { Camera, StopCircle, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UseOcrScannerResult } from "@/components/useOcrScanner";

interface ScannerViewfinderProps<T extends string> {
  scanner: UseOcrScannerResult<T>;
  /** Stage labels shown in the placeholder while the camera is opening. */
  labels: {
    scan: string;
    extract: string;
    /** Header of the OCR logs panel. */
    logsHeader: string;
  };
}

/**
 * Shared camera viewfinder + OCR progress UI for the Drivers and Vehicles
 * scanners. Renders the live `<video>`, the scan-line animation, the
 * shutter/stop buttons, the hidden capture `<canvas>` and the logs panel.
 * All state and handlers come from `useOcrScanner`; only the stage labels
 * differ between slices.
 */
export default function ScannerViewfinder<T extends string>({
  scanner,
  labels,
}: ScannerViewfinderProps<T>) {
  const {
    ocrStep,
    ocrLogs,
    isCameraActive,
    cameraError,
    isScanning,
    videoRef,
    canvasRef,
    capturePhoto,
    stopCamera,
  } = scanner;

  if (!isScanning) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex flex-col gap-4 py-3"
    >
      <div className="relative aspect-video w-full rounded-xl border border-primary/30 bg-muted overflow-hidden flex items-center justify-center">
        {isCameraActive && !cameraError ? (
          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
        ) : (
          <div className="text-center space-y-2 p-4 z-20">
            <Camera
              className={`w-8 h-8 mx-auto ${ocrStep !== "done" ? "text-primary animate-pulse" : "text-muted-foreground"}`}
            />
            <p className="text-xs font-bold text-foreground">
              {ocrStep === "align" && (cameraError || "Iniciando captura...")}
              {ocrStep === "scan" && labels.scan}
              {ocrStep === "extract" && labels.extract}
              {ocrStep === "done" && "✓ Procesado"}
            </p>
          </div>
        )}

        {ocrStep === "scan" && (
          <motion.div
            initial={{ y: -80 }}
            animate={{ y: 80 }}
            transition={{ repeat: Infinity, repeatType: "reverse", duration: 1.2 }}
            className="absolute left-0 right-0 h-1 bg-primary shadow-lg shadow-primary/60 z-10"
          />
        )}

        <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-border" />
        <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-border" />
        <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-border" />
        <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-border" />

        {isCameraActive && !cameraError && (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3 z-30">
            <Button
              type="button"
              onClick={capturePhoto}
              className="bg-primary hover:bg-primary text-white font-bold rounded-full h-12 px-5 flex items-center justify-center gap-2 shadow-lg active:scale-90"
            >
              <Camera className="w-5 h-5" /> Capturar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={stopCamera}
              className="rounded-full h-12 px-5 flex items-center justify-center gap-2 shadow-lg active:scale-90"
            >
              <StopCircle className="w-5 h-5" /> Cancelar
            </Button>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      <div className="bg-muted border border-border rounded-xl p-3 h-36 overflow-y-auto font-mono text-xs text-primary/90 flex flex-col gap-1 shadow-inner">
        <div className="flex items-center gap-1.5 text-muted-foreground border-b border-border pb-1 mb-1">
          <Terminal className="w-3.5 h-3.5" />
          <span>{labels.logsHeader}</span>
        </div>
        {ocrLogs.map((log, index) => (
          <div key={index} className="leading-relaxed">
            {log}
          </div>
        ))}
      </div>
    </motion.div>
  );
}