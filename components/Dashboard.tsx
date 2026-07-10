"use client";

import React, { useState, useEffect, useMemo } from "react";
import { db, Driver, Vehicle, Assignment, Checklist, WeeklyRental, Alert } from "@/lib/db";
import { formatDate, sortByDateDesc } from "@/lib/utils";
import { computeUsageStats } from "@/lib/usageStats";
import { getDriverName } from "@/lib/lookups";
import { getVerificationSchedule } from "@/lib/db";
import { uploadDocumentImage } from "@/lib/db/storage";
import DriversSlice from "./DriversSlice";
import VehiclesSlice from "./VehiclesSlice";
import UsersSlice from "@/features/auth/components/UsersSlice";
import LoginScreen from "@/features/auth/components/LoginScreen";
import { EntityActionSheet } from "@/features/assignments/components/EntityActionSheet";
import { ChecklistSheet } from "@/features/checklists/components/ChecklistSheet";
import AssignmentDialog from "@/features/assignments/components/AssignmentDialog";
import ChecklistActionModal from "@/features/checklists/components/ChecklistActionModal";
import WearPartDialog from "@/features/maintenance/components/WearPartDialog";
import InventoryWizard from "./InventoryWizard";
import Sidebar from "./Sidebar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DashboardSkeleton } from "@/components/ui/skeletons";
import { Bell, User, Car, ArrowLeftRight, CheckCircle, AlertTriangle, Sun, Moon, Sparkles, Shield, ShieldAlert, Gauge, Search, X, CheckCircle2, BarChart3, Download } from "lucide-react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useDashboard, type TabId } from "@/features/dashboard/hooks/useDashboard";

