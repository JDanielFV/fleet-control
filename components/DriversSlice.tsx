"use client";

import React, { useState, useEffect, useRef } from "react";
import { db, Driver } from "@/lib/db";
import { parseOcrText, extractDobFromCurp, calculateCurp, MEXICAN_STATES } from "@/lib/ocr";
import Tesseract from "tesseract.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { User, FileText, CheckCircle, AlertTriangle, Scan, Search, Calendar, UserCheck, Play, Camera, Terminal, Upload, FolderOpen, Video, StopCircle, RefreshCw, BadgeInfo, CheckCircle2, Check, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface DriversSliceProps {
  onRefreshAlerts: () => void;
}

export default function DriversSlice({ onRefreshAlerts }: DriversSliceProps) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanTarget, setScanTarget] = useState<"INE" | "LICENCIA" | null>(null);
  
  // OCR logs
  const [ocrStep, setOcrStep] = useState<"align" | "scan" | "extract" | "done">("align");
  const [ocrLogs, setOcrLogs] = useState<string[]>([]);

  // WebRTC Camera States
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // File picker refs
  const ineFileRef = useRef<HTMLInputElement>(null);
  const licFileRef = useRef<HTMLInputElement>(null);

  // Form State
  const [firstName, setFirstName] = useState("");
  const [paternalLastName, setPaternalLastName] = useState("");
  const [maternalLastName, setMaternalLastName] = useState("");
  const [licenseCurp, setLicenseCurp] = useState("");
  const [ineCurp, setIneCurp] = useState("");
  const [licenseDob, setLicenseDob] = useState("");
  const [ineDob, setIneDob] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseIssueDate, setLicenseIssueDate] = useState("");
  const [licenseExpirationDate, setLicenseExpirationDate] = useState("");
  const [licenseIsPermanent, setLicenseIsPermanent] = useState(false);
  const [ineAddress, setIneAddress] = useState("");
  const [ineSex, setIneSex] = useState<"M" | "F" | "X">("M");
  const [ineElectorKey, setIneElectorKey] = useState("");
  const [birthState, setBirthState] = useState("DF"); // CDMX default

  useEffect(() => {
    loadDrivers();
    return () => {
      stopCamera();
    };
  }, []);

  const loadDrivers = async () => {
    const list = await db.getDrivers();
    setDrivers(list);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !paternalLastName || !licenseCurp) return;

    await db.saveDriver({
      first_name: firstName,
      paternal_last_name: paternalLastName,
      maternal_last_name: maternalLastName,
      curp: licenseCurp,
      dob: licenseDob || ineDob,
      license_number: licenseNumber,
      license_issue_date: licenseIssueDate,
      license_expiration_date: licenseIsPermanent ? "" : licenseExpirationDate,
      license_is_permanent: licenseIsPermanent,
      ine_address: ineAddress,
      ine_sex: ineSex,
      ine_elector_key: ineElectorKey,
    });

    resetForm();
    setIsOpen(false);
    loadDrivers();
    onRefreshAlerts();
  };

  const resetForm = () => {
    setFirstName("");
    setPaternalLastName("");
    setMaternalLastName("");
    setLicenseCurp("");
    setIneCurp("");
    setLicenseDob("");
    setIneDob("");
    setLicenseNumber("");
    setLicenseIssueDate("");
    setLicenseExpirationDate("");
    setLicenseIsPermanent(false);
    setIneAddress("");
    setIneSex("M");
    setIneElectorKey("");
    setBirthState("DF");
    stopCamera();
  };

  // WebRTC camera startup
  const startCamera = async (target: "INE" | "LICENCIA") => {
    setScanTarget(target);
    setIsScanning(true);
    setIsCameraActive(true);
    setOcrStep("align");
    setCameraError(null);
    const initMsg = `[Cámara] Solicitando acceso al dispositivo. Target: ${target}`;
    console.log(initMsg);
    setOcrLogs([initMsg]);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      const successMsg = `[Cámara] Acceso concedido. Coloque el documento frente a la lente.`;
      console.log(successMsg);
      setOcrLogs(prev => [...prev, successMsg]);
    } catch (err: any) {
      console.error("[Cámara] Error al abrir el stream:", err);
      const errMsg = `[Cámara] Error: ${err.message || "Permiso denegado."}`;
      setCameraError(errMsg);
      setOcrLogs(prev => [...prev, errMsg]);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      console.log("[Cámara] Deteniendo capturas y liberando tracks de video.");
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const preprocessCanvasForOcr = (canvas: HTMLCanvasElement) => {
    const context = canvas.getContext("2d");
    if (!context) return;

    try {
      const imgData = context.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        const newVal = gray < 135 ? 0 : 255;
        data[i] = newVal;
        data[i + 1] = newVal;
        data[i + 2] = newVal;
      }
      context.putImageData(imgData, 0, 0);
      console.log("[Preprocessing] Imagen binarizada a blanco y negro para mejorar el OCR.");
    } catch (e) {
      console.error("[Preprocessing] Falló el procesamiento de imagen:", e);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current || !scanTarget) {
      console.error("[Captura] Error: Refs nulas.");
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (context) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      preprocessCanvasForOcr(canvas);
      stopCamera();

      try {
        const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
        console.log(`[Captura] Data URL generado con éxito. Longitud cadena: ${dataUrl.length}`);
        setOcrLogs(prev => [...prev, `[Captura] Fotograma capturado en Base64.`]);
        processOcrOnImageSource(dataUrl, scanTarget);
      } catch (err) {
        console.error("[Captura] Error generating Data URL:", err);
        setOcrLogs(prev => [...prev, "❌ Error al capturar imagen en formato compatible"]);
      }
    }
  };

  // Core OCR runner (supports Gemini API with Tesseract local fallback)
  const processOcrOnImageSource = async (imageSource: string, target: "INE" | "LICENCIA") => {
    setOcrStep("scan");
    const initOcrMsg = `[OCR] Iniciando reconocimiento para ${target}...`;
    console.log(initOcrMsg);
    setOcrLogs(prev => [...prev, initOcrMsg, "[OCR] Intentando transcripción en la nube con Gemini..."]);

    try {
      // 1. Try Gemini OCR via API Route
      const apiResponse = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageSource, target }),
      });

      if (apiResponse.ok) {
        const parsed = await apiResponse.json();
        console.log("[OCR API Result]:", parsed);
        setOcrLogs(prev => [...prev, "✓ [OCR] Transcripción por Gemini finalizada exitosamente."]);
        setOcrStep("extract");

        if (target === "INE") {
          // INE fills primary identity data
          if (parsed.curp) {
            setIneCurp(parsed.curp);
            setIneDob(parsed.dob || "");
            setOcrLogs(prev => [...prev, `✓ [Gemini] CURP INE: ${parsed.curp}`]);
          }
          if (parsed.electorKey) {
            setIneElectorKey(parsed.electorKey);
            setOcrLogs(prev => [...prev, `✓ [Gemini] Clave Elector: ${parsed.electorKey}`]);
          }
          if (parsed.firstName) setFirstName(parsed.firstName);
          if (parsed.paternalLastName) setPaternalLastName(parsed.paternalLastName);
          if (parsed.maternalLastName) setMaternalLastName(parsed.maternalLastName);
          if (parsed.sex) setIneSex(parsed.sex);
          if (parsed.address) setIneAddress(parsed.address);
        } else {
          // LICENSE ONLY fills license specific values to avoid overwriting clean INE data
          if (parsed.licenseNumber) {
            setLicenseNumber(parsed.licenseNumber);
            setOcrLogs(prev => [...prev, `✓ [Gemini] Licencia: ${parsed.licenseNumber}`]);
          }
          if (parsed.expirationDate) {
            setLicenseExpirationDate(parsed.expirationDate);
            setOcrLogs(prev => [...prev, `✓ [Gemini] Expiración Licencia: ${parsed.expirationDate}`]);
          }
          
          // Fallback to fill other fields ONLY if they are empty
          if (parsed.curp && !licenseCurp) setLicenseCurp(parsed.curp);
          if (parsed.dob && !licenseDob) setLicenseDob(parsed.dob);
          if (parsed.firstName && !firstName) setFirstName(parsed.firstName);
          if (parsed.paternalLastName && !paternalLastName) setPaternalLastName(parsed.paternalLastName);
          if (parsed.maternalLastName && !maternalLastName) setMaternalLastName(parsed.maternalLastName);
        }

        setOcrStep("done");
        setTimeout(() => {
          setIsScanning(false);
          setScanTarget(null);
        }, 1500);
        return; // Success!
      } else {
        const errJson = await apiResponse.json();
        console.warn("[OCR API Fail]:", errJson.error || "Unknown error");
        setOcrLogs(prev => [...prev, `⚠ [OCR API] ${errJson.error || "Fallo API"}. Usando Tesseract local...`]);
      }
    } catch (err) {
      console.warn("[OCR API Connection Error]:", err);
      setOcrLogs(prev => [...prev, "⚠ Error de red con Gemini. Iniciando Tesseract local..."]);
    }

    // 2. Fallback: Run Tesseract Client-side
    try {
      const result = await Tesseract.recognize(imageSource, "spa", {
        logger: (m) => {
          if (m.status === "recognizing text") {
            const progress = Math.round(m.progress * 100);
            setOcrLogs(prev => {
              const filtered = prev.filter(l => !l.startsWith("[OCR] Progreso:"));
              return [...filtered, `[OCR] Progreso: ${progress}%`];
            });
          }
        }
      });

      setOcrStep("extract");
      const extractedText = result.data.text;
      console.log(`[OCR Texto Crudo Fallback]:\n`, extractedText);

      const parsed = parseOcrText(extractedText, target);
      console.log(`[OCR Objeto Fallback]:`, parsed);

      if (target === "INE") {
        if (parsed.curp) {
          setIneCurp(parsed.curp);
          setIneDob(parsed.dob || "");
          setOcrLogs(prev => [...prev, `✓ [Parser Local] CURP INE: ${parsed.curp}`]);
        }
        if (parsed.electorKey) {
          setIneElectorKey(parsed.electorKey);
          setOcrLogs(prev => [...prev, `✓ [Parser Local] Clave Elector: ${parsed.electorKey}`]);
        }
        if (parsed.firstName) setFirstName(parsed.firstName);
        if (parsed.paternalLastName) setPaternalLastName(parsed.paternalLastName);
        if (parsed.maternalLastName) setMaternalLastName(parsed.maternalLastName);
        if (parsed.sex) setIneSex(parsed.sex);
        if (parsed.address) setIneAddress(parsed.address);
      } else {
        if (parsed.licenseNumber) {
          setLicenseNumber(parsed.licenseNumber);
        }
        if (parsed.expirationDate) {
          setLicenseExpirationDate(parsed.expirationDate);
        }
        if (parsed.curp && !licenseCurp) setLicenseCurp(parsed.curp);
        if (parsed.dob && !licenseDob) setLicenseDob(parsed.dob);
      }

      setOcrStep("done");
      setOcrLogs(prev => [...prev, "✓ [OCR] Extracción local finalizada."]);
      
      setTimeout(() => {
        setIsScanning(false);
        setScanTarget(null);
      }, 2000);

    } catch (err: any) {
      console.error("[OCR] Fallo en la transcripción local:", err);
      const errorMsg = `❌ [OCR] Error: ${err.message || err}`;
      setOcrLogs(prev => [...prev, errorMsg]);
      setTimeout(() => {
        setIsScanning(false);
        setScanTarget(null);
      }, 3000);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, target: "INE" | "LICENCIA") => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setScanTarget(target);
    setOcrStep("align");
    const fileMsg = `[Archivo] Cargando: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
    console.log(fileMsg);
    setOcrLogs([fileMsg]);

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        console.log("[Archivo] Conversión exitosa a Base64 Data URL.");
        processOcrOnImageSource(reader.result, target);
      } else {
        setOcrLogs(prev => [...prev, "❌ Error al leer el archivo en formato Base64"]);
        setIsScanning(false);
      }
    };
    reader.onerror = () => {
      console.error("[Archivo] Error de lectura");
      setOcrLogs(prev => [...prev, "❌ Error de lectura del archivo"]);
      setIsScanning(false);
    };
    reader.readAsDataURL(file);
  };

  // Simulated OCR Trigger for fast demo
  const triggerOcrScanDemo = (target: "INE" | "LICENCIA") => {
    setIsScanning(true);
    setScanTarget(target);
    setOcrStep("align");
    setOcrLogs(["Iniciando cámara de demostración...", "Alineando documento..."]);

    setTimeout(() => {
      setOcrStep("scan");
      setOcrLogs(prev => [...prev, "INE detectada", "Procesando código PDF417 de seguridad..."]);
    }, 1000);

    setTimeout(() => {
      setOcrStep("extract");
      setOcrLogs(prev => [...prev, "Extrayendo campos estructurados...", "CURP y Clave de Elector leídos."]);
    }, 2000);

    setTimeout(() => {
      setOcrStep("done");
      setOcrLogs(prev => [...prev, "✓ Simulación completada"]);
      
      if (target === "INE") {
        setFirstName("Carlos Alberto");
        setPaternalLastName("Mendoza");
        setMaternalLastName("Ruiz");
        setIneCurp("MERC920814HDFRZS03");
        setIneDob("1992-08-14");
        setIneAddress("Av. Insurgentes Sur 1204, Del Valle, CDMX");
        setIneSex("M");
        setIneElectorKey("MNDZCR92081409H400");
      } else {
        setFirstName("Carlos Alberto");
        setPaternalLastName("Mendoza");
        setMaternalLastName("Ruiz");
        setLicenseCurp("MERC920814HDFRZS03");
        setLicenseDob("1992-08-14");
        setLicenseNumber("LIC-554901-M");
        setLicenseIssueDate("2025-02-10");
        setLicenseExpirationDate("2028-02-10");
        setLicenseIsPermanent(false);
      }

      setTimeout(() => {
        setIsScanning(false);
        setScanTarget(null);
      }, 1000);
    }, 3200);
  };

  const filteredDrivers = drivers.filter(
    (d) =>
      `${d.first_name} ${d.paternal_last_name} ${d.maternal_last_name}`
        .toLowerCase()
        .includes(search.toLowerCase()) || d.curp.toLowerCase().includes(search.toLowerCase())
  );

  // Real-time suggested CURP calculation based on UI values
  const currentDob = ineDob || licenseDob;
  const suggestedCurp = (firstName && paternalLastName && currentDob)
    ? calculateCurp({
        firstName,
        paternalLastName,
        maternalLastName,
        dob: currentDob,
        sex: ineSex,
        stateCode: birthState
      })
    : "";

  const applySuggestedCurp = () => {
    if (suggestedCurp) {
      setLicenseCurp(suggestedCurp);
      setIneCurp(suggestedCurp);
    }
  };

  // Helper to repair Elector Key (adds missing date parts or adjusts length)
  const getSuggestedElectorKey = (): string => {
    if (!ineElectorKey || ineElectorKey.length < 15) return "";
    
    // Elector Key structure: 6 letters (surnames/name initials), 8 numbers (date YYMMDD + State), H/M, 3 numbers
    // e.g. FLVGJS97111609H600
    // If user's ineElectorKey has 17 chars like FLVGJS9711609H600, let's fix it:
    if (ineElectorKey.length === 17 && currentDob) {
      const initials = ineElectorKey.substring(0, 6);
      const dobYYMMDD = currentDob.replace(/-/g, "").substring(2, 8); // e.g. 971116
      const suffix = ineElectorKey.substring(ineElectorKey.length - 6); // State code (09) + gender (H/M) + 3 digits
      return `${initials}${dobYYMMDD}${suffix}`;
    }
    return "";
  };

  const suggestedElectorKey = getSuggestedElectorKey();

  const applySuggestedElectorKey = () => {
    if (suggestedElectorKey) {
      setIneElectorKey(suggestedElectorKey);
    }
  };

  // Click handler to sync mismatching license CURP and DOB values with the validated INE values
  const syncLicenseWithIne = () => {
    if (ineCurp) setLicenseCurp(ineCurp);
    if (ineDob) setLicenseDob(ineDob);
  };

  const isCurpMismatch = !!(licenseCurp && ineCurp && licenseCurp !== ineCurp);
  const isDobMismatch = !!(licenseDob && ineDob && licenseDob !== ineDob);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight dark:text-zinc-50">Conductores</h2>
          <p className="text-sm text-zinc-500">Expedientes de choferes registrados</p>
        </div>

        <Dialog open={isOpen} onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold active:scale-95 cursor-pointer" onClick={resetForm}>
              <UserCheck className="w-4 h-4 mr-2" />
              Nuevo Conductor
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto border border-zinc-800 bg-zinc-950 text-zinc-50 rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-white font-black text-lg">Registro de Conductor</DialogTitle>
              <DialogDescription className="text-zinc-400 text-xs">
                Crea el expediente escaneando documentos o llenando los campos.
              </DialogDescription>
            </DialogHeader>

            <AnimatePresence mode="wait">
              {isScanning ? (
                /* Scanning viewscreen */
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex flex-col gap-4 py-3"
                >
                  <div className="relative aspect-video w-full rounded-xl border border-emerald-500/30 bg-zinc-900 overflow-hidden flex items-center justify-center">
                    
                    {/* Live webcam feed stream */}
                    {isCameraActive && !cameraError ? (
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center space-y-2 p-4 z-20">
                        <Camera className={`w-8 h-8 mx-auto ${ocrStep !== "done" ? "text-emerald-400 animate-pulse" : "text-zinc-500"}`} />
                        <p className="text-xs font-bold text-zinc-300">
                          {ocrStep === "align" && (cameraError || "Iniciando captura...")}
                          {ocrStep === "scan" && "Escaneando píxeles..."}
                          {ocrStep === "extract" && "Analizando caracteres..."}
                          {ocrStep === "done" && "✓ Procesado"}
                        </p>
                      </div>
                    )}

                    {ocrStep === "scan" && (
                      <motion.div
                        initial={{ y: -80 }}
                        animate={{ y: 80 }}
                        transition={{ repeat: Infinity, repeatType: "reverse", duration: 1.2 }}
                        className="absolute left-0 right-0 h-1 bg-emerald-400 shadow-lg shadow-emerald-500/60 z-10"
                      />
                    )}

                    <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-zinc-500" />
                    <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-zinc-500" />
                    <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-zinc-500" />
                    <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-zinc-500" />

                    {/* Camera capture shutter button */}
                    {isCameraActive && !cameraError && (
                      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-30">
                        <Button
                          type="button"
                          onClick={capturePhoto}
                          className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-full w-12 h-12 p-0 flex items-center justify-center shadow-lg active:scale-90"
                        >
                          <Camera className="w-5 h-5" />
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={stopCamera}
                          className="rounded-full w-12 h-12 p-0 flex items-center justify-center shadow-lg active:scale-90"
                        >
                          <StopCircle className="w-5 h-5" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Hidden canvas for drawing frame */}
                  <canvas ref={canvasRef} className="hidden" />

                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 h-36 overflow-y-auto font-mono text-[10px] text-emerald-400/90 flex flex-col gap-1 shadow-inner">
                    <div className="flex items-center gap-1.5 text-zinc-500 border-b border-zinc-800 pb-1 mb-1">
                      <Terminal className="w-3.5 h-3.5" />
                      <span>LOGS DETALLADOS DEL FLUJO OCR</span>
                    </div>
                    {ocrLogs.map((log, index) => (
                      <div key={index} className="leading-relaxed">{log}</div>
                    ))}
                  </div>
                </motion.div>
              ) : (
                /* Standard form view */
                <form onSubmit={handleSave} className="space-y-4 pt-2">
                  
                  {/* Document matching state headers with correction helpers */}
                  {(licenseCurp || ineCurp || licenseDob || ineDob) && (
                    <div className="bg-zinc-900/60 p-3 rounded-xl border border-zinc-800 text-xs space-y-2">
                      <h4 className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Verificación Cruzada INE vs Licencia</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-400">Coincidencia de CURP:</span>
                          {isCurpMismatch ? (
                            <span className="text-red-400 font-bold flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Mismatch</span>
                          ) : (licenseCurp && ineCurp) ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Válida</span>
                          ) : (
                            <span className="text-zinc-500">Pendiente (falta doc)</span>
                          )}
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-400">Coincidencia de F. Nacimiento:</span>
                          {isDobMismatch ? (
                            <span className="text-red-400 font-bold flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Mismatch</span>
                          ) : (licenseDob && ineDob) ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Válida</span>
                          ) : (
                            <span className="text-zinc-500">Pendiente (falta doc)</span>
                          )}
                        </div>

                        {(isCurpMismatch || isDobMismatch) && ineCurp && (
                          <Button
                            type="button"
                            onClick={syncLicenseWithIne}
                            className="w-full mt-1.5 h-8 text-[10px] font-black uppercase tracking-wider bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-emerald-400 flex items-center justify-center gap-1.5 rounded-lg cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5" /> Sincronizar Licencia con Datos de INE
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Two separate triggers for camera vs file uploads */}
                  <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-800/80 space-y-3.5">
                    <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 font-black">Escanear INE (Identificación)</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => startCamera("INE")}
                        className="border-zinc-800 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 text-xs rounded-xl flex items-center justify-center gap-1.5 h-11 cursor-pointer"
                      >
                        <Camera className="w-4 h-4 text-emerald-400" /> Tomar Foto
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => ineFileRef.current?.click()}
                        className="border-zinc-800 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 text-xs rounded-xl flex items-center justify-center gap-1.5 h-11 cursor-pointer"
                      >
                        <FolderOpen className="w-4 h-4 text-emerald-400" /> Subir Archivo
                      </Button>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={ineFileRef}
                        onChange={(e) => handleFileChange(e, "INE")}
                      />
                      <button
                        type="button"
                        onClick={() => triggerOcrScanDemo("INE")}
                        className="col-span-2 text-[9px] text-zinc-500 hover:text-zinc-300 font-bold uppercase tracking-wider text-center pt-0.5"
                      >
                        Simular INE Demo
                      </button>
                    </div>
                  </div>

                  <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-800/80 space-y-3.5">
                    <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 font-black">Escanear Licencia de Conducir</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => startCamera("LICENCIA")}
                        className="border-zinc-800 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 text-xs rounded-xl flex items-center justify-center gap-1.5 h-11 cursor-pointer"
                      >
                        <Camera className="w-4 h-4 text-emerald-400" /> Tomar Foto
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => licFileRef.current?.click()}
                        className="border-zinc-800 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 text-xs rounded-xl flex items-center justify-center gap-1.5 h-11 cursor-pointer"
                      >
                        <FolderOpen className="w-4 h-4 text-emerald-400" /> Subir Archivo
                      </Button>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={licFileRef}
                        onChange={(e) => handleFileChange(e, "LICENCIA")}
                      />
                      <button
                        type="button"
                        onClick={() => triggerOcrScanDemo("LICENCIA")}
                        className="col-span-2 text-[9px] text-zinc-500 hover:text-zinc-300 font-bold uppercase tracking-wider text-center pt-0.5"
                      >
                        Simular Licencia Demo
                      </button>
                    </div>
                  </div>

                  <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-800/80 space-y-3">
                    <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 font-black">Datos Personales</h4>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="min-w-0">
                        <Label htmlFor="firstName" className="text-zinc-400 text-xs">Nombres</Label>
                        <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="border-zinc-800 bg-zinc-900 rounded-xl w-full min-w-0" />
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        <div className="min-w-0">
                          <Label htmlFor="patName" className="text-zinc-400 text-xs">Apellido Paterno</Label>
                          <Input id="patName" value={paternalLastName} onChange={(e) => setPaternalLastName(e.target.value)} required className="border-zinc-800 bg-zinc-900 rounded-xl w-full min-w-0" />
                        </div>
                        <div className="min-w-0">
                          <Label htmlFor="matName" className="text-zinc-400 text-xs">Apellido Materno</Label>
                          <Input id="matName" value={maternalLastName} onChange={(e) => setMaternalLastName(e.target.value)} className="border-zinc-800 bg-zinc-900 rounded-xl w-full min-w-0" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Suggested CURP Box */}
                  {suggestedCurp && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-emerald-400 font-bold flex items-center gap-1 font-black">
                          <Sparkles className="w-4 h-4" /> Sugerencia de CURP Calculada:
                        </span>
                        <button
                          type="button"
                          onClick={applySuggestedCurp}
                          className="text-[10px] font-black uppercase text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
                        >
                          Autocompletar
                        </button>
                      </div>
                      <div className="font-mono text-sm text-zinc-200 font-bold tracking-wider text-center">
                        {suggestedCurp}
                      </div>
                    </div>
                  )}

                  {/* Licencia Details */}
                  <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-800/80 space-y-3">
                    <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 font-black">Licencia de Conducir</h4>
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 gap-3">
                        <div className="min-w-0">
                          <Label htmlFor="licNo" className="text-zinc-400 text-xs">No. Licencia</Label>
                          <Input id="licNo" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} className="border-zinc-800 bg-zinc-900 rounded-xl w-full min-w-0" />
                        </div>
                        <div className="min-w-0">
                          <Label htmlFor="licCurp" className="text-zinc-400 text-xs">CURP Licencia</Label>
                          <Input id="licCurp" value={licenseCurp} onChange={(e) => setLicenseCurp(e.target.value)} className="border-zinc-800 bg-zinc-900 rounded-xl w-full min-w-0" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        <div className="min-w-0">
                          <Label htmlFor="licDob" className="text-zinc-400 text-xs">F. Nacimiento (Licencia)</Label>
                          <Input type="date" id="licDob" value={licenseDob} onChange={(e) => setLicenseDob(e.target.value)} className="border-zinc-800 bg-zinc-900 rounded-xl w-full min-w-0" />
                        </div>
                        <div className="min-w-0">
                          <Label htmlFor="licIssue" className="text-zinc-400 text-xs">F. Expedición</Label>
                          <Input type="date" id="licIssue" value={licenseIssueDate} onChange={(e) => setLicenseIssueDate(e.target.value)} className="border-zinc-800 bg-zinc-900 rounded-xl w-full min-w-0" />
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between pt-1">
                        <Label htmlFor="permanentLic" className="cursor-pointer text-zinc-300">¿Licencia Permanente?</Label>
                        <Switch id="permanentLic" checked={licenseIsPermanent} onCheckedChange={setLicenseIsPermanent} />
                      </div>

                      {!licenseIsPermanent && (
                        <div className="min-w-0">
                          <Label htmlFor="licExp" className="text-zinc-400 text-xs">F. Vencimiento</Label>
                          <Input type="date" id="licExp" value={licenseExpirationDate} onChange={(e) => setLicenseExpirationDate(e.target.value)} className="border-zinc-800 bg-zinc-900 rounded-xl w-full min-w-0" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* INE Details */}
                  <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-800/80 space-y-3">
                    <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 font-black">Datos INE</h4>
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 gap-3">
                        <div className="min-w-0">
                          <Label htmlFor="ineCurp" className="text-zinc-400 text-xs">CURP INE</Label>
                          <Input id="ineCurp" value={ineCurp} onChange={(e) => setIneCurp(e.target.value)} className="border-zinc-800 bg-zinc-900 rounded-xl w-full min-w-0" />
                        </div>
                        <div className="min-w-0">
                          <Label htmlFor="ineDob" className="text-zinc-400 text-xs">F. Nacimiento (INE)</Label>
                          <Input type="date" id="ineDob" value={ineDob} onChange={(e) => setIneDob(e.target.value)} className="border-zinc-800 bg-zinc-900 rounded-xl w-full min-w-0" />
                        </div>
                      </div>

                      {/* Suggestion for Elector Key */}
                      {suggestedElectorKey && suggestedElectorKey !== ineElectorKey && (
                        <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex justify-between items-center text-xs">
                          <div>
                            <span className="text-emerald-400 font-bold block">¿Corregir Clave Elector?</span>
                            <span className="font-mono text-zinc-300 tracking-wider text-[10px]">{suggestedElectorKey}</span>
                          </div>
                          <button
                            type="button"
                            onClick={applySuggestedElectorKey}
                            className="text-[9px] font-black uppercase text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
                          >
                            Aplicar
                          </button>
                        </div>
                      )}

                      <div className="grid grid-cols-1 gap-3">
                        <div className="min-w-0">
                          <Label htmlFor="electorKey" className="text-zinc-400 text-xs">Clave Elector</Label>
                          <Input id="electorKey" value={ineElectorKey} onChange={(e) => setIneElectorKey(e.target.value)} className="border-zinc-800 bg-zinc-900 rounded-xl w-full min-w-0" />
                        </div>
                        <div className="min-w-0">
                          <Label className="text-zinc-400 text-xs">Sexo</Label>
                          <Select value={ineSex} onValueChange={(val: "M" | "F" | "X") => setIneSex(val)}>
                            <SelectTrigger className="w-full border-zinc-800 bg-zinc-900 rounded-xl">
                              <SelectValue placeholder="Sexo" />
                            </SelectTrigger>
                            <SelectContent className="border-zinc-850 bg-zinc-900 text-zinc-50">
                              <SelectItem value="M">Masculino</SelectItem>
                              <SelectItem value="F">Femenino</SelectItem>
                              <SelectItem value="X">No Binario</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        <div className="min-w-0">
                          <Label className="text-zinc-400 text-xs font-semibold">Estado de Nacimiento (Para cálculo CURP)</Label>
                          <Select value={birthState} onValueChange={setBirthState}>
                            <SelectTrigger className="w-full border-zinc-800 bg-zinc-900 rounded-xl">
                              <SelectValue placeholder="Estado de nacimiento" />
                            </SelectTrigger>
                            <SelectContent className="border-zinc-850 bg-zinc-900 text-zinc-50 max-h-48 overflow-y-auto">
                              {MEXICAN_STATES.map((st) => (
                                <SelectItem key={st.code} value={st.code}>
                                  {st.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="min-w-0">
                          <Label htmlFor="ineAddr" className="text-zinc-400 text-xs">Domicilio</Label>
                          <Input id="ineAddr" value={ineAddress} onChange={(e) => setIneAddress(e.target.value)} className="border-zinc-800 bg-zinc-900 rounded-xl w-full min-w-0" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Warnings */}
                  {isCurpMismatch && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex gap-2 items-start">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">CURP Mismatch:</span> La CURP de la INE no coincide con la de la Licencia.
                      </div>
                    </div>
                  )}
                  {isDobMismatch && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex gap-2 items-start">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">F. Nacimiento Mismatch:</span> La fecha de nacimiento varía entre documentos.
                      </div>
                    </div>
                  )}

                  <Button type="submit" className="w-full rounded-xl bg-emerald-500 text-zinc-950 font-bold hover:bg-emerald-400 transition-all cursor-pointer" disabled={isScanning || isCurpMismatch || isDobMismatch}>
                    Guardar Conductor
                  </Button>
                </form>
              )}
            </AnimatePresence>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3.5 w-4 h-4 text-zinc-500" />
        <Input
          placeholder="Buscar conductor por nombre o CURP..."
          className="pl-9 bg-zinc-900 border-zinc-800 rounded-xl h-11 focus-visible:ring-emerald-500"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        {filteredDrivers.map((driver) => (
          <Card key={driver.id} className="border-zinc-800 bg-zinc-900/30 overflow-hidden hover:bg-zinc-900/40 hover:border-zinc-700 transition-all duration-200">
            <CardHeader className="p-4 pb-2.5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl">
                    <User className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold text-white">{`${driver.first_name} ${driver.paternal_last_name} ${driver.maternal_last_name}`}</CardTitle>
                    <CardDescription className="text-2xs font-mono font-bold text-zinc-500 tracking-wide pt-0.5">{driver.curp}</CardDescription>
                  </div>
                </div>
                {driver.license_is_permanent ? (
                  <span className="px-2 py-0.5 text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md">
                    Lic. Permanente
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[9px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Vence: {driver.license_expiration_date}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3.5 pt-2 text-xs space-y-2 border-t border-zinc-900 bg-zinc-950/20">
              <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-zinc-400">
                <div>
                  <span className="font-semibold block text-[10px] uppercase tracking-wider text-zinc-600">Licencia</span>
                  <span className="text-zinc-300 font-medium">{driver.license_number || "N/D"}</span>
                </div>
                <div>
                  <span className="font-semibold block text-[10px] uppercase tracking-wider text-zinc-600">Clave Elector</span>
                  <span className="text-zinc-300 font-medium">{driver.ine_elector_key || "N/D"}</span>
                </div>
                <div className="col-span-2 border-t border-zinc-900/60 pt-1.5 mt-0.5">
                  <span className="font-semibold block text-[10px] uppercase tracking-wider text-zinc-600">Domicilio INE</span>
                  <span className="text-zinc-300 leading-snug">{driver.ine_address || "N/D"}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredDrivers.length === 0 && (
          <div className="text-center py-8 text-zinc-500">
            No se encontraron conductores.
          </div>
        )}
      </div>
    </div>
  );
}
