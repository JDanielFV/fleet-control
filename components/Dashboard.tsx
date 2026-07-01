"use client";

import React, { useState, useEffect } from "react";
import { db, Alert, Driver, Vehicle, Assignment } from "@/lib/db";
import DriversSlice from "./DriversSlice";
import VehiclesSlice from "./VehiclesSlice";
import AssignmentsSlice from "./AssignmentsSlice";
import FinancesSlice from "./FinancesSlice";
import MaintenanceSlice from "./MaintenanceSlice";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, User, Car, DollarSign, Wrench, ShieldAlert, ArrowLeftRight, CheckCircle, AlertTriangle, Sun, Moon, Search, Command, Sparkles, TrendingUp, Gauge } from "lucide-react";
import { motion, AnimatePresence, type Variants } from "framer-motion";

type TabId = "dashboard" | "drivers" | "vehicles" | "assignments" | "finances" | "maintenance";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [stats, setStats] = useState({ vehicles: 0, drivers: 0, assigned: 0 });
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [collectionRate, setCollectionRate] = useState(100);
  const [totalMileage, setTotalMileage] = useState<number>(0);
  const [avgDailyMileage, setAvgDailyMileage] = useState<number>(80);
  const [avgFuelConsumption, setAvgFuelConsumption] = useState<number>(6.7);
  const [recentAssignments, setRecentAssignments] = useState<Assignment[]>([]);
  const [globalSearch, setGlobalSearch] = useState("");
  const [isMobileSearchActive, setIsMobileSearchActive] = useState(false);
  const [currentTime, setCurrentTime] = useState("");

  const loadAlerts = async () => {
    const list = await db.getAlerts();
    setAlerts(list);
  };

  const loadStats = async () => {
    const vList = await db.getVehicles();
    const dList = await db.getDrivers();
    const aList = await db.getAssignments();
    const rList = await db.getWeeklyRentals();
    const cList = await db.getChecklists();

    setVehicles(vList);
    setDrivers(dList);

    const assigned = vList.filter(v => v.active_driver_id !== null).length;
    setStats({
      vehicles: vList.length,
      drivers: dList.length,
      assigned: assigned
    });

    const totalCollected = rList.reduce((acc, curr) => acc + curr.paid_amount, 0);
    const totalPending = rList.reduce((acc, curr) => acc + curr.accumulated_debt, 0);
    const totalDebtSum = totalCollected + totalPending;
    const rate = totalDebtSum > 0 ? Math.round((totalCollected / totalDebtSum) * 100) : 100;
    setCollectionRate(rate);

    setRecentAssignments(aList.slice(0, 4));

    // Compute mileage statistics
    let totalKmSum = 0;
    let totalDailyRateSum = 0;
    let vehiclesWithRate = 0;

    vList.forEach((vehicle) => {
      const vChecklists = cList.filter((c) => c.vehicle_id === vehicle.id);
      if (vChecklists.length > 0) {
        const sorted = [...vChecklists].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const latest = sorted[0];
        totalKmSum += latest.mileage;

        if (vChecklists.length >= 2) {
          const first = sorted[sorted.length - 1];
          const daysDiff = Math.max(1, Math.round((new Date(latest.created_at).getTime() - new Date(first.created_at).getTime()) / (1000 * 60 * 60 * 24)));
          const diffKm = latest.mileage - first.mileage;
          if (diffKm > 0) {
            totalDailyRateSum += diffKm / daysDiff;
            vehiclesWithRate++;
          }
        }
      }
    });

    const finalAvgDaily = vehiclesWithRate > 0 ? Math.round(totalDailyRateSum / vehiclesWithRate) : 80;
    const finalAvgFuel = Math.round((finalAvgDaily / 12) * 10) / 10; // Est. 12 km/l

    setTotalMileage(totalKmSum);
    setAvgDailyMileage(finalAvgDaily);
    setAvgFuelConsumption(finalAvgFuel);
  };

  const triggerRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  useEffect(() => {
    loadAlerts();
    loadStats();
    db.autoGenerateMondayChecklists().then((count) => {
      if (count > 0) {
        console.log(`[Checklists] Se generaron ${count} checklists semanales automáticamente para unidades activas.`);
        triggerRefresh();
      }
    });
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" || "dark";
    setTheme(savedTheme);
    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }));
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, [refreshTrigger]);

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
    setIsMobileSearchActive(false);
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

  const tabLabels: Record<string, string> = {
    dashboard: "Inicio",
    drivers: "Choferes",
    vehicles: "Autos",
    assignments: "Turnos",
    finances: "Rentas",
    maintenance: "Taller",
  };

  const navigationItems = [
    { id: "dashboard", label: "Inicio", icon: Sparkles },
    { id: "drivers", label: "Choferes", icon: User },
    { id: "vehicles", label: "Autos", icon: Car },
    { id: "assignments", label: "Turnos", icon: ArrowLeftRight },
    { id: "finances", label: "Rentas", icon: DollarSign },
    { id: "maintenance", label: "Taller", icon: Wrench },
  ];

  const tileVariants: Variants = {
    hidden: { opacity: 0, y: 24, scale: 0.96 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        delay: 0.05 + i * 0.08,
        duration: 0.5,
        type: "spring",
        stiffness: 280,
        damping: 28,
      },
    }),
  };

  const occupancy = stats.vehicles > 0 ? Math.round((stats.assigned / stats.vehicles) * 100) : 0;

  return (
    <div className="relative flex flex-col h-[100dvh] w-screen bg-background text-foreground overflow-hidden font-sans antialiased">
      {/* Main Content */}
      <main className="relative z-10 flex-1 overflow-y-auto px-4 sm:px-6 pt-[calc(env(safe-area-inset-top,0px)+16px)] pb-[calc(env(safe-area-inset-bottom,0px)+32px)] scroll-smooth max-w-6xl mx-auto w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            className="w-full space-y-5"
          >
            {activeTab === "dashboard" && (
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
                      Buenos días.
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {stats.vehicles} vehículos · {stats.assigned} activos · {alerts.length} {alerts.length === 1 ? "alerta" : "alertas"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleTheme}
                      className="p-2.5 rounded-full bg-secondary hover:bg-secondary/80 text-foreground transition-all cursor-pointer active:scale-95 shadow-2xs border-none shrink-0"
                      aria-label="Toggle theme"
                    >
                      {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-500" />}
                    </button>
                    <button
                      onClick={() => handleTabChange("dashboard")}
                      className="relative p-2.5 rounded-full bg-secondary hover:bg-secondary/80 text-foreground transition-all cursor-pointer active:scale-95 shadow-2xs border-none shrink-0"
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-max">
                  {/* BENTO TILE 1: Hero KPI Card with Occupancy */}
                  <motion.div custom={1} initial="hidden" animate="visible" variants={tileVariants} className="md:col-span-2">
                    <Card className="relative overflow-hidden p-0 border-border bg-card elevation-2">
                      <div className="absolute inset-0 gradient-pill opacity-[0.04] pointer-events-none" />
                      <div className="relative p-5 sm:p-6 space-y-5">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-label">Ocupación de Flota</h3>
                            <p className="text-caption mt-1">Vehículos actualmente en servicio</p>
                          </div>
                          <div className="px-2 py-1 rounded-md bg-success/10 border border-success/20">
                            <span className="text-[10px] font-bold text-success uppercase tracking-wider">+ Activo</span>
                          </div>
                        </div>

                        <div className="flex items-end gap-6">
                          <div>
                            <span className="block text-display text-foreground tabular-nums">{occupancy}<span className="text-2xl text-muted-foreground font-bold">%</span></span>
                          </div>
                          <div className="flex-1 pb-2 space-y-1">
                            <div className="flex justify-between text-[11px] font-semibold text-muted-foreground">
                              <span>{stats.assigned} de {stats.vehicles} unidades</span>
                              <span className="text-foreground">{occupancy}%</span>
                            </div>
                            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${occupancy}%` }}
                                transition={{ type: "spring", stiffness: 80, damping: 18, delay: 0.2 }}
                                className="h-full gradient-pill rounded-full"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border/60">
                          <div>
                            <span className="text-label">Autos</span>
                            <p className="text-[22px] font-bold tracking-tight text-foreground tabular-nums leading-none mt-1.5">{stats.vehicles}</p>
                          </div>
                          <div>
                            <span className="text-label">Activos</span>
                            <p className="text-[22px] font-bold tracking-tight text-primary tabular-nums leading-none mt-1.5">{stats.assigned}</p>
                          </div>
                          <div>
                            <span className="text-label">Choferes</span>
                            <p className="text-[22px] font-bold tracking-tight text-foreground tabular-nums leading-none mt-1.5">{stats.drivers}</p>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </motion.div>

                  {/* BENTO TILE 2: Cobranza — circular gauge style */}
                  <motion.div custom={2} initial="hidden" animate="visible" variants={tileVariants}>
                    <Card className="relative overflow-hidden p-5 border-border bg-card elevation-2 h-full">
                      <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-success/5 blur-2xl pointer-events-none" />
                      <div className="relative space-y-3 h-full flex flex-col">
                        <div className="flex items-center justify-between">
                          <h3 className="text-label">Cobranza Semanal</h3>
                          <TrendingUp className="w-3.5 h-3.5 text-success" />
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-display text-foreground tabular-nums">{collectionRate}</span>
                          <span className="text-xl font-bold text-muted-foreground">%</span>
                        </div>
                        <div className="flex-1 flex items-end">
                          <div className="w-full space-y-1.5">
                            <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${collectionRate}%` }}
                                transition={{ type: "spring", stiffness: 80, damping: 18, delay: 0.3 }}
                                className="h-full bg-success rounded-full"
                              />
                            </div>
                            <p className="text-caption">Pagos vs. deuda acumulada</p>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </motion.div>

                  {/* BENTO TILE 3: Quick Actions */}
                  <motion.div custom={3} initial="hidden" animate="visible" variants={tileVariants}>
                    <Card className="p-5 border-border bg-card elevation-2 h-full">
                      <h3 className="text-label mb-4">Acceso Rápido</h3>
                      <div className="grid grid-cols-2 gap-2">
                        <QuickActionButton
                          icon={User}
                          label="Choferes"
                          onClick={() => setActiveTab("drivers")}
                        />
                        <QuickActionButton
                          icon={Car}
                          label="Autos"
                          onClick={() => setActiveTab("vehicles")}
                        />
                        <QuickActionButton
                          icon={ArrowLeftRight}
                          label="Asignar Turno"
                          onClick={() => setActiveTab("assignments")}
                          span={2}
                        />
                      </div>
                    </Card>
                  </motion.div>

                  {/* BENTO TILE 4: Recent Activity */}
                  <motion.div custom={4} initial="hidden" animate="visible" variants={tileVariants} className="md:col-span-2">
                    <Card className="p-5 border-border bg-card elevation-2">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-label">Actividad Reciente</h3>
                        <span className="text-[10px] text-muted-foreground font-medium">Últimos turnos</span>
                      </div>
                      <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
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
                                <p className="text-[10px] text-muted-foreground mt-1">{new Date(asg.created_at).toLocaleDateString()}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </Card>
                  </motion.div>

                  {/* BENTO TILE 4b: Mileage & Fuel/Consumption Analytics */}
                  <motion.div custom={4.5} initial="hidden" animate="visible" variants={tileVariants}>
                    <Card className="p-5 border-border bg-card shadow-md h-full flex flex-col justify-between">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-label">Kilometraje y Consumo</h3>
                          <Gauge className="w-3.5 h-3.5 text-primary" />
                        </div>

                        <div className="space-y-3">
                          <div>
                            <span className="text-[9px] uppercase tracking-wider text-muted-foreground block font-bold">Kilometraje Flota</span>
                            <p className="text-2xl font-black text-foreground font-mono leading-none pt-1">
                              {totalMileage.toLocaleString()} <span className="text-xs text-muted-foreground font-medium">km</span>
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60">
                            <div>
                              <span className="text-[9px] uppercase tracking-wider text-muted-foreground block font-bold">Media Diaria</span>
                              <p className="text-sm font-bold text-foreground font-mono mt-0.5">
                                {avgDailyMileage} <span className="text-[9px] text-muted-foreground font-normal">km/d</span>
                              </p>
                            </div>
                            <div>
                              <span className="text-[9px] uppercase tracking-wider text-muted-foreground block font-bold">Consumo Est.</span>
                              <p className="text-sm font-bold text-primary font-mono mt-0.5">
                                {avgFuelConsumption} <span className="text-[9px] text-muted-foreground font-normal">L/d</span>
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <p className="text-[9px] text-muted-foreground pt-3 border-t border-border/40 mt-3 leading-relaxed">
                        Cálculo dinámico basado en checklists (Consumo est. urbano de 12 km/L).
                      </p>
                    </Card>
                  </motion.div>

                  {/* BENTO TILE 5: Alerts — full width, redesigned */}
                  <motion.div custom={5} initial="hidden" animate="visible" variants={tileVariants} className="md:col-span-3 space-y-3">
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
                              onClick={() => handleDismissAlert(alert.id, alert.title)}
                              className={`group relative overflow-hidden border-border bg-card hover:elevation-2 cursor-pointer active:scale-[0.99] transition-all duration-200 ${
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
            )}

            {activeTab === "drivers" && <DriversSlice onRefreshAlerts={triggerRefresh} searchQuery={globalSearch} />}
            {activeTab === "vehicles" && <VehiclesSlice onRefreshAlerts={triggerRefresh} searchQuery={globalSearch} />}
            {activeTab === "assignments" && <AssignmentsSlice onRefreshAll={triggerRefresh} />}
            {activeTab === "finances" && <FinancesSlice />}
            {activeTab === "maintenance" && <MaintenanceSlice onRefreshAlerts={triggerRefresh} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile Bottom Tab Bar for Direct Navigation */}
      <nav className="md:hidden glass-nav border-t border-border bg-card/85 backdrop-blur-lg flex items-center justify-around h-14 w-full fixed bottom-0 left-0 z-40 px-2">
        {navigationItems.map((tab) => {
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
function QuickActionButton({ icon: Icon, label, onClick, span = 1 }: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void; span?: number }) {
  return (
    <button
      onClick={onClick}
      style={{ gridColumn: span === 2 ? "span 2" : undefined }}
      className="group flex items-center gap-2.5 h-11 px-3 bg-secondary/60 hover:bg-secondary border border-border/60 hover:border-border rounded-lg text-[12px] font-semibold text-foreground transition-all cursor-pointer active:scale-[0.97]"
    >
      <div className="w-7 h-7 rounded-md bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-colors">
        <Icon className="w-3.5 h-3.5 text-primary" />
      </div>
      <span>{label}</span>
    </button>
  );
}
