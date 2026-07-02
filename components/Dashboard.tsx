"use client";

import React, { useState, useEffect, useMemo } from "react";
import { db, Alert, Driver, Vehicle, Assignment, Checklist } from "@/lib/db";
import { formatDate, sortByDateDesc } from "@/lib/utils";
import { computeUsageStats } from "@/lib/usageStats";
import DriversSlice from "./DriversSlice";
import VehiclesSlice from "./VehiclesSlice";
import AssignmentsSlice from "./AssignmentsSlice";
import FinancesSlice from "./FinancesSlice";
import MaintenanceSlice from "./MaintenanceSlice";
import { EntityActionSheet } from "./EntityActionSheet";
import { ChecklistSheet } from "./ChecklistSheet";
import Sidebar from "./Sidebar";
import { Card } from "@/components/ui/card";
import { DashboardSkeleton } from "@/components/ui/skeletons";
import { Bell, User, Car, DollarSign, ArrowLeftRight, CheckCircle, AlertTriangle, Sun, Moon, Sparkles, ListChecks, ShieldAlert, Gauge } from "lucide-react";
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
  const [recentAssignments, setRecentAssignments] = useState<Assignment[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [globalSearch, setGlobalSearch] = useState("");
  const [currentTime, setCurrentTime] = useState("");
  const [actionSheet, setActionSheet] = useState<{ open: boolean, entity: Driver | Vehicle, type: "driver" | "vehicle" } | null>(null);
  const [checklistSheet, setChecklistSheet] = useState<{ open: boolean, vehicle: Vehicle | null }>({ open: false, vehicle: null });
  const [isLoading, setIsLoading] = useState(true);

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

    setVehicles(vList);
    setDrivers(dList);
    setChecklists(cList);

    const assigned = vList.filter(v => v.active_driver_id !== null).length;
    setStats({
      vehicles: vList.length,
      drivers: dList.length,
      assigned: assigned
    });

    setRecentAssignments(aList.slice(0, 4));
  };

  const triggerRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  // Load data on mount and when refreshTrigger changes. Kept inside a single
  // effect to avoid cascading renders while still satisfying React 19 lint.
  useEffect(() => {
    let isStale = false;
    const run = async () => {
      await db.autoGenerateMondayChecklists().then((count) => {
        if (count > 0) {
          console.log(`[Checklists] Se generaron ${count} checklists semanales automáticamente para unidades activas.`);
        }
      });
      if (isStale) return;
      await Promise.all([loadAlerts(), loadStats()]);
      if (!isStale) setIsLoading(false);
    };
    run();
    return () => {
      isStale = true;
    };
  }, [refreshTrigger]);

  // Theme initialization
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" || "dark";
    // Synchronize DOM class directly; avoid setState in effect body.
    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    // Initialize theme state in a microtask to avoid synchronous setState.
    Promise.resolve().then(() => setTheme(savedTheme));
  }, []);

  // Live clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
      // Avoid setState if value hasn't changed to prevent cascading renders.
      setCurrentTime((prev) => (prev === timeStr ? prev : timeStr));
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

  const openActionSheet = (entity: Driver | Vehicle, type: "driver" | "vehicle") => {
    setActionSheet({ open: true, entity, type });
  };

  const openChecklistSheet = (vehicle: Vehicle) => {
    setActionSheet(null);
    setChecklistSheet({ open: true, vehicle });
  };

  // When the user assigns a chofer to a vehicle from inside the action sheet,
  // close the sheet and immediately pop the checklist so they can log the
  // initial state of the freshly assigned unit in a single flow.
  const handleVehicleAssignedFromSheet = (vehicle: Vehicle) => {
    openChecklistSheet(vehicle);
  };

  // Always serve the freshest entity reference from the latest state so the
  // sheet reflects the current assignment status (e.g. after a successful
  // assign/remove the new vehicles/drivers data is rendered immediately).
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
    // Trigger a parent refresh so vehicles/drivers state picks up the change.
    // The sheet stays open and the parent re-renders with the fresh entity
    // reference, so the next view shows the updated assignment status.
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

  // Desktop nav exposes all 6 tabs (sidebar has room for them). The mobile
  // bottom-nav is restricted to the 4 most-used primary actions — secondary
  // flows (Asignaciones, Servicios) are reachable on mobile by widening to
  // desktop size or via the back-button after assigning a vehicle, etc.
  const desktopNavItems: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "dashboard", label: "Inicio", icon: Sparkles },
    { id: "drivers", label: "Choferes", icon: User },
    { id: "vehicles", label: "Autos", icon: Car },
    { id: "assignments", label: "Asignaciones", icon: ArrowLeftRight },
    { id: "finances", label: "Rentas", icon: DollarSign },
    { id: "maintenance", label: "Servicios", icon: ListChecks },
  ];

  const mobileNavItems: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "dashboard", label: "Inicio", icon: Sparkles },
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
    <div className="relative flex flex-col md:flex-row h-full w-full bg-background text-foreground font-sans antialiased overflow-hidden">
      {/* Desktop Sidebar — visible from md+ */}
      <Sidebar
        items={desktopNavItems}
        activeTab={activeTab}
        onChange={handleTabChange}
        theme={theme}
        onToggleTheme={toggleTheme}
        alertCount={alerts.length}
        onAlertsClick={() => handleTabChange("dashboard")}
      />

      {/* Main Content */}
      <main className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 md:px-8 pt-[calc(env(safe-area-inset-top,0px)+16px)] pb-20 md:pb-8 scroll-smooth max-w-3xl md:max-w-5xl mx-auto md:mx-0 w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
            className="w-full space-y-5"
          >
            {activeTab === "dashboard" && (
              isLoading ? (
                <DashboardSkeleton />
              ) : (
              <>
                {/* HERO HEADER — large greeting + live clock */}
                <motion.div
                  custom={0}
                  initial="hidden"
                  animate="visible"
                  variants={tileVariants}
                  className="flex items-center justify-between gap-4 pt-2 px-1 animate-in fade-in slide-in-from-top-4 duration-300"
                >
                  <div>
                    <h1 className="text-[26px] font-bold tracking-tight leading-none text-foreground">
                      Buenos días.{greeting && <span className="text-muted-foreground ml-2 text-lg font-medium">{greeting}</span>}
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {stats.vehicles} vehículos · {stats.assigned} activos · {alerts.length} {alerts.length === 1 ? "alerta" : "alertas"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleTheme}
                      className="md:hidden p-2.5 rounded-full bg-secondary hover:bg-secondary/80 text-foreground transition-all cursor-pointer active:scale-95 shadow-2xs border-none shrink-0"
                      aria-label="Toggle theme"
                    >
                      {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-500" />}
                    </button>
                    <button
                      onClick={() => handleTabChange("dashboard")}
                      className="md:hidden relative p-2.5 rounded-full bg-secondary hover:bg-secondary/80 text-foreground transition-all cursor-pointer active:scale-95 shadow-2xs border-none shrink-0"
                      aria-label="Alerts"
                    >
                      <Bell className="w-4 h-4" />
                      {alerts.length > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                          {alerts.length}
                        </span>
                      )}
                    </button>
                  </div>
                </motion.div>

                <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-4">
                  {/* BENTO TILE: Recent Activity */}
                  <motion.div custom={1} initial="hidden" animate="visible" variants={tileVariants} className="lg:col-span-2">
                    <Card className="p-5 border-border bg-card elevation-2 h-full flex flex-col">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-label">Actividad Reciente</h3>
                        <span className="text-[10px] text-muted-foreground font-medium">Últimos turnos</span>
                      </div>
                      <div className="space-y-1.5 max-h-[260px] lg:max-h-[340px] overflow-y-auto pr-1">
                        {recentAssignments.length === 0 ? (
                          <p className="text-caption italic py-6 text-center">No hay movimientos registrados.</p>
                        ) : (
                          recentAssignments.map((asg) => (
                            <div
                              key={asg.id}
                              className="group flex items-center gap-3 p-2.5 rounded-lg hover:bg-secondary/60 transition-colors"
                            >
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${asg.action_type === "ASSIGN" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                                {asg.action_type === "ASSIGN" ? (
                                  <ArrowLeftRight className="w-3.5 h-3.5 rotate-180" />
                                ) : (
                                  <ArrowLeftRight className="w-3.5 h-3.5" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-semibold text-foreground leading-tight truncate">
                                  {getDriverDesc(asg.driver_id)}
                                </p>
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {getVehicleDesc(asg.vehicle_id)} · {asg.reason}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <span className={`inline-block px-2 py-0.5 text-[9px] font-bold rounded-md uppercase tracking-wider ${asg.action_type === "ASSIGN" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                                  {asg.action_type === "ASSIGN" ? "Asignado" : "Retirado"}
                                </span>
                                <p className="text-[10px] text-muted-foreground mt-1">{formatDate(asg.created_at)}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </Card>
                  </motion.div>

                  {/* BENTO TILE: Mileage per Unit */}
                  <motion.div custom={2} initial="hidden" animate="visible" variants={tileVariants} className="lg:col-span-1">
                    <Card className="p-5 border-border bg-card shadow-md h-full flex flex-col">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-label">Kilometraje por Unidad</h3>
                        <Gauge className="w-3.5 h-3.5 text-primary" />
                      </div>

                      <div className="flex-1 space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
                        {vehicles.length === 0 ? (
                          <p className="text-caption italic py-4 text-center">No hay vehículos registrados.</p>
                        ) : (
                          vehicles.map((vehicle) => {
                            const vChecklists = checklists.filter((c) => c.vehicle_id === vehicle.id);
                            const latest = vChecklists.length > 0
                              ? sortByDateDesc(vChecklists, "created_at")[0]
                              : null;
                            const { weeks: usageWeeks } = computeUsageStats(vChecklists);
                            const latestWeek = usageWeeks.length > 0 ? usageWeeks[usageWeeks.length - 1] : null;
                            return (
                              <div
                                key={vehicle.id}
                                className="flex items-center justify-between gap-2 py-1.5 px-2.5 rounded-lg hover:bg-secondary/50 transition-colors"
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="text-[12px] font-semibold text-foreground truncate">
                                    {vehicle.brand} {vehicle.vehicle_name}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground font-mono tracking-tight">
                                    {vehicle.plate_number}
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-[12px] font-bold text-foreground font-mono leading-none">
                                    {latest ? `${latest.mileage.toLocaleString()} km` : "Sin registros"}
                                  </p>
                                  <p className={`text-[10px] font-mono mt-0.5 ${latestWeek ? "text-primary font-bold" : "text-muted-foreground"}`}>
                                    {latestWeek
                                      ? `${Math.round(latestWeek.kmPerDay).toLocaleString()} km/d`
                                      : "—"}
                                  </p>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      <p className="text-[9px] text-muted-foreground pt-3 border-t border-border/40 mt-3 leading-relaxed">
                        Media diaria calculada sobre la última semana registrada.
                      </p>
                    </Card>
                  </motion.div>

                  {/* BENTO TILE: Alerts — full width, redesigned */}
                  <motion.div custom={3} initial="hidden" animate="visible" variants={tileVariants} className="space-y-3 lg:col-span-3">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="text-h2">Avisos & Pendientes</h3>
                      {alerts.length > 0 && (
                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{alerts.length} {alerts.length === 1 ? "pendiente" : "pendientes"}</span>
                      )}
                    </div>

                    {alerts.length === 0 ? (
                      <Card className="p-8 text-center border-dashed border-border bg-card/40 flex flex-col items-center justify-center gap-2.5">
                        <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
                          <CheckCircle className="w-6 h-6 text-success" />
                        </div>
                        <p className="text-h2 text-foreground">¡Todo en orden!</p>
                        <p className="text-caption">No hay alertas de verificación, seguros ni licencias pendientes.</p>
                      </Card>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[400px] overflow-y-auto pr-1">
                        {alerts.map((alert) => {
                          const isCritical = alert.severity === "critical";
                          return (
                            <Card
                              key={alert.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => handleDismissAlert(alert.id, alert.title)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  handleDismissAlert(alert.id, alert.title);
                                }
                              }}
                              className={`group relative overflow-hidden border-border bg-card hover:elevation-2 cursor-pointer active:scale-[0.99] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                isCritical ? "border-l-2 border-l-critical" : "border-l-2 border-l-warning"
                              }`}
                            >
                              <div className="p-4 flex gap-3.5 items-start">
                                <div className={`p-2 rounded-lg shrink-0 ${isCritical ? "bg-critical/10 text-critical" : "bg-warning/10 text-warning"}`}>
                                  {isCritical ? <ShieldAlert className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                                </div>
                                <div className="space-y-1 min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <h4 className="text-[13px] font-semibold text-foreground leading-tight">
                                      {alert.title}
                                    </h4>
                                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${isCritical ? "bg-critical/10 text-critical" : "bg-warning/10 text-warning"}`}>
                                      {isCritical ? "Crítica" : "Media"}
                                    </span>
                                  </div>
                                  <p className="text-caption leading-relaxed">
                                    {alert.description}
                                  </p>
                                </div>
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                </div>
              </>
              )
            )}

            {activeTab === "drivers" && <DriversSlice onRefreshAlerts={triggerRefresh} searchQuery={globalSearch} onOpenActionSheet={openActionSheet} />}
            {activeTab === "vehicles" && <VehiclesSlice onRefreshAlerts={triggerRefresh} searchQuery={globalSearch} onOpenActionSheet={openActionSheet} />}
            {activeTab === "assignments" && <AssignmentsSlice onRefreshAll={triggerRefresh} />}
            {activeTab === "finances" && <FinancesSlice />}
            {activeTab === "maintenance" && <MaintenanceSlice onRefreshAlerts={triggerRefresh} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {actionSheet?.open && (
          <EntityActionSheet
            isOpen={true}
            entity={activeEntity}
            type={actionSheet?.type || "driver"}
            isAssigned={isEntityAssigned}
            onActionComplete={handleActionComplete}
            onRequestChecklist={openChecklistSheet}
            onVehicleAssigned={handleVehicleAssignedFromSheet}
            onClose={() => setActionSheet(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {checklistSheet.open && (
          <ChecklistSheet
            isOpen={true}
            vehicle={checklistSheet.vehicle}
            onClose={() => setChecklistSheet({ open: false, vehicle: null })}
            onComplete={handleActionComplete}
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
              className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] transition-all active:scale-95 cursor-pointer relative ${
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

      {/* Removed Mobile Drawer */}
    </div>
  );
}
