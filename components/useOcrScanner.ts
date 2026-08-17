"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type OcrStep = "align" | "scan" | "extract" | "done";

interface UseOcrScannerOptions<T extends string> {
  /**
   * Targets that should skip OCR processing and just store the raw photo
   * (e.g. driver portrait or address proof). Defaults to none.
   */
  rawTargets?: T[];
  /** Per-target camera facing mode. Defaults to "environment". */
  facingMode?: (target: T) => "user" | "environment";
  /**
   * Called with the captured frame data URL. The slice decides what to do
   * with it: store it as a photo (raw targets) or feed it to its own OCR
   * parser for document targets.
   */
  onFrame: (dataUrl: string, target: T) => void;
}

/**
 * Owns the WebRTC camera lifecycle and OCR progress state shared by the
 * Drivers and Vehicles scanners: the video/canvas/stream refs, the
 * `isCameraActive`/`cameraError`/`ocrStep`/`ocrLogs`/`isScanning`/`scanTarget`
 * state, and the `startCamera`/`stopCamera`/`capturePhoto` functions.
 *
 * The slice-specific OCR field mapping (Gemini → Tesseract fallback, parsed
 * field → form setter) stays in each slice — it differs per target and per
 * OCR source — but consumes this hook's `setOcrStep`/`setOcrLogs` so the
 * progress UI stays in sync.
 */
export function useOcrScanner<T extends string>({
  rawTargets = [],
  facingMode = () => "environment",
  onFrame,
}: UseOcrScannerOptions<T>) {
  const [ocrStep, setOcrStep] = useState<OcrStep>("align");
  const [ocrLogs, setOcrLogs] = useState<string[]>([]);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanTarget, setScanTarget] = useState<T | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Keep the latest onFrame without re-creating capturePhoto each render.
  const onFrameRef = useRef(onFrame);
  const rawTargetsRef = useRef(rawTargets);
  const facingModeRef = useRef(facingMode);

  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  useEffect(() => {
    rawTargetsRef.current = rawTargets;
  }, [rawTargets]);

  useEffect(() => {
    facingModeRef.current = facingMode;
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      console.log("[Cámara] Deteniendo capturas y liberando tracks de video.");
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  /**
   * Full cancel: stop the camera AND reset all scanning state so the
   * ScannerViewfinder disappears and the form is visible again.
   */
  const cancelScan = useCallback(() => {
    stopCamera();
    setIsScanning(false);
    setScanTarget(null);
    setOcrStep("align");
    setCameraError(null);
    setOcrLogs([]);
  }, [stopCamera]);

  const startCamera = useCallback((target: T) => {
    setScanTarget(target);
    setIsScanning(true);
    setIsCameraActive(true);
    setOcrStep("align");
    setCameraError(null);
    const initMsg = `[Cámara] Solicitando acceso al stream de video. Target: ${target}`;
    console.log(initMsg);
    setOcrLogs([initMsg]);

    // Timeout: if the camera doesn't start within 15 seconds, cancel.
    const timeoutId = setTimeout(() => {
      if (!streamRef.current) {
        const timeoutMsg = "[Cámara] Tiempo de espera agotado. No se pudo acceder a la cámara.";
        setCameraError(timeoutMsg);
        setOcrLogs((prev) => [...prev, `❌ ${timeoutMsg}`]);
        stopCamera();
      }
    }, 15000);

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: facingModeRef.current(target), width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      .then((stream) => {
        clearTimeout(timeoutId);
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        const successMsg = `[Cámara] Acceso concedido. Coloque el documento frente a la lente.`;
        console.log(successMsg);
        setOcrLogs((prev) => [...prev, successMsg]);
      })
      .catch((err: unknown) => {
        clearTimeout(timeoutId);
        console.error("[Cámara] Error al abrir el stream:", err);
        const errMsg = err instanceof DOMException && err.name === "NotAllowedError"
          ? "[Cámara] Permiso denegado. Ve a Configuración → Privacidad → Cámara y permite el acceso."
          : err instanceof DOMException && err.name === "NotFoundError"
          ? "[Cámara] No se encontró ninguna cámara en este dispositivo."
          : `[Cámara] Error: ${err instanceof Error ? err.message : "Error desconocido."}`;
        setCameraError(errMsg);
        setOcrLogs((prev) => [...prev, `❌ ${errMsg}`]);
        stopCamera();
      });
  }, [stopCamera]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !scanTarget) {
      console.error("[Captura] Error: Refs nulas.");
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Capture the raw color image — no preprocessing, Gemini 3.5 Flash handles it natively
    const colorDataUrl = canvas.toDataURL("image/jpeg", 0.95);

    stopCamera();

    try {
      console.log(`[Captura] Data URL generado con éxito. Longitud cadena: ${colorDataUrl.length}`);
      setOcrLogs((prev) => [...prev, `[Captura] Fotograma capturado en Base64.`]);
      // Pass the COLOR image to onFrame so it gets stored in full color
      onFrameRef.current(colorDataUrl, scanTarget);
      // Photo-only (raw) targets are done once captured; OCR targets stay
      // "scanning" until the slice's parser finishes and clears the state.
      if (rawTargetsRef.current.includes(scanTarget)) {
        setIsScanning(false);
        setScanTarget(null);
      }
    } catch (err) {
      console.error("[Captura] Error generating Data URL:", err);
      setOcrLogs((prev) => [...prev, "❌ Error al capturar imagen en formato compatible"]);
    }
  }, [scanTarget, stopCamera]);

  // Release the camera stream on unmount.
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    ocrStep,
    setOcrStep,
    ocrLogs,
    setOcrLogs,
    isCameraActive,
    cameraError,
    isScanning,
    setIsScanning,
    scanTarget,
    setScanTarget,
    videoRef,
    canvasRef,
    streamRef,
    startCamera,
    stopCamera,
    capturePhoto,
    cancelScan,
  };
}

export type UseOcrScannerResult<T extends string> = ReturnType<typeof useOcrScanner<T>>;