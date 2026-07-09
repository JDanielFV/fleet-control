"use client";

import React, { useState, useEffect, useMemo } from "react";
import { db, Alert, Driver, Vehicle, Assignment, Checklist, WeeklyRental, getVerificationSchedule } from "@/lib/db";
import { formatDate, sortByDateDesc } from "@/lib/utils";
import { computeUsageStats } from "@/lib/usageStats";
import { getDriverName } from "@/lib/lookups";
import DriversSlice from "./DriversSlice";
import VehiclesSlice from "./VehiclesSlice";
import AssignmentsSlice from "./AssignmentsSlice";
import FinancesSlice from "./FinancesSlice";
import MaintenanceSlice from "./MaintenanceSlice";
import { EntityActionSheet } from "./EntityActionSheet";
import { ChecklistSheet } from "./ChecklistSheet";
import Sidebar from "./Sidebar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DashboardSkeleton } from "@/components/ui/skeletons";
import {
  Bell,
  User,
  Car,
  DollarSign,
  ArrowLeftRight,
  CheckCircle,
  AlertTriangle,
  Sun,
  Moon,
  Sparkles,
  ListChecks,
  ShieldAlert,
  Gauge,
  Search,
  X,
  CheckCircle2,
  BarChart3,
} from "lucide-react";
import { motion, AnimatePresence, type Variants } from "framer-motion";

