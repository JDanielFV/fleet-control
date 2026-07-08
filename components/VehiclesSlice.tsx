"use client";

import React, { useState, useEffect, useRef } from "react";
import { db, Vehicle, getVerificationSchedule, Driver, Maintenance, Checklist, WeeklyRental } from "@/lib/db";
import { parseOcrText } from "@/lib/ocr";
import { formatDate, sortByDateDesc } from "@/lib/utils";
import { computeUsageStats } from "@/lib/usageStats";
import { getDriverName } from "@/lib/lookups";
import Tesseract from "tesseract.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Stepper } from "@/components/ui/stepper";
import { Car, FileText, CheckCircle2, AlertTriangle, Search, Shield, Trash2, Camera, FolderOpen, Pencil, RefreshCcw, Mic } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import SliceHeader from "@/components/SliceHeader";
import { VehiclesListSkeleton } from "@/components/ui/skeletons";
import { useOcrScanner } from "@/components/useOcrScanner";
import ScannerViewfinder from "@/components/ScannerViewfinder";

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
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [weeklyRentals, setWeeklyRentals] = useState<WeeklyRental[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [expandedVehicleLogs, setExpandedVehicleLogs] = useState<Record<string, boolean>>({});
  const [expandedVehicleDetails, setExpandedVehicleDetails] = useState<Record<string, boolean>>({});

  const toggleLogs = (vehicleId: string) => {
    setExpandedVehicleLogs(prev => ({
      ...prev,
      [vehicleId]: !prev[vehicleId]
    }));
  };

  const toggleVehicleDetails = (vehicleId: string) => {
    setExpandedVehicleDetails(prev => ({
      ...prev,
      [vehicleId]: !prev[vehicleId]
    }));
  };

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
  const [rentCost, setRentCost] = useState<number>(2500);
  const [nextServiceMileage, setNextServiceMileage] = useState<string>("");
  const [color, setColor] = useState("");

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

  useEffect(() => {
    let isStale = false;
    (async () => {
      const [list, dList, mList, cList, rList] = await Promise.all([
        db.getVehicles(),
        db.getDrivers(),
        db.getMaintenances(),
        db.getChecklists(),
        db.getWeeklyRentals(),
      ]);
      if (isStale) return;
      setVehicles(list);
      setDrivers(dList);
      setMaintenances(mList);
      setChecklists(cList);
      setWeeklyRentals(rList);
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
      const [list, dList, mList, cList, rList] = await Promise.all([
        db.getVehicles(),
        db.getDrivers(),
        db.getMaintenances(),
        db.getChecklists(),
        db.getWeeklyRentals(),
      ]);
      if (isStale) return;
      setVehicles(list);
      setDrivers(dList);
      setMaintenances(mList);
      setChecklists(cList);
      setWeeklyRentals(rList);
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

    await db.saveVehicle({
      id: editingVehicleId || undefined,
      brand,
      vehicle_name: vehicleName,
      model,
      class_type: classType,
      color: color.trim() || null,
      circulation_expiration_date: circulationExpirationDate,
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
                    <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground font-black">Datos del Vehículo</h4>
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
                    <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground font-black">Identificación & Vigencias</h4>
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                    <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground font-black">Póliza de Seguro</h4>
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



      <div className="space-y-3">
        {isLoading ? (
          <VehiclesListSkeleton count={3} />
        ) : (
          filteredVehicles.map((vehicle) => {
          const schedule = getVerificationSchedule(vehicle.plate_number);
          
          // 1. Last service calculation
          const vehicleMaints = maintenances.filter((m) => m.vehicle_id === vehicle.id);
          const lastMaint = vehicleMaints.length > 0
            ? sortByDateDesc(vehicleMaints, "maintenance_date")[0]
            : null;
          const lastServiceDate = lastMaint ? lastMaint.maintenance_date : "Sin registros";
          
          // 2. Mileage calculation
          const vehicleChecklists = checklists.filter((c) => c.vehicle_id === vehicle.id);
          const lastChecklist = vehicleChecklists.length > 0
            ? sortByDateDesc(vehicleChecklists, "created_at")[0]
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

          // 3b. Usage stats — weekly km, km/day and 4-week rolling average.
          // The last 4 weeks' km/day average is what we surface as the
          // "media de uso mensual" in the expanded details tab.
          const { weeks: usageWeeks, monthlyAverage: monthlyUsageAverage } = computeUsageStats(vehicleChecklists);
          const latestWeek = usageWeeks.length > 0 ? usageWeeks[usageWeeks.length - 1] : null;
          
          // 4. Next service prediction formula based on checklists and average daily mileage
          const currentKm = lastChecklist ? lastChecklist.mileage : 0;
          const targetKm = vehicle.next_service_mileage || null;
          
          let nextServiceText = "No programado";
          let nextServiceEstimate = "N/D";
          let isServiceOverdue = false;
          let daysToService = 0;

          if (targetKm) {
            nextServiceText = `${targetKm.toLocaleString()} km`;
            
            // Calculate average daily usage
            let averageDailyKm = 80; // default typical daily mileage for taxi/uber fleet (e.g. 80km/day)
            if (vehicleChecklists.length >= 2) {
              const sortedChecklists = [...vehicleChecklists].sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
              const first = sortedChecklists[0];
              const last = sortedChecklists[sortedChecklists.length - 1];
              const kmDiff = last.mileage - first.mileage;
              const daysDiff = (new Date(last.created_at).getTime() - new Date(first.created_at).getTime()) / (1000 * 60 * 60 * 24);
              if (daysDiff > 0 && kmDiff > 0) {
                averageDailyKm = kmDiff / daysDiff;
              }
            }

            if (currentKm >= targetKm) {
              isServiceOverdue = true;
              const diff = currentKm - targetKm;
              nextServiceEstimate = `Excedido por ${diff.toLocaleString()} km`;
            } else {
              const remainingKm = targetKm - currentKm;
              daysToService = Math.ceil(remainingKm / averageDailyKm);
              
              const estDate = new Date();
              estDate.setDate(estDate.getDate() + daysToService);
              nextServiceEstimate = estDate.toLocaleDateString("es-MX", {
                day: "numeric",
                month: "short",
                year: "numeric"
              });
            }
          }

          // 5. Rent status check (si está pagada)
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
            <Card 
              key={vehicle.id} 
              onClick={() => onOpenActionSheet(vehicle, "vehicle")}
              className="border-border bg-card/30 overflow-hidden hover:bg-card/45 hover:border-border/80 transition-all duration-200 cursor-pointer active:scale-[0.99]"
            >
              <CardHeader className="p-4 pb-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="p-2.5 bg-muted border border-border rounded-xl shrink-0">
                      <Car className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-sm font-bold text-foreground truncate">{`${vehicle.brand} ${vehicle.vehicle_name} ${vehicle.model}`}</CardTitle>
                      <CardDescription className="text-2xs font-mono font-bold text-muted-foreground tracking-wide pt-0.5 truncate block">{vehicle.vin}</CardDescription>
                      <div className="mt-1 text-[10px] font-bold truncate">
                        {vehicle.active_driver_id ? (
                          <span className="text-primary dark:text-blue-400 truncate block">
                            Asignado a: {getDriverName(drivers, vehicle.active_driver_id)}
                          </span>
                        ) : (
                          <span className="text-amber-500">
                            Disponible (En Patio)
                          </span>
                        )}
                      </div>
                      {/* Alerta de revisión semanal de lunes */}
                      {(() => {
                        const d = new Date();
                        const day = d.getDay();
                        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                        const monday = new Date(d.setDate(diff));
                        monday.setHours(0, 0, 0, 0);

                        const hasThisWeeksChecklist = vehicleChecklists.some(
                          c => new Date(c.created_at) >= monday
                        );
                        // Only flag weekly review for assigned vehicles.
                        if (vehicle.active_driver_id && !hasThisWeeksChecklist) {
                          return (
                            <div className="mt-1.5 px-2 py-0.5 w-fit bg-amber-500/10 border border-amber-500/20 text-amber-500 dark:text-amber-400 text-[9px] font-extrabold rounded-md flex items-center gap-1 animate-pulse">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span>Revisión de Lunes Pendiente</span>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-2.5 py-1 text-xs font-black font-mono tracking-wide border border-border bg-card/80 text-foreground rounded-lg shadow-sm whitespace-nowrap">
                      {vehicle.plate_number}
                    </span>
                    <Button
                      onClick={(e) => { e.stopPropagation(); handleEditVehicle(vehicle); }}
                      variant="ghost"
                      size="sm"
                      className="text-primary hover:text-primary hover:bg-primary/10 text-xs gap-1.5"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </Button>
                    <Button
                      onClick={(e) => { e.stopPropagation(); handleDeleteVehicle(vehicle.id); }}
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-400 hover:bg-red-500/10 text-xs gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Eliminar
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <AnimatePresence initial={false}>
                {expandedVehicleDetails[vehicle.id] && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <CardContent className="px-4 pb-3.5 pt-2 text-xs space-y-2 border-t border-border bg-muted/20">
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-2 gap-y-2 text-muted-foreground">
                        <div className="min-w-0">
                          <span className="font-semibold block text-[10px] uppercase tracking-wider text-muted-foreground/80">Chofer Asignado</span>
                          <span className="font-semibold text-foreground truncate block">
                            {getDriverName(drivers, vehicle.active_driver_id)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold block text-[10px] uppercase tracking-wider text-muted-foreground/80">Clase / Tipo</span>
                          <span className="text-foreground font-medium truncate block">{vehicle.class_type || "Sedán"}</span>
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold block text-[10px] uppercase tracking-wider text-muted-foreground/80">Color</span>
                          <span className="text-foreground font-medium truncate block">{vehicle.color || "Sin registrar"}</span>
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold block text-[10px] uppercase tracking-wider text-muted-foreground/80">Engomado</span>
                          <span className="flex items-center gap-1.5 font-semibold text-foreground truncate">
                            <span className="w-2.5 h-2.5 rounded-full border border-black/20 inline-block shrink-0" style={{
                              backgroundColor: schedule.color === "Amarillo" ? "#eab308" :
                                              schedule.color === "Rosa" ? "#ec4899" :
                                              schedule.color === "Rojo" ? "#ef4444" :
                                              schedule.color === "Verde" ? "#22c55e" : "#3b82f6"
                            }} />
                            <span className="truncate">{schedule.color}</span>
                          </span>
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold block text-[10px] uppercase tracking-wider text-muted-foreground/80">Vence Circ.</span>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-foreground font-medium truncate">{vehicle.circulation_expiration_date || "—"}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRenewDocument(vehicle, "CIRCULACION"); }}
                              className="text-[9px] font-bold uppercase tracking-wider text-primary hover:text-primary/80 hover:underline flex items-center gap-0.5 shrink-0"
                            >
                              <RefreshCcw className="w-3 h-3" /> Renovar
                            </button>
                          </div>
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold block text-[10px] uppercase tracking-wider text-muted-foreground/80">Vence Póliza</span>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Shield className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span className="text-foreground font-medium truncate">{vehicle.insurance_expiration_date || "—"}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRenewDocument(vehicle, "SEGURO"); }}
                              className="text-[9px] font-bold uppercase tracking-wider text-primary hover:text-primary/80 hover:underline flex items-center gap-0.5 shrink-0"
                            >
                              <RefreshCcw className="w-3 h-3" /> Renovar
                            </button>
                          </div>
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold block text-[10px] uppercase tracking-wider text-muted-foreground/80">Últ. Servicio</span>
                          <span className="text-foreground font-medium truncate block">{lastServiceDate}</span>
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold block text-[10px] uppercase tracking-wider text-muted-foreground/80">Kilometraje</span>
                          <span className="text-foreground font-medium truncate block">{mileage}</span>
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold block text-[10px] uppercase tracking-wider text-muted-foreground/80 font-black">Próx. Servicio</span>
                          <span className={`font-semibold truncate block ${isServiceOverdue ? "text-amber-500 animate-pulse font-bold" : "text-foreground font-medium"}`}>{nextServiceText}</span>
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold block text-[10px] uppercase tracking-wider text-muted-foreground/80 font-black">Est. Fecha</span>
                          <span className={`font-semibold flex items-center gap-1 min-w-0 ${isServiceOverdue ? "text-red-400 font-extrabold" : "text-foreground font-medium"}`}>
                            {isServiceOverdue && <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                            <span className="truncate">{nextServiceEstimate}</span>
                          </span>
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold block text-[10px] uppercase tracking-wider text-muted-foreground/80">Verificación</span>
                          <span className={`font-semibold truncate block ${verificationStatus === "Verificado (Al corriente)" ? "text-emerald-400" : "text-amber-500"}`}>
                            {verificationStatus}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold block text-[10px] uppercase tracking-wider text-muted-foreground/80">Renta</span>
                          <span className={`truncate block ${rentStatusColor}`}>{rentStatusText}</span>
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold block text-[10px] uppercase tracking-wider text-muted-foreground/80">Uso Semanal (km/día)</span>
                          <span className="text-foreground font-medium truncate block">
                            {latestWeek ? `${Math.round(latestWeek.kmPerDay).toLocaleString()} km/día` : "—"}
                          </span>
                          {latestWeek && (
                            <span className="text-[9px] text-muted-foreground/80 font-medium block truncate">
                              {latestWeek.km.toLocaleString()} km en la semana
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold block text-[10px] uppercase tracking-wider text-muted-foreground/80">Media de Uso Mensual</span>
                          <span className="text-foreground font-medium truncate block">
                            {monthlyUsageAverage !== null
                              ? `${Math.round(monthlyUsageAverage).toLocaleString()} km/día`
                              : "—"}
                          </span>
                          {monthlyUsageAverage !== null && (
                            <span className="text-[9px] text-muted-foreground/80 font-medium block truncate">
                              Últimas 4 semanas
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="pt-2.5 border-t border-border mt-3 flex justify-between items-center" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[10px] text-muted-foreground font-semibold">
                          {vehicleChecklists.length} bitácoras / checklists
                        </span>
                        <Button
                          onClick={(e) => { e.stopPropagation(); toggleLogs(vehicle.id); }}
                          variant="ghost"
                          className="h-10 text-xs px-3 rounded-lg text-primary hover:bg-primary/10 font-bold flex items-center gap-1 cursor-pointer animate-pulse"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          {expandedVehicleLogs[vehicle.id] ? "Ocultar Historial" : "Ver Historial"}
                        </Button>
                      </div>

                      <AnimatePresence initial={false}>
                        {expandedVehicleLogs[vehicle.id] && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
                            className="overflow-hidden"
                          >
                            <div className="mt-3 pt-3 border-t border-border/80 space-y-2 max-h-[200px] overflow-y-auto pr-1">
                              {vehicleChecklists.length === 0 ? (
                                <p className="text-2xs text-muted-foreground italic text-center py-2">No hay checklists registrados aún.</p>
                              ) : (
                                sortByDateDesc(vehicleChecklists, "created_at")
                                  .map((c) => (
                                    <div key={c.id} className="p-2 rounded-lg bg-muted/40 border border-border/40 text-2xs space-y-1.5">
                                      <div className="flex justify-between items-center">
                                        <span className="font-bold text-foreground/90 uppercase tracking-wide">
                                          {c.type === "WEEKLY_START" ? "Semanal" : "Entrega"}
                                        </span>
                                        <span className="text-muted-foreground font-medium">
                                          {formatDate(c.created_at)}
                                        </span>
                                      </div>
                                      <div className="grid grid-cols-2 gap-x-2 text-muted-foreground">
                                        <span>KM: <strong className="text-foreground">{c.mileage} km</strong></span>
                                        <span>Gas: <strong className="text-foreground">{c.gasoline_level}</strong></span>
                                      </div>
                                      {c.irregularities && (
                                        <p className="text-[10px] text-amber-500/90 font-medium">
                                          <span className="font-bold">Incidencia:</span> {c.irregularities}
                                        </p>
                                      )}
                                    </div>
                                  ))
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="px-4 py-2 border-t border-border/60 flex justify-end bg-muted/10" onClick={(e) => e.stopPropagation()}>
                <Button
                  onClick={(e) => { e.stopPropagation(); toggleVehicleDetails(vehicle.id); }}
                  variant="ghost"
                  className="h-10 text-xs px-3 rounded-lg text-primary hover:bg-primary/10 font-bold cursor-pointer"
                >
                  {expandedVehicleDetails[vehicle.id] ? "Ocultar Detalles" : "Ver Detalles"}
                </Button>
              </div>
            </Card>
          );
        })
        )}

        {!isLoading && filteredVehicles.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No se encontraron vehículos.
          </div>
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
                  <span className="text-[9px] font-black uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-md">
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
