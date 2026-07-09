"use client";

import React, { useState, useEffect, useRef } from "react";
import { db, Vehicle, Driver } from "@/lib/db";
import { parseOcrText } from "@/lib/ocr";
import { getDriverName } from "@/lib/lookups";
import Tesseract from "tesseract.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Stepper } from "@/components/ui/stepper";
import { Car, CheckCircle2, Search, Trash2, Camera, FolderOpen, Pencil, RefreshCcw, Mic, AlertTriangle, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import SliceHeader from "@/components/SliceHeader";
import { VehiclesListSkeleton } from "@/components/ui/skeletons";
import { useOcrScanner } from "@/components/useOcrScanner";
import ScannerViewfinder from "@/components/ScannerViewfinder";
import { uploadDocumentImage } from "@/lib/db/storage";
interface VehiclesSliceProps {
  onRefreshAlerts: () => void;
  searchQuery?: string;
  onOpenActionSheet: (entity: Driver | Vehicle, type: "driver" | "vehicle") => void;
  /** When true, the registration dialog opens automatically on mount. */
  autoOpen?: boolean;
  /** Called after the dialog is closed (to clear the autoOpen flag). */
  onAutoOpenConsumed?: () => void;
}

export default function VehiclesSlice({ onRefreshAlerts, searchQuery, onOpenActionSheet, autoOpen, onAutoOpenConsumed }: VehiclesSliceProps) {

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  const handleEditVehicle = (v: Vehicle) => {
    setEditingVehicleId(v.id);
    setBrand(v.brand);
    setVehicleName(v.vehicle_name);
    setModel(v.model);
    setClassType(v.class_type);
    setCirculationExpirationDate(v.circulation_expiration_date ?? "");
    setCirculationImg(v.circulation_img ?? "");
    setVin(v.vin);
    setPlateNumber(v.plate_number);
    setInsurancePolicyImg(v.insurance_policy_img);
    setInsuranceExpirationDate(v.insurance_expiration_date ?? "");
    setRentCost(v.rent_cost);
    setNextServiceMileage(v.next_service_mileage?.toString() ?? "");
    setColor(v.color ?? "");
    setIsOpen(true);
  };

  const handleRenewDocument = (v: Vehicle, target: "CIRCULACION" | "SEGURO") => {
    setRenewingVehicle(v);
    setRenewTarget(target);
    setRenewExpirationDate((target === "CIRCULACION" ? v.circulation_expiration_date : v.insurance_expiration_date) ?? "");
    setRenewPolicyImg(target === "SEGURO" ? v.insurance_policy_img : "");
    setIsRenewOpen(true);
  };

  const submitRenewal = async () => {
    if (!renewingVehicle) return;
    const patch: Partial<Vehicle> = {};
    if (renewTarget === "CIRCULACION") {
      patch.circulation_expiration_date = renewExpirationDate;
    } else {
      patch.insurance_expiration_date = renewExpirationDate;
      if (renewPolicyImg) patch.insurance_policy_img = renewPolicyImg;
    }
    await db.saveVehicle({ ...renewingVehicle, ...patch });
    setIsRenewOpen(false);
    setRenewingVehicle(null);
    setRenewTarget(null);
    setRenewExpirationDate("");
    setRenewPolicyImg("");
    loadData();
    onRefreshAlerts();
  };

  // Sync external search query into local filter without synchronous setState.
  useEffect(() => {
    if (searchQuery === undefined) return;
    Promise.resolve().then(() => {
      setSearch((prev) => (prev === searchQuery ? prev : searchQuery));
    });
  }, [searchQuery]);

  const [isOpen, setIsOpen] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [isRenewOpen, setIsRenewOpen] = useState(false);
  const [renewingVehicle, setRenewingVehicle] = useState<Vehicle | null>(null);

  // Auto-open the registration dialog when the parent sets autoOpen=true.
  useEffect(() => {
    if (autoOpen && !isOpen) {
      setIsOpen(true);
      onAutoOpenConsumed?.();
    }
  }, [autoOpen]);

  // Section tracker for the Stepper. Click any step to scroll that
  // section into view; the active step updates as the user scrolls.
  // Lives right after `isOpen` because the observer depends on it.
  const [activeSection, setActiveSection] = useState<string>("circ");
  const scrollToSection = React.useCallback((id: string) => {
    requestAnimationFrame(() => {
      document.getElementById(`section-${id}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      setActiveSection(id);
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const ids = ["circ", "seguro", "datos", "vig"];
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          const id = visible[0].target.id.replace(/^section-/, "");
          setActiveSection(id);
        }
      },
      {
        rootMargin: "-80px 0px -50% 0px",
        threshold: [0, 0.1, 0.5],
      }
    );
    for (const id of ids) {
      const el = document.getElementById(`section-${id}`);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [isOpen]);
  const [renewTarget, setRenewTarget] = useState<"CIRCULACION" | "SEGURO" | null>(null);
  const [renewExpirationDate, setRenewExpirationDate] = useState("");
  const [renewPolicyImg, setRenewPolicyImg] = useState("");

  // Refs for hidden inputs
  const circFileRef = useRef<HTMLInputElement>(null);
  const insFileRef = useRef<HTMLInputElement>(null);

  // Camera + OCR progress state shared with DriversSlice via useOcrScanner.
  const scanner = useOcrScanner<"CIRCULACION" | "SEGURO">({
    onFrame: (dataUrl, target) => processOcrOnImageSource(dataUrl, target),
  });
  const {
    setOcrStep,
    setOcrLogs,
    isScanning,
    setIsScanning,
    setScanTarget,
    startCamera,
    stopCamera,
  } = scanner;

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
  const [circulationImg, setCirculationImg] = useState("");
  const [rentCost, setRentCost] = useState<number>(2500);
  const [nextServiceMileage, setNextServiceMileage] = useState<string>("");
  const [color, setColor] = useState("");

  const loadData = async () => {
    const list = await db.getVehicles();
    const dList = await db.getDrivers();
    setVehicles(list);
    setDrivers(dList);
  };

  useEffect(() => {
    let isStale = false;
    (async () => {
      const [list, dList] = await Promise.all([
        db.getVehicles(),
        db.getDrivers(),
      ]);
      if (isStale) return;
      setVehicles(list);
      setDrivers(dList);
      setIsLoading(false);
    })();
    return () => {
      isStale = true;
    };
  }, []);

  // Reload when parent signals a refresh.
  useEffect(() => {
    let isStale = false;
    (async () => {
      const [list, dList] = await Promise.all([
        db.getVehicles(),
        db.getDrivers(),
      ]);
      if (isStale) return;
      setVehicles(list);
      setDrivers(dList);
      setIsLoading(false);
    })();
    return () => {
      isStale = true;
    };
  }, [onRefreshAlerts]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand || !vehicleName || !plateNumber) {
      alert("Por favor completa los campos obligatorios (*)");
      return;
    }

    const formattedPlate = plateNumber.toUpperCase().trim();
    const formattedVin = vin.toUpperCase().trim();

    // Prevent duplicates matching plates or serial (VIN) — skip the current edited vehicle
    const plateExists = vehicles.some((v) => v.plate_number === formattedPlate && v.id !== editingVehicleId);
    const vinExists = vin && vehicles.some((v) => v.vin === formattedVin && v.id !== editingVehicleId);

    if (plateExists) {
      alert(`Error: Ya existe un auto registrado con las placas "${formattedPlate}".`);
      return;
    }
    if (vinExists) {
      alert(`Error: Ya existe un auto registrado con el número de serie (VIN) "${formattedVin}".`);
      return;
    }

    const circUrl = circulationImg ? await uploadDocumentImage(circulationImg, "circulation") : null;

    await db.saveVehicle({
      id: editingVehicleId || undefined,
      brand,
      vehicle_name: vehicleName,
      model,
      class_type: classType,
      color: color.trim() || null,
      circulation_expiration_date: circulationExpirationDate,
      circulation_img: circUrl,
      vin: formattedVin,
      plate_number: formattedPlate,
      insurance_policy_img: insurancePolicyImg,
      insurance_expiration_date: insuranceExpirationDate,
      active_driver_id: editingVehicleId
        ? vehicles.find((v) => v.id === editingVehicleId)?.active_driver_id ?? null
        : null,
      rent_cost: Number(rentCost),
      next_service_mileage: nextServiceMileage ? parseInt(nextServiceMileage) : null,
    });

    resetForm();
    setEditingVehicleId(null);
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
    setCirculationImg("");
    setRentCost(2500);
    setNextServiceMileage("");
    setColor("");
    setEditingVehicleId(null);
    stopCamera();
  };

  // (CSV export removed)

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
          setCirculationImg(imageSource);
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
        setCirculationImg(imageSource);
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

    } catch (err: unknown) {
      console.error("[OCR] Error al transcribir documento:", err);
      const errorMsg = `❌ [OCR] Fallo: ${err instanceof Error ? err.message : String(err)}`;
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

  const filteredVehicles = vehicles.filter(
    (v) =>
      `${v.brand} ${v.vehicle_name}`.toLowerCase().includes(search.toLowerCase()) ||
      v.plate_number.toLowerCase().includes(search.toLowerCase())
  );

  // Length warnings for inputs
  const isVinLengthInvalid = vin.length > 0 && vin.length !== 17;
  const isPlateLengthInvalid = plateNumber.length > 0 && (plateNumber.length < 5 || plateNumber.length > 10);

  return (
    <div className="space-y-4">
      {/* Header Row: Title on Left, Actions on Right */}
      <SliceHeader
        title="Vehículos"
        action={
          <Dialog open={isOpen} onOpenChange={(open) => {
            setIsOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="rounded-full bg-[#0088FF] hover:bg-[#0077EE] text-white text-sm font-bold px-6 h-11 border-none active:scale-95 transition-all cursor-pointer flex items-center justify-center shadow-xs">
                Registrar vehículo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md md:max-w-2xl max-h-[90vh] overflow-y-auto border border-border bg-background text-foreground rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-foreground font-black text-lg">
                {editingVehicleId ? "Editar Vehículo" : "Registro de Vehículo"}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                {editingVehicleId
                  ? "Modifica los datos del vehículo. Los cambios se aplican al instante."
                  : "Ingresa datos o usa OCR de la tarjeta de circulación y póliza."}
              </DialogDescription>
            </DialogHeader>

            {/* Section overview — same Stepper pattern as DriversSlice */}
            <div className="pt-2 pb-1">
              <Stepper
                steps={[
                  { id: "circ", label: "Circulación" },
                  { id: "seguro", label: "Seguro" },
                  { id: "datos", label: "Datos" },
                  { id: "vig", label: "Vigencias" },
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
                    scan: "Analizando marcas...",
                    extract: "Generando bloques de texto...",
                    logsHeader: "LOGS DETALLADOS VEHICULARES",
                  }}
                />
              ) : (
                <form onSubmit={handleSave} className="space-y-4 pt-2 flex flex-col max-h-[78vh]">
                  <div className="flex-1 overflow-y-auto pr-1.5 space-y-4 max-h-[62vh]">
                  
                  {/* Tarjeta de Circulación Photo / Upload picker */}
                  <div id="section-circ" className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3.5 scroll-mt-2">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground font-black">Tarjeta de Circulación (OCR)</h4>
                    {circulationImg && (
                      <div className="relative w-full h-20 rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center">
                        <Image src={circulationImg} alt="Tarjeta de Circulación" fill className="object-cover" />
                        <button
                          type="button"
                          onClick={() => setCirculationImg("")}
                          className="absolute top-1.5 right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md transition-all active:scale-90"
                          title="Eliminar Tarjeta de Circulación"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
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
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => triggerOcrScanDemo("CIRCULACION")}
                        className="col-span-2 text-xs text-muted-foreground hover:text-foreground font-bold uppercase tracking-wider text-center h-10"
                      >
                        Simular Tarjeta Demo
                      </Button>
                    </div>
                  </div>

                  {/* Seguro Photo / Upload picker */}
                  <div id="section-seguro" className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3.5 scroll-mt-2">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground font-black">Póliza de Seguro (OCR)</h4>
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
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => triggerOcrScanDemo("SEGURO")}
                        className="col-span-2 text-xs text-muted-foreground hover:text-foreground font-bold uppercase tracking-wider text-center h-10"
                      >
                        Simular Seguro Demo
                      </Button>
                    </div>
                  </div>

                  <div id="section-datos" className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3 scroll-mt-2">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground font-black">Datos del Vehículo</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

                  <div id="section-vig" className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3 scroll-mt-2">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground font-black">Identificación & Vigencias</h4>
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="min-w-0">
                          <Label htmlFor="plate" className="text-muted-foreground text-xs">Placa</Label>
                          <Input id="plate" value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)} placeholder="ej. 982-WXY" required className="border-input bg-background rounded-xl w-full min-w-0" />
                          {isPlateLengthInvalid && (
                            <span className="text-xs text-amber-400 flex items-center gap-1 mt-1">
                              <AlertTriangle className="w-3.5 h-3.5" /> Placa corta o inusual.
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <Label htmlFor="vin" className="text-muted-foreground text-xs">NIV / Serie</Label>
                          <Input id="vin" value={vin} onChange={(e) => setVin(e.target.value)} placeholder="17 caracteres" className="border-input bg-background rounded-xl w-full min-w-0" />
                          {isVinLengthInvalid && (
                            <span className="text-xs text-amber-400 flex items-center gap-1 mt-1 font-semibold">
                              <AlertTriangle className="w-3.5 h-3.5" /> El NIV debe tener 17 caracteres (leídos: {vin.length}).
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="min-w-0">
                          <Label htmlFor="circExp" className="text-muted-foreground text-xs">Vigencia Tarjeta Circulación</Label>
                          <Input type="date" id="circExp" value={circulationExpirationDate} onChange={(e) => setCirculationExpirationDate(e.target.value)} className="border-input bg-background rounded-xl w-full min-w-0" />
                        </div>
                        <div className="min-w-0">
                          <Label htmlFor="insExp" className="text-muted-foreground text-xs">Vigencia del Seguro</Label>
                          <Input type="date" id="insExp" value={insuranceExpirationDate} onChange={(e) => setInsuranceExpirationDate(e.target.value)} className="border-input bg-background rounded-xl w-full min-w-0" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="min-w-0">
                          <Label htmlFor="rentCost" className="text-muted-foreground text-xs">Costo Renta Semanal ($)</Label>
                          <Input type="number" id="rentCost" value={rentCost || ""} onChange={(e) => setRentCost(Number(e.target.value))} className="border-input bg-background rounded-xl w-full min-w-0" placeholder="ej. 2500" required />
                        </div>
                        <div className="min-w-0">
                          <Label htmlFor="nextService" className="text-muted-foreground text-xs">Kilometraje Próximo Servicio (km)</Label>
                          <Input type="number" id="nextService" value={nextServiceMileage} onChange={(e) => setNextServiceMileage(e.target.value)} className="border-input bg-background rounded-xl w-full min-w-0" placeholder="ej. 20000" />
                        </div>
                      </div>
                      <div className="min-w-0">
                        <Label htmlFor="color" className="text-muted-foreground text-xs">Color del Auto</Label>
                        <Input id="color" value={color} onChange={(e) => setColor(e.target.value)} className="border-input bg-background rounded-xl w-full min-w-0" placeholder="ej. Rojo, Blanco, Gris" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground font-black">Póliza de Seguro</h4>
                    <div className="space-y-3">
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

                  </div>

                  <Button type="submit" className="w-full rounded-xl bg-primary text-white font-bold hover:bg-primary transition-all cursor-pointer shrink-0" disabled={isScanning}>
                    Guardar Vehículo
                  </Button>
                </form>
              )}
            </AnimatePresence>
          </DialogContent>
        </Dialog>
        }
      />

    {/* iOS styled Search Bar */}
    <div className="bg-[#ECECEC] dark:bg-muted/70 rounded-full h-11 px-4 flex items-center gap-2 w-full shadow-inner mb-4 mt-2">
      <Search className="w-4 h-4 text-muted-foreground/60 shrink-0" />
      <input
        type="text"
        placeholder="Search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="flex-1 bg-transparent border-none text-foreground text-sm placeholder:text-muted-foreground/60 focus:outline-hidden"
      />
      <Mic className="w-4 h-4 text-muted-foreground/60 shrink-0 cursor-pointer" />
    </div>

      {/* Verification Schedule Visual Grid — removed */}



      <div className="w-full overflow-x-auto pb-6">
        {isLoading ? (
          <VehiclesListSkeleton count={4} />
        ) : (
          <>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/40">
                  <th className="text-left py-2.5 px-2 whitespace-nowrap">Auto</th>
                  <th className="text-left py-2.5 px-2 whitespace-nowrap">Placa</th>
                  <th className="text-left py-2.5 px-2 whitespace-nowrap">ID</th>
                  <th className="text-left py-2.5 px-2 whitespace-nowrap">Chofer</th>
                  <th className="text-right py-2.5 px-2 whitespace-nowrap">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredVehicles.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-muted-foreground italic">
                      No se encontraron vehículos.
                    </td>
                  </tr>
                ) : (
                  filteredVehicles.map((vehicle) => {
                    const vehicleId = vehicle.vin?.slice(-6).toUpperCase() || "—";
                    return (
                      <tr
                        key={vehicle.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => onOpenActionSheet(vehicle, "vehicle")}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onOpenActionSheet(vehicle, "vehicle");
                          }
                        }}
                        className="border-b border-border/20 hover:bg-muted/30 transition-colors cursor-pointer"
                      >
                        <td className="py-2.5 px-2">
                          <span className="font-bold text-foreground">{`${vehicle.brand} ${vehicle.vehicle_name} ${vehicle.model}`}</span>
                        </td>
                        <td className="py-2.5 px-2 font-mono font-bold text-foreground">
                          {vehicle.plate_number}
                        </td>
                        <td className="py-2.5 px-2 font-mono text-muted-foreground">
                          {vehicleId}
                        </td>
                        <td className="py-2.5 px-2">
                          {vehicle.active_driver_id ? (
                            <span className="text-primary font-semibold">
                              {getDriverName(drivers, vehicle.active_driver_id)}
                            </span>
                          ) : (
                            <span className="text-amber-500 font-semibold">Disponible</span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleEditVehicle(vehicle); }}
                              className="text-muted-foreground hover:text-primary text-xs gap-1 h-7 px-2"
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleDeleteVehicle(vehicle.id); }}
                              className="text-red-500 hover:text-red-400 hover:bg-red-500/10 text-xs gap-1 h-7 px-2"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* Documentos Section — shows circulation card and insurance policy with their vigencias */}
            {filteredVehicles.length > 0 && (
              <div className="mt-6 space-y-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Documentos de Vehículos</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredVehicles.map((vehicle) => {
                    const hasCirc = vehicle.circulation_img || vehicle.circulation_expiration_date;
                    const hasIns = vehicle.insurance_policy_img || vehicle.insurance_expiration_date;
                    if (!hasCirc && !hasIns) return null;
                    return (
                      <div key={vehicle.id} className="bg-muted/30 border border-border/60 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-foreground truncate">{vehicle.brand} {vehicle.vehicle_name} · {vehicle.plate_number}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {vehicle.circulation_img && (
                            <div className="relative h-16 rounded-lg overflow-hidden border border-border bg-card">
                              <Image src={vehicle.circulation_img} alt="Tarjeta de Circulación" fill className="object-cover" />
                            </div>
                          )}
                          {vehicle.insurance_policy_img && (
                            <div className="relative h-16 rounded-lg overflow-hidden border border-border bg-card">
                              <Image src={vehicle.insurance_policy_img} alt="Póliza de Seguro" fill className="object-cover" />
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-2xs">
                          <div>
                            <span className="text-muted-foreground font-semibold uppercase tracking-wider">Circ. vence</span>
                            <span className={`block font-bold ${vehicle.circulation_expiration_date && new Date(vehicle.circulation_expiration_date) < new Date() ? "text-red-400" : "text-foreground"}`}>
                              {vehicle.circulation_expiration_date || "—"}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground font-semibold uppercase tracking-wider">Seguro vence</span>
                            <span className={`block font-bold ${vehicle.insurance_expiration_date && new Date(vehicle.insurance_expiration_date) < new Date() ? "text-red-400" : "text-foreground"}`}>
                              {vehicle.insurance_expiration_date || "—"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Renewal Dialog — quick update of circulation card or insurance policy */}
      <Dialog open={isRenewOpen} onOpenChange={(o) => { setIsRenewOpen(o); if (!o) setRenewingVehicle(null); }}>
        <DialogContent className="max-w-sm md:max-w-md border border-border bg-background text-foreground rounded-2xl">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 shrink-0">
                <RefreshCcw className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-foreground font-black text-lg">
                    Renovar {renewTarget === "CIRCULACION" ? "Tarjeta de Circulación" : "Póliza de Seguro"}
                  </DialogTitle>
                  <span className="text-[11px] font-black uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-md">
                    Actualización
                  </span>
                </div>
                <DialogDescription className="text-muted-foreground text-xs">
                  {renewingVehicle
                    ? `${renewingVehicle.brand} ${renewingVehicle.vehicle_name} · ${renewingVehicle.plate_number}`
                    : "Cargando..."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {renewTarget === "SEGURO" && (
              <div>
                <Label className="text-muted-foreground text-xs">Foto de Póliza</Label>
                <div className="mt-1.5 border border-dashed border-border rounded-xl p-3 text-center">
                  {renewPolicyImg ? (
                    <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400 font-semibold">
                      <CheckCircle2 className="w-4 h-4" /> Póliza Cargada
                    </div>
                  ) : (
                    <div className="text-muted-foreground text-xs">
                      <Shield className="w-5 h-5 mx-auto mb-1 opacity-60" />
                      Sin cambios en imagen
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <Label className="text-muted-foreground text-xs">
                Nueva fecha de vigencia {renewTarget === "CIRCULACION" ? "de circulación" : "del seguro"}
              </Label>
              <Input
                type="date"
                value={renewExpirationDate}
                onChange={(e) => setRenewExpirationDate(e.target.value)}
                className="mt-1.5 border-input bg-background rounded-xl"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => { setIsRenewOpen(false); setRenewingVehicle(null); }}
                className="flex-1 rounded-xl border-border"
              >
                Cancelar
              </Button>
              <Button
                onClick={submitRenewal}
                disabled={!renewExpirationDate}
                className="flex-1 rounded-xl bg-primary text-white font-bold hover:bg-primary disabled:opacity-50"
              >
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
