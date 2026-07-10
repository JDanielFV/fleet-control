"use client";

import React, { useState, useEffect, useMemo } from "react";
import { db, Alert, Driver, Vehicle, Assignment, Checklist, WeeklyRental, getVerificationSchedule } from "@/lib/db";
import type { User as UserType } from "@/lib/db";
import { formatDate, sortByDateDesc } from "@/lib/utils";
import { computeUsageStats } from "@/lib/usageStats";
import { getDriverName } from "@/lib/lookups";
import DriversSlice from "./DriversSlice";
import VehiclesSlice from "./VehiclesSlice";
import UsersSlice from "./UsersSlice";
import LoginScreen from "./LoginScreen";
import { EntityActionSheet } from "./EntityActionSheet";
import { ChecklistSheet } from "./ChecklistSheet";
import AssignmentDialog from "./AssignmentDialog";
import ChecklistActionModal from "./ChecklistActionModal";
import WearPartDialog from "./WearPartDialog";
import InventoryWizard from "./InventoryWizard";
import { uploadDocumentImage } from "@/lib/db/storage";
import Sidebar from "./Sidebar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DashboardSkeleton } from "@/components/ui/skeletons";
import {
  Bell,
  User,
  Car,
  ArrowLeftRight,
  CheckCircle,
  AlertTriangle,
  Sun,
  Moon,
  Sparkles,
  Shield,
  ShieldAlert,
  Gauge,
  Search,
  X,
  CheckCircle2,
  BarChart3,
  Download,
} from "lucide-react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";

export type TabId = "dashboard" | "drivers" | "vehicles" | "users";

