"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { db, Driver, Vehicle } from "@/lib/db";
import { parseOcrText, calculateCurp, MEXICAN_STATES } from "@/lib/ocr";
import Tesseract from "tesseract.js";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Stepper, type StepperStep } from "@/components/ui/stepper";
import { User, AlertTriangle, Search, Camera, FolderOpen, CheckCircle2, Sparkles, Trash2, Car, Pencil, RefreshCcw, Mic, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import SliceHeader from "@/components/SliceHeader";
import { useOcrScanner } from "@/components/useOcrScanner";
import ScannerViewfinder from "@/components/ScannerViewfinder";
import { uploadDocumentImage } from "@/lib/db/storage";
import { DriversListSkeleton } from "@/components/ui/skeletons";
import { cn } from "@/lib/utils";

interface DriversSliceProps {
  onRefreshAlerts: () => void;
  searchQuery?: string;
  onOpenActionSheet: (entity: Driver | Vehicle, type: "driver" | "vehicle") => void;
  /** When true, the registration dialog opens automatically on mount. */
  autoOpen?: boolean;
  /** Called after the dialog is closed (to clear the autoOpen flag). */
  onAutoOpenConsumed?: () => void;
}

export default function DriversSlice({ onRefreshAlerts, searchQuery, onOpenActionSheet, autoOpen, onAutoOpenConsumed }: DriversSliceProps) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const handleDeleteDriver = async (id: string) => {
    if (confirm("¿Estás seguro de que deseas eliminar este chofer? Se desvinculará de cualquier vehículo activo.")) {
      const success = await db.deleteDriver(id);
      if (success) {
        setDrivers((prev) => prev.filter((d) => d.id !== id));
        onRefreshAlerts();
      }
    }
  };

  const handleEditDriver = (d: Driver) => {
    setEditingDriverId(d.id);
    setFirstName(d.first_name);
    setPaternalLastName(d.paternal_last_name);
    setMaternalLastName(d.maternal_last_name);
    setLicenseCurp(d.curp);
    setIneCurp(d.curp);
    setLicenseDob(d.dob ?? "");
    setIneDob(d.dob ?? "");
    setLicenseNumber(d.license_number);
    setLicenseIssueDate(d.license_issue_date ?? "");
    setLicenseExpirationDate(d.license_expiration_date ?? "");
    setLicenseIsPermanent(d.license_is_permanent);
    setIneAddress(d.ine_address);
    setIneSex(d.ine_sex);
    setIneElectorKey(d.ine_elector_key);
    setDriverPhotoImg(d.driver_photo_img ?? "");
    setAddressProofImg(d.address_proof_img ?? "");
    setIneImg(d.ine_img ?? "");
    setLicenseImg(d.license_img ?? "");
    setIsOpen(true);
  };

  const handleRenewLicense = (d: Driver) => {
    setRenewingDriver(d);
    setRenewNumber(d.license_number);
    setRenewIssueDate(d.license_issue_date ?? "");
    setRenewExpirationDate(d.license_expiration_date ?? "");
    setRenewIsPermanent(d.license_is_permanent);
    setIsRenewOpen(true);
  };

  const submitLicenseRenewal = async () => {
    if (!renewingDriver) return;
    await db.saveDriver({
      ...renewingDriver,
      license_number: renewNumber,
      license_issue_date: renewIssueDate,
      license_expiration_date: renewIsPermanent ? "" : renewExpirationDate,
      license_is_permanent: renewIsPermanent,
    });
    setIsRenewOpen(false);
    setRenewingDriver(null);
    loadDrivers();
    onRefreshAlerts();
  };

  const [isOpen, setIsOpen] = useState(false);

  // Auto-open the registration dialog when the parent sets autoOpen=true.
  useEffect(() => {
    if (autoOpen && !isOpen) {
      setIsOpen(true);
      onAutoOpenConsumed?.();
    }
  }, [autoOpen]);

  // Sync external search query into local filter. Use the callback form and
  // avoid setState synchronously in the effect body by comparing in microtask.
  useEffect(() => {
    if (searchQuery === undefined) return;
    Promise.resolve().then(() => {
      setSearch((prev) => (prev === searchQuery ? prev : searchQuery));
    });
  }, [searchQuery]);

  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);
  const [isRenewOpen, setIsRenewOpen] = useState(false);
  const [renewingDriver, setRenewingDriver] = useState<Driver | null>(null);
  const [renewNumber, setRenewNumber] = useState("");
  const [renewIssueDate, setRenewIssueDate] = useState("");
  const [renewExpirationDate, setRenewExpirationDate] = useState("");
  const [renewIsPermanent, setRenewIsPermanent] = useState(false);
  const [driverPhotoImg, setDriverPhotoImg] = useState("");
  const [addressProofImg, setAddressProofImg] = useState("");
  const [ineImg, setIneImg] = useState("");
  const [licenseImg, setLicenseImg] = useState("");

  // File picker refs
  const ineFileRef = useRef<HTMLInputElement>(null);
  const licFileRef = useRef<HTMLInputElement>(null);
  const photoFileRef = useRef<HTMLInputElement>(null);
  const addressProofFileRef = useRef<HTMLInputElement>(null);
  // Camera capture for the address proof — opens the device camera directly
  // via the native <input type="file" capture>, no OCR pipeline.
  const addressProofCameraRef = useRef<HTMLInputElement>(null);

  // Camera + OCR progress state shared with VehiclesSlice via useOcrScanner.
  const scanner = useOcrScanner<"INE" | "LICENCIA" | "CHOFER" | "DOMICILIO">({
    rawTargets: ["CHOFER", "DOMICILIO"],
    facingMode: (t) => (t === "CHOFER" ? "user" : "environment"),
    onFrame: (dataUrl, target) => {
      if (target === "CHOFER") setDriverPhotoImg(dataUrl);
      else if (target === "DOMICILIO") setAddressProofImg(dataUrl);
      else processOcrOnImageSource(dataUrl, target);
    },
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

  // Section tracker for the Stepper. The user can click any step to
  // scroll that section into view; we use IntersectionObserver to
  // update the highlight as they scroll naturally too. "doc" is the
  // initial section because that's where most users start (OCR/scan).
  const [activeSection, setActiveSection] = useState<string>("doc");
  const scrollToSection = React.useCallback((id: string) => {
    // Defer to the next frame so Radix's dialog animations don't
    // fight the scroll.
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
    const ids = ["foto", "doc", "dom", "datos"];
    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry that's most visible. If multiple are visible,
        // prefer the one closer to the top of the viewport.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          const id = visible[0].target.id.replace(/^section-/, "");
          setActiveSection(id);
        }
      },
      {
        // Trigger when the section is in the top half of the dialog's
        // scroll container. The negative top margin accounts for the
        // Stepper bar above the scrolling area.
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
  const [demoIndex, setDemoIndex] = useState<number | null>(null);
  const [expandedDriverDetails, setExpandedDriverDetails] = useState<Record<string, boolean>>({});

  const toggleDriverDetails = (driverId: string) => {
    setExpandedDriverDetails(prev => ({
      ...prev,
      [driverId]: !prev[driverId]
    }));
  };

  const loadDrivers = async () => {
    const list = await db.getDrivers();
    const vList = await db.getVehicles();
    setDrivers(list);
    setVehicles(vList);
  };

  useEffect(() => {
    let isStale = false;
    (async () => {
      const [list, vList] = await Promise.all([db.getDrivers(), db.getVehicles()]);
      if (isStale) return;
      setDrivers(list);
      setVehicles(vList);
      setIsLoading(false);
    })();
    return () => {
      isStale = true;
    };
  }, []);

  // Reload when parent signals a refresh (license renewals, etc.).
  useEffect(() => {
    let isStale = false;
    // Skip the very first render — the mount effect already handles it.
    (async () => {
      const [list, vList] = await Promise.all([db.getDrivers(), db.getVehicles()]);
      if (isStale) return;
      setDrivers(list);
      setVehicles(vList);
      setIsLoading(false);
    })();
    return () => {
      isStale = true;
    };
  }, [onRefreshAlerts]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !paternalLastName || !licenseCurp) {
      alert("Por favor completa los campos requeridos: Nombre, Apellido Paterno y CURP.");
      return;
    }

    // Check for duplicates (skip the driver being edited)
    const isDuplicate = drivers.some(
      (d) =>
        d.id !== editingDriverId && (
        d.curp.toLowerCase().trim() === licenseCurp.toLowerCase().trim() ||
        (d.license_number && licenseNumber && d.license_number.toLowerCase().trim() === licenseNumber.toLowerCase().trim()) ||
        (d.ine_elector_key && ineElectorKey && d.ine_elector_key.toLowerCase().trim() === ineElectorKey.toLowerCase().trim())
      )
    );

    if (isDuplicate) {
      alert("Error: Ya existe un chofer registrado con esta CURP, número de licencia o clave electoral.");
      return;
    }

    try {
      const [ineUrl, licenseUrl, photoUrl, addressUrl] = await Promise.all([
        ineImg ? uploadDocumentImage(ineImg, "ine") : Promise.resolve(null),
        licenseImg ? uploadDocumentImage(licenseImg, "license") : Promise.resolve(null),
        driverPhotoImg ? uploadDocumentImage(driverPhotoImg, "photo") : Promise.resolve(null),
        addressProofImg ? uploadDocumentImage(addressProofImg, "address") : Promise.resolve(null),
      ]);

      await db.saveDriver({
        id: editingDriverId || undefined,
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
        ine_img: ineUrl,
        license_img: licenseUrl,
        driver_photo_img: photoUrl || driverPhotoImg || null,
        address_proof_img: addressUrl || addressProofImg || null,
      });

      resetForm();
      setEditingDriverId(null);
      setIsOpen(false);
      loadDrivers();
      onRefreshAlerts();
    } catch (err: unknown) {
      console.error(err);
      alert("Error al guardar chofer: " + (err instanceof Error ? err.message : String(err)));
    }
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
    setDriverPhotoImg("");
    setAddressProofImg("");
    setIneImg("");
    setLicenseImg("");
    setDemoIndex(null);
    setEditingDriverId(null);
    setShowManualFields(false);
    stopCamera();
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
          setIneImg(imageSource);
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
          setLicenseImg(imageSource);
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
        setIneImg(imageSource);
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
        setLicenseImg(imageSource);
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

    } catch (err: unknown) {
      console.error("[OCR] Fallo en la transcripción local:", err);
      const errorMsg = `❌ [OCR] Error: ${err instanceof Error ? err.message : String(err)}`;
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

  // Address proof: just store the file as a base64 image, no OCR pipeline.
  // Used by both the camera capture and the file picker inputs.
  const handleAddressProofFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setAddressProofImg(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // Demo helper: fill the OCR-derived fields directly so the user can keep
  // editing the form as if the scan had finished. We deliberately skip the
  // scanner viewfinder here: the demo's job is to populate fields, not to
  // replay a 3-second animation that traps the user in the camera UI.
  const fillDemoData = (target: "INE" | "LICENCIA") => {
    // Use the first digit of the target string as a deterministic index so
    // the demo varies between INE/LICENCIA without calling impure functions
    // in render.
    const idx = demoIndex ?? (target === "INE" ? 0 : 3);
    if (demoIndex === null) {
      setDemoIndex(idx);
    }

    setOcrLogs((prev) => [
      ...prev,
      `[Demo] Rellenando campos de ${target}…`,
      "[Demo] ✓ Listo, puedes seguir editando.",
    ]);

    if (target === "INE") {
      const demoDrivers = [
        {
          first_name: "Carlos Alberto",
          paternal_last_name: "Mendoza",
          maternal_last_name: "Ruiz",
          curp: "MERC920814HDFRZS03",
          dob: "1992-08-14",
          address: "Av. Insurgentes Sur 1204, Del Valle, CDMX",
          sex: "M" as const,
          elector_key: "MNDZCR92081409H400",
        },
        {
          first_name: "María Fernanda",
          paternal_last_name: "Gómez",
          maternal_last_name: "López",
          curp: "GOLM940315MDFRNS04",
          dob: "1994-03-15",
          address: "Calle Benito Juárez 45, Coyoacán, CDMX",
          sex: "F" as const,
          elector_key: "GOMZFE94031512M800",
        },
        {
          first_name: "Alejandro",
          paternal_last_name: "Silva",
          maternal_last_name: "Torres",
          curp: "SITA881122HDFRND05",
          dob: "1988-11-22",
          address: "Paseo de la Reforma 300, Cuauhtémoc, CDMX",
          sex: "M" as const,
          elector_key: "SLVATR88112204H500",
        },
        {
          first_name: "Sofia",
          paternal_last_name: "Ramírez",
          maternal_last_name: "Castro",
          curp: "RACS960130MDFRNR02",
          dob: "1996-01-30",
          address: "Av. Universidad 1900, Copilco, CDMX",
          sex: "F" as const,
          elector_key: "RMRZCS96013018M300",
        },
        {
          first_name: "Javier",
          paternal_last_name: "Ortega",
          maternal_last_name: "Martínez",
          curp: "ORMJ910512HDFRTR09",
          dob: "1991-05-12",
          address: "Calzada de Tlalpan 4050, Tlalpan, CDMX",
          sex: "M" as const,
          elector_key: "ORTGMT91051222H100",
        },
        {
          first_name: "Ana Patricia",
          paternal_last_name: "Herrera",
          maternal_last_name: "Juárez",
          curp: "HEJA930704MDFRRN01",
          dob: "1993-07-04",
          address: "Av. Revolución 580, Mixcoac, CDMX",
          sex: "F" as const,
          elector_key: "HRRAJZ93070408M600",
        },
      ];
      const choice = demoDrivers[idx];

      setFirstName(choice.first_name);
      setPaternalLastName(choice.paternal_last_name);
      setMaternalLastName(choice.maternal_last_name);
      setIneCurp(choice.curp);
      setIneDob(choice.dob);
      setIneAddress(choice.address);
      setIneSex(choice.sex);
      setIneElectorKey(choice.elector_key);
    } else {
      const demoLicenses = [
        {
          first_name: "Carlos Alberto",
          paternal_last_name: "Mendoza",
          maternal_last_name: "Ruiz",
          curp: "MERC920814HDFRZS03",
          dob: "1992-08-14",
          number: "LIC-554901-M",
          issue: "2025-02-10",
          expiration: "2028-02-10",
        },
        {
          first_name: "María Fernanda",
          paternal_last_name: "Gómez",
          maternal_last_name: "López",
          curp: "GOLM940315MDFRNS04",
          dob: "1994-03-15",
          number: "LIC-983104-F",
          issue: "2024-05-18",
          expiration: "2027-05-18",
        },
        {
          first_name: "Alejandro",
          paternal_last_name: "Silva",
          maternal_last_name: "Torres",
          curp: "SITA881122HDFRND05",
          dob: "1988-11-22",
          number: "LIC-112349-M",
          issue: "2023-11-01",
          expiration: "2026-11-01",
        },
        {
          first_name: "Sofia",
          paternal_last_name: "Ramírez",
          maternal_last_name: "Castro",
          curp: "RACS960130MDFRNR02",
          dob: "1996-01-30",
          number: "LIC-662304-F",
          issue: "2026-01-15",
          expiration: "2029-01-15",
        },
        {
          first_name: "Javier",
          paternal_last_name: "Ortega",
          maternal_last_name: "Martínez",
          curp: "ORMJ910512HDFRTR09",
          dob: "1991-05-12",
          number: "LIC-881204-M",
          issue: "2025-04-12",
          expiration: "2028-04-12",
        },
        {
          first_name: "Ana Patricia",
          paternal_last_name: "Herrera",
          maternal_last_name: "Juárez",
          curp: "HEJA930704MDFRRN01",
          dob: "1993-07-04",
          number: "LIC-334910-F",
          issue: "2024-08-04",
          expiration: "2027-08-04",
        },
      ];
      const choice = demoLicenses[idx];

      setFirstName(choice.first_name);
      setPaternalLastName(choice.paternal_last_name);
      setMaternalLastName(choice.maternal_last_name);
      setLicenseCurp(choice.curp);
      setLicenseDob(choice.dob);
      setLicenseNumber(choice.number);
      setLicenseIssueDate(choice.issue);
      setLicenseExpirationDate(choice.expiration);
      setLicenseIsPermanent(false);
    }
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

  // Whether the optional "Datos manuales" collapsible section is expanded.
  // Defaults to false so the primary document-scan flow is the focus.
  const [showManualFields, setShowManualFields] = useState(false);

  // Count how many of the 11 manual text fields have been captured (by OCR or
  // typed). Displayed in the collapsible header so the user knows what the OCR
  // already filled without having to open it.
  const manualFieldsCount = useMemo(() => {
    const fields = [
      firstName,
      paternalLastName,
      maternalLastName,
      licenseCurp,
      licenseNumber,
      licenseDob,
      licenseIssueDate,
      licenseExpirationDate,
      ineCurp,
      ineDob,
      ineElectorKey,
      ineAddress,
    ];
    return fields.filter((f) => f && f.trim().length > 0).length;
  }, [
    firstName,
    paternalLastName,
    maternalLastName,
    licenseCurp,
    licenseNumber,
    licenseDob,
    licenseIssueDate,
    licenseExpirationDate,
    ineCurp,
    ineDob,
    ineElectorKey,
    ineAddress,
  ]);
  const MANUAL_FIELDS_TOTAL = 12;

  return (
    <div className="space-y-4">
      {/* Header Row: Title on Left, Actions on Right */}
      <SliceHeader
        title="Conductores"
        action={
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

            {/* Section overview — a non-linear stepper: click any step to
                scroll that section into view, the active step updates as
                the user scrolls too. */}
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
                /* Standard form view */
                <form onSubmit={handleSave} className="space-y-4 pt-2 flex flex-col max-h-[78vh]">
                  <div className="flex-1 overflow-y-auto pr-1.5 space-y-4 max-h-[62vh]">
                  
                  {/* Foto de Perfil del Chofer */}
                  <div id="section-foto" className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3.5 flex flex-col items-center text-center scroll-mt-2">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground font-black self-start">Foto de Perfil del Chofer</h4>
                    <div className="relative w-24 h-24 rounded-full border-2 border-primary/20 bg-muted overflow-hidden flex items-center justify-center shadow-inner group">
                      {driverPhotoImg ? (
                        <Image src={driverPhotoImg} alt="Foto Chofer" fill className="object-cover" />
                      ) : (
                        <User className="w-12 h-12 text-muted-foreground/60" />
                      )}
                      {driverPhotoImg && (
                        <button
                          type="button"
                          onClick={() => setDriverPhotoImg("")}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-2xs font-bold transition-opacity duration-200 cursor-pointer"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 w-full">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => startCamera("CHOFER")}
                        className="border-border bg-card hover:bg-accent text-foreground text-xs rounded-xl flex items-center justify-center gap-1.5 h-11 cursor-pointer"
                      >
                        <Camera className="w-4 h-4 text-primary" /> Tomar Foto
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => photoFileRef.current?.click()}
                        className="border-border bg-card hover:bg-accent text-foreground text-xs rounded-xl flex items-center justify-center gap-1.5 h-11 cursor-pointer"
                      >
                        <FolderOpen className="w-4 h-4 text-primary" /> Subir Foto
                      </Button>
                      <input
                        type="file"
                        accept="image/*"
                        ref={photoFileRef}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              if (event.target?.result) {
                                setDriverPhotoImg(event.target.result as string);
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </div>
                  </div>
                  
                  {/* Two separate triggers for camera vs file uploads */}
                  <div id="section-doc" className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3.5 scroll-mt-2">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground font-black">Escanear INE (Identificación)</h4>
                    {ineImg && (
                      <div className="relative w-full h-14 rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center">
                        <Image src={ineImg} alt="INE" fill className="object-contain p-1" />
                        <button
                          type="button"
                          onClick={() => setIneImg("")}
                          className="absolute top-1.5 right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md transition-all active:scale-90"
                          title="Eliminar INE"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => startCamera("INE")}
                        className="border-border bg-card hover:bg-accent text-foreground text-xs rounded-xl flex items-center justify-center gap-1.5 h-11 cursor-pointer"
                      >
                        <Camera className="w-4 h-4 text-primary" /> Tomar Foto
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => ineFileRef.current?.click()}
                        className="border-border bg-card hover:bg-accent text-foreground text-xs rounded-xl flex items-center justify-center gap-1.5 h-11 cursor-pointer"
                      >
                        <FolderOpen className="w-4 h-4 text-primary" /> Subir Archivo
                      </Button>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={ineFileRef}
                        onChange={(e) => handleFileChange(e, "INE")}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => fillDemoData("INE")}
                        className="col-span-2 text-xs text-muted-foreground hover:text-foreground font-bold uppercase tracking-wider text-center h-10"
                      >
                        Simular INE Demo
                      </Button>
                    </div>
                  </div>

                  <div className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3.5">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground font-black">Escanear Licencia de Conducir</h4>
                    {licenseImg && (
                      <div className="relative w-full h-14 rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center">
                        <Image src={licenseImg} alt="Licencia" fill className="object-contain p-1" />
                        <button
                          type="button"
                          onClick={() => setLicenseImg("")}
                          className="absolute top-1.5 right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md transition-all active:scale-90"
                          title="Eliminar Licencia"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => startCamera("LICENCIA")}
                        className="border-border bg-card hover:bg-accent text-foreground text-xs rounded-xl flex items-center justify-center gap-1.5 h-11 cursor-pointer"
                      >
                        <Camera className="w-4 h-4 text-primary" /> Tomar Foto
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => licFileRef.current?.click()}
                        className="border-border bg-card hover:bg-accent text-foreground text-xs rounded-xl flex items-center justify-center gap-1.5 h-11 cursor-pointer"
                      >
                        <FolderOpen className="w-4 h-4 text-primary" /> Subir Archivo
                      </Button>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={licFileRef}
                        onChange={(e) => handleFileChange(e, "LICENCIA")}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => fillDemoData("LICENCIA")}
                        className="col-span-2 text-xs text-muted-foreground hover:text-foreground font-bold uppercase tracking-wider text-center h-10"
                      >
                        Simular Licencia Demo
                      </Button>
                    </div>
                  </div>

                  <div id="section-dom" className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3.5 scroll-mt-2">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground font-black">Comprobante de Domicilio</h4>
                      {addressProofImg && (
                        <span className="text-[11px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-md font-bold">
                          Cargado
                        </span>
                      )}
                    </div>
                    {addressProofImg && (
                      <div className="relative w-full h-14 rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center">
                        <Image src={addressProofImg} alt="Comprobante de Domicilio" fill className="object-contain p-1" />
                        <button
                          type="button"
                          onClick={() => setAddressProofImg("")}
                          className="absolute top-1.5 right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md transition-all active:scale-90"
                          title="Eliminar comprobante"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => addressProofCameraRef.current?.click()}
                        className="border-border bg-card hover:bg-accent text-foreground text-xs rounded-xl flex items-center justify-center gap-1.5 h-11 cursor-pointer"
                      >
                        <Camera className="w-4 h-4 text-primary" /> Tomar Foto
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => addressProofFileRef.current?.click()}
                        className="border-border bg-card hover:bg-accent text-foreground text-xs rounded-xl flex items-center justify-center gap-1.5 h-11 cursor-pointer"
                      >
                        <FolderOpen className="w-4 h-4 text-primary" /> Subir Archivo
                      </Button>
                      {/* Native camera capture — no OCR. The address proof is
                          stored as-is for human review. */}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        ref={addressProofCameraRef}
                        onChange={(e) => handleAddressProofFile(e)}
                      />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={addressProofFileRef}
                        onChange={(e) => handleAddressProofFile(e)}
                      />
                    </div>
                  </div>

                  <div id="section-datos" className="bg-muted/40 rounded-xl border border-border/80 overflow-hidden scroll-mt-2">
                    <button
                      type="button"
                      onClick={() => setShowManualFields((v) => !v)}
                      className="w-full p-3.5 flex items-center justify-between gap-2 cursor-pointer hover:bg-muted/60 transition-colors"
                      aria-expanded={showManualFields}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ChevronDown
                          className={cn(
                            "w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-300",
                            !showManualFields && "-rotate-90"
                          )}
                        />
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground font-black">
                          Datos Manuales
                        </h4>
                        <span
                          className={cn(
                            "text-xs font-bold px-1.5 py-0.5 rounded-md border",
                            manualFieldsCount === MANUAL_FIELDS_TOTAL
                              ? "bg-primary/10 text-primary border-primary/20"
                              : manualFieldsCount > 0
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                : "bg-muted text-muted-foreground border-border"
                          )}
                        >
                          {manualFieldsCount}/{MANUAL_FIELDS_TOTAL} campos
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground italic shrink-0">
                        Opcional — solo para correcciones
                      </span>
                    </button>

                    <AnimatePresence initial={false}>
                      {showManualFields && (
                        <motion.div
                          key="manual-fields"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="p-4 pt-1 space-y-3 border-t border-border/60">

                  <div className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground font-black">Datos Personales</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="min-w-0 md:col-span-2">
                        <Label htmlFor="firstName" className="text-muted-foreground text-xs">Nombres</Label>
                        <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="border-input bg-background rounded-xl w-full min-w-0" />
                      </div>
                      <div className="min-w-0">
                        <Label htmlFor="patName" className="text-muted-foreground text-xs">Apellido Paterno</Label>
                        <Input id="patName" value={paternalLastName} onChange={(e) => setPaternalLastName(e.target.value)} required className="border-input bg-background rounded-xl w-full min-w-0" />
                      </div>
                      <div className="min-w-0">
                        <Label htmlFor="matName" className="text-muted-foreground text-xs">Apellido Materno</Label>
                        <Input id="matName" value={maternalLastName} onChange={(e) => setMaternalLastName(e.target.value)} className="border-input bg-background rounded-xl w-full min-w-0" />
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Suggested CURP Box — kept inside the manual section as
                      a fallback when the OCR fails to extract CURP but the rest of
                      the identity data was captured. */}
                  {suggestedCurp && (
                    <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-primary font-bold flex items-center gap-1 font-black">
                          <Sparkles className="w-4 h-4" /> Sugerencia de CURP Calculada:
                        </span>
                        <button
                          type="button"
                          onClick={applySuggestedCurp}
                          className="text-xs font-black uppercase text-primary hover:text-primary/80 underline cursor-pointer"
                        >
                          Autocompletar
                        </button>
                      </div>
                      <div className="font-mono text-sm text-foreground font-bold tracking-wider text-center">
                        {suggestedCurp}
                      </div>
                    </div>
                  )}

                  {/* Licencia Details */}
                  <div className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground font-black">Licencia de Conducir</h4>
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="min-w-0">
                          <Label htmlFor="licNo" className="text-muted-foreground text-xs">No. Licencia</Label>
                          <Input id="licNo" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} className="border-input bg-background rounded-xl w-full min-w-0" />
                        </div>
                        <div className="min-w-0">
                          <Label htmlFor="licCurp" className="text-muted-foreground text-xs">CURP Licencia</Label>
                          <Input id="licCurp" value={licenseCurp} onChange={(e) => setLicenseCurp(e.target.value)} className="border-input bg-background rounded-xl w-full min-w-0" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="min-w-0">
                          <Label htmlFor="licDob" className="text-muted-foreground text-xs">F. Nacimiento (Licencia)</Label>
                          <Input type="date" id="licDob" value={licenseDob} onChange={(e) => setLicenseDob(e.target.value)} className="border-input bg-background rounded-xl w-full min-w-0" />
                        </div>
                        <div className="min-w-0">
                          <Label htmlFor="licIssue" className="text-muted-foreground text-xs">F. Expedición</Label>
                          <Input type="date" id="licIssue" value={licenseIssueDate} onChange={(e) => setLicenseIssueDate(e.target.value)} className="border-input bg-background rounded-xl w-full min-w-0" />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <Label htmlFor="permanentLic" className="cursor-pointer text-foreground">¿Licencia Permanente?</Label>
                        <Switch id="permanentLic" checked={licenseIsPermanent} onCheckedChange={setLicenseIsPermanent} />
                      </div>

                      {!licenseIsPermanent && (
                        <div className="min-w-0">
                          <Label htmlFor="licExp" className="text-muted-foreground text-xs">F. Vencimiento</Label>
                          <Input type="date" id="licExp" value={licenseExpirationDate} onChange={(e) => setLicenseExpirationDate(e.target.value)} className="border-input bg-background rounded-xl w-full min-w-0" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* INE Details */}
                  <div className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground font-black">Datos INE</h4>
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="min-w-0">
                          <Label htmlFor="ineCurp" className="text-muted-foreground text-xs">CURP INE</Label>
                          <Input id="ineCurp" value={ineCurp} onChange={(e) => setIneCurp(e.target.value)} className="border-input bg-background rounded-xl w-full min-w-0" />
                        </div>
                        <div className="min-w-0">
                          <Label htmlFor="ineDob" className="text-muted-foreground text-xs">F. Nacimiento (INE)</Label>
                          <Input type="date" id="ineDob" value={ineDob} onChange={(e) => setIneDob(e.target.value)} className="border-input bg-background rounded-xl w-full min-w-0" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="min-w-0">
                          <Label htmlFor="electorKey" className="text-muted-foreground text-xs">Clave Elector</Label>
                          <Input id="electorKey" value={ineElectorKey} onChange={(e) => setIneElectorKey(e.target.value)} className="border-input bg-background rounded-xl w-full min-w-0" />
                        </div>
                        <div className="min-w-0">
                          <Label className="text-muted-foreground text-xs">Sexo</Label>
                          <Select value={ineSex} onValueChange={(val: "M" | "F" | "X") => setIneSex(val)}>
                            <SelectTrigger className="w-full border-input bg-background rounded-xl">
                              <SelectValue placeholder="Sexo" />
                            </SelectTrigger>
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
                          <Label className="text-muted-foreground text-xs font-semibold">Estado de Nacimiento (Para cálculo CURP)</Label>
                          <Select value={birthState} onValueChange={setBirthState}>
                            <SelectTrigger className="w-full border-input bg-background rounded-xl">
                              <SelectValue placeholder="Estado de nacimiento" />
                            </SelectTrigger>
                            <SelectContent className="border-border bg-popover text-popover-foreground max-h-48 overflow-y-auto">
                              {MEXICAN_STATES.map((st) => (
                                <SelectItem key={st.code} value={st.code}>
                                  {st.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="min-w-0">
                          <Label htmlFor="ineAddr" className="text-muted-foreground text-xs">Domicilio</Label>
                          <Input id="ineAddr" value={ineAddress} onChange={(e) => setIneAddress(e.target.value)} className="border-input bg-background rounded-xl w-full min-w-0" />
                        </div>
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



      <div className="w-full overflow-x-auto pb-6">
        {isLoading ? (
          <DriversListSkeleton count={4} />
        ) : (
          <>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/40">
                  <th className="text-left py-2.5 px-2 whitespace-nowrap">Foto</th>
                  <th className="text-left py-2.5 px-2 whitespace-nowrap">Nombre</th>
                  <th className="text-left py-2.5 px-2 whitespace-nowrap">CURP</th>
                  <th className="text-left py-2.5 px-2 whitespace-nowrap">Licencia</th>
                  <th className="text-left py-2.5 px-2 whitespace-nowrap">Vence</th>
                  <th className="text-left py-2.5 px-2 whitespace-nowrap">Auto</th>
                  <th className="text-right py-2.5 px-2 whitespace-nowrap">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredDrivers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-muted-foreground italic">
                      No se encontraron conductores.
                    </td>
                  </tr>
                ) : (
                  filteredDrivers.map((driver) => {
                    const assignedVehicle = vehicles.find((v) => v.active_driver_id === driver.id);
                    return (
                      <React.Fragment key={driver.id}>
                      <tr
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleDriverDetails(driver.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleDriverDetails(driver.id);
                          }
                        }}
                        className="border-b border-border/20 hover:bg-muted/30 transition-colors cursor-pointer"
                      >
                        <td className="py-2.5 px-2">
                          <div className="relative w-8 h-8 rounded-full overflow-hidden bg-[#D8D8D8] flex items-center justify-center shrink-0">
                            {driver.driver_photo_img ? (
                              <Image src={driver.driver_photo_img} alt="Foto" fill className="object-cover" />
                            ) : (
                              <User className="w-4 h-4 text-muted-foreground/60" />
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-2">
                          <span className="font-bold text-foreground">{`${driver.first_name} ${driver.paternal_last_name}`}</span>
                        </td>
                        <td className="py-2.5 px-2 font-mono text-muted-foreground">
                          {driver.curp}
                        </td>
                        <td className="py-2.5 px-2 font-mono text-muted-foreground">
                          {driver.license_number || "—"}
                        </td>
                        <td className="py-2.5 px-2">
                          {driver.license_is_permanent ? (
                            <span className="px-1.5 py-0.5 text-[11px] font-bold bg-primary/10 text-primary border border-primary/20 rounded-md">Permanente</span>
                          ) : (
                            <span className={`text-muted-foreground ${driver.license_expiration_date && new Date(driver.license_expiration_date) < new Date() ? "text-red-400 font-bold" : ""}`}>
                              {driver.license_expiration_date || "—"}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-2">
                          {assignedVehicle ? (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Car className="w-3.5 h-3.5 shrink-0" />
                              {assignedVehicle.plate_number}
                            </span>
                          ) : (
                            <span className="text-amber-500 font-semibold">Sin auto</span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            {!driver.license_is_permanent && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); handleRenewLicense(driver); }}
                                className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 text-xs gap-1 h-7 px-2"
                                title="Renovar licencia"
                              >
                                <RefreshCcw className="w-3 h-3" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleEditDriver(driver); }}
                              className="text-muted-foreground hover:text-primary text-xs gap-1 h-7 px-2"
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleDeleteDriver(driver.id); }}
                              className="text-red-500 hover:text-red-400 hover:bg-red-500/10 text-xs gap-1 h-7 px-2"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {expandedDriverDetails[driver.id] && (
                        <tr className="border-b border-border/20 bg-muted/10">
                          <td colSpan={7} className="p-3">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-xs">
                              <div>
                                <span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Clave Elector</span>
                                <span className="block text-foreground font-medium">{driver.ine_elector_key || "N/D"}</span>
                              </div>
                              <div>
                                <span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Domicilio INE</span>
                                <span className="block text-foreground leading-snug">{driver.ine_address || "N/D"}</span>
                              </div>
                              <div>
                                <span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Licencia Vence</span>
                                <span className="block text-foreground">{driver.license_expiration_date || (driver.license_is_permanent ? "Permanente" : "—")}</span>
                              </div>
                              {driver.ine_img && (
                                <div>
                                  <span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">INE</span>
                                  <div className="relative h-12 w-20 rounded-lg overflow-hidden border border-border/70 mt-0.5">
                                    <Image src={driver.ine_img} alt="INE" fill className="object-cover" />
                                  </div>
                                </div>
                              )}
                              {driver.license_img && (
                                <div>
                                  <span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Licencia</span>
                                  <div className="relative h-12 w-20 rounded-lg overflow-hidden border border-border/70 mt-0.5">
                                    <Image src={driver.license_img} alt="Licencia" fill className="object-cover" />
                                  </div>
                                </div>
                              )}
                              {driver.address_proof_img && (
                                <div>
                                  <span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Comprobante Domicilio</span>
                                  <div className="relative h-12 w-20 rounded-lg overflow-hidden border border-border/70 mt-0.5">
                                    <Image src={driver.address_proof_img} alt="Comprobante" fill className="object-cover" />
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* License Renewal Dialog — quick update of license data without touching the rest of the file */}
      <Dialog open={isRenewOpen} onOpenChange={(o) => { setIsRenewOpen(o); if (!o) setRenewingDriver(null); }}>
        <DialogContent className="max-w-sm md:max-w-md border border-border bg-background text-foreground rounded-2xl">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 shrink-0">
                <RefreshCcw className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-foreground font-black text-lg">
                    Renovar Licencia
                  </DialogTitle>
                  <span className="text-[11px] font-black uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-md">
                    Actualización
                  </span>
                </div>
                <DialogDescription className="text-muted-foreground text-xs">
                  {renewingDriver
                    ? `${renewingDriver.first_name} ${renewingDriver.paternal_last_name} ${renewingDriver.maternal_last_name}`
                    : "Cargando..."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div>
              <Label className="text-muted-foreground text-xs">Número de Licencia</Label>
              <Input
                value={renewNumber}
                onChange={(e) => setRenewNumber(e.target.value)}
                placeholder="ej. 12345678"
                className="mt-1.5 border-input bg-background rounded-xl"
              />
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-muted-foreground text-xs">Fecha Expedición</Label>
                <Input
                  type="date"
                  value={renewIssueDate}
                  onChange={(e) => setRenewIssueDate(e.target.value)}
                  className="mt-1.5 border-input bg-background rounded-xl w-full min-w-0"
                />
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Fecha Vigencia</Label>
                <Input
                  type="date"
                  value={renewExpirationDate}
                  onChange={(e) => setRenewExpirationDate(e.target.value)}
                  disabled={renewIsPermanent}
                  className="mt-1.5 border-input bg-background rounded-xl w-full min-w-0 disabled:opacity-50"
                />
              </div>
            </div>

            <label className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/40 cursor-pointer">
              <span className="text-xs font-semibold text-foreground">Licencia Permanente</span>
              <Switch checked={renewIsPermanent} onCheckedChange={setRenewIsPermanent} />
            </label>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => { setIsRenewOpen(false); setRenewingDriver(null); }}
                className="flex-1 rounded-xl border-border"
              >
                Cancelar
              </Button>
              <Button
                onClick={submitLicenseRenewal}
                disabled={!renewNumber}
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