export type TabId = "dashboard" | "drivers" | "vehicles" | "assignments" | "finances" | "maintenance";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
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
  const [isBuzonOpen, setIsBuzonOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  // Auto-open flags: when set, the corresponding slice opens its registration
  // dialog on mount. The slice calls onAutoOpenConsumed to clear the flag.
  const [autoOpenDriver, setAutoOpenDriver] = useState(false);
  const [autoOpenVehicle, setAutoOpenVehicle] = useState(false);
  // Stats dialog state
  const [statsDialog, setStatsDialog] = useState<{
    driver: Driver;
    usage: { weeks: { weekStart: string; km: number; kmPerDay: number }[]; monthlyAverage: number | null };
  } | null>(null);
  const openStatsDialog = (
    driver: Driver,
    usage: { weeks: { weekStart: string; km: number; kmPerDay: number }[]; monthlyAverage: number | null }
  ) => setStatsDialog({ driver, usage });

  useEffect(() => {
    const checkScreenSize = () => {
      setIsLargeScreen(window.innerWidth >= 1024);
    };
    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

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

  // Initialize theme
  useEffect(() => {
    const storedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const initialTheme = storedTheme || "dark";
    setTheme(initialTheme);
    if (initialTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
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
    if (!dateStr) return { label: "N/D", colorClass: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" };
    const today = new Date();
    const date = new Date(dateStr);
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return { label: `Vencido (${formatDate(dateStr)})`, colorClass: "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20" };
    } else if (diffDays <= 30) {
      return { label: `Vence en ${diffDays}d (${formatDate(dateStr)})`, colorClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" };
    } else {
      return { label: `Vence: ${formatDate(dateStr)}`, colorClass: "bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20" };
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

  const handleDismissAlert = async (id: string, title: string) => {
    if (confirm(`¿Deseas marcar la alerta "${title}" como completada?`)) {
      await db.dismissAlert(id);
      loadAlerts();
    }
  };

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const desktopNavItems: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "dashboard", label: "Check Lists", icon: Sparkles },
    { id: "drivers", label: "Choferes", icon: User },
    { id: "vehicles", label: "Autos", icon: Car },
    { id: "assignments", label: "Asignaciones", icon: ArrowLeftRight },
    { id: "finances", label: "Rentas", icon: DollarSign },
    { id: "maintenance", label: "Servicios", icon: ListChecks },
  ];

  const mobileNavItems: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "dashboard", label: "Check Lists", icon: Sparkles },
    { id: "drivers", label: "Choferes", icon: User },
    { id: "vehicles", label: "Autos", icon: Car },
    { id: "finances", label: "Rentas", icon: DollarSign },
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

  return (
    <div className="relative flex flex-col md:flex-row h-screen w-screen bg-background text-foreground font-sans antialiased overflow-hidden">
      {/* Desktop Sidebar — visible from md+ */}
      <Sidebar
        items={desktopNavItems}
        activeTab={activeTab}
        onChange={handleTabChange}
        theme={theme}
        onToggleTheme={toggleTheme}
        alertCount={alerts.length}
        onAlertsClick={() => setIsBuzonOpen(true)}
      />

      {/* Main Container: Flexbox side-by-side layout for desktop */}
      <div className="flex-1 flex h-full overflow-hidden">
        {/* Middle column: Main content */}
        <main className="relative z-10 flex-1 overflow-hidden flex flex-col px-4 sm:px-6 md:px-8 pt-[calc(env(safe-area-inset-top,0px)+16px)] pb-20 md:pb-4 scroll-smooth w-full h-full">
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
                          onClick={toggleTheme}
                          className="md:hidden p-2.5 rounded-full bg-secondary hover:bg-secondary/80 text-foreground transition-all cursor-pointer active:scale-95 shadow-2xs border-none shrink-0"
                          aria-label="Cambiar tema"
                        >
                          {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-500" />}
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
                    <div className="bg-[#ECECEC] dark:bg-muted/70 rounded-2xl h-12 px-4 flex items-center gap-2 w-full shrink-0 shadow-inner border border-border/40 focus-within:ring-4 focus-within:ring-primary/20 transition-all">
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
                              filteredDriversList.map((driver) => {
                                const assignedVehicle = vehicles.find(v => v.active_driver_id === driver.id);
                                if (!assignedVehicle) return null;

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

                                return (
                                  <tr
                                    key={driver.id}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => openChecklistSheet(assignedVehicle)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        openChecklistSheet(assignedVehicle);
                                      }
                                    }}
                                    className="border-b border-border/20 hover:bg-muted/30 transition-colors cursor-pointer"
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
                  {activeTab === "drivers" && <DriversSlice onRefreshAlerts={triggerRefresh} searchQuery={globalSearch} onOpenActionSheet={openActionSheet} autoOpen={autoOpenDriver} onAutoOpenConsumed={() => setAutoOpenDriver(false)} />}
                  {activeTab === "vehicles" && <VehiclesSlice onRefreshAlerts={triggerRefresh} searchQuery={globalSearch} onOpenActionSheet={openActionSheet} autoOpen={autoOpenVehicle} onAutoOpenConsumed={() => setAutoOpenVehicle(false)} />}
                  {activeTab === "assignments" && <AssignmentsSlice onRefreshAll={triggerRefresh} />}
                  {activeTab === "finances" && <FinancesSlice />}
                  {activeTab === "maintenance" && <MaintenanceSlice onRefreshAlerts={triggerRefresh} />}
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
                            className={`p-4 rounded-2xl bg-secondary/30 dark:bg-muted/10 border border-border/60 hover:border-border transition-all flex gap-3.5 ${
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
                                  isCritical ? "bg-red-500/15 text-red-600 dark:text-red-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
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
                            className={`p-4 rounded-2xl bg-secondary/30 dark:bg-muted/10 border border-border/60 hover:border-border transition-all flex gap-3.5 ${
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
                                  isCritical ? "bg-red-500/15 text-red-600 dark:text-red-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
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

      <AnimatePresence>
        {checklistSheet.open && (
          <ChecklistSheet
            isOpen={true}
            vehicle={checklistSheet.vehicle}
            onClose={() => setChecklistSheet({ open: false, vehicle: null })}
            onComplete={handleActionComplete}
          />
        )}

        {/* Stats Dialog */}
        <Dialog open={!!statsDialog} onOpenChange={(o) => { if (!o) setStatsDialog(null); }}>
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
