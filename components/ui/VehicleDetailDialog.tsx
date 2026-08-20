"use client";

import React from "react";
import { Vehicle, Driver, Maintenance, Assignment, Checklist, WeeklyRental, getVerificationSchedule } from "@/lib/db";
import { getDriverName } from "@/lib/lookups";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Car, Pencil, Trash2, Camera, RefreshCcw, Wrench, AlertTriangle, ArrowLeftRight, CheckCircle, X } from "lucide-react";
import Image from "next/image";
import VehicleHistory from "@/components/VehicleHistory";
import { resolveDocUrl } from "@/lib/db/storage";

interface VehicleDetailDialogProps {
  vehicle: Vehicle | null;
  open: boolean;
  onClose: () => void;
  onEdit: (vehicle: Vehicle) => void;
  onDelete: (vehicleId: string) => void;
  onRenewDocument: (vehicle: Vehicle, target: "CIRCULACION" | "SEGURO" | "VERIFICACION") => void;
  onServiceOut: (vehicle: Vehicle) => void;
  onServiceReturn: (vehicle: Vehicle) => void;
  onReportWearPart: (vehicle: Vehicle) => void;
  drivers: Driver[];
  maintenances: Maintenance[];
  assignments: Assignment[];
  checklists: Checklist[];
  weeklyRentals: WeeklyRental[];
  setPreviewImage: (url: string | null) => void;
}

