"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { db, Vehicle, Driver, getVerificationSchedule, Checklist, Maintenance, Assignment, RenewalLog, WeeklyRental } from "@/lib/db";
import { parseOcrText } from "@/lib/ocr";
import { computeUsageStats } from "@/lib/usageStats";
import { getDriverName } from "@/lib/lookups";
import { getNextVerificationDate } from "@/lib/db/utils";
import Tesseract from "tesseract.js";
import { useOcrScanner } from "@/components/useOcrScanner";
import { uploadDocumentImage } from "@/lib/db/storage";
import { requirePasskeyConfirmation } from "@/lib/webauthn";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";

export interface UseVehiclesOptions {
  onRefreshAlerts: () => void;
  searchQuery?: string;
  onOpenActionSheet: (entity: Vehicle | Driver, type: "driver" | "vehicle") => void;
  autoOpen?: boolean;
  onAutoOpenConsumed?: () => void;
  onAssignVehicle?: (vehicleId: string) => void;
  externalWearPartVehicle?: Vehicle | null;
  refreshTrigger?: number;
}

export function useVehicles(options: UseVehiclesOptions) {
  const { onRefreshAlerts, searchQuery, onOpenActionSheet, autoOpen, onAutoOpenConsumed, onAssignVehicle, externalWearPartVehicle: extWearPartVehicle, refreshTrigger } = options;

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [weeklyRentals, setWeeklyRentals] = useState<WeeklyRental[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [expandedVehicleDetails, setExpandedVehicleDetails] = useState<Record<string, boolean>>({});

  const { toast } = useToast();
  const { confirm: showConfirm } = useConfirm();

  // --- Dialog state ---
  const [isOpen, setIsOpen] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [isRenewOpen, setIsRenewOpen] = useState(false);
  const [renewingVehicle, setRenewingVehicle] = useState<Vehicle | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [renewTarget, setRenewTarget] = useState<"CIRCULACION" | "SEGURO" | "VERIFICACION" | null>(null);
  const [renewExpirationDate, setRenewExpirationDate] = useState("");
  const [renewPolicyImg, setRenewPolicyImg] = useState("");

  // Wear part dialog
  const [wearPartOpen, setWearPartOpen] = useState(false);
  const [wearPartVehicleState, setWearPartVehicleState] = useState<Vehicle | null>(null);
  const [wearPartName, setWearPartName] = useState("");
  const [wearPartCost, setWearPartCost] = useState("");
  const [wearPartDate, setWearPartDate] = useState(new Date().toISOString().split("T")[0]);

  // Verification dialog
  const [verifOpen, setVerifOpen] = useState(false);
  const [verifVehicle, setVerifVehicle] = useState<Vehicle | null>(null);
  const [verifCompleted, setVerifCompleted] = useState(false);
  const [verifImg, setVerifImg] = useState("");
  const [verifDate, setVerifDate] = useState(new Date().toISOString().split("T")[0]);
  const verifFileRef = useRef<HTMLInputElement>(null);

  // Refs
  const circFileRef = useRef<HTMLInputElement>(null);
  const insFileRef = useRef<HTMLInputElement>(null);

  // Scanner
  const scanner = useOcrScanner<"CIRCULACION" | "SEGURO">({
    onFrame: (dataUrl, target) => processOcrOnImageSource(dataUrl, target),
  });
  const { setOcrStep, setOcrLogs, isScanning, setIsScanning, setScanTarget, startCamera, stopCamera } = scanner;

  // Form state
  const [brand, setBrand] = useState("");
  const [vehicleName, setVehicleName] = useState("");
  const [model, setModel] = useState("");
  const [classType, setClassType] = useState("");
  const [circulationExpirationDate, setCirculationExpirationDate] = useState("");
  const [vin, setVin] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [insurancePolicyImg, setInsurancePolicyImg] = useState("");
  const [insurancePolicyFiles, setInsurancePolicyFiles] = useState<string[]>([]);
  const [insuranceExpirationDate, setInsuranceExpirationDate] = useState("");
  const [circulationImg, setCirculationImg] = useState("");
  const [rentCost, setRentCost] = useState<number>(2500);
  const [nextServiceMileage, setNextServiceMileage] = useState<string>("");
  const [color, setColor] = useState("");
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState("");
  const [verificationExpirationDate, setVerificationExpirationDate] = useState("");

  // Stepper
  const [activeSection, setActiveSection] = useState<string>("circ");
  const scrollToSection = useCallback((id: string) => {
    requestAnimationFrame(() => {
      document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSection(id);
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const ids = ["circ", "seguro", "datos", "vig"];
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          const id = visible[0].target.id.replace(/^section-/, "");
          setActiveSection(id);
        }
      },
      { rootMargin: "-80px 0px -50% 0px", threshold: [0, 0.1, 0.5] }
    );
    for (const id of ids) {
      const el = document.getElementById(`section-${id}`);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [isOpen]);

  // Auto-open
  useEffect(() => {
    if (autoOpen && !isOpen) {
      setIsOpen(true);
      onAutoOpenConsumed?.();
    }
  }, [autoOpen, isOpen, onAutoOpenConsumed]);

  // External wear part trigger
  useEffect(() => {
    if (extWearPartVehicle) {
      setWearPartVehicleState(extWearPartVehicle);
      setWearPartName("");
      setWearPartCost("");
      setWearPartDate(new Date().toISOString().split("T")[0]);
      setWearPartOpen(true);
    }
  }, [extWearPartVehicle]);

  // Sync search
  useEffect(() => {
    if (searchQuery === undefined) return;
    Promise.resolve().then(() => {
      setSearch((prev) => (prev === searchQuery ? prev : searchQuery));
    });
  }, [searchQuery]);

  // Data loading
  const loadData = useCallback(async () => {
    const [list, dList, maints, assigns, cls, rents] = await Promise.all([
      showArchived ? db.getArchivedVehicles() : db.getVehicles(),
      db.getDrivers(),
      db.getMaintenances(),
      db.getAssignments(),
      db.getChecklists(),
      db.getWeeklyRentals(),
    ]);
    setVehicles(list);
    setDrivers(dList);
    setMaintenances(maints);
    setAssignments(assigns);
    setChecklists(cls);
    setWeeklyRentals(rents);
  }, [showArchived]);

  useEffect(() => {
    let isStale = false;
    (async () => {
      const [list, dList, maints, assigns, cls, rents] = await Promise.all([
        showArchived ? db.getArchivedVehicles() : db.getVehicles(),
        db.getDrivers(),
        db.getMaintenances(),
        db.getAssignments(),
        db.getChecklists(),
        db.getWeeklyRentals(),
      ]);
      if (isStale) return;
      setVehicles(list);
      setDrivers(dList);
      setMaintenances(maints);
      setAssignments(assigns);
      setChecklists(cls);
      setWeeklyRentals(rents);
      setIsLoading(false);
    })();
    return () => { isStale = true; };
  }, [showArchived]);

  useEffect(() => {
    let isStale = false;
    (async () => {
      const [list, dList, maints, assigns, cls, rents] = await Promise.all([
        db.getVehicles(),
        db.getDrivers(),
        db.getMaintenances(),
        db.getAssignments(),
        db.getChecklists(),
        db.getWeeklyRentals(),
      ]);
      if (isStale) return;
      setVehicles(list);
      setDrivers(dList);
      setMaintenances(maints);
      setAssignments(assigns);
      setChecklists(cls);
      setWeeklyRentals(rents);
      setIsLoading(false);
    })();
    return () => { isStale = true; };
  }, [refreshTrigger]);

  // --- Handlers ---

  const toggleVehicleDetails = (vehicleId: string) => {
    setExpandedVehicleDetails((prev) => ({ ...prev, [vehicleId]: !prev[vehicleId] }));
  };

  const handleDeleteVehicle = async (id: string) => {
    const confirmed = await requirePasskeyConfirmation("¿Estás seguro de que deseas eliminar este vehículo? Se archivará y no afectará a los registros activos.");
    if (!confirmed) return;
    const success = await db.deleteVehicle(id);
    if (success) {
      setVehicles((prev) => prev.filter((v) => v.id !== id));
      onRefreshAlerts();
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
    setInsurancePolicyNumber(v.insurance_policy_number ?? "");
    setInsuranceExpirationDate(v.insurance_expiration_date ?? "");
    setVerificationExpirationDate(v.verification_expiration_date ?? "");
    setRentCost(v.rent_cost);
    setNextServiceMileage(v.next_service_mileage?.toString() ?? "");
    setColor(v.color ?? "");
    setIsOpen(true);
  };

  const handleRenewDocument = (v: Vehicle, target: "CIRCULACION" | "SEGURO" | "VERIFICACION") => {
    if (target === "VERIFICACION") {
      setVerifVehicle(v);
      setVerifCompleted(v.verification_completed || false);
      setVerifImg(v.verification_img || "");
      setVerifDate(v.verification_expiration_date || new Date().toISOString().split("T")[0]);
      setVerifOpen(true);
      return;
    }
    setRenewingVehicle(v);
    setRenewTarget(target);
    startCamera(target);
  };

  const submitRenewal = async () => {
    if (!renewingVehicle) return;
    const patch: Partial<Vehicle> = {};
    let prevExpiration: string | null = null;
    if (renewTarget === "CIRCULACION") {
      prevExpiration = renewingVehicle.circulation_expiration_date;
      patch.circulation_expiration_date = renewExpirationDate;
    } else if (renewTarget === "SEGURO") {
      prevExpiration = renewingVehicle.insurance_expiration_date;
      patch.insurance_expiration_date = renewExpirationDate;
      if (renewPolicyImg) patch.insurance_policy_img = renewPolicyImg;
    } else if (renewTarget === "VERIFICACION") {
      patch.verification_expiration_date = renewExpirationDate;
    }
    await db.saveVehicle({ ...renewingVehicle, ...patch });
    if (renewTarget === "CIRCULACION" || renewTarget === "SEGURO") {
      await db.saveRenewalLog({
        vehicle_id: renewingVehicle.id,
        type: renewTarget,
        previous_expiration: prevExpiration,
        new_expiration: renewExpirationDate,
      });
    }
    setIsRenewOpen(false);
    setRenewingVehicle(null);
    setRenewTarget(null);
    setRenewExpirationDate("");
    setRenewPolicyImg("");
    loadData();
    onRefreshAlerts();
  };

  const submitVerification = async () => {
    if (!verifVehicle) return;
    const imgUrl = verifImg ? await uploadDocumentImage(verifImg, "verification") : null;
    const nextDate = getNextVerificationDate(verifVehicle.plate_number);
    await db.saveVehicle({
      ...verifVehicle,
      verification_completed: true,
      verification_img: imgUrl || verifImg,
      verification_expiration_date: nextDate,
    });
    setVerifOpen(false);
    setVerifVehicle(null);
    loadData();
    onRefreshAlerts();
  };

  const handleServiceOut = async (vehicle: Vehicle) => {
    if (!(await showConfirm({ title: "Retirar a Servicio", message: `¿Retirar ${vehicle.brand} ${vehicle.vehicle_name} (${vehicle.plate_number}) a servicio? No generará costo de renta mientras esté en servicio.`, confirmLabel: "Retirar", variant: "warning" }))) return;
    await db.saveVehicle({ ...vehicle, status: "in_service", service_out_date: new Date().toISOString().split("T")[0], service_return_date: null });
    loadData();
    onRefreshAlerts();
  };

  const handleServiceReturn = async (vehicle: Vehicle) => {
    if (!(await showConfirm({ title: "Devolver a Chofer", message: `¿Regresar ${vehicle.brand} ${vehicle.vehicle_name} (${vehicle.plate_number}) a su chofer? Se aplicará condonación por los días en taller.`, confirmLabel: "Devolver", variant: "default" }))) return;
    const returnDate = new Date();
    const outDate = vehicle.service_out_date ? new Date(vehicle.service_out_date) : returnDate;
    const daysOut = Math.max(1, Math.round((returnDate.getTime() - outDate.getTime()) / (1000 * 60 * 60 * 24)));
    const discountDays = daysOut === 1 ? 0.5 : daysOut;

    await db.saveVehicle({ ...vehicle, status: "active", service_return_date: returnDate.toISOString().split("T")[0] });

    if (vehicle.active_driver_id) {
      const rentals = await db.getWeeklyRentals();
      const currentRental = rentals.find((r) => r.driver_id === vehicle.active_driver_id && r.status !== "PAID");
      if (currentRental) {
        const dailyRate = currentRental.rent_amount / 7;
        const condonedAmount = Math.round(dailyRate * discountDays);
        const updated: WeeklyRental = {
          ...currentRental,
          condoned_days: (currentRental.condoned_days || 0) + Math.ceil(discountDays),
          condoned_amount: (currentRental.condoned_amount || 0) + condonedAmount,
        };
        const effectiveRent = updated.rent_amount - updated.condoned_amount;
        if (updated.paid_amount >= effectiveRent) updated.status = "PAID";
        else if (updated.paid_amount > 0) updated.status = "PARTIAL";
        else updated.status = "UNPAID";
        await db.saveWeeklyRental(updated);
      }
    }
    loadData();
    onRefreshAlerts();
  };

  const handleReportWearPart = async (vehicle: Vehicle) => {
    setWearPartVehicleState(vehicle);
    setWearPartName("");
    setWearPartCost("");
    setWearPartDate(new Date().toISOString().split("T")[0]);
    setWearPartOpen(true);
  };

  const submitWearPart = async () => {
    if (!wearPartVehicleState || !wearPartName.trim()) return;
    await db.saveMaintenance({
      vehicle_id: wearPartVehicleState.id,
      cost: parseFloat(wearPartCost) || 0,
      description: `[REEMPLAZO PIEZA] ${wearPartName.trim()}`,
      maintenance_date: wearPartDate,
      next_maintenance_date: null,
    });
    setWearPartOpen(false);
    setWearPartVehicleState(null);
    loadData();
    onRefreshAlerts();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand || !vehicleName || !plateNumber) {
      alert("Por favor completa los campos obligatorios (*)");
      return;
    }

    const formattedPlate = plateNumber.toUpperCase().trim();
    const formattedVin = vin.toUpperCase().trim();

    const plateExists = vehicles.some((v) => v.plate_number === formattedPlate && v.id !== editingVehicleId);
    const vinExists = vin && vehicles.some((v) => v.vin === formattedVin && v.id !== editingVehicleId);

    if (plateExists) { alert(`Error: Ya existe un auto registrado con las placas "${formattedPlate}".`); return; }
    if (vinExists) { alert(`Error: Ya existe un auto registrado con el número de serie (VIN) "${formattedVin}".`); return; }

    const circUrl = circulationImg ? await uploadDocumentImage(circulationImg, "circulation") : null;
    const insUrl = insurancePolicyImg ? await uploadDocumentImage(insurancePolicyImg, "insurance") : null;

    const insPagesUrls: string[] = [];
    for (const page of insurancePolicyFiles) {
      const url = await uploadDocumentImage(page, "insurance");
      insPagesUrls.push(url);
    }

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
      insurance_policy_img: insUrl || insurancePolicyImg,
      insurance_policy_pages: JSON.stringify(insPagesUrls.length > 0 ? insPagesUrls : (insurancePolicyImg ? [insurancePolicyImg] : [])),
      insurance_policy_number: insurancePolicyNumber,
      insurance_expiration_date: insuranceExpirationDate,
      verification_expiration_date: verificationExpirationDate,
      verification_img: null,
      verification_completed: false,
      status: editingVehicleId ? (vehicles.find((v) => v.id === editingVehicleId)?.status ?? "active") : "active",
      service_out_date: editingVehicleId ? (vehicles.find((v) => v.id === editingVehicleId)?.service_out_date ?? null) : null,
      service_return_date: editingVehicleId ? (vehicles.find((v) => v.id === editingVehicleId)?.service_return_date ?? null) : null,
      active_driver_id: editingVehicleId ? vehicles.find((v) => v.id === editingVehicleId)?.active_driver_id ?? null : null,
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

  // --- OCR ---
  const processOcrOnImageSource = async (imageSource: string, target: "CIRCULACION" | "SEGURO") => {
    setOcrStep("scan");
    setOcrLogs((prev) => [...prev, `[OCR] Iniciando reconocimiento para: ${target}`, "[OCR] Intentando transcripción en la nube con Gemini..."]);

    try {
      const apiResponse = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageSource, target }),
      });

      if (apiResponse.ok) {
        const parsed = await apiResponse.json();
        setOcrLogs((prev) => [...prev, "[OK] [OCR] Transcripción por Gemini finalizada exitosamente."]);
        setOcrStep("extract");

        if (target === "CIRCULACION") {
          if (renewingVehicle) {
            setRenewPolicyImg(imageSource);
            if (parsed.expirationDate) { setRenewExpirationDate(parsed.expirationDate); setOcrLogs((prev) => [...prev, `✓ [Gemini] Vigencia: ${parsed.expirationDate}`]); }
          } else {
            setCirculationImg(imageSource);
            if (parsed.brand) setBrand(parsed.brand);
            if (parsed.vehicleName) setVehicleName(parsed.vehicleName);
            if (parsed.model) setModel(parsed.model);
            if (parsed.classType) setClassType(parsed.classType);
            if (parsed.plateNumber) { setPlateNumber(parsed.plateNumber); setOcrLogs((prev) => [...prev, `[OK] [Gemini] Placa: ${parsed.plateNumber}`]); }
            if (parsed.vin) { setVin(parsed.vin); setOcrLogs((prev) => [...prev, `[OK] [Gemini] Serie/VIN: ${parsed.vin}`]); }
            if (parsed.expirationDate) { setCirculationExpirationDate(parsed.expirationDate); setOcrLogs((prev) => [...prev, `✓ [Gemini] Vigencia: ${parsed.expirationDate}`]); }
          }
        } else {
          if (renewingVehicle) {
            setRenewPolicyImg(imageSource);
            if (parsed.expirationDate) { setRenewExpirationDate(parsed.expirationDate); setOcrLogs((prev) => [...prev, `✓ [Gemini] Expiración: ${parsed.expirationDate}`]); }
          } else {
            setInsurancePolicyImg(imageSource);
            if (parsed.expirationDate) { setInsuranceExpirationDate(parsed.expirationDate); setOcrLogs((prev) => [...prev, `✓ [Gemini] Expiración: ${parsed.expirationDate}`]); }
          }
        }

        if (renewingVehicle) setIsRenewOpen(true);

        setOcrStep("done");
        setTimeout(() => { setIsScanning(false); setScanTarget(null); }, 1500);
        return;
      } else {
        const errJson = await apiResponse.json();
        setOcrLogs((prev) => [...prev, `⚠ [OCR API] ${errJson.error || "Fallo API"}. Usando Tesseract local...`]);
      }
    } catch (err) {
      setOcrLogs((prev) => [...prev, "⚠ Error de red con Gemini. Iniciando Tesseract local..."]);
    }

    try {
      const result = await Tesseract.recognize(imageSource, "spa", {
        logger: (m) => {
          if (m.status === "recognizing text") {
            const progress = Math.round(m.progress * 100);
            setOcrLogs((prev) => {
              const filtered = prev.filter((l) => !l.startsWith("[OCR] Progreso:"));
              return [...filtered, `[OCR] Progreso: ${progress}%`];
            });
          }
        },
      });

      setOcrStep("extract");
      const text = result.data.text;
      const parsed = parseOcrText(text, target);

      if (target === "CIRCULACION") {
        setCirculationImg(imageSource);
        if (parsed.brand) { setBrand(parsed.brand); setOcrLogs((prev) => [...prev, `[OK] [Parser Local] Marca: ${parsed.brand}`]); }
        if (parsed.modelYear) { setModel(parsed.modelYear); setOcrLogs((prev) => [...prev, `[OK] [Parser] Año: ${parsed.modelYear}`]); }
        if (parsed.plateNumber) { setPlateNumber(parsed.plateNumber); setOcrLogs((prev) => [...prev, `[OK] [Parser Local] Placa: ${parsed.plateNumber}`]); }
        if (parsed.vin) { setVin(parsed.vin); setOcrLogs((prev) => [...prev, `[OK] [Parser Local] Serie/NIV: ${parsed.vin}`]); }
        if (parsed.expirationDate) setCirculationExpirationDate(parsed.expirationDate);
      } else {
        setInsurancePolicyImg(imageSource);
        if (parsed.expirationDate) { setInsuranceExpirationDate(parsed.expirationDate); setOcrLogs((prev) => [...prev, `[OK] [Parser Local] Expiración: ${parsed.expirationDate}`]); }
      }

      setOcrStep("done");
      setOcrLogs((prev) => [...prev, "[OK] [OCR] Análisis local finalizado."]);
      setTimeout(() => { setIsScanning(false); setScanTarget(null); }, 2000);
    } catch (err: unknown) {
      const errorMsg = `[ERROR] [OCR] Fallo: ${err instanceof Error ? err.message : String(err)}`;
      setOcrLogs((prev) => [...prev, errorMsg]);
      setTimeout(() => { setIsScanning(false); setScanTarget(null); }, 3000);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, target: "CIRCULACION" | "SEGURO") => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsScanning(true);
    setScanTarget(target);
    setOcrStep("align");
    setOcrLogs([`[Archivo] Cargando: ${files.length} archivo(s)`]);

    if (target === "SEGURO") {
      const dataUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        dataUrls.push(dataUrl);
      }
      setInsurancePolicyFiles(dataUrls);
      setInsurancePolicyImg(dataUrls[0]);
      processOcrOnImageSource(dataUrls[0], target);
      return;
    }

    const file = files[0];
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") processOcrOnImageSource(reader.result, target);
      else { setOcrLogs((prev) => [...prev, "[ERROR] Error al leer el archivo"]); setIsScanning(false); }
    };
    reader.onerror = () => { setOcrLogs((prev) => [...prev, "[ERROR] Error de lectura"]); setIsScanning(false); };
    reader.readAsDataURL(file);
  };

  const triggerOcrScanDemo = (target: "CIRCULACION" | "SEGURO") => {
    setIsScanning(true);
    setScanTarget(target);
    setOcrStep("align");
    setOcrLogs(["Iniciando cámara de captura...", "Enfocando documento..."]);

    setTimeout(() => { setOcrStep("scan"); setOcrLogs((prev) => [...prev, "Bordes del documento encontrados", "Leyendo código QR y barras holográficas..."]); }, 1000);
    setTimeout(() => { setOcrStep("extract"); setOcrLogs((prev) => [...prev, "Procesando metadatos estructurados...", "Extrayendo Placa, Marca y VIN..."]); }, 2000);
    setTimeout(() => {
      setOcrStep("done");
      setOcrLogs((prev) => [...prev, "[OK] Simulación completada"]);

      if (target === "CIRCULACION") {
        const demoVehicles = [
          { brand: "Nissan", name: "Sentra", model: "2023", class: "Sedán - Confort", circExp: "2027-11-20", vin: "3N1CN81D7PL892103", plate: "741-XYZ", rent: 2600 },
          { brand: "Toyota", name: "Prius", model: "2022", class: "Híbrido - Premium", circExp: "2028-04-15", vin: "JTDDKRFU9M3812049", plate: "852-MNO", rent: 2800 },
          { brand: "Chevrolet", name: "Beat", model: "2020", class: "Hatchback - Económico", circExp: "2026-09-30", vin: "KL1TA54B9KC981023", plate: "963-JKL", rent: 2200 },
          { brand: "Volkswagen", name: "Vento", model: "2021", class: "Sedán - Estándar", circExp: "2027-06-18", vin: "3VW2K4FX4LM819203", plate: "321-UWV", rent: 2400 },
          { brand: "Hyundai", name: "Grand i10", model: "2022", class: "Hatchback - Compacto", circExp: "2028-02-10", vin: "MALAN51C7NM819203", plate: "456-RST", rent: 2300 },
          { brand: "Kia", name: "Rio", model: "2023", class: "Sedán - Confort", circExp: "2027-12-05", vin: "3KPA24AD5PE819203", plate: "159-QWE", rent: 2500 },
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
        const demoInsurances = [{ date: "2027-06-15" }, { date: "2027-09-20" }, { date: "2026-12-10" }, { date: "2027-03-05" }, { date: "2028-01-18" }, { date: "2027-11-30" }];
        const idx = Math.floor(Math.random() * demoInsurances.length);
        setInsurancePolicyImg("base64_mock_insurance_policy_image_proof");
        setInsuranceExpirationDate(demoInsurances[idx].date);
      }

      setTimeout(() => { setIsScanning(false); setScanTarget(null); }, 1000);
    }, 3200);
  };

  // --- Derived ---
  const filteredVehicles = vehicles.filter(
    (v) =>
      `${v.brand} ${v.vehicle_name}`.toLowerCase().includes(search.toLowerCase()) ||
      v.plate_number.toLowerCase().includes(search.toLowerCase())
  );

  const isVinLengthInvalid = vin.length > 0 && vin.length !== 17;
  const isPlateLengthInvalid = plateNumber.length > 0 && (plateNumber.length < 5 || plateNumber.length > 10);

  return {
    // State
    vehicles, drivers, maintenances, assignments, checklists, weeklyRentals,
    search, setSearch, isLoading, showArchived, setShowArchived,
    expandedVehicleDetails, filteredVehicles,

    // Dialog state
    isOpen, setIsOpen, editingVehicleId,
    isRenewOpen, setIsRenewOpen, renewingVehicle, setRenewingVehicle,
    previewImage, setPreviewImage,
    renewTarget, renewExpirationDate, setRenewExpirationDate, renewPolicyImg,
    isScanning, scanner, activeSection, scrollToSection,

    // Wear part
    wearPartOpen, setWearPartOpen, wearPartVehicleState, setWearPartVehicleState,
    wearPartName, setWearPartName, wearPartCost, setWearPartCost, wearPartDate, setWearPartDate,

    // Verification
    verifOpen, setVerifOpen, verifVehicle, setVerifVehicle,
    verifCompleted, verifImg, setVerifImg, verifDate, verifFileRef,

    // Refs
    circFileRef, insFileRef,

    // Form state
    brand, setBrand, vehicleName, setVehicleName, model, setModel,
    classType, setClassType, circulationExpirationDate, setCirculationExpirationDate,
    vin, setVin, plateNumber, setPlateNumber,
    insurancePolicyImg, setInsurancePolicyImg, insurancePolicyFiles, setInsurancePolicyFiles,
    insuranceExpirationDate, setInsuranceExpirationDate,
    circulationImg, setCirculationImg,
    rentCost, setRentCost, nextServiceMileage, setNextServiceMileage,
    color, setColor, insurancePolicyNumber, setInsurancePolicyNumber,
    verificationExpirationDate, setVerificationExpirationDate,

    // Derived
    isVinLengthInvalid, isPlateLengthInvalid,

    // Handlers
    toggleVehicleDetails, handleDeleteVehicle, handleEditVehicle,
    handleRenewDocument, submitRenewal, submitVerification,
    handleServiceOut, handleServiceReturn, handleReportWearPart, submitWearPart,
    handleSave, resetForm, handleFileChange, triggerOcrScanDemo,
    startCamera, stopCamera,
    onOpenActionSheet, onAssignVehicle, onRefreshAlerts,
    loadData,
  };
}
