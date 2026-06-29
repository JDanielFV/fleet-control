"use client";

import React, { useState, useEffect } from "react";
import { db, Alert } from "@/lib/db";
import DriversSlice from "./DriversSlice";
import VehiclesSlice from "./VehiclesSlice";
import AssignmentsSlice from "./AssignmentsSlice";
import FinancesSlice from "./FinancesSlice";
import MaintenanceSlice from "./MaintenanceSlice";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, User, Car, DollarSign, Wrench, ShieldAlert, ArrowLeftRight, CheckCircle, TrendingUp, AlertTriangle, Sun, Moon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "drivers" | "vehicles" | "assignments" | "finances" | "maintenance">("dashboard");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    loadAlerts();
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

  const triggerRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
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

  return (
    <div className="flex flex-col h-[100dvh] w-screen bg-background text-foreground overflow-hidden font-sans antialiased transition-colors duration-300">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full glass-header px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-zinc-950 font-black text-sm tracking-tighter shadow-md shadow-emerald-500/20">
            FC
          </div>
          <div>
            <span className="font-black text-base tracking-tight text-foreground block leading-none">
              FleetControl
            </span>
            <span className="text-[10px] text-muted-foreground font-semibold tracking-wider uppercase">
              Consola Admin
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Theme Switcher Button */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-muted border border-border hover:bg-zinc-800/10 dark:hover:bg-zinc-800 transition-all cursor-pointer active:scale-95 text-muted-foreground hover:text-foreground"
            aria-label="Cambiar Tema"
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-600" />
            )}
          </button>

          {/* Notifications Button */}
          <button
            onClick={() => setActiveTab("dashboard")}
            className="relative p-2 rounded-xl bg-muted border border-border hover:bg-zinc-850 transition-all cursor-pointer active:scale-95"
          >
            <Bell className="w-4.5 h-4.5 text-muted-foreground hover:text-foreground" />
            {alerts.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 text-zinc-950 text-[10px] font-black rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30">
                {alerts.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area (Viewport bounded) */}
      <main className="flex-1 overflow-y-auto px-4 py-4 pb-24 scroll-smooth max-w-lg mx-auto w-full">
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
              <div className="space-y-5">
                {/* Opera State banner */}
                <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-xs">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl" />
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground">Estado Operativo</h3>
                      <h2 className="text-2xl font-black text-foreground mt-1">Óptimo</h2>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center glow-emerald">
                      <CheckCircle className="w-6 h-6 text-emerald-500 dark:text-emerald-400" />
                    </div>
                  </div>
                  <div className="w-full bg-secondary h-1.5 rounded-full mt-4 overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full w-[85%]" />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">85% de la flota se encuentra operativa y activa.</p>
                </div>

                {/* KPI counts */}
                <div className="grid grid-cols-2 gap-3">
                  <Card className="p-4 border-border bg-card hover:bg-secondary/20 transition-colors">
                    <CardDescription className="text-2xs font-bold uppercase tracking-wider text-red-500 dark:text-red-400">
                      Críticos
                    </CardDescription>
                    <CardTitle className="text-2xl font-black text-red-600 dark:text-red-500 pt-1">
                      {criticalAlertsCount}
                    </CardTitle>
                    <p className="text-[10px] text-muted-foreground mt-1">Acción inmediata</p>
                  </Card>
                  <Card className="p-4 border-border bg-card hover:bg-secondary/20 transition-colors">
                    <CardDescription className="text-2xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      Advertencias
                    </CardDescription>
                    <CardTitle className="text-2xl font-black text-amber-500 pt-1">
                      {warningAlertsCount}
                    </CardTitle>
                    <p className="text-[10px] text-muted-foreground mt-1">Vencimientos próximos</p>
                  </Card>
                </div>

                {/* Alerts List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Avisos & Pendientes</h3>
                    {alerts.length > 0 && (
                      <span className="text-[10px] text-emerald-500 font-semibold uppercase">Actualizado</span>
                    )}
                  </div>

                  {alerts.length === 0 ? (
                    <Card className="p-6 text-center text-zinc-500 border-dashed border-border bg-transparent flex flex-col items-center justify-center gap-2">
                      <CheckCircle className="w-8 h-8 text-emerald-500" />
                      <p className="text-sm font-semibold text-foreground">¡Al corriente!</p>
                      <p className="text-xs">No hay trámites ni mantenimientos vencidos.</p>
                    </Card>
                  ) : (
                    alerts.map((alert) => (
                      <Card key={alert.id} className="overflow-hidden border-border bg-card hover:bg-secondary/10 transition-colors">
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
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === "drivers" && <DriversSlice onRefreshAlerts={triggerRefresh} />}
            {activeTab === "vehicles" && <VehiclesSlice onRefreshAlerts={triggerRefresh} />}
            {activeTab === "assignments" && <AssignmentsSlice onRefreshAll={triggerRefresh} />}
            {activeTab === "finances" && <FinancesSlice />}
            {activeTab === "maintenance" && <MaintenanceSlice onRefreshAlerts={triggerRefresh} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 glass-nav px-4 pt-2 flex items-center justify-between shadow-2xl">
        {[
          { id: "dashboard", label: "Avisos", icon: Bell },
          { id: "drivers", label: "Choferes", icon: User },
          { id: "vehicles", label: "Autos", icon: Car },
          { id: "assignments", label: "Turnos", icon: ArrowLeftRight },
          { id: "finances", label: "Rentas", icon: DollarSign },
          { id: "maintenance", label: "Taller", icon: Wrench },
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className="flex flex-col items-center gap-1 text-center transition-all cursor-pointer relative py-1"
            >
              <div className={`p-1.5 rounded-xl transition-all ${
                isSelected 
                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 scale-110" 
                  : "text-muted-foreground hover:text-foreground border border-transparent"
              }`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className={`text-[9px] font-bold tracking-tight transition-colors ${
                isSelected ? "text-emerald-500" : "text-muted-foreground"
              }`}>
                {tab.label
              }</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