export default function Dashboard() {
  const ctx = useDashboard();

  const desktopNavItems: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "dashboard", label: "Check Lists", icon: Sparkles },
    { id: "drivers", label: "Choferes", icon: User },
    { id: "vehicles", label: "Autos", icon: Car },
    { id: "users", label: "Usuarios", icon: Shield },
  ];

  const mobileNavItems = desktopNavItems;

  const tileVariants: Variants = {
    hidden: { opacity: 0, y: 24, scale: 0.96 },
    visible: (i: number) => ({
      opacity: 1, y: 0, scale: 1,
      transition: { delay: 0.05 + i * 0.08, duration: 0.9, type: "spring", stiffness: 120, damping: 18 },
    }),
  };

  if (ctx.isSessionLoading) {
    return <div className="flex items-center justify-center min-h-screen w-screen bg-background text-foreground"><div className="text-muted-foreground">Cargando...</div></div>;
  }

  if (!ctx.session) {
    return <LoginScreen onLogin={ctx.handleLogin} />;
  }

  return (
    <div className="relative flex flex-col md:flex-row h-screen w-screen bg-background text-foreground font-sans antialiased overflow-hidden">
      <Sidebar items={desktopNavItems} activeTab={ctx.activeTab} onChange={ctx.handleTabChange} alertCount={ctx.alerts.length} onAlertsClick={() => ctx.setIsBuzonOpen(true)} />

      <div className="flex-1 flex h-full overflow-hidden">
        <main id="main-content" className="relative z-10 flex-1 overflow-hidden flex flex-col px-3 sm:px-4 md:px-6 lg:px-8 xl:px-10 pt-[calc(env(safe-area-inset-top,0px)+16px)] pb-20 md:pb-4 scroll-smooth w-full h-full max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div key={ctx.activeTab} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }} className="w-full flex-1 flex flex-col overflow-hidden">

              {ctx.activeTab === "dashboard" && (
                ctx.isLoading ? <DashboardSkeleton /> : (
                  <div className="flex-1 flex flex-col overflow-hidden space-y-6 h-full">
                    {/* Hero */}
                    <motion.div custom={0} initial="hidden" animate="visible" variants={tileVariants} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 pt-2 px-1 shrink-0">
                      <div>
                        <h1 className="text-xl sm:text-[26px] font-black tracking-tight leading-none text-foreground">
                          Buenos días.{ctx.currentTime && <span className="text-muted-foreground ml-2 text-sm sm:text-lg font-medium">{ctx.currentTime}</span>}
                        </h1>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 sm:mt-2">{ctx.stats.vehicles} vehículos · {ctx.stats.assigned} activos · {ctx.alerts.length} {ctx.alerts.length === 1 ? "alerta" : "alertas"} pendientes</p>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button onClick={ctx.exportChecklistCsv} className="p-2 sm:p-2.5 rounded-full bg-secondary hover:bg-secondary/80 text-foreground transition-all cursor-pointer active:scale-95 shadow-2xs border-none shrink-0" aria-label="Exportar checklists a CSV" title="Exportar CSV"><Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>
                        <button onClick={() => ctx.setIsBuzonOpen(true)} className="md:hidden relative p-2 sm:p-2.5 rounded-full bg-secondary hover:bg-secondary/80 text-foreground transition-all cursor-pointer active:scale-95 shadow-2xs border-none shrink-0" aria-label={`Abrir buzón de alertas. ${ctx.alerts.length} alertas activas`}>
                          <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          {ctx.alerts.length > 0 && <span className="absolute -top-1 -right-1 min-w-[14px] sm:min-w-[16px] h-3 sm:h-4 px-1 bg-red-500 text-white text-[10px] sm:text-[11px] font-black rounded-full flex items-center justify-center">{ctx.alerts.length}</span>}
                        </button>
                      </div>
                    </motion.div>

                    {/* Search + Quick Actions */}
                    <div className="bg-[#ECECEC] rounded-2xl min-h-12 px-3 sm:px-4 flex items-center gap-2 w-full shrink-0 shadow-inner border border-border/40 focus-within:ring-4 focus-within:ring-primary/20 transition-all flex-wrap sm:flex-nowrap py-2 sm:py-0">
                      <Search className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                      <input type="text" placeholder="Buscar chofer por nombre o placas..." value={ctx.globalSearch} onChange={(e) => ctx.setGlobalSearch(e.target.value)}
                        className="flex-1 bg-transparent border-none text-foreground text-xs placeholder:text-muted-foreground/60 focus:outline-hidden min-w-0 w-full sm:w-auto" />
                      {ctx.globalSearch && (
                        <button onClick={() => ctx.setGlobalSearch("")} className="text-[11px] font-bold text-muted-foreground hover:text-foreground shrink-0 px-2 cursor-pointer">Limpiar</button>
                      )}
                      <div className="flex items-center gap-1.5 shrink-0 pl-0 sm:pl-2 border-l-0 sm:border-l border-border/40 w-full sm:w-auto justify-end">
                        <button onClick={() => { ctx.setAutoOpenDriver(true); ctx.handleTabChange("drivers"); }} className="inline-flex items-center gap-1 px-2.5 h-7 sm:px-3 sm:h-8 rounded-lg bg-primary text-white text-[10px] sm:text-[11px] font-bold hover:bg-primary/90 transition-all cursor-pointer active:scale-95 shadow-sm border-none">
                          <User className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Chofer
                        </button>
                        <button onClick={() => { ctx.setAutoOpenVehicle(true); ctx.handleTabChange("vehicles"); }} className="inline-flex items-center gap-1 px-2.5 h-7 sm:px-3 sm:h-8 rounded-lg bg-primary text-white text-[10px] sm:text-[11px] font-bold hover:bg-primary/90 transition-all cursor-pointer active:scale-95 shadow-sm border-none">
                          <Car className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Auto
                        </button>
                        <button onClick={() => ctx.setAssignmentDialogOpen(true)} className="inline-flex items-center gap-1 px-2.5 h-7 sm:px-3 sm:h-8 rounded-lg bg-emerald-500 text-white text-[10px] sm:text-[11px] font-bold hover:bg-emerald-600 transition-all cursor-pointer active:scale-95 shadow-sm border-none">
                          <ArrowLeftRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Asignar
                        </button>
                      </div>
                    </div>

                    {/* Checklist Table */}
                    <div className="flex-1 overflow-y-auto pr-1">
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
                            {ctx.filteredDriversList.filter((d) => ctx.vehicles.some((v) => v.active_driver_id === d.id)).length === 0 ? (
                              <tr><td colSpan={9} className="text-center py-10 text-muted-foreground italic">No se encontraron choferes que coincidan con la búsqueda.</td></tr>
                            ) : (
                              ctx.filteredDriversList.filter((driver) => ctx.vehicles.some((v) => v.active_driver_id === driver.id)).map((driver) => {
                                const assignedVehicle = ctx.vehicles.find((v) => v.active_driver_id === driver.id)!;
                                const vChecklists = ctx.checklists.filter((c) => c.vehicle_id === assignedVehicle.id);
                                const sortedChecks = sortByDateDesc(vChecklists, "created_at");
                                const latestKm = sortedChecks[0]?.mileage;
                                const prevKm = sortedChecks[1]?.mileage;
                                const vehicleId = assignedVehicle.vin?.slice(-6).toUpperCase() || "—";
                                const driverRentals = ctx.weeklyRentals.filter((r) => r.driver_id === driver.id && r.status !== "PAID");
                                const totalPending = driverRentals.reduce((acc, r) => acc + Math.max(0, r.rent_amount - r.paid_amount), 0);
                                const driverChecklists = ctx.checklists.filter((c) => { const v = ctx.vehicles.find((vv) => vv.id === c.vehicle_id); return v?.active_driver_id === driver.id; });
                                const usageStats = computeUsageStats(driverChecklists);
                                const today = new Date();
                                const getRowStatus = (v: Vehicle): "in_service" | "red" | "yellow" | "green" => {
                                  if (v.status === "in_service") return "in_service";
                                  const dates = [v.circulation_expiration_date, v.insurance_expiration_date, v.verification_expiration_date].filter(Boolean) as string[];
                                  for (const d of dates) {
                                    const diff = Math.ceil((new Date(d).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                                    if (diff <= 0) return "red";
                                    if (diff <= 30) return "yellow";
                                  }
                                  return "green";
                                };
                                const rowStatus = getRowStatus(assignedVehicle);
                                const rowColorClass = rowStatus === "in_service" ? "bg-blue-500/5 border-l-4 border-l-blue-500"
                                  : rowStatus === "red" ? "bg-red-500/5 border-l-4 border-l-red-500"
                                  : rowStatus === "yellow" ? "bg-amber-500/5 border-l-4 border-l-amber-500"
                                  : "border-l-4 border-l-transparent";
                                const rowIndex = ctx.filteredDriversList.filter((d) => ctx.vehicles.some((v) => v.active_driver_id === d.id)).indexOf(driver);

                                return (
                                  <tr key={driver.id} role="button" tabIndex={0} onClick={() => ctx.openActionModal(assignedVehicle)}
                                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ctx.openActionModal(assignedVehicle); } }}
                                    className={`border-b border-border/20 hover:bg-muted/30 transition-colors cursor-pointer ${rowColorClass} ${rowIndex % 2 === 0 ? "bg-card" : "bg-muted/5"}`}>
                                    <td className="py-3 px-2"><span className="font-bold text-foreground">{driver.first_name} {driver.paternal_last_name}</span></td>
                                    <td className="py-3 px-2 text-muted-foreground">{assignedVehicle.brand} {assignedVehicle.vehicle_name}</td>
                                    <td className="py-3 px-2 font-mono text-muted-foreground">{assignedVehicle.plate_number}</td>
                                    <td className="py-3 px-2 font-mono text-muted-foreground">{vehicleId}</td>
                                    <td className="py-3 px-2 text-right font-mono text-muted-foreground">{prevKm != null ? prevKm.toLocaleString() : "—"}</td>
                                    <td className="py-3 px-2 text-right font-mono font-bold text-foreground">{latestKm != null ? latestKm.toLocaleString() : "—"}</td>
                                    <td className="py-3 px-2 text-right font-mono text-muted-foreground">${assignedVehicle.rent_cost.toLocaleString()}</td>
                                    <td className="py-3 px-2 text-right font-mono font-bold text-red-400">${totalPending.toLocaleString()}</td>
                                    <td className="py-3 px-2 text-center">
                                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); ctx.openStatsDialog(driver, usageStats); }}
                                        className="text-primary hover:text-primary hover:bg-primary/10 text-xs gap-1"><BarChart3 className="w-3.5 h-3.5" /></Button>
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

              {ctx.activeTab !== "dashboard" && (
                <div className="flex-1 overflow-y-auto pr-1">
                  {ctx.activeTab === "drivers" && <DriversSlice onRefreshAlerts={ctx.triggerRefresh} searchQuery={ctx.globalSearch} onOpenActionSheet={ctx.openActionSheet} autoOpen={ctx.autoOpenDriver} onAutoOpenConsumed={() => ctx.setAutoOpenDriver(false)} weeklyRentals={ctx.weeklyRentals} onAssignDriver={(driverId) => { ctx.setAssignmentPreselect(driverId, null); ctx.setAssignmentDialogOpen(true); }} />}
                  {ctx.activeTab === "vehicles" && <VehiclesSlice onRefreshAlerts={ctx.triggerRefresh} searchQuery={ctx.globalSearch} onOpenActionSheet={ctx.openActionSheet} autoOpen={ctx.autoOpenVehicle} onAutoOpenConsumed={() => ctx.setAutoOpenVehicle(false)} onAssignVehicle={(vehicleId) => { ctx.setAssignmentPreselect(null, vehicleId); ctx.setAssignmentDialogOpen(true); }} externalWearPartVehicle={ctx.wearPartVehicle} refreshTrigger={ctx.refreshTrigger} />}
                  {ctx.activeTab === "users" && <UsersSlice />}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Right panel */}
        {ctx.isLargeScreen && (ctx.isBuzonOpen || ctx.actionSheet?.open) && (
          <aside className="hidden lg:flex lg:w-[400px] xl:w-[440px] shrink-0 border-l border-border bg-card/30 h-full flex-col overflow-hidden">
            <AnimatePresence mode="wait">
              {ctx.isBuzonOpen ? (
                <motion.div key="buzon-inline" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3, ease: "easeOut" }} className="h-full w-full flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-5 border-b border-border/40 shrink-0">
                    <div>
                      <h2 className="text-xl font-bold text-foreground flex items-center gap-2"><Bell className="w-5 h-5 text-primary shrink-0" /> Buzón de Alertas</h2>
                      <p className="text-xs text-muted-foreground mt-0.5 font-semibold">{ctx.alerts.length} {ctx.alerts.length === 1 ? "pendiente" : "pendientes"} por resolver</p>
                    </div>
                    <button onClick={() => ctx.setIsBuzonOpen(false)} className="p-3 rounded-full text-foreground hover:bg-secondary transition-all cursor-pointer border-none" style={{ minWidth: "48px", minHeight: "48px" }} aria-label="Cerrar buzón"><X className="w-5 h-5" /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 overscroll-contain">
                    {ctx.alerts.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-3">
                        <div className="w-12 h-12 rounded-full bg-success/15 flex items-center justify-center text-success shrink-0"><CheckCircle className="w-6 h-6" /></div>
                        <h3 className="text-base font-bold text-foreground">¡Todo en orden!</h3>
                        <p className="text-xs text-muted-foreground max-w-[240px]">No tienes alertas ni vencimientos administrativos por resolver en este momento.</p>
                      </div>
                    ) : (
                      ctx.alerts.map((alert) => {
                        const isCritical = alert.severity === "critical";
                        return (
                          <div key={alert.id} className={`p-4 rounded-2xl bg-secondary/30 border border-border/60 hover:border-border transition-all flex gap-3.5 ${isCritical ? "border-l-4 border-l-red-500" : "border-l-4 border-l-amber-500"}`}>
                            <div className={`p-2 rounded-xl shrink-0 h-fit ${isCritical ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"}`}>
                              {isCritical ? <ShieldAlert className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                            </div>
                            <div className="flex-1 min-w-0 space-y-2">
                              <div className="flex items-start justify-between gap-2 flex-wrap">
                                <h4 className="text-sm font-extrabold text-foreground leading-snug">{alert.title}</h4>
                                <span className={`text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-sm shrink-0 ${isCritical ? "bg-red-500/15 text-red-600" : "bg-amber-500/15 text-amber-600"}`}>{isCritical ? "Crítica" : "Media"}</span>
                              </div>
                              <p className="text-xs text-muted-foreground leading-relaxed font-semibold">{alert.description}</p>
                              <div className="pt-1">
                                <button onClick={() => ctx.handleDismissAlert(alert.id, alert.title)} className="px-4 py-2 bg-card hover:bg-secondary text-foreground text-xs font-bold rounded-xl border border-border/80 transition-all cursor-pointer focus-visible:ring-4 focus-visible:ring-primary focus-visible:outline-hidden">Marcar como Resuelto</button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              ) : ctx.actionSheet?.open ? (
                <motion.div key="actions-inline" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3, ease: "easeOut" }} className="h-full w-full flex flex-col overflow-hidden">
                  <EntityActionSheet isOpen={true} isInline={true} driver={ctx.actionSheet.driver} vehicle={ctx.actionSheet.vehicle}
                    entity={ctx.activeEntity} type={ctx.actionSheet.type} isAssigned={ctx.isEntityAssigned}
                    onActionComplete={ctx.handleActionComplete} onRequestChecklist={ctx.openChecklistSheet}
                    onVehicleAssigned={ctx.handleVehicleAssignedFromSheet} onClose={() => ctx.setActionSheet(null)} />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </aside>
        )}
      </div>

      {/* Mobile overlays */}
      {!ctx.isLargeScreen && (
        <>
          <AnimatePresence>
            {ctx.actionSheet?.open && (
              <EntityActionSheet isOpen={true} driver={ctx.actionSheet.driver} vehicle={ctx.actionSheet.vehicle}
                entity={ctx.activeEntity} type={ctx.actionSheet.type} isAssigned={ctx.isEntityAssigned}
                onActionComplete={ctx.handleActionComplete} onRequestChecklist={ctx.openChecklistSheet}
                onVehicleAssigned={ctx.handleVehicleAssignedFromSheet} onClose={() => ctx.setActionSheet(null)} />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {ctx.isBuzonOpen && (
              <>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4, ease: "easeOut" }}
                  className="fixed inset-0 bg-black/75 z-40 backdrop-blur-md" onClick={() => ctx.setIsBuzonOpen(false)} />
                <motion.div role="dialog" aria-modal="true" aria-labelledby="buzon-title-mobile"
                  initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="fixed bottom-0 top-0 right-0 z-50 bg-card border-l border-border w-full sm:w-[440px] h-screen shadow-2xl flex flex-col overflow-hidden"
                  style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
                  <div className="flex items-center justify-between px-6 py-5 border-b border-border/40 shrink-0">
                    <div>
                      <h2 id="buzon-title-mobile" className="text-xl font-bold text-foreground flex items-center gap-2"><Bell className="w-5 h-5 text-primary shrink-0" /> Buzón de Alertas</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">{ctx.alerts.length} {ctx.alerts.length === 1 ? "pendiente" : "pendientes"} por resolver</p>
                    </div>
                    <button onClick={() => ctx.setIsBuzonOpen(false)} className="p-3 rounded-full text-foreground hover:bg-secondary transition-all cursor-pointer border-none" style={{ minWidth: "48px", minHeight: "48px" }} aria-label="Cerrar buzón"><X className="w-5 h-5" /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 overscroll-contain">
                    {ctx.alerts.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-3">
                        <div className="w-12 h-12 rounded-full bg-success/15 flex items-center justify-center text-success shrink-0"><CheckCircle className="w-6 h-6" /></div>
                        <h3 className="text-base font-bold text-foreground">¡Todo en orden!</h3>
                        <p className="text-xs text-muted-foreground max-w-[260px]">No tienes alertas ni vencimientos administrativos por resolver en este momento.</p>
                      </div>
                    ) : (
                      ctx.alerts.map((alert) => {
                        const isCritical = alert.severity === "critical";
                        return (
                          <div key={alert.id} className={`p-4 rounded-2xl bg-secondary/30 border border-border/60 hover:border-border transition-all flex gap-3.5 ${isCritical ? "border-l-4 border-l-red-500" : "border-l-4 border-l-amber-500"}`}>
                            <div className={`p-2 rounded-xl shrink-0 h-fit ${isCritical ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"}`}>
                              {isCritical ? <ShieldAlert className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                            </div>
                            <div className="flex-1 min-w-0 space-y-2">
                              <div className="flex items-start justify-between gap-2 flex-wrap">
                                <h4 className="text-sm font-extrabold text-foreground leading-snug">{alert.title}</h4>
                                <span className={`text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-sm shrink-0 ${isCritical ? "bg-red-500/15 text-red-600" : "bg-amber-500/15 text-amber-600"}`}>{isCritical ? "Crítica" : "Media"}</span>
                              </div>
                              <p className="text-xs text-muted-foreground leading-relaxed font-semibold">{alert.description}</p>
                              <div className="pt-1">
                                <button onClick={() => ctx.handleDismissAlert(alert.id, alert.title)} className="px-4 py-2 bg-card hover:bg-secondary text-foreground text-xs font-bold rounded-xl border border-border/80 transition-all cursor-pointer focus-visible:ring-4 focus-visible:ring-primary focus-visible:outline-hidden">Marcar como Resuelto</button>
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
      <Dialog key="stats-dialog" open={!!ctx.statsDialog} onOpenChange={(o) => { if (!o) ctx.setStatsDialog(null); }}>
        <DialogContent className="max-w-sm md:max-w-md border border-border bg-background text-foreground rounded-2xl">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 shrink-0"><BarChart3 className="w-5 h-5 text-primary" /></div>
              <div className="min-w-0">
                <DialogTitle className="text-foreground font-black text-lg">Estadísticas de Uso</DialogTitle>
                <DialogDescription className="text-muted-foreground text-xs">{ctx.statsDialog?.driver ? `${ctx.statsDialog.driver.first_name} ${ctx.statsDialog.driver.paternal_last_name}` : ""}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {ctx.statsDialog?.usage.monthlyAverage != null ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-muted/40 border border-border text-center">
                  <span className="block text-[11px] uppercase font-bold text-muted-foreground">Promedio Semanal</span>
                  <p className="text-lg font-black text-foreground font-mono mt-1">{Math.round(ctx.statsDialog.usage.monthlyAverage * 7).toLocaleString()} km</p>
                </div>
                <div className="p-3 rounded-xl bg-muted/40 border border-border text-center">
                  <span className="block text-[11px] uppercase font-bold text-muted-foreground">Promedio Mensual</span>
                  <p className="text-lg font-black text-foreground font-mono mt-1">{Math.round(ctx.statsDialog.usage.monthlyAverage * 30).toLocaleString()} km</p>
                </div>
              </div>
            ) : (
              <p className="text-center py-4 text-muted-foreground text-xs">No hay suficientes datos de kilometraje para calcular promedios.</p>
            )}
            {ctx.statsDialog && ctx.statsDialog.usage.weeks.length > 0 && (
              <div>
                <span className="block text-[11px] uppercase font-bold text-muted-foreground mb-2">Historial Semanal</span>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {[...ctx.statsDialog.usage.weeks].reverse().map((w, i) => (
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
      <AssignmentDialog open={ctx.assignmentDialogOpen} onClose={() => { ctx.setAssignmentDialogOpen(false); ctx.setAssignmentPreselect(null, null); }}
        onComplete={ctx.triggerRefresh} onAssign={(vehicleId) => { const v = ctx.vehicles.find((vv) => vv.id === vehicleId); if (v) ctx.openChecklistSheet(v); }}
        drivers={ctx.drivers} vehicles={ctx.vehicles} preselectDriver={ctx.assignmentPreselectDriver} preselectVehicle={ctx.assignmentPreselectVehicle} />

      {/* Action Modal */}
      <AnimatePresence>
        {ctx.actionModal.open && (
          <ChecklistActionModal key="action-modal" open={true} vehicle={ctx.actionModal.vehicle}
            onClose={() => ctx.setActionModal({ open: false, vehicle: null })}
            onChecklist={ctx.openChecklistSheet} onServiceOut={ctx.handleServiceOut} onServiceReturn={ctx.handleServiceReturn}
            onWearPart={ctx.handleWearPart} onInventory={ctx.handleInventory} />
        )}
      </AnimatePresence>

      {/* Checklist Sheet */}
      <AnimatePresence>
        {ctx.checklistSheet.open && (
          <ChecklistSheet key="checklist-sheet" isOpen={true} vehicle={ctx.checklistSheet.vehicle}
            onClose={() => ctx.setChecklistSheet({ open: false, vehicle: null })} onComplete={ctx.handleActionComplete} />
        )}
      </AnimatePresence>

      {/* Wear Part Dialog */}
      <WearPartDialog open={ctx.wearPartDialogOpen} onClose={() => { ctx.setWearPartDialogOpen(false); ctx.setWearPartVehicle(null); }}
        vehicle={ctx.wearPartVehicle} onComplete={ctx.triggerRefresh} />

      {/* Inventory Wizard */}
      <AnimatePresence>
        {ctx.inventoryOpen && (
          <InventoryWizard key="inventory-wizard" open={true}
            onClose={() => { ctx.setInventoryOpen(false); ctx.setInventoryVehicle(null); ctx.setInventoryExisting(null); }}
            onSave={ctx.handleSaveInventory} initialPhotos={ctx.inventoryExisting?.photos.map((p) => ({ angle: p.angle, dataUrl: p.url }))} initialItems={ctx.inventoryExisting?.items} />
        )}
      </AnimatePresence>

      {/* Mobile Bottom Nav */}
      <nav className="relative md:hidden border-t border-border bg-card/95 backdrop-blur-md flex items-center justify-around w-full px-2 pb-[env(safe-area-inset-bottom,0px)] h-[calc(56px+env(safe-area-inset-bottom,0px))] shrink-0 z-40">
        {mobileNavItems.map((tab) => {
          const Icon = tab.icon;
          const isSelected = ctx.activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => ctx.handleTabChange(tab.id as TabId)}
              className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-xs transition-all active:scale-95 cursor-pointer relative ${isSelected ? "text-primary font-bold" : "text-muted-foreground"}`}>
              <Icon className={`w-5 h-5 mb-0.5 transition-transform ${isSelected ? "scale-105" : ""}`} />
              <span>{tab.label}</span>
              {isSelected && <motion.div layoutId="activeBottomIndicator" className="absolute top-0 w-8 h-[2.5px] bg-primary rounded-full" transition={{ type: "spring", stiffness: 380, damping: 30 }} />}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
