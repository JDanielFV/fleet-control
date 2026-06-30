"use client";

import React, { useState, useEffect, useRef } from "react";
import { db, Vehicle, getVerificationSchedule, Driver, Maintenance, Checklist, WeeklyRental } from "@/lib/db";
import { parseOcrText } from "@/lib/ocr";
import Tesseract from "tesseract.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Car, FileText, CheckCircle2, AlertTriangle, Scan, Search, Calendar, Shield, Trash2, Key, Camera, Terminal, Upload, FolderOpen, StopCircle, BadgeInfo, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface VehiclesSliceProps {
  onRefreshAlerts: () => void;
  searchQuery?: string;
}

export default function VehiclesSlice({ onRefreshAlerts, searchQuery }: VehiclesSliceProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [weeklyRentals, setWeeklyRentals] = useState<WeeklyRental[]>([]);
  const [search, setSearch] = useState("");

  const handleDeleteVehicle = async (id: string) => {
    if (confirm("¿Estás seguro de que deseas eliminar este vehículo? Esta acción borrará su historial activo.")) {
      const success = await db.deleteVehicle(id);
      if (success) {
        setVehicles((prev) => prev.filter((v) => v.id !== id));
        onRefreshAlerts();
      }
    }
  };

  useEffect(() => {
    if (searchQuery !== undefined) {
      setSearch(searchQuery);
    }
  }, [searchQuery]);
  const [isOpen, setIsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanTarget, setScanTarget] = useState<"CIRCULACION" | "SEGURO" | null>(null);

  // OCR viewfinder logs
  const [ocrStep, setOcrStep] = useState<"align" | "scan" | "extract" | "done">("align");
  const [ocrLogs, setOcrLogs] = useState<string[]>([]);

  // WebRTC Camera States
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Refs for hidden inputs
  const circFileRef = useRef<HTMLInputElement>(null);
  const insFileRef = useRef<HTMLInputElement>(null);

  // Form State
  const [brand, setBrand] = useState("");
  const [vehicleName, setVehicleName] = useState("");
  const [model, setModel] = useState("");
  const [classType, setClassType] = useState("");
  const [circulationExpirationDate, setCirculationExpirationDate] = useState("");
  const [vin, setVin] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [insurancePolicyImg, setInsurancePolicyImg] = useState("");
  const [insuranceExpirationDate, setInsuranceExpirationDate] = useState("");
  const [rentCost, setRentCost] = useState<number>(2500);

  useEffect(() => {
    loadData();
    return () => {
      stopCamera();
    };
  }, []);

  const loadData = async () => {
    const list = await db.getVehicles();
    const dList = await db.getDrivers();
    const mList = await db.getMaintenances();
    const cList = await db.getChecklists();
    const rList = await db.getWeeklyRentals();
    setVehicles(list);
    setDrivers(dList);
    setMaintenances(mList);
    setChecklists(cList);
    setWeeklyRentals(rList);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand || !vehicleName || !plateNumber) return;

    const formattedPlate = plateNumber.toUpperCase().replace(/\s+/g, "").trim();
    const formattedVin = vin.toUpperCase().trim();

    // Check for duplicates
    const isDuplicate = vehicles.some(
      (v) =>
        v.plate_number.toUpperCase().replace(/\s+/g, "").trim() === formattedPlate ||
        (v.vin && formattedVin && v.vin.toUpperCase().trim() === formattedVin)
    );

    if (isDuplicate) {
      alert("Error: Ya existe un vehículo registrado con estas placas o número de serie (VIN).");
      return;
    }

    await db.saveVehicle({
      brand,
      vehicle_name: vehicleName,
      model,
      class_type: classType,
      circulation_expiration_date: circulationExpirationDate,
      vin: formattedVin,
      plate_number: formattedPlate,
      insurance_policy_img: insurancePolicyImg,
      insurance_expiration_date: insuranceExpirationDate,
      active_driver_id: null,
      rent_cost: Number(rentCost),
    });

    resetForm();
    setIsOpen(false);
    loadData();
    onRefreshAlerts();
  };

  const resetForm = () => {
    setBrand("");
    setVehicleName("");
    setModel("");
    setClassType("");
    setCirculationExpirationDate("");
    setVin("");
    setPlateNumber("");
    setInsurancePolicyImg("");
    setInsuranceExpirationDate("");
    setRentCost(2500);
    stopCamera();
  };

  // WebRTC camera startup
  const startCamera = async (target: "CIRCULACION" | "SEGURO") => {
    setScanTarget(target);
    setIsScanning(true);
    setIsCameraActive(true);
    setOcrStep("align");
    setCameraError(null);
    const initMsg = `[Cámara] Solicitando acceso al stream de video. Target: ${target}`;
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
      const successMsg = `[Cámara] Transmisión activa en alta resolución. Coloque el documento en foco.`;
      console.log(successMsg);
      setOcrLogs(prev => [...prev, successMsg]);
    } catch (err: any) {
      console.error("[Cámara] Error al abrir el video:", err);
      const errMsg = `[Cámara] Error: ${err.message || "Permisos denegados."}`;
      setCameraError(errMsg);
      setOcrLogs(prev => [...prev, errMsg]);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      console.log("[Cámara] Deteniendo streams activos y liberando dispositivo.");
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
      console.error("[Captura] Error: Referencias de video/canvas nulas.");
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
        console.log(`[Captura] Data URL generado: ${dataUrl.length} caracteres.`);
        processOcrOnImageSource(dataUrl, scanTarget);
      } catch (err) {
        console.error("[Captura] Error generating Data URL:", err);
        setOcrLogs(prev => [...prev, "❌ Error al capturar imagen en formato compatible"]);
      }
    }
  };

  // Core OCR runner (supports Gemini API with Tesseract local fallback)
  const processOcrOnImageSource = async (imageSource: string, target: "CIRCULACION" | "SEGURO") => {
    setOcrStep("scan");
    const initOcrMsg = `[OCR] Iniciando reconocimiento para: ${target}`;
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

        if (target === "CIRCULACION") {
          if (parsed.brand) setBrand(parsed.brand);
          if (parsed.vehicleName) setVehicleName(parsed.vehicleName);
          if (parsed.model) setModel(parsed.model);
          if (parsed.classType) setClassType(parsed.classType);
          if (parsed.plateNumber) {
            setPlateNumber(parsed.plateNumber);
            setOcrLogs(prev => [...prev, `✓ [Gemini] Placa: ${parsed.plateNumber}`]);
          }
          if (parsed.vin) {
            setVin(parsed.vin);
            setOcrLogs(prev => [...prev, `✓ [Gemini] Serie/VIN: ${parsed.vin}`]);
          }
          if (parsed.circulationExpirationDate) setCirculationExpirationDate(parsed.circulationExpirationDate);
        } else {
          setInsurancePolicyImg(imageSource); // Store the actual Base64 URL image
          if (parsed.expirationDate) {
            setInsuranceExpirationDate(parsed.expirationDate);
            setOcrLogs(prev => [...prev, `✓ [Gemini] Expiración Póliza de Seguro: ${parsed.expirationDate}`]);
          }
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
      const text = result.data.text;
      console.log(`[OCR Texto Crudo Fallback]:\n`, text);

      const parsed = parseOcrText(text, target);
      console.log(`[OCR Objeto Fallback]:`, parsed);

      if (target === "CIRCULACION") {
        if (parsed.brand) {
          setBrand(parsed.brand);
          setOcrLogs(prev => [...prev, `✓ [Parser Local] Marca: ${parsed.brand}`]);
        }
        if (parsed.modelYear) {
          setModel(parsed.modelYear);
          setOcrLogs(prev => [...prev, `✓ [Parser] Año: ${parsed.modelYear}`]);
        }
        if (parsed.plateNumber) {
          setPlateNumber(parsed.plateNumber);
          setOcrLogs(prev => [...prev, `✓ [Parser Local] Placa: ${parsed.plateNumber}`]);
        }
        if (parsed.vin) {
          setVin(parsed.vin);
          setOcrLogs(prev => [...prev, `✓ [Parser Local] Serie/NIV: ${parsed.vin}`]);
        }
        if (parsed.expirationDate) {
          setCirculationExpirationDate(parsed.expirationDate);
        }
      } else {
        setInsurancePolicyImg(imageSource);
        if (parsed.expirationDate) {
          setInsuranceExpirationDate(parsed.expirationDate);
          setOcrLogs(prev => [...prev, `✓ [Parser Local] Expiración Póliza de Seguro: ${parsed.expirationDate}`]);
        }
      }

      setOcrStep("done");
      setOcrLogs(prev => [...prev, "✓ [OCR] Análisis local finalizado."]);
      
      setTimeout(() => {
        setIsScanning(false);
        setScanTarget(null);
      }, 2000);

    } catch (err: any) {
      console.error("[OCR] Error al transcribir documento:", err);
      const errorMsg = `❌ [OCR] Fallo: ${err.message || err}`;
      setOcrLogs(prev => [...prev, errorMsg]);
      setTimeout(() => {
        setIsScanning(false);
        setScanTarget(null);
      }, 3000);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, target: "CIRCULACION" | "SEGURO") => {
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
        setOcrLogs(prev => [...prev, "❌ Error al leer el archivo"]);
        setIsScanning(false);
      }
    };
    reader.onerror = () => {
      setOcrLogs(prev => [...prev, "❌ Error de lectura"]);
      setIsScanning(false);
    };
    reader.readAsDataURL(file);
  };

  // Simulated OCR Trigger for fast demo
  const triggerOcrScanDemo = (target: "CIRCULACION" | "SEGURO") => {
    setIsScanning(true);
    setScanTarget(target);
    setOcrStep("align");
    setOcrLogs(["Iniciando cámara de captura...", "Enfocando documento..."]);

    setTimeout(() => {
      setOcrStep("scan");
      setOcrLogs(prev => [...prev, "Bordes del documento encontrados", "Leyendo código QR y barras holográficas..."]);
    }, 1000);

    setTimeout(() => {
      setOcrStep("extract");
      setOcrLogs(prev => [...prev, "Procesando metadatos estructurados...", "Extrayendo Placa, Marca y VIN..."]);
    }, 2000);

    setTimeout(() => {
      setOcrStep("done");
      setOcrLogs(prev => [...prev, "✓ Simulación completada"]);
      
      if (target === "CIRCULACION") {
        const demoVehicles = [
          {
            brand: "Nissan",
            name: "Sentra",
            model: "2023",
            class: "Sedán - Confort",
            circExp: "2027-11-20",
            vin: "3N1CN81D7PL892103",
            plate: "741-XYZ",
            rent: 2600
          },
          {
            brand: "Toyota",
            name: "Prius",
            model: "2022",
            class: "Híbrido - Premium",
            circExp: "2028-04-15",
            vin: "JTDDKRFU9M3812049",
            plate: "852-MNO",
            rent: 2800
          },
          {
            brand: "Chevrolet",
            name: "Beat",
            model: "2020",
            class: "Hatchback - Económico",
            circExp: "2026-09-30",
            vin: "KL1TA54B9KC981023",
            plate: "963-JKL",
            rent: 2200
          },
          {
            brand: "Volkswagen",
            name: "Vento",
            model: "2021",
            class: "Sedán - Estándar",
            circExp: "2027-06-18",
            vin: "3VW2K4FX4LM819203",
            plate: "321-UWV",
            rent: 2400
          },
          {
            brand: "Hyundai",
            name: "Grand i10",
            model: "2022",
            class: "Hatchback - Compacto",
            circExp: "2028-02-10",
            vin: "MALAN51C7NM819203",
            plate: "456-RST",
            rent: 2300
          },
          {
            brand: "Kia",
            name: "Rio",
            model: "2023",
            class: "Sedán - Confort",
            circExp: "2027-12-05",
            vin: "3KPA24AD5PE819203",
            plate: "159-QWE",
            rent: 2500
          }
        ];
        const idx = Math.floor(Math.random() * demoVehicles.length);
        const choice = demoVehicles[idx];

        setBrand(choice.brand);
        setVehicleName(choice.name);
        setModel(choice.model);
        setClassType(choice.class);
        setCirculationExpirationDate(choice.circExp);
        setVin(choice.vin);
        setPlateNumber(choice.plate);
        setRentCost(choice.rent);
      } else {
        const demoInsurances = [
          { date: "2027-06-15" },
          { date: "2027-09-20" },
          { date: "2026-12-10" },
          { date: "2027-03-05" },
          { date: "2028-01-18" },
          { date: "2027-11-30" }
        ];
        const idx = Math.floor(Math.random() * demoInsurances.length);
        setInsurancePolicyImg("base64_mock_insurance_policy_image_proof");
        setInsuranceExpirationDate(demoInsurances[idx].date);
      }

      setTimeout(() => {
        setIsScanning(false);
        setScanTarget(null);
      }, 1000);
    }, 3200);
  };

  const getDriverName = (driverId: string | null) => {
    if (!driverId) return "No asignado";
    const d = drivers.find((x) => x.id === driverId);
    return d ? `${d.first_name} ${d.paternal_last_name}` : "Desconocido";
  };

  const filteredVehicles = vehicles.filter(
    (v) =>
      `${v.brand} ${v.vehicle_name}`.toLowerCase().includes(search.toLowerCase()) ||
      v.plate_number.toLowerCase().includes(search.toLowerCase())
  );

  const schedules = [
    { color: "Amarillo", digits: "5 y 6", months: "Feb-Mar / Ago-Sep", bg: "bg-yellow-500 text-zinc-950" },
    { color: "Rosa", digits: "7 y 8", months: "Mar-Abr / Sep-Oct", bg: "bg-pink-500 text-white" },
    { color: "Rojo", digits: "3 y 4", months: "Abr-May / Oct-Nov", bg: "bg-red-500 text-white" },
    { color: "Verde", digits: "1 y 2", months: "May-Jun / Nov-Dic", bg: "bg-emerald-500 text-white" },
    { color: "Azul", digits: "9 y 0", months: "Jun-Jul / Dic-Ene", bg: "bg-blue-500 text-white" },
  ];

  // Length warnings for inputs
  const isVinLengthInvalid = vin.length > 0 && vin.length !== 17;
  const isPlateLengthInvalid = plateNumber.length > 0 && (plateNumber.length < 5 || plateNumber.length > 10);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Vehículos</h2>
          <p className="text-sm text-muted-foreground">Administra los autos de la flota</p>
        </div>

        <Dialog open={isOpen} onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="rounded-xl bg-primary hover:bg-primary text-white font-bold active:scale-95 cursor-pointer" onClick={resetForm}>
              <Car className="w-4 h-4 mr-2" />
              Nuevo Vehículo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto border border-border bg-background text-foreground rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-white font-black text-lg">Registro de Vehículo</DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                Ingresa datos o usa OCR de la tarjeta de circulación y póliza.
              </DialogDescription>
            </DialogHeader>

            <AnimatePresence mode="wait">
              {isScanning ? (
                /* Scanner animation */
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex flex-col gap-4 py-3"
                >
                  <div className="relative aspect-video w-full rounded-xl border border-primary/30 bg-muted overflow-hidden flex items-center justify-center">
                    
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
                        <Camera className={`w-8 h-8 mx-auto ${ocrStep !== "done" ? "text-primary animate-pulse" : "text-muted-foreground"}`} />
                        <p className="text-xs font-bold text-foreground">
                          {ocrStep === "align" && (cameraError || "Iniciando captura...")}
                          {ocrStep === "scan" && "Analizando marcas..."}
                          {ocrStep === "extract" && "Generando bloques de texto..."}
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

                    {/* Camera capture shutter button */}
                    {isCameraActive && !cameraError && (
                      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-30">
                        <Button
                          type="button"
                          onClick={capturePhoto}
                          className="bg-primary hover:bg-primary text-white font-bold rounded-full w-12 h-12 p-0 flex items-center justify-center shadow-lg active:scale-90"
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

                  <canvas ref={canvasRef} className="hidden" />

                  <div className="bg-muted border border-border rounded-xl p-3 h-36 overflow-y-auto font-mono text-[10px] text-primary/90 flex flex-col gap-1 shadow-inner">
                    <div className="flex items-center gap-1.5 text-muted-foreground border-b border-border pb-1 mb-1">
                      <Terminal className="w-3.5 h-3.5" />
                      <span>LOGS DETALLADOS VEHICULARES</span>
                    </div>
                    {ocrLogs.map((log, index) => (
                      <div key={index} className="leading-relaxed">{log}</div>
                    ))}
                  </div>
                </motion.div>
              ) : (
                <form onSubmit={handleSave} className="space-y-4 pt-2">
                  
                  {/* Tarjeta de Circulación Photo / Upload picker */}
                  <div className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3.5">
                    <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground font-black">Tarjeta de Circulación (OCR)</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => startCamera("CIRCULACION")}
                        className="border-border bg-card hover:bg-accent text-foreground text-xs rounded-xl flex items-center justify-center gap-1.5 h-11 cursor-pointer"
                      >
                        <Camera className="w-4 h-4 text-primary" /> Tomar Foto
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => circFileRef.current?.click()}
                        className="border-border bg-card hover:bg-accent text-foreground text-xs rounded-xl flex items-center justify-center gap-1.5 h-11 cursor-pointer"
                      >
                        <FolderOpen className="w-4 h-4 text-primary" /> Subir Archivo
                      </Button>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={circFileRef}
                        onChange={(e) => handleFileChange(e, "CIRCULACION")}
                      />
                      <button
                        type="button"
                        onClick={() => triggerOcrScanDemo("CIRCULACION")}
                        className="col-span-2 text-[9px] text-muted-foreground hover:text-foreground font-bold uppercase tracking-wider text-center pt-0.5"
                      >
                        Simular Tarjeta Demo
                      </button>
                    </div>
                  </div>

                  {/* Seguro Photo / Upload picker */}
                  <div className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3.5">
                    <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground font-black">Póliza de Seguro (OCR)</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => startCamera("SEGURO")}
                        className="border-border bg-card hover:bg-accent text-foreground text-xs rounded-xl flex items-center justify-center gap-1.5 h-11 cursor-pointer"
                      >
                        <Camera className="w-4 h-4 text-primary" /> Tomar Foto
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => insFileRef.current?.click()}
                        className="border-border bg-card hover:bg-accent text-foreground text-xs rounded-xl flex items-center justify-center gap-1.5 h-11 cursor-pointer"
                      >
                        <FolderOpen className="w-4 h-4 text-primary" /> Subir Archivo
                      </Button>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={insFileRef}
                        onChange={(e) => handleFileChange(e, "SEGURO")}
                      />
                      <button
                        type="button"
                        onClick={() => triggerOcrScanDemo("SEGURO")}
                        className="col-span-2 text-[9px] text-muted-foreground hover:text-foreground font-bold uppercase tracking-wider text-center pt-0.5"
                      >
                        Simular Seguro Demo
                      </button>
                    </div>
                  </div>

                  <div className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3">
                    <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground font-black">Datos del Vehículo</h4>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="min-w-0">
                        <Label htmlFor="brand" className="text-muted-foreground text-xs">Marca</Label>
                        <Input id="brand" value={brand} onChange={(e) => setBrand(e.target.value)} required placeholder="ej. Nissan" className="border-input bg-background rounded-xl w-full min-w-0" />
                      </div>
                      <div className="min-w-0">
                        <Label htmlFor="vName" className="text-muted-foreground text-xs">Vehículo / Submarca</Label>
                        <Input id="vName" value={vehicleName} onChange={(e) => setVehicleName(e.target.value)} required placeholder="ej. Versa" className="border-input bg-background rounded-xl w-full min-w-0" />
                      </div>
                      <div className="min-w-0">
                        <Label htmlFor="model" className="text-muted-foreground text-xs">Modelo (Año)</Label>
                        <Input id="model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="ej. 2022" className="border-input bg-background rounded-xl w-full min-w-0" />
                      </div>
                      <div className="min-w-0">
                        <Label htmlFor="classType" className="text-muted-foreground text-xs">Clase / Tipo</Label>
                        <Input id="classType" value={classType} onChange={(e) => setClassType(e.target.value)} placeholder="ej. Sedán" className="border-input bg-background rounded-xl w-full min-w-0" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3">
                    <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground font-black">Identificación & Vigencias</h4>
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 gap-3">
                        <div className="min-w-0">
                          <Label htmlFor="plate" className="text-muted-foreground text-xs">Placa</Label>
                          <Input id="plate" value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)} placeholder="ej. 982-WXY" required className="border-input bg-background rounded-xl w-full min-w-0" />
                          {isPlateLengthInvalid && (
                            <span className="text-[10px] text-amber-400 flex items-center gap-1 mt-1">
                              <AlertTriangle className="w-3.5 h-3.5" /> Placa corta o inusual.
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <Label htmlFor="vin" className="text-muted-foreground text-xs">NIV / Serie</Label>
                          <Input id="vin" value={vin} onChange={(e) => setVin(e.target.value)} placeholder="17 caracteres" className="border-input bg-background rounded-xl w-full min-w-0" />
                          {isVinLengthInvalid && (
                            <span className="text-[10px] text-amber-400 flex items-center gap-1 mt-1 font-semibold">
                              <AlertTriangle className="w-3.5 h-3.5" /> El NIV debe tener 17 caracteres (leídos: {vin.length}).
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <Label htmlFor="circExp" className="text-muted-foreground text-xs">Vigencia Tarjeta Circulación</Label>
                        <Input type="date" id="circExp" value={circulationExpirationDate} onChange={(e) => setCirculationExpirationDate(e.target.value)} className="border-input bg-background rounded-xl w-full min-w-0" />
                      </div>
                      <div className="min-w-0">
                        <Label htmlFor="rentCost" className="text-muted-foreground text-xs">Costo Renta Semanal ($)</Label>
                        <Input type="number" id="rentCost" value={rentCost || ""} onChange={(e) => setRentCost(Number(e.target.value))} className="border-input bg-background rounded-xl w-full min-w-0" placeholder="ej. 2500" required />
                      </div>
                    </div>
                  </div>

                  <div className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3">
                    <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground font-black">Póliza de Seguro</h4>
                    <div className="space-y-3">
                      <div className="min-w-0">
                        <Label htmlFor="insExp" className="text-muted-foreground text-xs">Vigencia del Seguro</Label>
                        <Input type="date" id="insExp" value={insuranceExpirationDate} onChange={(e) => setInsuranceExpirationDate(e.target.value)} className="border-input bg-background rounded-xl w-full min-w-0" />
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">Foto de Póliza</Label>
                        <div className="border border-dashed border-border rounded-xl p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors">
                          {insurancePolicyImg ? (
                            <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400 font-semibold">
                              <CheckCircle2 className="w-4 h-4" /> Seguro Escaneado Correctamente
                            </div>
                          ) : (
                            <div className="text-muted-foreground text-xs flex flex-col items-center gap-1">
                              <Shield className="w-6 h-6 text-muted-foreground/80 mb-1" />
                              <span>Póliza no cargada</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button type="submit" className="w-full rounded-xl bg-primary text-white font-bold hover:bg-primary transition-all cursor-pointer" disabled={isScanning}>
                    Guardar Vehículo
                  </Button>
                </form>
              )}
            </AnimatePresence>
          </DialogContent>
        </Dialog>
      </div>

      {/* Verification Schedule Visual Grid */}
      <Card className="border-border bg-card/30 overflow-hidden">
        <CardHeader className="p-3.5 pb-2">
          <CardTitle className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 font-black">
            <Calendar className="w-4 h-4 text-primary" />
            Calendario de Verificación CDMX / Edomex
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3.5 pt-0 space-y-2">
          <div className="grid grid-cols-5 gap-1 text-[9px] font-bold text-center">
            {schedules.map((sch, idx) => (
              <div key={idx} className="space-y-1">
                <div className={`py-1.5 rounded-md ${sch.bg} font-black shadow-xs`}>
                  {sch.color}
                </div>
                <div className="text-muted-foreground text-[8px] font-mono leading-none">{sch.digits}</div>
                <div className="text-muted-foreground font-medium scale-90 leading-tight">{sch.months.split("/")[0]}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>



      <div className="space-y-3">
        {filteredVehicles.map((vehicle) => {
          const schedule = getVerificationSchedule(vehicle.plate_number);
          
          // 1. Last service calculation
          const vehicleMaints = maintenances.filter((m) => m.vehicle_id === vehicle.id);
          const lastMaint = vehicleMaints.length > 0
            ? [...vehicleMaints].sort((a, b) => new Date(b.maintenance_date).getTime() - new Date(a.maintenance_date).getTime())[0]
            : null;
          const lastServiceDate = lastMaint ? lastMaint.maintenance_date : "Sin registros";
          
          // 2. Mileage calculation
          const vehicleChecklists = checklists.filter((c) => c.vehicle_id === vehicle.id);
          const lastChecklist = vehicleChecklists.length > 0
            ? [...vehicleChecklists].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
            : null;
          const mileage = lastChecklist ? `${lastChecklist.mileage} km` : "Sin registros";
          
          // 3. Verification status check
          let verificationStatus = "Pendiente";
          if (typeof window !== "undefined") {
            const completed = JSON.parse(localStorage.getItem("fleet_completed_alerts") || "[]");
            if (completed.includes(`alert-ver-${vehicle.id}`)) {
              verificationStatus = "Verificado (Al corriente)";
            }
          }
          
          // 4. Rent status check (si está pagada)
          let rentStatusText = "Sin chofer";
          let rentStatusColor = "text-muted-foreground";
          if (vehicle.active_driver_id) {
            const d = new Date();
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(d.setDate(diff));
            const currentMondayStr = monday.toISOString().split("T")[0];
            
            const activeRent = weeklyRentals.find(
              (r) => r.driver_id === vehicle.active_driver_id && r.week_start === currentMondayStr
            );
            if (activeRent) {
              if (activeRent.status === "PAID") {
                rentStatusText = "Al corriente (Pagada)";
                rentStatusColor = "text-emerald-400 font-bold";
              } else if (activeRent.status === "PARTIAL") {
                rentStatusText = "Abono Parcial";
                rentStatusColor = "text-amber-400 font-bold";
              } else {
                rentStatusText = "Pendiente de Pago";
                rentStatusColor = "text-red-400 font-bold";
              }
            } else {
              rentStatusText = "Sin cobro generado";
              rentStatusColor = "text-muted-foreground font-medium";
            }
          }

          return (
            <Card key={vehicle.id} className="border-border bg-card/30 overflow-hidden hover:bg-card/45 hover:border-border/80 transition-all duration-200">
              <CardHeader className="p-4 pb-2.5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-muted border border-border rounded-xl">
                      <Car className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold text-foreground">{`${vehicle.brand} ${vehicle.vehicle_name} ${vehicle.model}`}</CardTitle>
                      <CardDescription className="text-2xs font-mono font-bold text-muted-foreground tracking-wide pt-0.5">{vehicle.vin}</CardDescription>
                      <div className="mt-1 text-[10px] font-bold">
                        {vehicle.active_driver_id ? (
                          <span className="text-primary dark:text-blue-400">
                            Asignado a: {getDriverName(vehicle.active_driver_id)}
                          </span>
                        ) : (
                          <span className="text-amber-500">
                            Disponible (En Patio)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 text-xs font-black font-mono tracking-wide border border-border bg-card/80 text-foreground rounded-lg shadow-sm">
                      {vehicle.plate_number}
                    </span>
                    <Button
                      onClick={() => handleDeleteVehicle(vehicle.id)}
                      variant="ghost"
                      className="p-1.5 h-auto text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg cursor-pointer shrink-0"
                      title="Eliminar Vehículo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-3.5 pt-2 text-xs space-y-2 border-t border-border bg-muted/20">
                <div className="grid grid-cols-2 gap-x-2 gap-y-2 text-muted-foreground">
                  <div>
                    <span className="font-semibold block text-[10px] uppercase tracking-wider text-muted-foreground/80">Chofer Asignado</span>
                    <span className="font-semibold text-foreground">
                      {getDriverName(vehicle.active_driver_id)}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold block text-[10px] uppercase tracking-wider text-muted-foreground/80">Clase / Tipo</span>
                    <span className="text-foreground font-medium">{vehicle.class_type || "Sedán"}</span>
                  </div>
                  <div>
                    <span className="font-semibold block text-[10px] uppercase tracking-wider text-muted-foreground/80">Engomado Verificación</span>
                    <span className="flex items-center gap-1.5 font-semibold text-foreground">
                      <span className="w-2.5 h-2.5 rounded-full border border-black/20 inline-block" style={{
                        backgroundColor: schedule.color === "Amarillo" ? "#eab308" :
                                        schedule.color === "Rosa" ? "#ec4899" :
                                        schedule.color === "Rojo" ? "#ef4444" :
                                        schedule.color === "Verde" ? "#22c55e" : "#3b82f6"
                      }} />
                      {schedule.color}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold block text-[10px] uppercase tracking-wider text-muted-foreground/80">Seguro Vigente</span>
                    <span className="flex items-center gap-1 text-foreground font-medium">
                      <Shield className="w-3.5 h-3.5 text-primary" />
                      {vehicle.insurance_expiration_date || "No registrada"}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold block text-[10px] uppercase tracking-wider text-muted-foreground/80">Último Servicio</span>
                    <span className="text-foreground font-medium">{lastServiceDate}</span>
                  </div>
                  <div>
                    <span className="font-semibold block text-[10px] uppercase tracking-wider text-muted-foreground/80">Kilometraje</span>
                    <span className="text-foreground font-medium">{mileage}</span>
                  </div>
                  <div>
                    <span className="font-semibold block text-[10px] uppercase tracking-wider text-muted-foreground/80">Estatus Verificación</span>
                    <span className={`font-semibold ${verificationStatus === "Verificado (Al corriente)" ? "text-emerald-400" : "text-amber-500"}`}>
                      {verificationStatus}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold block text-[10px] uppercase tracking-wider text-muted-foreground/80">Renta Semanal</span>
                    <span className={rentStatusColor}>{rentStatusText}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredVehicles.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No se encontraron vehículos.
          </div>
        )}
      </div>
    </div>
  );
}