export default function Dashboard() {
  const [session, setSession] = useState<UserType | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [stats, setStats] = useState({ vehicles: 0, drivers: 0, assigned: 0 });
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [weeklyRentals, setWeeklyRentals] = useState<WeeklyRental[]>([]);
  const [recentAssignments, setRecentAssignments] = useState<Assignment[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [globalSearch, setGlobalSearch] = useState("");
  const [currentTime, setCurrentTime] = useState("");
  const [actionSheet, setActionSheet] = useState<{
    open: boolean;
    entity: Driver | Vehicle;
    type: "driver" | "vehicle";
    driver?: Driver | null;
    vehicle?: Vehicle | null;
  } | null>(null);
  const [checklistSheet, setChecklistSheet] = useState<{ open: boolean, vehicle: Vehicle | null }>({ open: false, vehicle: null });
  const [actionModal, setActionModal] = useState<{ open: boolean, vehicle: Vehicle | null }>({ open: false, vehicle: null });
  const [isBuzonOpen, setIsBuzonOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  // Auto-open flags: when set, the corresponding slice opens its registration
  // dialog on mount. The slice calls onAutoOpenConsumed to clear the flag.
  const [autoOpenDriver, setAutoOpenDriver] = useState(false);
  const [autoOpenVehicle, setAutoOpenVehicle] = useState(false);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [assignmentPreselectDriver, setAssignmentPreselectDriver] = useState<string | null>(null);
  const [assignmentPreselectVehicle, setAssignmentPreselectVehicle] = useState<string | null>(null);
  const setAssignmentPreselect = (driverId: string | null, vehicleId: string | null) => {
    setAssignmentPreselectDriver(driverId);
    setAssignmentPreselectVehicle(vehicleId);
  };
  // Stats dialog state
  const [statsDialog, setStatsDialog] = useState<{
    driver: Driver;
    usage: { weeks: { weekStart: string; km: number; kmPerDay: number }[]; monthlyAverage: number | null };
  } | null>(null);
  const openStatsDialog = (
    driver: Driver,
    usage: { weeks: { weekStart: string; km: number; kmPerDay: number }[]; monthlyAverage: number | null }
  ) => setStatsDialog({ driver, usage });

  const { toast } = useToast();
  const { confirm: showConfirm } = useConfirm();

  useEffect(() => {
    const checkScreenSize = () => {
      setIsLargeScreen(window.innerWidth >= 1024);
    };
    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  // Restore session from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("fleet_session");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSession({
          id: parsed.userId,
          display_name: parsed.displayName,
          email: null,
          role: parsed.role,
          webauthn_credentials: [],
          metadata: {},
          is_active: true,
          last_login_at: parsed.loginAt,
          created_at: "",
          updated_at: "",
        });
      } catch {}
    }
    setIsSessionLoading(false);
  }, []);

  const handleLogin = (user: UserType) => {
    setSession(user);
  };

  // Display current time in the greeting area.
  const greeting = useMemo(() => {
    return currentTime ? `${currentTime}` : "";
  }, [currentTime]);

  const loadAlerts = async () => {
    const list = await db.getAlerts();
    setAlerts(list);
  };

  const loadStats = async () => {
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

    setStats({
      vehicles: vList.length,
      drivers: dList.length,
      assigned: activeVehicles.size,
    });

    const sortedAss = sortByDateDesc(aList, "created_at");
    setRecentAssignments(sortedAss.slice(0, 10));
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([loadAlerts(), loadStats()]);
    } catch (e) {
      console.error("Error loading dashboard data:", e);
    } finally {
      setIsLoading(false);
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
        return [
          `${driver.first_name} ${driver.paternal_last_name}`,
          `${v.brand} ${v.vehicle_name}`,
          v.plate_number,
          vehicleId,
          prevKm?.toLocaleString() || "—",
          latestKm?.toLocaleString() || "—",
          `$${v.rent_cost.toLocaleString()}`,
          `$${totalPending.toLocaleString()}`,
        ];
      });
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `checklists-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Checklists exportados a CSV", "success");
  };

  useEffect(() => {
    loadData();
  }, [refreshTrigger]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const dateOptions: Intl.DateTimeFormatOptions = {
        weekday: "long",
        day: "numeric",
        month: "long",
      };
      const formattedDate = now.toLocaleDateString("es-MX", dateOptions);
      const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
      setCurrentTime(capitalizedDate);
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const getVehicleDesc = (id: string) => {
    const v = vListFind(id);
    return v ? `${v.brand} ${v.vehicle_name}` : "Vehículo";
  };

  const getDriverDesc = (id: string) => {
    const d = dListFind(id);
    return d ? `${d.first_name} ${d.paternal_last_name}` : "Conductor";
  };

  const vListFind = (id: string) => vehicles.find((x) => x.id === id);
  const dListFind = (id: string) => drivers.find((x) => x.id === id);

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    setGlobalSearch("");
  };

  const triggerRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  // CDMX Verification Range and Color Helper
  const getVerificationWindow = (plate: string) => {
    if (!plate) return null;
    const schedule = getVerificationSchedule(plate);
    const match = plate.replace(/\D/g, "");
    const lastDigit = match ? parseInt(match.slice(-1), 10) : 5;
    const today = new Date();
    
    type Window = { limitDate: string; period: string };
    let activeWindow: Window | null = null;

    if (lastDigit === 5 || lastDigit === 6) {
      activeWindow = today.getMonth() <= 2
        ? { limitDate: `${today.getFullYear()}-03-31`, period: "Primer Semestre (Feb-Mar)" }
        : { limitDate: `${today.getFullYear()}-09-30`, period: "Segundo Semestre (Ago-Sep)" };
    } else if (lastDigit === 7 || lastDigit === 8) {
      activeWindow = today.getMonth() <= 3
        ? { limitDate: `${today.getFullYear()}-04-30`, period: "Primer Semestre (Mar-Abr)" }
        : { limitDate: `${today.getFullYear()}-10-31`, period: "Segundo Semestre (Sep-Oct)" };
    } else if (lastDigit === 3 || lastDigit === 4) {
      activeWindow = today.getMonth() <= 4
        ? { limitDate: `${today.getFullYear()}-05-31`, period: "Primer Semestre (Abr-May)" }
        : { limitDate: `${today.getFullYear()}-11-30`, period: "Segundo Semestre (Oct-Nov)" };
    } else if (lastDigit === 1 || lastDigit === 2) {
      activeWindow = today.getMonth() <= 5
        ? { limitDate: `${today.getFullYear()}-06-30`, period: "Primer Semestre (May-Jun)" }
        : { limitDate: `${today.getFullYear()}-12-31`, period: "Segundo Semestre (Nov-Dic)" };
    } else {
      activeWindow = today.getMonth() >= 10 || today.getMonth() === 0
        ? {
            limitDate: `${today.getMonth() === 0 ? today.getFullYear() : today.getFullYear() + 1}-01-31`,
            period: "Segundo Semestre (Dic-Ene)",
          }
        : { limitDate: `${today.getFullYear()}-07-31`, period: "Primer Semestre (Jun-Jul)" };
    }
    return {
      color: schedule.color,
      period: activeWindow.period,
      limitDate: activeWindow.limitDate,
      lastDigit
    };
  };

  // Expiration Status styling helper
  const getDateStatus = (dateStr: string | null) => {
    if (!dateStr) return { label: "N/D", colorClass: "bg-slate-100 text-slate-600  " };
    const today = new Date();
    const date = new Date(dateStr);
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return { label: `Vencido (${formatDate(dateStr)})`, colorClass: "bg-red-500/10 text-red-600  border border-red-500/20" };
    } else if (diffDays <= 30) {
      return { label: `Vence en ${diffDays}d (${formatDate(dateStr)})`, colorClass: "bg-amber-500/10 text-amber-600  border border-amber-500/20" };
    } else {
      return { label: `Vence: ${formatDate(dateStr)}`, colorClass: "bg-green-500/10 text-green-600  border border-green-500/20" };
    }
  };

  // Drivers Filter list
  const filteredDriversList = useMemo(() => {
    return drivers.filter((driver) => {
      const name = `${driver.first_name} ${driver.paternal_last_name} ${driver.maternal_last_name}`.toLowerCase();
      const matchName = name.includes(globalSearch.toLowerCase());
      
      const assignedVehicle = vehicles.find(v => v.active_driver_id === driver.id);
      const matchPlate = assignedVehicle 
        ? assignedVehicle.plate_number.toLowerCase().includes(globalSearch.toLowerCase())
        : false;

      return matchName || matchPlate;
    });
  }, [drivers, vehicles, globalSearch]);

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
    if (actionSheet.type === "driver") {
      return drivers.find(d => d.id === (actionSheet.entity as Driver).id) ?? actionSheet.entity;
    }
    return vehicles.find(v => v.id === (actionSheet.entity as Vehicle).id) ?? actionSheet.entity;
  }, [actionSheet, drivers, vehicles]);

  const isEntityAssigned = !!activeEntity && (
    actionSheet?.type === "driver"
      ? vehicles.some(v => v.active_driver_id === activeEntity.id)
      : !!(activeEntity as Vehicle | null)?.active_driver_id
  );

  const handleActionComplete = () => {
    triggerRefresh();
  };

  // Service out: mark vehicle as in_service
  const handleServiceOut = async (vehicle: Vehicle) => {
    if (!(await showConfirm({ title: "Retirar a Servicio", message: `¿Retirar ${vehicle.brand} ${vehicle.vehicle_name} (${vehicle.plate_number}) a servicio? No generará costo de renta mientras esté en servicio.`, confirmLabel: "Retirar", variant: "warning" }))) return;
    await db.saveVehicle({
      ...vehicle,
      status: "in_service",
      service_out_date: new Date().toISOString().split("T")[0],
      service_return_date: null,
    });
    triggerRefresh();
  };

  // Service return: mark as active, condone days on weekly rental
  const handleServiceReturn = async (vehicle: Vehicle) => {
    if (!(await showConfirm({ title: "Devolver a Chofer", message: `¿Regresar ${vehicle.brand} ${vehicle.vehicle_name} (${vehicle.plate_number}) a su chofer? Se aplicará condonación por los días en taller.`, confirmLabel: "Devolver", variant: "default" }))) return;
    const returnDate = new Date();
    const outDate = vehicle.service_out_date ? new Date(vehicle.service_out_date) : returnDate;
    const daysOut = Math.max(1, Math.round((returnDate.getTime() - outDate.getTime()) / (1000 * 60 * 60 * 24)));
    const discountDays = daysOut === 1 ? 0.5 : daysOut;

    await db.saveVehicle({
      ...vehicle,
      status: "active",
      service_return_date: returnDate.toISOString().split("T")[0],
    });

    if (vehicle.active_driver_id) {
      const rentals = await db.getWeeklyRentals();
      const currentRental = rentals.find(
        (r) => r.driver_id === vehicle.active_driver_id && r.status !== "PAID"
      );
      if (currentRental) {
        const dailyRate = currentRental.rent_amount / 7;
        const condonedAmount = Math.round(dailyRate * discountDays);
        const updated: WeeklyRental = {
          ...currentRental,
          condoned_days: (currentRental.condoned_days || 0) + Math.ceil(discountDays),
          condoned_amount: (currentRental.condoned_amount || 0) + condonedAmount,
        };
        const effectiveRent = updated.rent_amount - updated.condoned_amount;
        if (updated.paid_amount >= effectiveRent) {
          updated.status = "PAID";
        } else if (updated.paid_amount > 0) {
          updated.status = "PARTIAL";
        } else {
          updated.status = "UNPAID";
        }
        await db.saveWeeklyRental(updated);
      }
    }
    triggerRefresh();
  };

  // Wear part: open the wear part dialog via VehiclesSlice
  const [wearPartVehicle, setWearPartVehicle] = useState<Vehicle | null>(null);
  const [wearPartDialogOpen, setWearPartDialogOpen] = useState(false);
  const handleWearPart = (vehicle: Vehicle) => {
    setWearPartVehicle(vehicle);
    setWearPartDialogOpen(true);
  };

  // Inventory wizard
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [inventoryVehicle, setInventoryVehicle] = useState<Vehicle | null>(null);
  const [inventoryExisting, setInventoryExisting] = useState<{ photos: { angle: string; url: string }[]; items: { name: string; quantity: number }[] } | null>(null);
  const handleInventory = async (vehicle: Vehicle) => {
    setInventoryVehicle(vehicle);
    // Load existing inventory from DB
    const existing = await db.getVehicleInventory(vehicle.id);
    setInventoryExisting(existing ? { photos: existing.photos, items: existing.items } : null);
    setInventoryOpen(true);
  };
  const handleSaveInventory = async (photos: { angle: string; dataUrl: string | null }[], items: { name: string; quantity: number }[]) => {
    if (!inventoryVehicle) return;
    // Upload photos to storage and get URLs
    const photoEntries: { angle: string; url: string }[] = [];
    for (const p of photos) {
      if (p.dataUrl) {
        const url = await uploadDocumentImage(p.dataUrl, `inventario/${inventoryVehicle.id}/${p.angle}`);
        photoEntries.push({ angle: p.angle, url });
      } else {
        // Keep existing URL if photo wasn't retaken
        const existing = inventoryExisting?.photos.find((ep) => ep.angle === p.angle);
        photoEntries.push({ angle: p.angle, url: existing?.url || "" });
      }
    }
    await db.saveVehicleInventory({
      vehicle_id: inventoryVehicle.id,
      photos: photoEntries,
      items,
    });
    triggerRefresh();
  };

  const handleDismissAlert = async (id: string, title: string) => {
    if (await showConfirm({ title: "Completar Alerta", message: `¿Deseas marcar la alerta "${title}" como completada?`, confirmLabel: "Completar", variant: "default" })) {
      await db.dismissAlert(id);
      loadAlerts();
    }
  };

  const desktopNavItems: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "dashboard", label: "Check Lists", icon: Sparkles },
    { id: "drivers", label: "Choferes", icon: User },
    { id: "vehicles", label: "Autos", icon: Car },
    { id: "users", label: "Usuarios", icon: Shield },
  ];

  const mobileNavItems: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "dashboard", label: "Check Lists", icon: Sparkles },
    { id: "drivers", label: "Choferes", icon: User },
    { id: "vehicles", label: "Autos", icon: Car },
    { id: "users", label: "Usuarios", icon: Shield },
  ];

  const tileVariants: Variants = {
    hidden: { opacity: 0, y: 24, scale: 0.96 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        delay: 0.05 + i * 0.08,
        duration: 0.9,
        type: "spring",
        stiffness: 120,
        damping: 18,
      },
    }),
  };

  if (isSessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen w-screen bg-background text-foreground">
        <div className="text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  if (!session) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="relative flex flex-col md:flex-row h-screen w-screen bg-background text-foreground font-sans antialiased overflow-hidden">
      {/* Desktop Sidebar — visible from md+ */}
      <Sidebar
        items={desktopNavItems}
        activeTab={activeTab}
        onChange={handleTabChange}
        alertCount={alerts.length}
        onAlertsClick={() => setIsBuzonOpen(true)}
      />

      {/* Main Container: Flexbox side-by-side layout for desktop */}
      <div className="flex-1 flex h-full overflow-hidden">
        {/* Middle column: Main content */}
        <main id="main-content" className="relative z-10 flex-1 overflow-hidden flex flex-col px-3 sm:px-4 md:px-6 lg:px-8 xl:px-10 pt-[calc(env(safe-area-inset-top,0px)+16px)] pb-20 md:pb-4 scroll-smooth w-full h-full max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
              className="w-full flex-1 flex flex-col overflow-hidden"
            >
              {activeTab === "dashboard" && (
                isLoading ? (
                  <DashboardSkeleton />
                ) : (
                  <div className="flex-1 flex flex-col overflow-hidden space-y-6 h-full">
                    {/* HERO HEADER */}
                    <motion.div
                      custom={0}
                      initial="hidden"
                      animate="visible"
                      variants={tileVariants}
                      className="flex items-center justify-between gap-4 pt-2 px-1 shrink-0"
                    >
                      <div>
                        <h1 className="text-[26px] font-black tracking-tight leading-none text-foreground">
                          Buenos días.{greeting && <span className="text-muted-foreground ml-2 text-lg font-medium">{greeting}</span>}
                        </h1>
                        <p className="text-xs text-muted-foreground mt-2">
                          {stats.vehicles} vehículos · {stats.assigned} activos · {alerts.length} {alerts.length === 1 ? "alerta" : "alertas"} pendientes
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={exportChecklistCsv}
                          className="p-2.5 rounded-full bg-secondary hover:bg-secondary/80 text-foreground transition-all cursor-pointer active:scale-95 shadow-2xs border-none shrink-0"
                          aria-label="Exportar checklists a CSV"
                          title="Exportar CSV"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setIsBuzonOpen(true)}
                          className="md:hidden relative p-2.5 rounded-full bg-secondary hover:bg-secondary/80 text-foreground transition-all cursor-pointer active:scale-95 shadow-2xs border-none shrink-0"
                          aria-label={`Abrir buzón de alertas. ${alerts.length} alertas activas`}
                        >
                          <Bell className="w-4 h-4" />
                          {alerts.length > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[11px] font-black rounded-full flex items-center justify-center">
                              {alerts.length}
                            </span>
                          )}
                        </button>
                      </div>
                    </motion.div>

                    {/* GLOBAL SEARCH FOR HOME / LIST VIEW — combined with quick-add buttons */}
                    <div className="bg-[#ECECEC]  rounded-2xl h-12 px-4 flex items-center gap-2 w-full shrink-0 shadow-inner border border-border/40 focus-within:ring-4 focus-within:ring-primary/20 transition-all">
                      <Search className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                      <input
                        type="text"
                        placeholder="Buscar chofer por nombre o placas..."
                        value={globalSearch}
                        onChange={(e) => setGlobalSearch(e.target.value)}
                        className="flex-1 bg-transparent border-none text-foreground text-xs placeholder:text-muted-foreground/60 focus:outline-hidden"
                      />
                      {globalSearch && (
                        <button
                          onClick={() => setGlobalSearch("")}
                          className="text-[11px] font-bold text-muted-foreground hover:text-foreground shrink-0 px-2 cursor-pointer"
                        >
                          Limpiar
                        </button>
                      )}
                      <div className="flex items-center gap-1.5 shrink-0 pl-2 border-l border-border/40">
                        <button
                          onClick={() => { setAutoOpenDriver(true); handleTabChange("drivers"); }}
                          className="inline-flex items-center gap-1 px-3 h-8 rounded-lg bg-primary text-white text-[11px] font-bold hover:bg-primary/90 transition-all cursor-pointer active:scale-95 shadow-sm border-none"
                        >
                          <User className="w-3.5 h-3.5" /> Chofer
                        </button>
                        <button
                          onClick={() => { setAutoOpenVehicle(true); handleTabChange("vehicles"); }}
                          className="inline-flex items-center gap-1 px-3 h-8 rounded-lg bg-primary text-white text-[11px] font-bold hover:bg-primary/90 transition-all cursor-pointer active:scale-95 shadow-sm border-none"
                        >
                          <Car className="w-3.5 h-3.5" /> Auto
                        </button>
                        <button
                          onClick={() => setAssignmentDialogOpen(true)}
                          className="inline-flex items-center gap-1 px-3 h-8 rounded-lg bg-emerald-500 text-white text-[11px] font-bold hover:bg-emerald-600 transition-all cursor-pointer active:scale-95 shadow-sm border-none"
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5" /> Asignar
                        </button>
                      </div>
                    </div>

                    {/* Scrollable list container */}
                    <div className="flex-1 overflow-y-auto pr-1">
                      {/* CHECKLIST TABLE — shows all drivers with assigned vehicles */}
                      <div className="w-full overflow-x-auto pb-6">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/40">
                              <th className="text-left py-2.5 px-2 whitespace-nowrap">Chofer</th>
                              <th className="text-left py-2.5 px-2 whitespace-nowrap">Auto</th>
                              <th className="text-left py-2.5 px-2 whitespace-nowrap">Placa</th>
                              <th className="text-left py-2.5 px-2 whitespace-nowrap">ID Auto</th>
                              <th className="text-right py-2.5 px-2 whitespace-nowrap">Km Anterior</th>
                              <th className="text-right py-2.5 px-2 whitespace-nowrap">Km Nuevo</th>
                              <th className="text-right py-2.5 px-2 whitespace-nowrap">Renta</th>
                              <th className="text-right py-2.5 px-2 whitespace-nowrap">Pendiente</th>
                              <th className="text-center py-2.5 px-2 whitespace-nowrap">Stats</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredDriversList.length === 0 ? (
                              <tr>
                                <td colSpan={9} className="text-center py-10 text-muted-foreground italic">
                                  No se encontraron choferes que coincidan con la búsqueda.
                                </td>
                              </tr>
                            ) : (
                              // Only show drivers with an assigned vehicle
                              filteredDriversList
                                .filter((driver) => vehicles.some((v) => v.active_driver_id === driver.id))
                                .map((driver) => {
                                const assignedVehicle = vehicles.find(v => v.active_driver_id === driver.id)!;

                                // Mileage: previous (second-to-last) and latest
                                const vChecklists = checklists.filter(c => c.vehicle_id === assignedVehicle.id);
                                const sortedChecks = sortByDateDesc(vChecklists, "created_at");
                                const latestKm = sortedChecks[0]?.mileage;
                                const prevKm = sortedChecks[1]?.mileage;

                                // Vehicle ID = last 6 chars of VIN
                                const vehicleId = assignedVehicle.vin?.slice(-6).toUpperCase() || "—";

                                // Pending payment for this driver
                                const driverRentals = weeklyRentals.filter(
                                  (r) => r.driver_id === driver.id && r.status !== "PAID"
                                );
                                const totalPending = driverRentals.reduce(
                                  (acc, r) => acc + Math.max(0, r.rent_amount - r.paid_amount), 0
                                );

                                // Usage stats for this driver (across all vehicles they've driven)
                                const driverChecklists = checklists.filter(
                                  (c) => {
                                    const v = vehicles.find(vv => vv.id === c.vehicle_id);
                                    return v?.active_driver_id === driver.id;
                                  }
                                );
                                const usageStats = computeUsageStats(driverChecklists);

                                // ── Traffic light status ──
                                const today = new Date();
                                const getRowStatus = (v: Vehicle): "in_service" | "red" | "yellow" | "green" => {
                                  if (v.status === "in_service") return "in_service";
                                  const dates = [
                                    v.circulation_expiration_date,
                                    v.insurance_expiration_date,
                                    v.verification_expiration_date,
                                  ].filter(Boolean) as string[];
                                  for (const d of dates) {
                                    const diff = Math.ceil((new Date(d).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                                    if (diff <= 0) return "red";
                                    if (diff <= 30) return "yellow";
                                  }
                                  return "green";
                                };
                                const rowStatus = getRowStatus(assignedVehicle);
                                const rowColorClass = rowStatus === "in_service"
                                  ? "bg-blue-500/5 border-l-4 border-l-blue-500"
                                  : rowStatus === "red"
                                  ? "bg-red-500/5 border-l-4 border-l-red-500"
                                  : rowStatus === "yellow"
                                  ? "bg-amber-500/5 border-l-4 border-l-amber-500"
                                  : "border-l-4 border-l-transparent";

                                const rowIndex = filteredDriversList.filter((d) => vehicles.some((v) => v.active_driver_id === d.id)).indexOf(driver);
                                return (
                                  <tr
                                    key={driver.id}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => openActionModal(assignedVehicle)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        openActionModal(assignedVehicle);
                                      }
                                    }}
                                    className={`border-b border-border/20 hover:bg-muted/30 transition-colors cursor-pointer ${rowColorClass} ${rowIndex % 2 === 0 ? "bg-card" : "bg-muted/5"}`}
                                  >
                                    <td className="py-3 px-2">
                                      <span className="font-bold text-foreground">{driver.first_name} {driver.paternal_last_name}</span>
                                    </td>
                                    <td className="py-3 px-2 text-muted-foreground">
                                      {assignedVehicle.brand} {assignedVehicle.vehicle_name}
                                    </td>
                                    <td className="py-3 px-2 font-mono text-muted-foreground">
                                      {assignedVehicle.plate_number}
                                    </td>
                                    <td className="py-3 px-2 font-mono text-muted-foreground">
                                      {vehicleId}
                                    </td>
                                    <td className="py-3 px-2 text-right font-mono text-muted-foreground">
                                      {prevKm != null ? prevKm.toLocaleString() : "—"}
                                    </td>
                                    <td className="py-3 px-2 text-right font-mono font-bold text-foreground">
                                      {latestKm != null ? latestKm.toLocaleString() : "—"}
                                    </td>
                                    <td className="py-3 px-2 text-right font-mono text-muted-foreground">
                                      ${assignedVehicle.rent_cost.toLocaleString()}
                                    </td>
                                    <td className="py-3 px-2 text-right font-mono font-bold text-red-400">
                                      ${totalPending.toLocaleString()}
                                    </td>
                                    <td className="py-3 px-2 text-center">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openStatsDialog(driver, usageStats);
                                        }}
                                        className="text-primary hover:text-primary hover:bg-primary/10 text-xs gap-1"
                                      >
                                        <BarChart3 className="w-3.5 h-3.5" />
                                      </Button>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )
              )}

              {activeTab !== "dashboard" && (
                <div className="flex-1 overflow-y-auto pr-1">
                  {activeTab === "drivers" && <DriversSlice onRefreshAlerts={triggerRefresh} searchQuery={globalSearch} onOpenActionSheet={openActionSheet} autoOpen={autoOpenDriver} onAutoOpenConsumed={() => setAutoOpenDriver(false)} weeklyRentals={weeklyRentals} onAssignDriver={(driverId) => { setAssignmentPreselect(driverId, null); setAssignmentDialogOpen(true); }} />}
                  {activeTab === "vehicles" && <VehiclesSlice onRefreshAlerts={triggerRefresh} searchQuery={globalSearch} onOpenActionSheet={openActionSheet} autoOpen={autoOpenVehicle} onAutoOpenConsumed={() => setAutoOpenVehicle(false)} onAssignVehicle={(vehicleId) => { setAssignmentPreselect(null, vehicleId); setAssignmentDialogOpen(true); }} externalWearPartVehicle={wearPartVehicle} refreshTrigger={refreshTrigger} />}
                  {activeTab === "users" && <UsersSlice />}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Right column: Docked panel for desktop (displays Alerts or Actions Sheet) */}
        {isLargeScreen && (isBuzonOpen || actionSheet?.open) && (
          <aside className="hidden lg:flex lg:w-[400px] xl:w-[440px] shrink-0 border-l border-border bg-card/30 h-full flex-col overflow-hidden">
            <AnimatePresence mode="wait">
              {isBuzonOpen ? (
                <motion.div
                  key="buzon-inline"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="h-full w-full flex flex-col overflow-hidden"
                >
                  <div className="flex items-center justify-between px-6 py-5 border-b border-border/40 shrink-0">
                    <div>
                      <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                        <Bell className="w-5 h-5 text-primary shrink-0" />
                        Buzón de Alertas
                      </h2>
                      <p className="text-xs text-muted-foreground mt-0.5 font-semibold">
                        {alerts.length} {alerts.length === 1 ? "pendiente" : "pendientes"} por resolver
                      </p>
                    </div>
                    <button
                      onClick={() => setIsBuzonOpen(false)}
                      className="p-3 rounded-full text-foreground hover:bg-secondary transition-all cursor-pointer border-none"
                      style={{ minWidth: "48px", minHeight: "48px" }}
                      aria-label="Cerrar buzón"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 overscroll-contain">
                    {alerts.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-3">
                        <div className="w-12 h-12 rounded-full bg-success/15 flex items-center justify-center text-success shrink-0">
                          <CheckCircle className="w-6 h-6" />
                        </div>
                        <h3 className="text-base font-bold text-foreground">¡Todo en orden!</h3>
                        <p className="text-xs text-muted-foreground max-w-[240px]">
                          No tienes alertas ni vencimientos administrativos por resolver en este momento.
                        </p>
                      </div>
                    ) : (
                      alerts.map((alert) => {
                        const isCritical = alert.severity === "critical";
                        return (
                          <div
                            key={alert.id}
                            className={`p-4 rounded-2xl bg-secondary/30  border border-border/60 hover:border-border transition-all flex gap-3.5 ${
                              isCritical ? "border-l-4 border-l-red-500" : "border-l-4 border-l-amber-500"
                            }`}
                          >
                            <div className={`p-2 rounded-xl shrink-0 h-fit ${isCritical ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"}`}>
                              {isCritical ? <ShieldAlert className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                            </div>
                            <div className="flex-1 min-w-0 space-y-2">
                              <div className="flex items-start justify-between gap-2 flex-wrap">
                                <h4 className="text-sm font-extrabold text-foreground leading-snug">
                                  {alert.title}
                                </h4>
                                <span className={`text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-sm shrink-0 ${
                                  isCritical ? "bg-red-500/15 text-red-600 " : "bg-amber-500/15 text-amber-600 "
                                }`}>
                                  {isCritical ? "Crítica" : "Media"}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground leading-relaxed font-semibold">
                                {alert.description}
                              </p>
                              <div className="pt-1">
                                <button
                                  onClick={() => handleDismissAlert(alert.id, alert.title)}
                                  className="px-4 py-2 bg-card hover:bg-secondary text-foreground text-xs font-bold rounded-xl border border-border/80 transition-all cursor-pointer focus-visible:ring-4 focus-visible:ring-primary focus-visible:outline-hidden"
                                >
                                  Marcar como Resuelto
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              ) : actionSheet?.open ? (
                <motion.div
                  key="actions-inline"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="h-full w-full flex flex-col overflow-hidden"
                >
                  <EntityActionSheet
                    isOpen={true}
                    isInline={true}
                    driver={actionSheet.driver}
                    vehicle={actionSheet.vehicle}
                    entity={activeEntity}
                    type={actionSheet.type}
                    isAssigned={isEntityAssigned}
                    onActionComplete={handleActionComplete}
                    onRequestChecklist={openChecklistSheet}
                    onVehicleAssigned={handleVehicleAssignedFromSheet}
                    onClose={() => setActionSheet(null)}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </aside>
        )}
      </div>

      {/* Floating overlays for mobile/tablet size only */}
      {!isLargeScreen && (
        <>
          <AnimatePresence>
            {actionSheet?.open && (
              <EntityActionSheet
                isOpen={true}
                driver={actionSheet.driver}
                vehicle={actionSheet.vehicle}
                entity={activeEntity}
                type={actionSheet.type}
                isAssigned={isEntityAssigned}
                onActionComplete={handleActionComplete}
                onRequestChecklist={openChecklistSheet}
                onVehicleAssigned={handleVehicleAssignedFromSheet}
                onClose={() => setActionSheet(null)}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isBuzonOpen && (
              <>
                {/* Backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="fixed inset-0 bg-black/75 z-40 backdrop-blur-md"
                  onClick={() => setIsBuzonOpen(false)}
                />
                {/* Drawer overlay */}
                <motion.div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="buzon-title-mobile"
                  initial={{ x: "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "100%" }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="fixed bottom-0 top-0 right-0 z-50 bg-card border-l border-border w-full sm:w-[440px] h-screen shadow-2xl flex flex-col overflow-hidden"
                  style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-6 py-5 border-b border-border/40 shrink-0">
                    <div>
                      <h2 id="buzon-title-mobile" className="text-xl font-bold text-foreground flex items-center gap-2">
                        <Bell className="w-5 h-5 text-primary shrink-0" />
                        Buzón de Alertas
                      </h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {alerts.length} {alerts.length === 1 ? "pendiente" : "pendientes"} por resolver
                      </p>
                    </div>
                    <button
                      onClick={() => setIsBuzonOpen(false)}
                      className="p-3 rounded-full text-foreground hover:bg-secondary transition-all cursor-pointer border-none"
                      style={{ minWidth: "48px", minHeight: "48px" }}
                      aria-label="Cerrar buzón"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  {/* Alerts List */}
                  <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 overscroll-contain">
                    {alerts.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-3">
                        <div className="w-12 h-12 rounded-full bg-success/15 flex items-center justify-center text-success shrink-0">
                          <CheckCircle className="w-6 h-6" />
                        </div>
                        <h3 className="text-base font-bold text-foreground">¡Todo en orden!</h3>
                        <p className="text-xs text-muted-foreground max-w-[260px]">
                          No tienes alertas ni vencimientos administrativos por resolver en este momento.
                        </p>
                      </div>
                    ) : (
                      alerts.map((alert) => {
                        const isCritical = alert.severity === "critical";
                        return (
                          <div
                            key={alert.id}
                            className={`p-4 rounded-2xl bg-secondary/30  border border-border/60 hover:border-border transition-all flex gap-3.5 ${
                              isCritical ? "border-l-4 border-l-red-500" : "border-l-4 border-l-amber-500"
                            }`}
                          >
                            <div className={`p-2 rounded-xl shrink-0 h-fit ${isCritical ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"}`}>
                              {isCritical ? <ShieldAlert className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                            </div>
                            <div className="flex-1 min-w-0 space-y-2">
                              <div className="flex items-start justify-between gap-2 flex-wrap">
                                <h4 className="text-sm font-extrabold text-foreground leading-snug">
                                  {alert.title}
                                </h4>
                                <span className={`text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-sm shrink-0 ${
                                  isCritical ? "bg-red-500/15 text-red-600 " : "bg-amber-500/15 text-amber-600 "
                                }`}>
                                  {isCritical ? "Crítica" : "Media"}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground leading-relaxed font-semibold">
                                {alert.description}
                              </p>
                              <div className="pt-1">
                                <button
                                  onClick={() => handleDismissAlert(alert.id, alert.title)}
                                  className="px-4 py-2 bg-card hover:bg-secondary text-foreground text-xs font-bold rounded-xl border border-border/80 transition-all cursor-pointer focus-visible:ring-4 focus-visible:ring-primary focus-visible:outline-hidden"
                                >
                                  Marcar como Resuelto
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </>
      )}

      {/* Stats Dialog */}
      <Dialog key="stats-dialog" open={!!statsDialog} onOpenChange={(o) => { if (!o) setStatsDialog(null); }}>
        <DialogContent className="max-w-sm md:max-w-md border border-border bg-background text-foreground rounded-2xl">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 shrink-0">
                <BarChart3 className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-foreground font-black text-lg">
                  Estadísticas de Uso
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-xs">
                  {statsDialog?.driver
                    ? `${statsDialog.driver.first_name} ${statsDialog.driver.paternal_last_name}`
                    : ""}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {statsDialog?.usage.monthlyAverage != null ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-muted/40 border border-border text-center">
                  <span className="block text-[11px] uppercase font-bold text-muted-foreground">Promedio Semanal</span>
                  <p className="text-lg font-black text-foreground font-mono mt-1">
                    {Math.round(statsDialog.usage.monthlyAverage * 7).toLocaleString()} km
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-muted/40 border border-border text-center">
                  <span className="block text-[11px] uppercase font-bold text-muted-foreground">Promedio Mensual</span>
                  <p className="text-lg font-black text-foreground font-mono mt-1">
                    {Math.round(statsDialog.usage.monthlyAverage * 30).toLocaleString()} km
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-center py-4 text-muted-foreground text-xs">
                No hay suficientes datos de kilometraje para calcular promedios.
              </p>
            )}

            {statsDialog && statsDialog.usage.weeks.length > 0 && (
              <div>
                <span className="block text-[11px] uppercase font-bold text-muted-foreground mb-2">Historial Semanal</span>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {[...statsDialog.usage.weeks].reverse().map((w, i) => (
                    <div key={i} className="flex justify-between text-xs py-1.5 px-2 rounded-lg bg-muted/20 border border-border/30">
                      <span className="text-muted-foreground font-mono">{w.weekStart}</span>
                      <span className="font-bold text-foreground">{w.km.toLocaleString()} km</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Assignment Dialog */}
      <AssignmentDialog
        open={assignmentDialogOpen}
        onClose={() => { setAssignmentDialogOpen(false); setAssignmentPreselect(null, null); }}
        onComplete={triggerRefresh}
        onAssign={(vehicleId) => {
          const v = vehicles.find((vv) => vv.id === vehicleId);
          if (v) openChecklistSheet(v);
        }}
        drivers={drivers}
        vehicles={vehicles}
        preselectDriver={assignmentPreselectDriver}
        preselectVehicle={assignmentPreselectVehicle}
      />

      {/* Checklist Action Modal */}
      <AnimatePresence>
        {actionModal.open && (
          <ChecklistActionModal
            key="action-modal"
            open={true}
            vehicle={actionModal.vehicle}
            onClose={() => setActionModal({ open: false, vehicle: null })}
            onChecklist={openChecklistSheet}
            onServiceOut={handleServiceOut}
            onServiceReturn={handleServiceReturn}
            onWearPart={handleWearPart}
            onInventory={handleInventory}
          />
        )}
      </AnimatePresence>

      {/* Checklist Sheet */}
      <AnimatePresence>
        {checklistSheet.open && (
          <ChecklistSheet
            key="checklist-sheet"
            isOpen={true}
            vehicle={checklistSheet.vehicle}
            onClose={() => setChecklistSheet({ open: false, vehicle: null })}
            onComplete={handleActionComplete}
          />
        )}
      </AnimatePresence>

      {/* Wear Part Dialog */}
      <WearPartDialog
        open={wearPartDialogOpen}
        onClose={() => { setWearPartDialogOpen(false); setWearPartVehicle(null); }}
        vehicle={wearPartVehicle}
        onComplete={triggerRefresh}
      />

      {/* Inventory Wizard */}
      <AnimatePresence>
        {inventoryOpen && (
          <InventoryWizard
            key="inventory-wizard"
            open={true}
            onClose={() => { setInventoryOpen(false); setInventoryVehicle(null); setInventoryExisting(null); }}
            onSave={handleSaveInventory}
            initialPhotos={inventoryExisting?.photos.map((p) => ({ angle: p.angle, dataUrl: p.url }))}
            initialItems={inventoryExisting?.items}
          />
        )}
      </AnimatePresence>

      {/* Mobile Bottom Tab Bar for Direct Navigation */}
      <nav
        className="relative md:hidden border-t border-border bg-card/95 backdrop-blur-md flex items-center justify-around w-full px-2 pb-[env(safe-area-inset-bottom,0px)] h-[calc(56px+env(safe-area-inset-bottom,0px))] shrink-0 z-40"
      >
        {mobileNavItems.map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id as TabId)}
              className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-xs transition-all active:scale-95 cursor-pointer relative ${
                isSelected ? "text-primary font-bold" : "text-muted-foreground"
              }`}
            >
              <Icon className={`w-5 h-5 mb-0.5 transition-transform ${isSelected ? "scale-105" : ""}`} />
              <span>{tab.label}</span>
              {isSelected && (
                <motion.div
                  layoutId="activeBottomIndicator"
                  className="absolute top-0 w-8 h-[2.5px] bg-primary rounded-full"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
