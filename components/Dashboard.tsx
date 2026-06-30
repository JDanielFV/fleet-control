"use client";

import React, { useState, useEffect } from "react";
import { db, Alert } from "@/lib/db";
import DriversSlice from "./DriversSlice";
import VehiclesSlice from "./VehiclesSlice";
import AssignmentsSlice from "./AssignmentsSlice";
import FinancesSlice from "./FinancesSlice";
import MaintenanceSlice from "./MaintenanceSlice";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, User, Car, DollarSign, Wrench, ShieldAlert, ArrowLeftRight, CheckCircle, TrendingUp, AlertTriangle, Sun, Moon, Menu, X, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "drivers" | "vehicles" | "assignments" | "finances" | "maintenance">("dashboard");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [stats, setStats] = useState({ vehicles: 0, drivers: 0, assigned: 0 });
  const [recentAssignments, setRecentAssignments] = useState<any[]>([]);
  const [globalSearch, setGlobalSearch] = useState("");
  const [isMobileSearchActive, setIsMobileSearchActive] = useState(false);

  useEffect(() => {
    loadAlerts();
    loadStats();
    // Run automated Monday checklist generation
    db.autoGenerateMondayChecklists().then((count) => {
      if (count > 0) {
        console.log(`[Checklists] Se generaron ${count} checklists semanales automáticamente para unidades activas.`);
        triggerRefresh();
      }
    });
    // Initialize Theme
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" || "dark";
    setTheme(savedTheme);
    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [refreshTrigger]);

  const loadAlerts = async () => {
    const list = await db.getAlerts();
    setAlerts(list);
  };

  const loadStats = async () => {
    const vList = await db.getVehicles();
    const dList = await db.getDrivers();
    const aList = await db.getAssignments();
    
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

  const handleTabChange = (tab: any) => {
    setActiveTab(tab);
    setGlobalSearch("");
    setIsMobileSearchActive(false);
  };

  const handleDismissAlert = async (id: string, title: string) => {
    if (confirm(`¿Deseas marcar la alerta "${title}" como completada? Se ocultará del panel principal.`)) {
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

  const criticalAlertsCount = alerts.filter(a => a.severity === "critical").length;
  const warningAlertsCount = alerts.filter(a => a.severity === "warning").length;

  const tabLabels: Record<string, string> = {
    dashboard: "Avisos",
    drivers: "Choferes",
    vehicles: "Autos",
    assignments: "Turnos",
    finances: "Rentas",
    maintenance: "Taller",
  };

  const navigationItems = [
    { id: "dashboard", label: "Avisos", icon: Bell },
    { id: "drivers", label: "Choferes", icon: User },
    { id: "vehicles", label: "Autos", icon: Car },
    { id: "assignments", label: "Turnos", icon: ArrowLeftRight },
    { id: "finances", label: "Rentas", icon: DollarSign },
    { id: "maintenance", label: "Taller", icon: Wrench },
  ];

  return (
    <div className="flex flex-col h-[100dvh] w-screen bg-background text-foreground overflow-hidden font-sans antialiased transition-colors duration-300">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full glass-header px-4 py-3.5 flex items-center justify-between min-h-[58px]">
        <AnimatePresence mode="wait">
          {isMobileSearchActive ? (
            /* Active iOS Search Header (Mobile only) */
            <motion.div
              key="search-active"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="flex items-center gap-2 w-full md:hidden"
            >
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  autoFocus
                  placeholder={activeTab === "drivers" ? "Buscar chofer..." : "Buscar auto..."}
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  className="w-full h-9 pl-8 pr-3 text-sm bg-secondary/80 border border-input rounded-xl focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary text-foreground placeholder:text-muted-foreground/60"
                />
              </div>
              <button
                onClick={() => {
                  setIsMobileSearchActive(false);
                  setGlobalSearch("");
                }}
                className="text-xs font-bold text-primary active:scale-95 transition-all px-1 cursor-pointer shrink-0"
              >
                Cancelar
              </button>
            </motion.div>
          ) : (
            /* Standard Header layout */
            <motion.div
              key="search-inactive"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-between w-full"
            >
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-sm tracking-tighter shadow-md shadow-blue-500/20">
                  FC
                </div>
                <div>
                  <span className="font-black text-base tracking-tight text-foreground block leading-none">
                    FleetControl
                  </span>
                  <span className="text-[9px] text-primary font-bold tracking-wider uppercase block pt-0.5 md:hidden">
                    {tabLabels[activeTab]}
                  </span>
                </div>
              </div>

              {/* Center: Desktop horizontal segmented tab controllers */}
              <div className="hidden md:flex items-center gap-0.5 bg-secondary/50 p-1 rounded-xl border border-border/40 select-none">
                {navigationItems.map((tab) => {
                  const Icon = tab.icon;
                  const isSelected = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTabChange(tab.id as any)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        isSelected
                          ? "bg-card text-foreground shadow-xs border border-border/20"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                {/* Global contextual Search Bar in header (Desktop only) */}
                {(activeTab === "drivers" || activeTab === "vehicles") && (
                  <div className="hidden md:block relative w-44 lg:w-52 mr-1">
                    <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder={activeTab === "drivers" ? "Buscar chofer..." : "Buscar auto..."}
                      value={globalSearch}
                      onChange={(e) => setGlobalSearch(e.target.value)}
                      className="w-full h-8.5 pl-8 pr-3 text-xs bg-background border border-input rounded-lg focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-transparent text-foreground placeholder:text-muted-foreground/60 transition-all"
                    />
                  </div>
                )}

                {/* Mobile Search Toggle Button (Mobile only, contextual) */}
                {(activeTab === "drivers" || activeTab === "vehicles") && (
                  <button
                    onClick={() => setIsMobileSearchActive(true)}
                    className="p-2 rounded-xl bg-muted border border-border hover:bg-secondary/20 transition-all cursor-pointer active:scale-95 text-muted-foreground hover:text-foreground md:hidden"
                    aria-label="Search"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                )}

                {/* Theme Switcher Button */}
                <button
                  onClick={toggleTheme}
                  className="p-2 rounded-xl bg-muted border border-border hover:bg-secondary/20 transition-all cursor-pointer active:scale-95 text-muted-foreground hover:text-foreground"
                  aria-label="Toggle theme"
                >
                  {theme === "dark" ? (
                    <Sun className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Moon className="w-4 h-4 text-indigo-600" />
                  )}
                </button>

                {/* Bell Notification Button */}
                <button
                  onClick={() => handleTabChange("dashboard")}
                  className="relative p-2 rounded-xl bg-muted border border-border hover:bg-secondary transition-all cursor-pointer active:scale-95"
                >
                  <Bell className="w-4.5 h-4.5 text-muted-foreground hover:text-foreground" />
                  {alerts.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-lg shadow-primary/30">
                      {alerts.length}
                    </span>
                  )}
                </button>

                {/* Hamburger Menu Sandwich Button (Mobile only) */}
                <button
                  onClick={() => setIsMenuOpen(true)}
                  className="p-2 rounded-xl bg-muted border border-border hover:bg-secondary transition-all cursor-pointer active:scale-95 text-muted-foreground hover:text-foreground md:hidden"
                  aria-label="Open navigation menu"
                >
                  <Menu className="w-4.5 h-4.5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main Content Area (PC Expanded width boundaries) */}
      <main className="flex-1 overflow-y-auto px-4 py-4 pb-6 scroll-smooth max-w-6xl mx-auto w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="w-full"
          >
            {activeTab === "dashboard" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-max">

                {/* BENTO TILE 4: Fleet Overview Quick Stats (Spans 1 column on PC) */}
                <Card className="p-5 border-border bg-card flex flex-col justify-between min-h-[160px]">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Resumen de Flota</h3>
                  <div className="grid grid-cols-3 gap-2 text-center pt-2">
                    <div>
                      <span className="block text-2xl font-black text-foreground">{stats.vehicles}</span>
                      <span className="text-[9px] font-bold text-muted-foreground uppercase">Autos</span>
                    </div>
                    <div>
                      <span className="block text-2xl font-black text-primary">{stats.assigned}</span>
                      <span className="text-[9px] font-bold text-muted-foreground uppercase">Activos</span>
                    </div>
                    <div>
                      <span className="block text-2xl font-black text-foreground">{stats.drivers}</span>
                      <span className="text-[9px] font-bold text-muted-foreground uppercase">Choferes</span>
                    </div>
                  </div>
                  <p className="text-[9px] text-muted-foreground leading-tight pt-3 border-t border-border/50 mt-2">
                    Flota activa al {stats.vehicles > 0 ? Math.round((stats.assigned / stats.vehicles) * 100) : 0}% de capacidad.
                  </p>
                </Card>

                {/* BENTO TILE 5: Acciones Rápidas Shortcuts (Spans 1 column on PC) */}
                <Card className="p-5 border-border bg-card flex flex-col justify-between min-h-[160px]">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Acceso Rápido</h3>
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <Button 
                      onClick={() => setActiveTab("drivers")} 
                      className="h-9 text-[10px] font-black uppercase bg-muted border border-border hover:bg-secondary text-foreground rounded-lg flex items-center justify-center cursor-pointer"
                    >
                      Choferes
                    </Button>
                    <Button 
                      onClick={() => setActiveTab("vehicles")} 
                      className="h-9 text-[10px] font-black uppercase bg-muted border border-border hover:bg-secondary text-foreground rounded-lg flex items-center justify-center cursor-pointer"
                    >
                      Autos
                    </Button>
                    <Button 
                      onClick={() => setActiveTab("assignments")} 
                      className="h-9 text-[10px] font-black uppercase bg-muted border border-border hover:bg-secondary text-foreground rounded-lg flex items-center justify-center cursor-pointer col-span-2"
                    >
                      Asignar Turno / Retiro
                    </Button>
                  </div>
                </Card>

                {/* BENTO TILE 7: Últimos Movimientos / Historial Rápido (Spans 1 column on PC) */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Historial de Turnos</h3>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {recentAssignments.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic py-4 text-center">No hay movimientos registrados.</p>
                    ) : (
                      recentAssignments.map((asg) => (
                        <Card key={asg.id} className="p-3 border-border bg-muted/20 text-xs">
                          <div className="flex justify-between items-center mb-1">
                            <span className={`px-1.5 py-0.5 text-[8px] font-black rounded-md ${asg.action_type === "ASSIGN" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
                              {asg.action_type === "ASSIGN" ? "Asignado" : "Retirado"}
                            </span>
                            <span className="text-[8px] text-muted-foreground">{new Date(asg.created_at).toLocaleDateString()}</span>
                          </div>
                          <p className="font-semibold text-foreground/90 truncate">
                            Placa: {asg.vehicle_id.substring(0, 5)}...
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">Motivo: {asg.reason}</p>
                        </Card>
                      ))
                    )}
                  </div>
                </div>

                {/* BENTO TILE 6: Alertas Detalladas / Avisos & Pendientes (Spans all 3 columns on PC) */}
                <div className="md:col-span-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Avisos & Pendientes</h3>
                    {alerts.length > 0 && (
                      <span className="text-[10px] text-primary font-semibold uppercase">Actualizado</span>
                    )}
                  </div>

                  {alerts.length === 0 ? (
                    <Card className="p-6 text-center text-muted-foreground border-dashed border-border bg-transparent flex flex-col items-center justify-center gap-2 h-[200px]">
                      <CheckCircle className="w-8 h-8 text-emerald-500 animate-pulse" />
                      <p className="text-sm font-semibold text-foreground">¡Todo en orden!</p>
                      <p className="text-xs">No hay alertas de verificación, seguros ni licencias pendientes.</p>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-1">
                      {alerts.map((alert) => (
                        <Card 
                          key={alert.id} 
                          onClick={() => handleDismissAlert(alert.id, alert.title)}
                          className="overflow-hidden border-border bg-card hover:bg-secondary/10 hover:border-border/80 cursor-pointer active:scale-[0.99] transition-all duration-200"
                        >
                          <div className="p-3.5 flex gap-3 items-start">
                            {alert.severity === "critical" ? (
                              <div className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 shrink-0">
                                <ShieldAlert className="w-4 h-4" />
                              </div>
                            ) : (
                              <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 shrink-0">
                                <AlertTriangle className="w-4 h-4" />
                              </div>
                            )}
                            <div className="space-y-1 min-w-0">
                              <h4 className="text-xs font-bold text-foreground">
                                {alert.title}
                              </h4>
                              <p className="text-2xs text-muted-foreground leading-normal">
                                {alert.description}
                              </p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "drivers" && <DriversSlice onRefreshAlerts={triggerRefresh} searchQuery={globalSearch} />}
            {activeTab === "vehicles" && <VehiclesSlice onRefreshAlerts={triggerRefresh} searchQuery={globalSearch} />}
            {activeTab === "assignments" && <AssignmentsSlice onRefreshAll={triggerRefresh} />}
            {activeTab === "finances" && <FinancesSlice />}
            {activeTab === "maintenance" && <MaintenanceSlice onRefreshAlerts={triggerRefresh} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Slide-out Navigation Drawer Menu (PWA Sandwich Menu) */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs"
            />

            {/* Sliding Panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed top-0 right-0 bottom-0 z-50 w-72 bg-background border-l border-border shadow-2xl flex flex-col p-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)]"
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-6 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-xs">
                    FC
                  </div>
                  <span className="font-black text-sm text-foreground">Navegación</span>
                </div>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  aria-label="Close navigation menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Navigation Tabs List */}
              <div className="flex-1 py-6 flex flex-col gap-2">
                {navigationItems.map((tab) => {
                  const Icon = tab.icon;
                  const isSelected = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id as any);
                        setIsMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all cursor-pointer text-left ${
                        isSelected
                          ? "bg-primary/10 text-primary border border-primary/20 font-bold dark:text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent"
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${isSelected ? "text-primary dark:text-primary" : "text-muted-foreground/70"}`} />
                      <span className="text-sm">{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Drawer Footer info */}
              <div className="pt-4 border-t border-border/60 text-center">
                <p className="text-[10px] text-muted-foreground/50 font-mono tracking-wider">FLEET CONTROL V1.2</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
