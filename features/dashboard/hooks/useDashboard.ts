"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { db, Driver, Vehicle, Checklist, WeeklyRental, Alert, User } from "@/lib/db";
import { formatDate, sortByDateDesc } from "@/lib/utils";
import { getVerificationSchedule } from "@/lib/db";
import { uploadDocumentImage } from "@/lib/db/storage";
import { getSession, syncSessionFromServer } from "@/lib/auth";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";

export type TabId = "dashboard" | "drivers" | "vehicles" | "users";

/** Map the session mirror to the User shape the dashboard renders with. */
function toUserView(s: { userId: string; email: string | null; displayName: string; role: "admin" | "owner" }): User {
  return {
    id: s.userId,
    display_name: s.displayName,
    email: s.email || null,
    role: s.role,
    webauthn_credentials: [],
    metadata: {},
    is_active: true,
    last_login_at: null,
    created_at: "",
    updated_at: "",
  };
}

export function useDashboard() {
  const [session, setSession] = useState<User | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [stats, setStats] = useState({ vehicles: 0, drivers: 0, assigned: 0 });
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [weeklyRentals, setWeeklyRentals] = useState<WeeklyRental[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [globalSearch, setGlobalSearch] = useState("");
  const [currentTime, setCurrentTime] = useState("");
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuzonOpen, setIsBuzonOpen] = useState(false);

  // Dialog states
  const [actionSheet, setActionSheet] = useState<{
    open: boolean;
    entity: Driver | Vehicle;
    type: "driver" | "vehicle";
    driver?: Driver | null;
    vehicle?: Vehicle | null;
  } | null>(null);
  const [checklistSheet, setChecklistSheet] = useState<{ open: boolean; vehicle: Vehicle | null }>({ open: false, vehicle: null });
  const [actionModal, setActionModal] = useState<{ open: boolean; vehicle: Vehicle | null }>({ open: false, vehicle: null });
  const [autoOpenDriver, setAutoOpenDriver] = useState(false);
  const [autoOpenVehicle, setAutoOpenVehicle] = useState(false);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [assignmentPreselectDriver, setAssignmentPreselectDriver] = useState<string | null>(null);
  const [assignmentPreselectVehicle, setAssignmentPreselectVehicle] = useState<string | null>(null);
  const [statsDialog, setStatsDialog] = useState<{
    driver: Driver;
    usage: { weeks: { weekStart: string; km: number; kmPerDay: number }[]; monthlyAverage: number | null };
  } | null>(null);
  const [wearPartVehicle, setWearPartVehicle] = useState<Vehicle | null>(null);
  const [wearPartDialogOpen, setWearPartDialogOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [inventoryVehicle, setInventoryVehicle] = useState<Vehicle | null>(null);
  const [inventoryExisting, setInventoryExisting] = useState<{ photos: { angle: string; url: string }[]; items: { name: string; quantity: number }[] } | null>(null);

  // Payment dialog
  const [paymentDialog, setPaymentDialog] = useState<{ open: boolean; vehicle: Vehicle | null; driverId: string | null; rental: WeeklyRental | null; amount: number }>({
    open: false, vehicle: null, driverId: null, rental: null, amount: 0,
  });

  const handlePayment = async (vehicle: Vehicle) => {
    const driverId = vehicle.active_driver_id;
    if (!driverId) { toast("El vehículo no tiene chofer asignado", "error"); return; }
    const rentals = await db.getWeeklyRentals();
    const currentRental = rentals.find((r) => r.driver_id === driverId && r.status !== "PAID");
    if (!currentRental) { toast("No hay renta activa para este chofer", "error"); return; }
    setPaymentDialog({ open: true, vehicle, driverId, rental: currentRental, amount: 0 });
  };

  const submitPayment = async () => {
    const pd = paymentDialog;
    if (!pd.rental || pd.amount <= 0) return;
    const updated: WeeklyRental = {
      ...pd.rental,
      paid_amount: pd.rental.paid_amount + pd.amount,
    };
    const effectiveRent = pd.rental.rent_amount - (pd.rental.condoned_amount || 0);
    if (updated.paid_amount >= effectiveRent) updated.status = "PAID";
    else if (updated.paid_amount > 0) updated.status = "PARTIAL";
    else updated.status = "UNPAID";
    await db.saveWeeklyRental(updated);
    setPaymentDialog((prev: typeof paymentDialog) => ({ ...prev, open: false }));
    toast(`Pago de $${pd.amount.toLocaleString()} registrado`, "success");
    triggerRefresh();
  };

  const { toast } = useToast();
  const { confirm: showConfirm } = useConfirm();

  const setAssignmentPreselect = (driverId: string | null, vehicleId: string | null) => {
    setAssignmentPreselectDriver(driverId);
    setAssignmentPreselectVehicle(vehicleId);
  };

  const openStatsDialog = (
    driver: Driver,
    usage: { weeks: { weekStart: string; km: number; kmPerDay: number }[]; monthlyAverage: number | null }
  ) => setStatsDialog({ driver, usage });

  // Screen size detection
  useEffect(() => {
    const check = () => setIsLargeScreen(window.innerWidth >= 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Session restore: mirror for instant render, then re-sync with the
  // authoritative HttpOnly cookie (role changes, deactivated accounts,
  // server-side logout take effect here — the mirror is never trusted).
  useEffect(() => {
    Promise.resolve().then(() => {
      const s = getSession();
      setSession(s ? toUserView(s) : null);
      setIsSessionLoading(false);
      void syncSessionFromServer().then((synced) => {
        if (!synced) {
          setSession(null);
          window.location.href = "/";
        } else {
          setSession(toUserView(synced));
        }
      });
    });
  }, []);

  const handleLogin = (user: User) => setSession(user);

  // Time
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const formatted = now.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
      setCurrentTime(formatted.charAt(0).toUpperCase() + formatted.slice(1));
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Data loading
  const loadAlerts = useCallback(async () => {
    const list = await db.getAlerts();
    setAlerts(list);
  }, []);

  const loadStats = useCallback(async () => {
    const vList = await db.getVehicles();
    const dList = await db.getDrivers();
    const aList = await db.getAssignments();
    const cList = await db.getChecklists();
    const rList = await db.getWeeklyRentals();

    setVehicles(vList);
    setDrivers(dList);
    setChecklists(cList);
    setWeeklyRentals(rList);

    const activeAss = aList.filter((x) => x.action_type === "ASSIGN");
    const activeVehicles = new Set(activeAss.map((x) => x.vehicle_id));
    setStats({ vehicles: vList.length, drivers: dList.length, assigned: activeVehicles.size });

  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([loadAlerts(), loadStats()]);
    } catch (e) {
      console.error("Error loading dashboard data:", e);
    } finally {
      setIsLoading(false);
    }
  }, [loadAlerts, loadStats]);

  useEffect(() => { Promise.resolve().then(() => { void loadData(); }); }, [loadData, refreshTrigger]);

  // Derived
  const filteredDriversList = useMemo(() => {
    return drivers.filter((driver) => {
      const name = `${driver.first_name} ${driver.paternal_last_name} ${driver.maternal_last_name}`.toLowerCase();
      const matchName = name.includes(globalSearch.toLowerCase());
      const assignedVehicle = vehicles.find((v) => v.active_driver_id === driver.id);
      const matchPlate = assignedVehicle ? assignedVehicle.plate_number.toLowerCase().includes(globalSearch.toLowerCase()) : false;
      return matchName || matchPlate;
    });
  }, [drivers, vehicles, globalSearch]);

  const getVehicleDesc = (id: string) => {
    const v = vehicles.find((x) => x.id === id);
    return v ? `${v.brand} ${v.vehicle_name}` : "Vehículo";
  };

  const getDriverDesc = (id: string) => {
    const d = drivers.find((x) => x.id === id);
    return d ? `${d.first_name} ${d.paternal_last_name}` : "Conductor";
  };

  // Handlers
  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    setGlobalSearch("");
  };

  const triggerRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const openActionSheet = (entity: Driver | Vehicle, type: "driver" | "vehicle") => {
    if (type === "driver") {
      const d = entity as Driver;
      const v = vehicles.find((x) => x.active_driver_id === d.id) || null;
      setActionSheet({ open: true, entity: d, type: "driver", driver: d, vehicle: v });
    } else {
      const v = entity as Vehicle;
      const d = drivers.find((x) => x.id === v.active_driver_id) || null;
      setActionSheet({ open: true, entity: v, type: "vehicle", driver: d, vehicle: v });
    }
  };

  const openChecklistSheet = (vehicle: Vehicle) => {
    setActionSheet(null);
    setChecklistSheet({ open: true, vehicle });
  };

  const openActionModal = (vehicle: Vehicle) => {
    setActionModal({ open: true, vehicle });
  };

  const handleVehicleAssignedFromSheet = (vehicle: Vehicle) => {
    openChecklistSheet(vehicle);
  };

  const activeEntity = useMemo(() => {
    if (!actionSheet?.entity) return null;
    if (actionSheet.type === "driver") return drivers.find((d) => d.id === (actionSheet.entity as Driver).id) ?? actionSheet.entity;
    return vehicles.find((v) => v.id === (actionSheet.entity as Vehicle).id) ?? actionSheet.entity;
  }, [actionSheet, drivers, vehicles]);

  const isEntityAssigned = !!activeEntity && (
    actionSheet?.type === "driver"
      ? vehicles.some((v) => v.active_driver_id === activeEntity.id)
      : !!(activeEntity as Vehicle | null)?.active_driver_id
  );

  const handleActionComplete = () => triggerRefresh();

  // Service handlers
  const handleServiceOut = async (vehicle: Vehicle) => {
    if (!(await showConfirm({ title: "Retirar a Servicio", message: `¿Retirar ${vehicle.brand} ${vehicle.vehicle_name} (${vehicle.plate_number}) a servicio?`, confirmLabel: "Retirar", variant: "warning" }))) return;
    await db.saveVehicle({ ...vehicle, status: "in_service", service_out_date: new Date().toISOString().split("T")[0], service_return_date: null });
    triggerRefresh();
  };

  const handleServiceReturn = async (vehicle: Vehicle) => {
    if (!(await showConfirm({ title: "Devolver a Chofer", message: `¿Regresar ${vehicle.brand} ${vehicle.vehicle_name} (${vehicle.plate_number}) a su chofer?`, confirmLabel: "Devolver", variant: "default" }))) return;
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
    triggerRefresh();
  };

  const handleWearPart = (vehicle: Vehicle) => {
    setWearPartVehicle(vehicle);
    setWearPartDialogOpen(true);
  };

  const handleInventory = async (vehicle: Vehicle) => {
    setInventoryVehicle(vehicle);
    const existing = await db.getVehicleInventory(vehicle.id);
    setInventoryExisting(existing ? { photos: existing.photos, items: existing.items } : null);
    setInventoryOpen(true);
  };

  const handleSaveInventory = async (photos: { angle: string; dataUrl: string | null }[], items: { name: string; quantity: number }[]) => {
    if (!inventoryVehicle) return;
    const photoEntries: { angle: string; url: string }[] = [];
    for (const p of photos) {
      if (p.dataUrl) {
        const url = await uploadDocumentImage(p.dataUrl, `inventario/${inventoryVehicle.id}/${p.angle}`);
        photoEntries.push({ angle: p.angle, url });
      } else {
        const existing = inventoryExisting?.photos.find((ep) => ep.angle === p.angle);
        photoEntries.push({ angle: p.angle, url: existing?.url || "" });
      }
    }
    await db.saveVehicleInventory({ vehicle_id: inventoryVehicle.id, photos: photoEntries, items });
    triggerRefresh();
  };

  const handleDismissAlert = async (id: string, title: string) => {
    if (await showConfirm({ title: "Completar Alerta", message: `¿Deseas marcar la alerta "${title}" como completada?`, confirmLabel: "Completar", variant: "default" })) {
      await db.dismissAlert(id);
      loadAlerts();
    }
  };

  const exportChecklistCsv = () => {
    const headers = ["Chofer", "Auto", "Placa", "ID Auto", "Km Anterior", "Km Nuevo", "Renta", "Pendiente"];
    const rows = filteredDriversList
      .filter((driver) => vehicles.some((v) => v.active_driver_id === driver.id))
      .map((driver) => {
        const v = vehicles.find((vv) => vv.active_driver_id === driver.id)!;
        const vChecks = checklists.filter((c) => c.vehicle_id === v.id);
        const sorted = sortByDateDesc(vChecks, "created_at");
        const latestKm = sorted[0]?.mileage;
        const prevKm = sorted[1]?.mileage;
        const vehicleId = v.vin?.slice(-6).toUpperCase() || "—";
        const driverRentals = weeklyRentals.filter((r) => r.driver_id === driver.id && r.status !== "PAID");
        const totalPending = driverRentals.reduce((acc, r) => acc + Math.max(0, r.rent_amount - r.paid_amount), 0);
        return [`${driver.first_name} ${driver.paternal_last_name}`, `${v.brand} ${v.vehicle_name}`, v.plate_number, vehicleId, prevKm?.toLocaleString() || "—", latestKm?.toLocaleString() || "—", `$${v.rent_cost.toLocaleString()}`, `$${totalPending.toLocaleString()}`];
      });
    const csvContent = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `checklists-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Checklists exportados a CSV", "success");
  };

  // Verification helpers
  const getVerificationWindow = (plate: string) => {
    if (!plate) return null;
    const schedule = getVerificationSchedule(plate);
    const match = plate.replace(/\D/g, "");
    const lastDigit = match ? parseInt(match.slice(-1), 10) : 5;
    const today = new Date();
    type Window = { limitDate: string; period: string };
    let activeWindow: Window | null = null;

    if (lastDigit === 5 || lastDigit === 6) {
      activeWindow = today.getMonth() <= 2 ? { limitDate: `${today.getFullYear()}-03-31`, period: "Primer Semestre (Feb-Mar)" } : { limitDate: `${today.getFullYear()}-09-30`, period: "Segundo Semestre (Ago-Sep)" };
    } else if (lastDigit === 7 || lastDigit === 8) {
      activeWindow = today.getMonth() <= 3 ? { limitDate: `${today.getFullYear()}-04-30`, period: "Primer Semestre (Mar-Abr)" } : { limitDate: `${today.getFullYear()}-10-31`, period: "Segundo Semestre (Sep-Oct)" };
    } else if (lastDigit === 3 || lastDigit === 4) {
      activeWindow = today.getMonth() <= 4 ? { limitDate: `${today.getFullYear()}-05-31`, period: "Primer Semestre (Abr-May)" } : { limitDate: `${today.getFullYear()}-11-30`, period: "Segundo Semestre (Oct-Nov)" };
    } else if (lastDigit === 1 || lastDigit === 2) {
      activeWindow = today.getMonth() <= 5 ? { limitDate: `${today.getFullYear()}-06-30`, period: "Primer Semestre (May-Jun)" } : { limitDate: `${today.getFullYear()}-12-31`, period: "Segundo Semestre (Nov-Dic)" };
    } else {
      activeWindow = today.getMonth() >= 10 || today.getMonth() === 0
        ? { limitDate: `${today.getMonth() === 0 ? today.getFullYear() : today.getFullYear() + 1}-01-31`, period: "Segundo Semestre (Dic-Ene)" }
        : { limitDate: `${today.getFullYear()}-07-31`, period: "Primer Semestre (Jun-Jul)" };
    }
    return { color: schedule.color, period: activeWindow.period, limitDate: activeWindow.limitDate, lastDigit };
  };

  const getDateStatus = (dateStr: string | null) => {
    if (!dateStr) return { label: "N/D", colorClass: "bg-slate-100 text-slate-600" };
    const today = new Date();
    const date = new Date(dateStr);
    const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return { label: `Vencido (${formatDate(dateStr)})`, colorClass: "bg-red-500/10 text-red-600 border border-red-500/20" };
    if (diffDays <= 30) return { label: `Vence en ${diffDays}d (${formatDate(dateStr)})`, colorClass: "bg-amber-500/10 text-amber-600 border border-amber-500/20" };
    return { label: `Vence: ${formatDate(dateStr)}`, colorClass: "bg-green-500/10 text-green-600 border border-green-500/20" };
  };

  return {
    // State
    session, isSessionLoading, activeTab, alerts, stats, vehicles, drivers, weeklyRentals, checklists,
    globalSearch, setGlobalSearch, currentTime, isLargeScreen, isLoading, isBuzonOpen, setIsBuzonOpen,
    filteredDriversList, refreshTrigger,

    // Dialog states
    actionSheet, setActionSheet, checklistSheet, setChecklistSheet, actionModal, setActionModal,
    autoOpenDriver, setAutoOpenDriver, autoOpenVehicle, setAutoOpenVehicle,
    assignmentDialogOpen, setAssignmentDialogOpen,
    assignmentPreselectDriver, assignmentPreselectVehicle, setAssignmentPreselect,
    statsDialog, setStatsDialog, openStatsDialog,
    wearPartVehicle, setWearPartVehicle, wearPartDialogOpen, setWearPartDialogOpen,
    inventoryOpen, setInventoryOpen, inventoryVehicle, setInventoryVehicle, inventoryExisting, setInventoryExisting,
    paymentDialog, setPaymentDialog,

    // Derived
    activeEntity, isEntityAssigned,

    // Handlers
    handleLogin, handleTabChange, triggerRefresh,
    openActionSheet, openChecklistSheet, openActionModal, handleVehicleAssignedFromSheet,
    handleActionComplete, handleServiceOut, handleServiceReturn, handleWearPart,
    handleInventory, handleSaveInventory, handleDismissAlert,
    handlePayment, submitPayment,
    exportChecklistCsv, getVerificationWindow, getDateStatus,
    getVehicleDesc, getDriverDesc,
    loadAlerts, loadData,
  };
}
