"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Driver, Vehicle, WeeklyRental } from "@/lib/db";
import { deleteDriver, getArchivedDrivers, getDrivers, saveDriver } from "@/lib/db/drivers";
import { getVehicles } from "@/lib/db/vehicles";
import { applyRentalPayment, saveWeeklyRental } from "@/lib/db/finances";
import { parseOcrText, calculateCurp } from "@/lib/ocr";
import Tesseract from "tesseract.js";
import { useOcrScanner } from "@/components/useOcrScanner";
import { uploadDocumentImage, resolveDocUrl } from "@/lib/db/storage";
import { requirePasskeyConfirmation } from "@/lib/webauthn";


export interface UseDriversOptions {
  onRefreshAlerts: () => void;
  searchQuery?: string;
  onOpenActionSheet: (entity: Driver | Vehicle, type: "driver" | "vehicle") => void;
  autoOpen?: boolean;
  onAutoOpenConsumed?: () => void;
  weeklyRentals?: WeeklyRental[];
  onAssignDriver?: (driverId: string) => void;
}

export function useDrivers(options: UseDriversOptions) {
  const { onRefreshAlerts, searchQuery, onOpenActionSheet, autoOpen, onAutoOpenConsumed, weeklyRentals = [], onAssignDriver } = options;

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);


  // --- Dialog state ---
  const [isOpen, setIsOpen] = useState(false);
  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);
  const [isRenewOpen, setIsRenewOpen] = useState(false);
  const [renewingDriver, setRenewingDriver] = useState<Driver | null>(null);
  const [renewNumber, setRenewNumber] = useState("");
  const [renewIssueDate, setRenewIssueDate] = useState("");
  const [renewExpirationDate, setRenewExpirationDate] = useState("");
  const [renewIsPermanent, setRenewIsPermanent] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // --- Form state ---
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
  const [birthState, setBirthState] = useState("DF");
  const [driverPhotoImg, setDriverPhotoImg] = useState("");
  const [addressProofImg, setAddressProofImg] = useState("");
  const [ineImg, setIneImg] = useState("");
  const [licenseImg, setLicenseImg] = useState("");
  const [showManualFields, setShowManualFields] = useState(false);

  // --- Expanded rows ---
  const [expandedDriverDetails, setExpandedDriverDetails] = useState<Record<string, boolean>>({});

  // --- Payment / condonation dialogs ---
  const [condonationDialog, setCondonationDialog] = useState<{ rentalId: string; weekStart: string; days: number } | null>(null);
  const [paymentDialog, setPaymentDialog] = useState<{ rentalId: string; weekStart: string; amount: number } | null>(null);

  // --- File refs ---
  const ineFileRef = useRef<HTMLInputElement>(null);
  const licFileRef = useRef<HTMLInputElement>(null);
  const photoFileRef = useRef<HTMLInputElement>(null);
  const addressProofFileRef = useRef<HTMLInputElement>(null);
  const addressProofCameraRef = useRef<HTMLInputElement>(null);

  // --- Scanner ---
  const scanner = useOcrScanner<"INE" | "LICENCIA" | "CHOFER" | "DOMICILIO">({
    rawTargets: ["CHOFER", "DOMICILIO"],
    facingMode: (t) => (t === "CHOFER" ? "user" : "environment"),
    onFrame: (dataUrl, target) => {
      if (target === "CHOFER") setDriverPhotoImg(dataUrl);
      else if (target === "DOMICILIO") setAddressProofImg(dataUrl);
      else processOcrOnImageSource(dataUrl, target);
    },
  });
  const { setOcrStep, setOcrLogs, isScanning, setIsScanning, setScanTarget, startCamera, stopCamera } = scanner;

  // --- Section stepper ---
  const [activeSection, setActiveSection] = useState<string>("doc");
  const scrollToSection = useCallback((id: string) => {
    requestAnimationFrame(() => {
      document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSection(id);
    });
  }, []);

  // --- IntersectionObserver for stepper ---
  useEffect(() => {
    if (!isOpen) return;
    const ids = ["foto", "doc", "dom", "datos"];
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

  // --- Auto-open ---
  useEffect(() => {
    if (autoOpen && !isOpen) {
      Promise.resolve().then(() => {
        setIsOpen(true);
        onAutoOpenConsumed?.();
      });
    }
  }, [autoOpen, isOpen, onAutoOpenConsumed]);

  // --- Sync search query ---
  useEffect(() => {
    if (searchQuery === undefined) return;
    Promise.resolve().then(() => {
      setSearch((prev) => (prev === searchQuery ? prev : searchQuery));
    });
  }, [searchQuery]);

  // --- Data loading ---
  const loadDrivers = useCallback(async () => {
    const list = showArchived ? await getArchivedDrivers() : await getDrivers();
    const vList = await getVehicles();
    setDrivers(list);
    setVehicles(vList);
  }, [showArchived]);

  useEffect(() => {
    let isStale = false;
    (async () => {
      const [list, vList] = await Promise.all([
        showArchived ? getArchivedDrivers() : getDrivers(),
        getVehicles(),
      ]);
      if (isStale) return;
      setDrivers(list);
      setVehicles(vList);
      setIsLoading(false);
    })();
    return () => { isStale = true; };
  }, [showArchived]);

  useEffect(() => {
    let isStale = false;
    (async () => {
      const [list, vList] = await Promise.all([getDrivers(), getVehicles()]);
      if (isStale) return;
      setDrivers(list);
      setVehicles(vList);
      setIsLoading(false);
    })();
    return () => { isStale = true; };
  }, [onRefreshAlerts]);

  // --- Handlers ---

  const toggleDriverDetails = (driverId: string) => {
    setExpandedDriverDetails((prev) => ({ ...prev, [driverId]: !prev[driverId] }));
  };

  const exportDriverPdf = (driver: Driver) => {
    const assignedV = vehicles.find((v) => v.active_driver_id === driver.id);
    const win = window.open("", "_blank");
    if (!win) return;
    const doc = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Chofer - ${driver.first_name} ${driver.paternal_last_name}</title>
  <style>
    @page { margin: 1.5cm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; font-size: 12px; color: #111; padding: 20px; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    .subtitle { color: #666; font-size: 13px; margin-bottom: 20px; }
    h2 { font-size: 14px; margin: 16px 0 8px; border-bottom: 2px solid #0071e3; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    td, th { padding: 5px 8px; text-align: left; border: 1px solid #ddd; font-size: 11px; }
    th { background: #f5f5f7; font-weight: 600; width: 30%; }
    .docs { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 8px; }
    .docs img { max-width: 200px; max-height: 150px; border: 1px solid #ddd; border-radius: 6px; }
    .doc-item { text-align: center; }
    .doc-item span { display: block; font-size: 10px; color: #666; margin-top: 4px; }
    .footer { margin-top: 30px; font-size: 10px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 10px; }
  </style>
</head>
<body>
  <h1>${driver.first_name} ${driver.paternal_last_name} ${driver.maternal_last_name || ""}</h1>
  <p class="subtitle">CURP: ${driver.curp}${assignedV ? ` · Auto: ${assignedV.brand} ${assignedV.vehicle_name} (${assignedV.plate_number})` : ""}</p>
  <h2>Datos Personales</h2>
  <table>
    <tr><th>Nombre</th><td>${driver.first_name} ${driver.paternal_last_name} ${driver.maternal_last_name || ""}</td></tr>
    <tr><th>CURP</th><td>${driver.curp}</td></tr>
    <tr><th>Fecha de Nacimiento</th><td>${driver.dob || "—"}</td></tr>
    <tr><th>Clave de Elector</th><td>${driver.ine_elector_key || "—"}</td></tr>
    <tr><th>Sexo</th><td>${driver.ine_sex || "—"}</td></tr>
    <tr><th>Domicilio</th><td>${driver.ine_address || "—"}</td></tr>
  </table>
  <h2>Licencia</h2>
  <table>
    <tr><th>Número</th><td>${driver.license_number || "—"}</td></tr>
    <tr><th>Vigencia</th><td>${driver.license_expiration_date || (driver.license_is_permanent ? "Permanente" : "—")}</td></tr>
    <tr><th>Expedición</th><td>${driver.license_issue_date || "—"}</td></tr>
  </table>
  ${assignedV ? `
  <h2>Vehículo Asignado</h2>
  <table>
    <tr><th>Marca / Modelo</th><td>${assignedV.brand} ${assignedV.vehicle_name} ${assignedV.model || ""}</td></tr>
    <tr><th>Placas</th><td>${assignedV.plate_number}</td></tr>
    <tr><th>VIN</th><td>${assignedV.vin || "—"}</td></tr>
    <tr><th>Renta Semanal</th><td>$${assignedV.rent_cost.toLocaleString()}</td></tr>
  </table>
  ` : ""}
  <h2>Documentos</h2>
  <div class="docs">
    ${driver.driver_photo_img ? `<div class="doc-item"><img src="${resolveDocUrl(driver.driver_photo_img)}" alt="Foto" /><span>Foto del Chofer</span></div>` : ""}
    ${driver.ine_img ? `<div class="doc-item"><img src="${resolveDocUrl(driver.ine_img)}" alt="INE" /><span>INE</span></div>` : ""}
    ${driver.license_img ? `<div class="doc-item"><img src="${resolveDocUrl(driver.license_img)}" alt="Licencia" /><span>Licencia</span></div>` : ""}
    ${driver.address_proof_img ? `<div class="doc-item"><img src="${resolveDocUrl(driver.address_proof_img)}" alt="Comprobante" /><span>Comprobante de Domicilio</span></div>` : ""}
  </div>
  <p class="footer">Fleet Control · Exportado el ${new Date().toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" })}</p>
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;
    win.document.write(doc);
    win.document.close();
  };

  const handleDeleteDriver = async (id: string) => {
    const confirmed = await requirePasskeyConfirmation("¿Estás seguro de que deseas eliminar este chofer? Se desvinculará de cualquier vehículo activo.");
    if (!confirmed) return;
    const success = await deleteDriver(id);
    if (success) {
      setDrivers((prev) => prev.filter((d) => d.id !== id));
      onRefreshAlerts();
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
    startCamera("LICENCIA");
  };

  const submitLicenseRenewal = async () => {
    if (!renewingDriver) return;
    await saveDriver({
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

  const handleCondonation = async (rental: WeeklyRental, days: number) => {
    if (days <= 0) return;
    const dailyRate = rental.rent_amount / 7;
    const condonedAmount = Math.round(dailyRate * days);
    const updated: WeeklyRental = {
      ...rental,
      condoned_days: (rental.condoned_days || 0) + days,
      condoned_amount: (rental.condoned_amount || 0) + condonedAmount,
    };
    const effectiveRent = rental.rent_amount - updated.condoned_amount;
    if (rental.paid_amount >= effectiveRent) updated.status = "PAID";
    else if (rental.paid_amount > 0) updated.status = "PARTIAL";
    else updated.status = "UNPAID";
    await saveWeeklyRental(updated);
    setCondonationDialog(null);
    onRefreshAlerts();
  };

  const handlePayment = async (rental: WeeklyRental, amount: number) => {
    if (amount <= 0) return;
    await applyRentalPayment(rental.id, amount);
    setPaymentDialog(null);
    onRefreshAlerts();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !paternalLastName || !licenseCurp) {
      alert("Por favor completa los campos requeridos: Nombre, Apellido Paterno y CURP.");
      return;
    }

    const isDuplicate = drivers.some(
      (d) =>
        d.id !== editingDriverId &&
        (d.curp.toLowerCase().trim() === licenseCurp.toLowerCase().trim() ||
          (d.license_number && licenseNumber && d.license_number.toLowerCase().trim() === licenseNumber.toLowerCase().trim()) ||
          (d.ine_elector_key && ineElectorKey && d.ine_elector_key.toLowerCase().trim() === ineElectorKey.toLowerCase().trim()))
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

      await saveDriver({
        id: editingDriverId || undefined,
        first_name: firstName,
        paternal_last_name: paternalLastName,
        maternal_last_name: maternalLastName,
        curp: licenseCurp,
        dob: ineDob,
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
    setEditingDriverId(null);
    setShowManualFields(false);
    stopCamera();
  };

  // --- OCR ---
  const processOcrOnImageSource = async (imageSource: string, target: "INE" | "LICENCIA") => {
    setOcrStep("scan");
    const initOcrMsg = `[OCR] Iniciando reconocimiento para ${target}...`;
    console.log(initOcrMsg);
    setOcrLogs((prev) => [...prev, initOcrMsg, "[OCR] Intentando transcripción en la nube con Gemini..."]);

    try {
      const apiResponse = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageSource, target }),
      });

      if (apiResponse.ok) {
        const parsed = await apiResponse.json();
        console.log("[OCR API Result]:", parsed);
        setOcrLogs((prev) => [...prev, "[OK] [OCR] Transcripción por Gemini finalizada exitosamente."]);
        setOcrStep("extract");

        if (target === "INE") {
          setIneImg(imageSource);
          if (parsed.curp) { setIneCurp(parsed.curp); setIneDob(parsed.dob || ""); setOcrLogs((prev) => [...prev, `[OK] [Gemini] CURP INE: ${parsed.curp}`]); }
          if (parsed.electorKey) { setIneElectorKey(parsed.electorKey); setOcrLogs((prev) => [...prev, `[OK] [Gemini] Clave Elector: ${parsed.electorKey}`]); }
          if (parsed.firstName) setFirstName(parsed.firstName);
          if (parsed.paternalLastName) setPaternalLastName(parsed.paternalLastName);
          if (parsed.maternalLastName) setMaternalLastName(parsed.maternalLastName);
          if (parsed.sex) setIneSex(parsed.sex);
          if (parsed.address) setIneAddress(parsed.address);
        } else {
          setLicenseImg(imageSource);
          if (parsed.licenseNumber) {
            if (renewingDriver) setRenewNumber(parsed.licenseNumber);
            else setLicenseNumber(parsed.licenseNumber);
            setOcrLogs((prev) => [...prev, `[OK] [Gemini] Licencia: ${parsed.licenseNumber}`]);
          }
          if (parsed.expirationDate) {
            if (renewingDriver) setRenewExpirationDate(parsed.expirationDate);
            else setLicenseExpirationDate(parsed.expirationDate);
            setOcrLogs((prev) => [...prev, `[OK] [Gemini] Expiración Licencia: ${parsed.expirationDate}`]);
          }
          if (renewingDriver) { setRenewIsPermanent(false); setIsRenewOpen(true); }
          if (parsed.curp && !licenseCurp) setLicenseCurp(parsed.curp);
          if (parsed.firstName && !firstName) setFirstName(parsed.firstName);
          if (parsed.paternalLastName && !paternalLastName) setPaternalLastName(parsed.paternalLastName);
          if (parsed.maternalLastName && !maternalLastName) setMaternalLastName(parsed.maternalLastName);
        }

        setOcrStep("done");
        setTimeout(() => { setIsScanning(false); setScanTarget(null); }, 1500);
        return;
      } else {
        const errJson = await apiResponse.json();
        console.warn("[OCR API Fail]:", errJson.error || "Unknown error");
        setOcrLogs((prev) => [...prev, `⚠ [OCR API] ${errJson.error || "Fallo API"}. Usando Tesseract local...`]);
      }
    } catch (err) {
      console.warn("[OCR API Connection Error]:", err);
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
      const extractedText = result.data.text;
      console.log(`[OCR Texto Crudo Fallback]:\n`, extractedText);
      const parsed = parseOcrText(extractedText, target);
      console.log(`[OCR Objeto Fallback]:`, parsed);

      if (target === "INE") {
        setIneImg(imageSource);
        if (parsed.curp) { setIneCurp(parsed.curp); setIneDob(parsed.dob || ""); setOcrLogs((prev) => [...prev, `[OK] [Parser Local] CURP INE: ${parsed.curp}`]); }
        if (parsed.electorKey) { setIneElectorKey(parsed.electorKey); setOcrLogs((prev) => [...prev, `[OK] [Parser Local] Clave Elector: ${parsed.electorKey}`]); }
        if (parsed.firstName) setFirstName(parsed.firstName);
        if (parsed.paternalLastName) setPaternalLastName(parsed.paternalLastName);
        if (parsed.maternalLastName) setMaternalLastName(parsed.maternalLastName);
        if (parsed.sex) setIneSex(parsed.sex);
        if (parsed.address) setIneAddress(parsed.address);
      } else {
        setLicenseImg(imageSource);
        if (parsed.licenseNumber) setLicenseNumber(parsed.licenseNumber);
        if (parsed.expirationDate) setLicenseExpirationDate(parsed.expirationDate);
        if (parsed.curp && !licenseCurp) setLicenseCurp(parsed.curp);
      }

      setOcrStep("done");
      setOcrLogs((prev) => [...prev, "[OK] [OCR] Extracción local finalizada."]);
      setTimeout(() => { setIsScanning(false); setScanTarget(null); }, 2000);
    } catch (err: unknown) {
      console.error("[OCR] Fallo en la transcripción local:", err);
      const errorMsg = `[ERROR] [OCR] Error: ${err instanceof Error ? err.message : String(err)}`;
      setOcrLogs((prev) => [...prev, errorMsg]);
      setTimeout(() => { setIsScanning(false); setScanTarget(null); }, 3000);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, target: "INE" | "LICENCIA") => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanning(true);
    setScanTarget(target);
    setOcrStep("align");
    setOcrLogs([`[Archivo] Cargando: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`]);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") processOcrOnImageSource(reader.result, target);
      else { setOcrLogs((prev) => [...prev, "[ERROR] Error al leer el archivo en formato Base64"]); setIsScanning(false); }
    };
    reader.onerror = () => { setOcrLogs((prev) => [...prev, "[ERROR] Error de lectura del archivo"]); setIsScanning(false); };
    reader.readAsDataURL(file);
  };

  const handleAddressProofFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => { if (event.target?.result) setAddressProofImg(event.target.result as string); };
    reader.readAsDataURL(file);
  };

  // --- Derived ---
  const filteredDrivers = useMemo(
    () =>
      drivers.filter(
        (d) =>
          `${d.first_name} ${d.paternal_last_name} ${d.maternal_last_name}`.toLowerCase().includes(search.toLowerCase()) ||
          d.curp.toLowerCase().includes(search.toLowerCase())
      ),
    [drivers, search]
  );

  const currentDob = ineDob;
  const suggestedCurp = useMemo(
    () =>
      firstName && paternalLastName && currentDob
        ? calculateCurp({ firstName, paternalLastName, maternalLastName, dob: currentDob, sex: ineSex, stateCode: birthState })
        : "",
    [firstName, paternalLastName, maternalLastName, currentDob, ineSex, birthState]
  );

  const applySuggestedCurp = () => {
    if (suggestedCurp) {
      setLicenseCurp(suggestedCurp);
      setIneCurp(suggestedCurp);
    }
  };

  const manualFieldsCount = useMemo(() => {
    const fields = [firstName, paternalLastName, maternalLastName, licenseCurp, licenseNumber, licenseExpirationDate, ineCurp, ineDob, ineElectorKey, ineAddress];
    return fields.filter((f) => f && f.trim().length > 0).length;
  }, [firstName, paternalLastName, maternalLastName, licenseCurp, licenseNumber, licenseExpirationDate, ineCurp, ineDob, ineElectorKey, ineAddress]);
  const MANUAL_FIELDS_TOTAL = 10;

  return {
    // State
    drivers,
    vehicles,
    search,
    setSearch,
    isLoading,
    showArchived,
    setShowArchived,
    isOpen,
    setIsOpen,
    editingDriverId,
    isRenewOpen,
    setIsRenewOpen,
    renewingDriver,
    setRenewingDriver,
    renewNumber,
    setRenewNumber,
    renewIssueDate,
    setRenewIssueDate,
    renewExpirationDate,
    setRenewExpirationDate,
    renewIsPermanent,
    setRenewIsPermanent,
    previewImage,
    setPreviewImage,
    isScanning,
    scanner,
    activeSection,
    scrollToSection,
    showManualFields,
    setShowManualFields,
    expandedDriverDetails,
    condonationDialog,
    setCondonationDialog,
    paymentDialog,
    setPaymentDialog,
    weeklyRentals,

    // Form state
    firstName, setFirstName,
    paternalLastName, setPaternalLastName,
    maternalLastName, setMaternalLastName,
    licenseCurp, setLicenseCurp,
    ineCurp, setIneCurp,
    licenseDob, setLicenseDob,
    ineDob, setIneDob,
    licenseNumber, setLicenseNumber,
    licenseIssueDate, setLicenseIssueDate,
    licenseExpirationDate, setLicenseExpirationDate,
    licenseIsPermanent, setLicenseIsPermanent,
    ineAddress, setIneAddress,
    ineSex, setIneSex,
    ineElectorKey, setIneElectorKey,
    birthState, setBirthState,
    driverPhotoImg, setDriverPhotoImg,
    addressProofImg, setAddressProofImg,
    ineImg, setIneImg,
    licenseImg, setLicenseImg,

    // Refs
    ineFileRef,
    licFileRef,
    photoFileRef,
    addressProofFileRef,
    addressProofCameraRef,

    // Derived
    filteredDrivers,
    suggestedCurp,
    applySuggestedCurp,
    manualFieldsCount,
    MANUAL_FIELDS_TOTAL,

    // Handlers
    toggleDriverDetails,
    exportDriverPdf,
    handleDeleteDriver,
    handleEditDriver,
    handleRenewLicense,
    submitLicenseRenewal,
    handleCondonation,
    handlePayment,
    handleSave,
    resetForm,
    handleFileChange,
    handleAddressProofFile,
    startCamera,
    stopCamera,
    onOpenActionSheet,
    onAssignDriver,
    onRefreshAlerts,
  };
}
