"use client";

import React from "react";
import { Driver, Vehicle, WeeklyRental } from "@/lib/db";
import { getDriverName } from "@/lib/lookups";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { User, Pencil, Trash2, X, RefreshCcw, Download, ArrowLeftRight, Car, DollarSign, Calendar, CheckCircle2, AlertTriangle, XCircle, Plus, Minus } from "lucide-react";
import Image from "next/image";
import { resolveDocUrl } from "@/lib/db/storage";

interface DriverDetailDialogProps {
  driver: Driver | null;
  open: boolean;
  onClose: () => void;
  onEdit: (driver: Driver) => void;
  onDelete: (driverId: string) => void;
  onRenewLicense: (driver: Driver) => void;
  onExportPdf: (driver: Driver) => void;
  onAssignDriver?: (driverId: string) => void;
  vehicles: Vehicle[];
  weeklyRentals: WeeklyRental[];
  setPreviewImage: (url: string | null) => void;
  setPaymentDialog: (dialog: { rentalId: string; weekStart: string; amount: number } | null) => void;
  setCondonationDialog: (dialog: { rentalId: string; weekStart: string; days: number } | null) => void;
}

export default function DriverDetailDialog({
  driver,
  open,
  onClose,
  onEdit,
  onDelete,
  onRenewLicense,
  onExportPdf,
  onAssignDriver,
  vehicles,
  weeklyRentals,
  setPreviewImage,
  setPaymentDialog,
  setCondonationDialog,
}: DriverDetailDialogProps) {
  if (!driver) return null;

  const assignedVehicle = vehicles.find((v) => v.active_driver_id === driver.id);
  const licenseExpired = !driver.license_is_permanent && !!driver.license_expiration_date && new Date(driver.license_expiration_date) < new Date();

  const driverRentals = weeklyRentals
    .filter((r) => r.driver_id === driver.id)
    .sort((a, b) => b.week_start.localeCompare(a.week_start));

  const totalDebt = driverRentals.reduce((sum, r) => sum + Math.max(0, r.rent_amount - r.paid_amount - (r.condoned_amount || 0)), 0);
  const totalPaid = driverRentals.reduce((sum, r) => sum + r.paid_amount, 0);
  const totalCondoned = driverRentals.reduce((sum, r) => sum + (r.condoned_amount || 0), 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto border border-border bg-background text-foreground rounded-2xl p-0">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background border-b border-border/40 px-4 pt-4 pb-3">
          <div className="flex items-start gap-3">
            <div className="relative w-11 h-11 rounded-full overflow-hidden bg-[#D8D8D8] flex items-center justify-center shrink-0">
              {driver.driver_photo_img ? (
                <Image src={resolveDocUrl(driver.driver_photo_img)} alt="Foto" fill className="object-cover" />
              ) : (
                <User className="w-5 h-5 text-muted-foreground/60" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-foreground font-black text-base leading-tight truncate">
                {driver.first_name} {driver.paternal_last_name}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-[10px] mt-0.5 font-mono truncate block">
                {driver.curp}
              </DialogDescription>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${driver.license_is_permanent ? "bg-primary/10 text-primary" : licenseExpired ? "bg-red-500/10 text-red-500" : "bg-green-500/10 text-green-600"}`}>
                  {driver.license_is_permanent ? "Permanente" : licenseExpired ? "Vencida" : "Vigente"}
                </span>
                {assignedVehicle && (
                  <span className="flex items-center gap-0.5 text-[10px] text-primary font-semibold">
                    <Car className="w-2.5 h-2.5" /> {assignedVehicle.plate_number}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <Button variant="ghost" size="sm" onClick={() => onEdit(driver)} className="h-8 w-8 p-0">
                <Pencil className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onDelete(driver.id)} className="h-8 w-8 p-0 text-red-500 hover:text-red-600">
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 py-3 space-y-4">
          {/* Datos Personales */}
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground/80 mb-3">Datos Personales</h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
              <div>
                <span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Nombre Completo</span>
                <span className="block text-foreground font-medium">{driver.first_name} {driver.paternal_last_name} {driver.maternal_last_name || ""}</span>
              </div>
              <div>
                <span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">CURP</span>
                <span className="block text-foreground font-medium font-mono">{driver.curp}</span>
              </div>
              {driver.dob && (
                <div>
                  <span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Fecha de Nacimiento</span>
                  <span className="block text-foreground font-medium">{driver.dob}</span>
                </div>
              )}
              {driver.ine_elector_key && (
                <div>
                  <span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Clave Elector</span>
                  <span className="block text-foreground font-medium font-mono">{driver.ine_elector_key}</span>
                </div>
              )}
              {driver.ine_address && (
                <div className="col-span-2">
                  <span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Domicilio</span>
                  <span className="block text-foreground font-medium leading-snug">{driver.ine_address}</span>
                </div>
              )}
            </div>
          </div>

          {/* Licencia */}
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground/80 mb-3">Licencia de Conducir</h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
              <div>
                <span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Número</span>
                <span className="block text-foreground font-medium font-mono">{driver.license_number || "—"}</span>
              </div>
              <div>
                <span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Vigencia</span>
                <span className={`block font-medium ${licenseExpired ? "text-red-400 font-bold" : "text-foreground"}`}>
                  {driver.license_is_permanent ? "Permanente" : driver.license_expiration_date || "—"}
                </span>
              </div>
              {!driver.license_is_permanent && (
                <div>
                  <Button variant="outline" size="sm" onClick={() => onRenewLicense(driver)}
                    className="h-10 rounded-xl border-amber-500/40 text-amber-600 hover:bg-amber-500/10 gap-1.5 text-xs font-bold w-full">
                    <RefreshCcw className="w-4 h-4" /> Renovar Licencia
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Documentos */}
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground/80 mb-2">Documentos</h4>
            <div className="grid grid-cols-2 gap-2">
              {driver.driver_photo_img && (
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground/80 block mb-1 truncate">Foto Chofer</span>
                  <div className="relative h-16 w-full rounded-lg overflow-hidden border border-border bg-card cursor-pointer" onClick={() => setPreviewImage(resolveDocUrl(driver.driver_photo_img))}>
                    <Image src={resolveDocUrl(driver.driver_photo_img)} alt="Foto Chofer" fill className="object-cover hover:scale-105 transition-transform" />
                  </div>
                </div>
              )}
              {driver.ine_img && (
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground/80 block mb-1 truncate">INE</span>
                  <div className="relative h-16 w-full rounded-lg overflow-hidden border border-border bg-card cursor-pointer" onClick={() => setPreviewImage(resolveDocUrl(driver.ine_img))}>
                    <Image src={resolveDocUrl(driver.ine_img)} alt="INE" fill className="object-cover hover:scale-105 transition-transform" />
                  </div>
                </div>
              )}
              {driver.license_img && (
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground/80 block mb-1 truncate">Licencia</span>
                  <div className="relative h-16 w-full rounded-lg overflow-hidden border border-border bg-card cursor-pointer" onClick={() => setPreviewImage(resolveDocUrl(driver.license_img))}>
                    <Image src={resolveDocUrl(driver.license_img)} alt="Licencia" fill className="object-cover hover:scale-105 transition-transform" />
                  </div>
                </div>
              )}
              {driver.address_proof_img && (
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground/80 block mb-1 truncate">Comprobante Domicilio</span>
                  <div className="relative h-16 w-full rounded-lg overflow-hidden border border-border bg-card cursor-pointer" onClick={() => setPreviewImage(resolveDocUrl(driver.address_proof_img))}>
                    <Image src={resolveDocUrl(driver.address_proof_img)} alt="Comprobante" fill className="object-cover hover:scale-105 transition-transform" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Vehículo Asignado */}
          {assignedVehicle && (
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground/80 mb-2">Vehículo Asignado</h4>
              <div className="bg-muted/20 rounded-xl border border-border/60 p-3 text-xs space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Marca / Modelo</span>
                  <span className="font-semibold text-foreground text-right min-w-0 truncate">{assignedVehicle.brand} {assignedVehicle.vehicle_name} {assignedVehicle.model}</span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Placas</span>
                  <span className="font-semibold text-foreground font-mono">{assignedVehicle.plate_number}</span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Renta Semanal</span>
                  <span className="font-semibold text-foreground">${assignedVehicle.rent_cost.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* Historial de Pagos */}
          {driverRentals.length > 0 && (
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5 mb-3">
                <DollarSign className="w-3.5 h-3.5" /> Historial de Pagos
              </h4>
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                <div className="bg-muted/20 rounded-xl border border-border/60 p-2 text-center">
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground/70 block">Deuda</span>
                  <span className="text-xs font-bold text-red-400">${totalDebt.toLocaleString()}</span>
                </div>
                <div className="bg-muted/20 rounded-xl border border-border/60 p-2 text-center">
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground/70 block">Pagado</span>
                  <span className="text-xs font-bold text-green-400">${totalPaid.toLocaleString()}</span>
                </div>
                <div className="bg-muted/20 rounded-xl border border-border/60 p-2 text-center">
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground/70 block">Cond.</span>
                  <span className="text-xs font-bold text-amber-400">${totalCondoned.toLocaleString()}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                {driverRentals.slice(0, 5).map((r) => {
                  const debt = Math.max(0, r.rent_amount - r.paid_amount - (r.condoned_amount || 0));
                  return (
                    <div key={r.id} className="bg-muted/10 rounded-lg border border-border/40 p-2 text-[10px]">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="flex items-center gap-1 text-foreground font-semibold">
                          <Calendar className="w-2.5 h-2.5 text-muted-foreground" />
                          {new Date(r.week_start + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                        </span>
                        {r.status === "PAID" ? (
                          <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 font-medium text-[8px]"><CheckCircle2 className="w-2 h-2" />PAID</span>
                        ) : r.status === "PARTIAL" ? (
                          <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium text-[8px]"><AlertTriangle className="w-2 h-2" />PARTIAL</span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 font-medium text-[8px]"><XCircle className="w-2 h-2" />UNPAID</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">${r.rent_amount.toLocaleString()} · Pagado: ${r.paid_amount.toLocaleString()}</span>
                        <span className={debt > 0 ? "text-red-400 font-bold" : "text-green-400"}>{debt > 0 ? `Deuda: $${debt.toLocaleString()}` : "$0"}</span>
                      </div>
                      {r.status !== "PAID" && (
                        <div className="flex gap-1 mt-1">
                          <button onClick={() => setPaymentDialog({ rentalId: r.id, weekStart: r.week_start, amount: 0 })}
                            className="flex-1 inline-flex items-center justify-center gap-0.5 px-1.5 py-1 rounded bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors text-[9px] font-medium">
                            <DollarSign className="w-2.5 h-2.5" />Pagar
                          </button>
                          <button onClick={() => setCondonationDialog({ rentalId: r.id, weekStart: r.week_start, days: 0 })}
                            className="flex-1 inline-flex items-center justify-center gap-0.5 px-1.5 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors text-[9px] font-medium">
                            <Plus className="w-2.5 h-2.5" />Cond.
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-background border-t border-border/40 px-4 py-3">
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" onClick={onClose} className="rounded-xl h-10 border-border font-bold text-[11px]">
              Cerrar
            </Button>
            <Button onClick={() => { onExportPdf(driver); onClose(); }} className="rounded-xl h-10 bg-blue-500 text-white font-bold hover:bg-blue-600 text-[11px]">
              <Download className="w-3.5 h-3.5 mr-1" /> PDF
            </Button>
            <Button onClick={() => { onEdit(driver); onClose(); }} className="rounded-xl h-10 bg-primary text-white font-bold hover:bg-primary text-[11px]">
              <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