export default function VehicleDetailDialog({
  vehicle,
  open,
  onClose,
  onEdit,
  onDelete,
  onRenewDocument,
  onServiceOut,
  onServiceReturn,
  onReportWearPart,
  drivers,
  maintenances,
  assignments,
  checklists,
  weeklyRentals,
  setPreviewImage,
}: VehicleDetailDialogProps) {
  if (!vehicle) return null;

  const vehicleId = vehicle.vin?.slice(-6).toUpperCase() || "—";
  const schedule = getVerificationSchedule(vehicle.plate_number);
  const driverName = vehicle.active_driver_id ? getDriverName(drivers, vehicle.active_driver_id) : null;
  const isInService = vehicle.status === "in_service";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto border border-border bg-background text-foreground rounded-2xl p-0">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background border-b border-border/40 px-5 pt-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-foreground font-black text-lg leading-tight">
                {vehicle.brand} {vehicle.vehicle_name} {vehicle.model}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs mt-1 font-mono">
                {vehicle.plate_number} · {vehicleId}
              </DialogDescription>
              <div className="flex items-center gap-2 mt-2">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${isInService ? "bg-blue-500/10 text-blue-500" : vehicle.active_driver_id ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-500"}`}>
                  {isInService ? "En Servicio" : vehicle.active_driver_id ? "Asignado" : "Disponible"}
                </span>
                <span className="flex items-center gap-1 text-xs font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full border border-black/20 shrink-0" style={{ backgroundColor: schedule.color === "Amarillo" ? "#eab308" : schedule.color === "Rosa" ? "#ec4899" : schedule.color === "Rojo" ? "#ef4444" : schedule.color === "Verde" ? "#22c55e" : "#3b82f6" }} />
                  {schedule.color}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="sm" onClick={() => onEdit(vehicle)} className="h-9 w-9 p-0">
                <Pencil className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onDelete(vehicle.id)} className="h-9 w-9 p-0 text-red-500 hover:text-red-600">
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose} className="h-9 w-9 p-0">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-5">
          {/* Información del Auto */}
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5 mb-3">
              <Car className="w-3.5 h-3.5" /> Información del Auto
            </h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
              <div>
                <span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Clase / Tipo</span>
                <span className="block text-foreground font-medium">{vehicle.class_type || "Sedán"}</span>
              </div>
              <div>
                <span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Color</span>
                <span className="block text-foreground font-medium">{vehicle.color || "Sin registrar"}</span>
              </div>
              <div>
                <span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Estado</span>
                <span className={`block font-bold ${isInService ? "text-amber-500" : "text-emerald-500"}`}>
                  {isInService ? <><Wrench className="w-3 h-3 inline text-amber-400" /> En Servicio</> : <><CheckCircle className="w-3 h-3 inline text-emerald-400" /> Activo</>}
                </span>
              </div>
              <div>
                <span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Chofer</span>
                <span className={`block font-semibold ${driverName ? "text-primary" : "text-amber-500"}`}>
                  {driverName || "Sin chofer"}
                </span>
              </div>
              <div>
                <span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Próx. Servicio</span>
                <span className="block text-foreground font-medium">{vehicle.next_service_mileage ? `${vehicle.next_service_mileage.toLocaleString()} km` : "No programado"}</span>
              </div>
              <div>
                <span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Renta Semanal</span>
                <span className="block text-foreground font-medium">${vehicle.rent_cost.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Acciones Rápidas */}
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground/80 mb-3">Acciones Rápidas</h4>
            <div className="grid grid-cols-2 gap-2">
              {isInService ? (
                <Button variant="outline" size="sm" onClick={() => onServiceReturn(vehicle)}
                  className="h-11 rounded-xl border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 gap-1.5 text-xs font-bold">
                  <ArrowLeftRight className="w-4 h-4" /> Regresar a Chofer
                </Button>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={() => onServiceOut(vehicle)}
                    className="h-11 rounded-xl border-amber-500/40 text-amber-600 hover:bg-amber-500/10 gap-1.5 text-xs font-bold">
                    <Wrench className="w-4 h-4" /> Retirar a Servicio
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onReportWearPart(vehicle)}
                    className="h-11 rounded-xl border-border gap-1.5 text-xs font-bold">
                    <AlertTriangle className="w-4 h-4" /> Pieza de Desgaste
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Documentos */}
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground/80 mb-3">Documentos</h4>
            <div className="space-y-3">
              {/* Circulación */}
              <div className="bg-muted/20 rounded-xl border border-border/60 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground/80">Circulación</span>
                  <Button variant="ghost" size="sm" onClick={() => onRenewDocument(vehicle, "CIRCULACION")} className="text-[10px] h-9 px-2 gap-1 text-muted-foreground hover:text-primary">
                    <RefreshCcw className="w-3 h-3" /> Renovar
                  </Button>
                </div>
                <div className="flex items-start gap-2.5">
                  {vehicle.circulation_img ? (
                    <div className="relative w-16 h-12 rounded-lg overflow-hidden border border-border bg-card shrink-0 cursor-pointer" onClick={() => setPreviewImage(resolveDocUrl(vehicle.circulation_img))}>
                      <Image src={resolveDocUrl(vehicle.circulation_img)} alt="Tarjeta de Circulación" fill className="object-cover hover:scale-105 transition-transform" />
                    </div>
                  ) : (
                    <div className="w-16 h-12 rounded-lg border border-dashed border-border/50 bg-muted/30 flex items-center justify-center shrink-0">
                      <Camera className="w-4 h-4 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="text-[10px] space-y-0.5 min-w-0">
                    <div><span className="text-muted-foreground/70">Vence: </span><strong className={vehicle.circulation_expiration_date && new Date(vehicle.circulation_expiration_date) < new Date() ? "text-red-400" : "text-foreground"}>{vehicle.circulation_expiration_date || "—"}</strong></div>
                    <div><span className="text-muted-foreground/70">Placas: </span><strong className="text-foreground font-mono">{vehicle.plate_number}</strong></div>
                  </div>
                </div>
              </div>

              {/* Seguro */}
              <div className="bg-muted/20 rounded-xl border border-border/60 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground/80">Seguro</span>
                  <Button variant="ghost" size="sm" onClick={() => onRenewDocument(vehicle, "SEGURO")} className="text-[10px] h-9 px-2 gap-1 text-muted-foreground hover:text-primary">
                    <RefreshCcw className="w-3 h-3" /> Renovar
                  </Button>
                </div>
                <div className="flex items-start gap-2.5">
                  {vehicle.insurance_policy_img ? (
                    <div className="relative w-16 h-12 rounded-lg overflow-hidden border border-border bg-card shrink-0 cursor-pointer" onClick={() => setPreviewImage(resolveDocUrl(vehicle.insurance_policy_img))}>
                      <Image src={resolveDocUrl(vehicle.insurance_policy_img)} alt="Póliza de Seguro" fill className="object-cover hover:scale-105 transition-transform" />
                    </div>
                  ) : (
                    <div className="w-16 h-12 rounded-lg border border-dashed border-border/50 bg-muted/30 flex items-center justify-center shrink-0">
                      <Camera className="w-4 h-4 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="text-[10px] space-y-0.5 min-w-0">
                    <div><span className="text-muted-foreground/70">Póliza: </span><strong className="text-foreground font-mono truncate block">{vehicle.insurance_policy_number || "—"}</strong></div>
                    <div><span className="text-muted-foreground/70">Vence: </span><strong className={vehicle.insurance_expiration_date && new Date(vehicle.insurance_expiration_date) < new Date() ? "text-red-400" : "text-foreground"}>{vehicle.insurance_expiration_date || "—"}</strong></div>
                  </div>
                </div>
              </div>

              {/* Verificación */}
              <div className="bg-muted/20 rounded-xl border border-border/60 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground/80">Verificación</span>
                  <Button variant="ghost" size="sm" onClick={() => onRenewDocument(vehicle, "VERIFICACION")} className="text-[10px] h-9 px-2 gap-1 text-muted-foreground hover:text-primary">
                    <RefreshCcw className="w-3 h-3" /> Renovar
                  </Button>
                </div>
                <div className="text-[10px] space-y-0.5">
                  <div><span className="text-muted-foreground/70">Vence: </span><strong className={vehicle.verification_expiration_date && new Date(vehicle.verification_expiration_date) < new Date() ? "text-red-400" : "text-foreground"}>{vehicle.verification_expiration_date || "—"}</strong></div>
                  <div><span className="text-muted-foreground/70">Engomado: </span>
                    <span className="flex items-center gap-1 font-semibold text-foreground">
                      <span className="w-2 h-2 rounded-full border border-black/20 inline-block shrink-0" style={{ backgroundColor: schedule.color === "Amarillo" ? "#eab308" : schedule.color === "Rosa" ? "#ec4899" : schedule.color === "Rojo" ? "#ef4444" : schedule.color === "Verde" ? "#22c55e" : "#3b82f6" }} />
                      <span>{schedule.color} · {schedule.months}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Historial */}
          <VehicleHistory
            vehicle={vehicle}
            maintenances={maintenances}
            assignments={assignments}
            drivers={drivers}
            checklists={checklists}
            weeklyRentals={weeklyRentals}
          />
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-background border-t border-border/40 px-5 py-4">
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl h-11 border-border font-bold">
              Cerrar
            </Button>
            <Button onClick={() => { onEdit(vehicle); onClose(); }} className="flex-1 rounded-xl h-11 bg-primary text-white font-bold hover:bg-primary">
              <Pencil className="w-4 h-4 mr-1.5" /> Editar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
