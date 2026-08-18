"use client";

import React from "react";
import { Driver, Vehicle, WeeklyRental } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { User, AlertTriangle, Search, CheckCircle2, Car, Pencil, RefreshCcw, DollarSign, XCircle, Calendar, Plus, Minus, ArrowLeftRight, Download, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import Image from "next/image";
import SliceHeader from "@/components/SliceHeader";
import DriverFormDialog from "@/components/DriverFormDialog";
import LicenseRenewalDialogs from "@/components/LicenseRenewalDialogs";
import { DriversListSkeleton } from "@/components/ui/skeletons";
import { resolveDocUrl } from "@/lib/db/storage";
import { useDrivers } from "@/features/drivers/hooks/useDrivers";
import { MobileCard, MobileActionButton } from "@/components/ui/MobileCard";

interface DriversSliceProps {
  onRefreshAlerts: () => void;
  searchQuery?: string;
  onOpenActionSheet: (entity: Driver | Vehicle, type: "driver" | "vehicle") => void;
  autoOpen?: boolean;
  onAutoOpenConsumed?: () => void;
  weeklyRentals?: WeeklyRental[];
  onAssignDriver?: (driverId: string) => void;
}

export default function DriversSlice(props: DriversSliceProps) {
  const drivers = useDrivers(props);
  const {
  search,
  setSearch,
  setShowArchived,
  showArchived,
  isLoading,
  filteredDrivers,
  vehicles,
  toggleDriverDetails,
  onAssignDriver,
  handleRenewLicense,
  exportDriverPdf,
  handleEditDriver,
  handleDeleteDriver,
  expandedDriverDetails,
  weeklyRentals,
  setPaymentDialog,
  setCondonationDialog,
  condonationDialog,
  handleCondonation,
  paymentDialog,
  handlePayment,
  setPreviewImage,
} = drivers;

  return (
    <div className="space-y-4">
      {/* Header Row */}
      <SliceHeader
        title="Conductores"
        action={
          <DriverFormDialog {...drivers} />
        }
      />

      {/* Search Bar */}
      <div className="bg-[#ECECEC] rounded-full h-11 px-4 flex items-center gap-2 w-full shadow-inner mb-4 mt-2">
        <Search className="w-4 h-4 text-muted-foreground/60 shrink-0" />
        <input type="text" placeholder="Search" value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent border-none text-foreground text-sm placeholder:text-muted-foreground/60 focus:outline-hidden py-3 sm:py-0" />
        <button type="button" onClick={() => setShowArchived(!showArchived)}
          className={`text-[11px] font-bold px-2.5 py-3.5 sm:py-1 rounded-lg transition-all cursor-pointer shrink-0 ${showArchived ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
          {showArchived ? "Activos" : "Archivo"}
        </button>
      </div>

      {/* Table (≥768px) */}
      <div className="hidden md:block w-full overflow-x-auto pb-6">
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
                  <tr><td colSpan={7} className="text-center py-10 text-muted-foreground italic">No se encontraron conductores.</td></tr>
                ) : (
                  filteredDrivers.map((driver) => {
                    const assignedVehicle = vehicles.find((v) => v.active_driver_id === driver.id);
                    return (
                      <React.Fragment key={driver.id}>
                        <tr role="button" tabIndex={0} onClick={() => toggleDriverDetails(driver.id)}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleDriverDetails(driver.id); } }}
                          className={`border-b border-border/20 hover:bg-muted/30 transition-colors cursor-pointer ${filteredDrivers.indexOf(driver) % 2 === 0 ? "bg-card" : "bg-muted/5"}`}>
                          <td className="py-2.5 px-2">
                            <div className="relative w-8 h-8 rounded-full overflow-hidden bg-[#D8D8D8] flex items-center justify-center shrink-0 cursor-pointer"
                              onClick={(e) => { e.stopPropagation(); if (driver.driver_photo_img) setPreviewImage(resolveDocUrl(driver.driver_photo_img)); }}>
                              {driver.driver_photo_img ? <Image src={resolveDocUrl(driver.driver_photo_img)} alt="Foto" fill className="object-cover" /> : <User className="w-4 h-4 text-muted-foreground/60" />}
                            </div>
                          </td>
                          <td className="py-2.5 px-2"><span className="font-bold text-foreground">{`${driver.first_name} ${driver.paternal_last_name}`}</span></td>
                          <td className="py-2.5 px-2 font-mono text-muted-foreground">{driver.curp}</td>
                          <td className="py-2.5 px-2 font-mono text-muted-foreground">{driver.license_number || "—"}</td>
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
                              <span className="flex items-center gap-1 text-muted-foreground"><Car className="w-3.5 h-3.5 shrink-0" />{assignedVehicle.plate_number}</span>
                            ) : (
                              <span className="text-amber-500 font-semibold">Sin auto</span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-right">
                            <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.stopPropagation(); }} role="button" tabIndex={-1}>
                              {!assignedVehicle && onAssignDriver && (
                                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onAssignDriver!(driver.id); }}
                                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs gap-1 h-9 px-2.5" title="Asignar auto">
                                  <ArrowLeftRight className="w-3 h-3" /><span className="sr-only">Asignar auto</span>
                                </Button>
                              )}
                              {!driver.license_is_permanent && (
                                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleRenewLicense(driver); }}
                                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs gap-1 h-9 px-2.5" title="Renovar licencia">
                                  <RefreshCcw className="w-3 h-3" /><span className="sr-only">Renovar licencia</span>
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); exportDriverPdf(driver); }}
                                className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 text-xs gap-1 h-9 px-2.5" title="Exportar datos del chofer">
                                <Download className="w-3 h-3" /><span className="sr-only">Exportar</span>
                              </Button>
                              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleEditDriver(driver); }}
                                className="text-muted-foreground hover:text-primary text-xs gap-1 h-9 px-2.5">
                                <Pencil className="w-3 h-3" /><span className="sr-only">Editar</span>
                              </Button>
                              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDeleteDriver(driver.id); }}
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs gap-1 h-9 px-2.5">
                                <Trash2 className="w-3 h-3" /><span className="sr-only">Eliminar</span>
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {expandedDriverDetails[driver.id] && (
                          <motion.tr initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="border-b border-border/20 bg-muted/10 overflow-hidden">
                            <td colSpan={7} className="p-3">
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-xs">
                                <div><span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Clave Elector</span><span className="block text-foreground font-medium">{driver.ine_elector_key || "N/D"}</span></div>
                                <div><span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Domicilio INE</span><span className="block text-foreground leading-snug">{driver.ine_address || "N/D"}</span></div>
                                <div><span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Licencia Vence</span><span className="block text-foreground">{driver.license_expiration_date || (driver.license_is_permanent ? "Permanente" : "—")}</span></div>
                                {driver.driver_photo_img && (
                                  <div><span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Foto Chofer</span>
                                    <div className="relative h-12 w-20 rounded-lg overflow-hidden border border-border/70 mt-0.5 cursor-pointer" onClick={(e) => { e.stopPropagation(); setPreviewImage(resolveDocUrl(driver.driver_photo_img)); }}>
                                      <Image src={resolveDocUrl(driver.driver_photo_img)} alt="Foto Chofer" fill className="object-cover hover:scale-105 transition-transform" />
                                    </div>
                                  </div>
                                )}
                                {driver.ine_img && (
                                  <div><span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">INE</span>
                                    <div className="relative h-12 w-20 rounded-lg overflow-hidden border border-border/70 mt-0.5 cursor-pointer" onClick={(e) => { e.stopPropagation(); setPreviewImage(resolveDocUrl(driver.ine_img)); }}>
                                      <Image src={resolveDocUrl(driver.ine_img)} alt="INE" fill className="object-cover hover:scale-105 transition-transform" />
                                    </div>
                                  </div>
                                )}
                                {driver.license_img && (
                                  <div><span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Licencia</span>
                                    <div className="relative h-12 w-20 rounded-lg overflow-hidden border border-border/70 mt-0.5 cursor-pointer" onClick={(e) => { e.stopPropagation(); setPreviewImage(resolveDocUrl(driver.license_img)); }}>
                                      <Image src={resolveDocUrl(driver.license_img)} alt="Licencia" fill className="object-cover hover:scale-105 transition-transform" />
                                    </div>
                                  </div>
                                )}
                                {driver.address_proof_img && (
                                  <div><span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Comprobante Domicilio</span>
                                    <div className="relative h-12 w-20 rounded-lg overflow-hidden border border-border/70 mt-0.5 cursor-pointer" onClick={(e) => { e.stopPropagation(); setPreviewImage(resolveDocUrl(driver.address_proof_img)); }}>
                                      <Image src={resolveDocUrl(driver.address_proof_img)} alt="Comprobante" fill className="object-cover hover:scale-105 transition-transform" />
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Payment History */}
                              {(() => {
                                const driverRentals = weeklyRentals
                                  .filter((r) => r.driver_id === driver.id)
                                  .sort((a, b) => b.week_start.localeCompare(a.week_start));
                                if (driverRentals.length === 0) return null;
                                const totalDebt = driverRentals.reduce((sum, r) => sum + Math.max(0, r.rent_amount - r.paid_amount - (r.condoned_amount || 0)), 0);
                                const totalPaid = driverRentals.reduce((sum, r) => sum + r.paid_amount, 0);
                                const totalCondoned = driverRentals.reduce((sum, r) => sum + (r.condoned_amount || 0), 0);
                                return (
                                  <div className="mt-4">
                                    <div className="flex items-center gap-2 mb-3"><DollarSign className="w-3.5 h-3.5 text-muted-foreground" /><span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Historial de Pagos</span></div>
                                    <div className="grid grid-cols-3 gap-2 mb-3">
                                      <div className="bg-muted/20 rounded-xl border border-border/60 p-3"><span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 block">Deuda Total</span><span className="text-sm font-bold text-red-400">${totalDebt.toLocaleString()}</span></div>
                                      <div className="bg-muted/20 rounded-xl border border-border/60 p-3"><span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 block">Total Pagado</span><span className="text-sm font-bold text-green-400">${totalPaid.toLocaleString()}</span></div>
                                      <div className="bg-muted/20 rounded-xl border border-border/60 p-3"><span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 block">Total Condonado</span><span className="text-sm font-bold text-amber-400">${totalCondoned.toLocaleString()}</span></div>
                                    </div>
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-[10px]">
                                        <thead><tr className="border-b border-border/20 text-muted-foreground/60">
                                          <th className="text-left py-1.5 pr-2 font-medium">Semana</th>
                                          <th className="text-right pr-2 font-medium">Renta</th>
                                          <th className="text-right pr-2 font-medium">Cond.</th>
                                          <th className="text-right pr-2 font-medium">Pagado</th>
                                          <th className="text-right pr-2 font-medium">Deuda</th>
                                          <th className="text-center px-2 font-medium">Status</th>
                                          <th className="text-right font-medium"></th>
                                        </tr></thead>
                                        <tbody>
                                          {driverRentals.map((r) => {
                                            const debt = Math.max(0, r.rent_amount - r.paid_amount - (r.condoned_amount || 0));
                                            return (
                                              <tr key={r.id} className="border-b border-border/10 hover:bg-muted/10">
                                                <td className="py-1.5 pr-2 text-foreground whitespace-nowrap"><span className="flex items-center gap-1"><Calendar className="w-2.5 h-2.5 text-muted-foreground" />{new Date(r.week_start + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" })}</span></td>
                                                <td className="py-1.5 pr-2 text-right text-foreground">${r.rent_amount.toLocaleString()}</td>
                                                <td className="py-1.5 pr-2 text-right">{(r.condoned_days || 0) > 0 ? <span className="text-amber-400 font-medium">{r.condoned_days}d · ${(r.condoned_amount || 0).toLocaleString()}</span> : <span className="text-muted-foreground/40">—</span>}</td>
                                                <td className="py-1.5 pr-2 text-right text-foreground">${r.paid_amount.toLocaleString()}</td>
                                                <td className="py-1.5 pr-2 text-right">{debt > 0 ? <span className="text-red-400 font-medium">${debt.toLocaleString()}</span> : <span className="text-green-400">$0</span>}</td>
                                                <td className="py-1.5 px-2 text-center">
                                                  {r.status === "PAID" ? <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 font-medium"><CheckCircle2 className="w-2.5 h-2.5" />PAID</span>
                                                  : r.status === "PARTIAL" ? <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium"><AlertTriangle className="w-2.5 h-2.5" />PARTIAL</span>
                                                  : <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 font-medium"><XCircle className="w-2.5 h-2.5" />UNPAID</span>}
                                                </td>
                                                <td className="py-1.5 text-right">
                                                  <div className="flex items-center justify-end gap-1">
                                                    <button onClick={(e) => { e.stopPropagation(); setPaymentDialog({ rentalId: r.id, weekStart: r.week_start, amount: 0 }); }}
                                                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors text-[10px] font-medium">
                                                      <DollarSign className="w-2.5 h-2.5" />Pagar
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); setCondonationDialog({ rentalId: r.id, weekStart: r.week_start, days: 0 }); }}
                                                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors text-[10px] font-medium">
                                                      <Plus className="w-2.5 h-2.5" />Cond.
                                                    </button>
                                                  </div>
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>

                                    {/* Condonation Dialog */}
                                    {condonationDialog && (
                                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setCondonationDialog(null)}>
                                        <div className="bg-background border border-border rounded-xl p-4 w-64 shadow-xl" onClick={(e) => e.stopPropagation()}>
                                          <div className="flex items-center gap-2 mb-3"><Minus className="w-4 h-4 text-amber-400" /><span className="text-xs font-semibold text-foreground">Condonar Días</span></div>
                                          <p className="text-[10px] text-muted-foreground mb-3">Semana del {new Date(condonationDialog.weekStart + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}</p>
                                          <div className="flex items-center gap-2 mb-3">
                                            <button onClick={() => setCondonationDialog((prev) => prev ? { ...prev, days: Math.max(0, prev.days - 1) } : prev)} className="w-7 h-7 rounded-md bg-muted/30 border border-border flex items-center justify-center text-foreground hover:bg-muted/50">−</button>
                                            <input type="number" min={0} max={7} value={condonationDialog.days} onChange={(e) => setCondonationDialog((prev) => prev ? { ...prev, days: Math.max(0, Math.min(7, parseInt(e.target.value) || 0)) } : prev)} className="w-14 text-center text-xs bg-muted/20 border border-border rounded-md py-1 text-foreground" />
                                            <button onClick={() => setCondonationDialog((prev) => prev ? { ...prev, days: Math.min(7, prev.days + 1) } : prev)} className="w-7 h-7 rounded-md bg-muted/30 border border-border flex items-center justify-center text-foreground hover:bg-muted/50">+</button>
                                            <span className="text-[10px] text-muted-foreground">días</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <button onClick={() => setCondonationDialog(null)} className="flex-1 text-[10px] py-1.5 rounded-md border border-border text-muted-foreground hover:bg-muted/20">Cancelar</button>
                                            <button onClick={() => { const rental = driverRentals.find((r) => r.id === condonationDialog!.rentalId); if (rental && condonationDialog!.days > 0) handleCondonation(rental, condonationDialog!.days); }}
                                              disabled={condonationDialog.days <= 0} className="flex-1 text-[10px] py-1.5 rounded-md bg-amber-500 text-white font-medium hover:bg-amber-600 disabled:opacity-50">Aplicar</button>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {/* Payment Dialog */}
                                    {paymentDialog && (
                                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setPaymentDialog(null)}>
                                        <div className="bg-background border border-border rounded-xl p-4 w-64 shadow-xl" onClick={(e) => e.stopPropagation()}>
                                          <div className="flex items-center gap-2 mb-3"><DollarSign className="w-4 h-4 text-green-400" /><span className="text-xs font-semibold text-foreground">Registrar Pago</span></div>
                                          <p className="text-[10px] text-muted-foreground mb-3">Semana del {new Date(paymentDialog.weekStart + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}</p>
                                          <div className="flex items-center gap-2 mb-3">
                                            <span className="text-xs text-muted-foreground">$</span>
                                            <input type="number" min={0} value={paymentDialog.amount || ""} onChange={(e) => setPaymentDialog((prev) => prev ? { ...prev, amount: Math.max(0, parseInt(e.target.value) || 0) } : prev)}
                                              className="flex-1 text-xs bg-muted/20 border border-border rounded-md py-1.5 px-2 text-foreground text-center" placeholder="0" />
                                          </div>
                                          <div className="flex gap-2">
                                            <button onClick={() => setPaymentDialog(null)} className="flex-1 text-[10px] py-1.5 rounded-md border border-border text-muted-foreground hover:bg-muted/20">Cancelar</button>
                                            <button onClick={() => { const rental = driverRentals.find((r) => r.id === paymentDialog!.rentalId); if (rental && paymentDialog!.amount > 0) handlePayment(rental, paymentDialog!.amount); }}
                                              disabled={paymentDialog.amount <= 0} className="flex-1 text-[10px] py-1.5 rounded-md bg-green-500 text-white font-medium hover:bg-green-600 disabled:opacity-50">Pagar</button>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>
                          </motion.tr>
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

      {/* Card list móvil (<768px) — misma data que la tabla */}
      <div className="md:hidden space-y-3 pb-2">
        {isLoading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-border/60 bg-card p-3.5 space-y-2.5 animate-pulse">
              <div className="h-4 w-2/3 bg-muted rounded-full" />
              <div className="h-3 w-1/2 bg-muted rounded-full" />
              <div className="h-9 w-full bg-muted rounded-xl" />
            </div>
          ))
        ) : filteredDrivers.length === 0 ? (
          <p className="text-center py-10 text-muted-foreground italic text-sm">No se encontraron conductores.</p>
        ) : (
          filteredDrivers.map((driver) => {
            const assignedVehicle = vehicles.find((v) => v.active_driver_id === driver.id);
            const licenseExpired = !driver.license_is_permanent && !!driver.license_expiration_date && new Date(driver.license_expiration_date) < new Date();
            return (
              <MobileCard
                key={driver.id}
                onClick={() => toggleDriverDetails(driver.id)}
                statusClass={licenseExpired ? "border-l-4 border-l-red-500" : !assignedVehicle ? "border-l-4 border-l-amber-500" : "border-l-4 border-l-transparent"}
                header={
                  <>
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div
                        className="relative w-10 h-10 rounded-full overflow-hidden bg-[#D8D8D8] flex items-center justify-center shrink-0 cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); if (driver.driver_photo_img) setPreviewImage(resolveDocUrl(driver.driver_photo_img)); }}
                      >
                        {driver.driver_photo_img ? <Image src={resolveDocUrl(driver.driver_photo_img)} alt="Foto" fill className="object-cover" /> : <User className="w-5 h-5 text-muted-foreground/60" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block text-base font-extrabold text-foreground leading-tight truncate">{driver.first_name} {driver.paternal_last_name}</span>
                        <span className="block text-[11px] text-muted-foreground font-semibold mt-0.5 truncate">
                          {assignedVehicle ? <span className="inline-flex items-center gap-1"><Car className="w-3 h-3" />{assignedVehicle.plate_number}</span> : "Sin auto asignado"}
                        </span>
                      </div>
                    </div>
                    <span className={`shrink-0 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${driver.license_is_permanent ? "bg-primary/10 text-primary" : licenseExpired ? "bg-red-500/10 text-red-500" : "bg-green-500/10 text-green-600"}`}>
                      {driver.license_is_permanent ? "Permanente" : licenseExpired ? "Vencida" : "Vigente"}
                    </span>
                  </>
                }
                rows={[
                  { label: "CURP", value: <span className="font-mono">{driver.curp}</span> },
                  { label: "Licencia", value: <span className="font-mono">{driver.license_number || "—"}</span> },
                  { label: "Vence", value: driver.license_is_permanent ? "Permanente" : <span className={licenseExpired ? "text-red-400 font-bold" : ""}>{driver.license_expiration_date || "—"}</span> },
                ]}
                actions={
                  <div className="grid grid-cols-2 gap-2">
                    {!assignedVehicle && onAssignDriver && (
                      <MobileActionButton variant="danger" onClick={(e) => { e.stopPropagation(); onAssignDriver!(driver.id); }}>
                        <ArrowLeftRight className="w-4 h-4" /> Asignar
                      </MobileActionButton>
                    )}
                    {!driver.license_is_permanent && (
                      <MobileActionButton variant="danger" onClick={(e) => { e.stopPropagation(); handleRenewLicense(driver); }}>
                        <RefreshCcw className="w-4 h-4" /> Renovar
                      </MobileActionButton>
                    )}
                    <MobileActionButton onClick={(e) => { e.stopPropagation(); exportDriverPdf(driver); }}>
                      <Download className="w-4 h-4" /> Exportar
                    </MobileActionButton>
                    <MobileActionButton onClick={(e) => { e.stopPropagation(); handleEditDriver(driver); }}>
                      <Pencil className="w-4 h-4" /> Editar
                    </MobileActionButton>
                    <MobileActionButton variant="danger" onClick={(e) => { e.stopPropagation(); handleDeleteDriver(driver.id); }}>
                      <Trash2 className="w-4 h-4" /> Eliminar
                    </MobileActionButton>
                  </div>
                }
              >
                {expandedDriverDetails[driver.id] && (
                  <div className="pt-2 border-t border-border/40 space-y-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Clave Elector</span>
                      <span className="text-xs font-semibold font-mono">{driver.ine_elector_key || "N/D"}</span>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Domicilio INE</span>
                      <span className="text-xs font-semibold text-right">{driver.ine_address || "N/D"}</span>
                    </div>
                  </div>
                )}
              </MobileCard>
            );
          })
        )}
      </div>

      {/* Renovación de licencia y previsualización de documentos */}
      <LicenseRenewalDialogs {...drivers} />
    </div>
  );
}
