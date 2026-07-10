"use client";

import React, { useState, useEffect } from "react";
import { db, type Maintenance, type Assignment, type Driver, type RenewalLog, type Vehicle, type Checklist, type WeeklyRental, type VehicleInventory } from "@/lib/db";
import { getDriverName } from "@/lib/lookups";
import { Wrench, AlertTriangle, ArrowLeftRight, RefreshCcw, Shield, DollarSign, ClipboardCheck, Camera, CalendarPlus, Edit3, CreditCard } from "lucide-react";
import { motion } from "framer-motion";

interface VehicleHistoryProps {
  vehicle: Vehicle;
  maintenances: Maintenance[];
  assignments: Assignment[];
  drivers: Driver[];
  checklists?: Checklist[];
  weeklyRentals?: WeeklyRental[];
}

interface HistoryEvent {
  date: string;
  type: "mantenimiento" | "desgaste" | "asignacion" | "servicio" | "renovacion_circ" | "renovacion_seguro" | "checklist" | "inventario" | "registro" | "renta";
  label: string;
  description: string;
  cost?: number;
}

export default function VehicleHistory({ vehicle, maintenances, assignments, drivers, checklists, weeklyRentals }: VehicleHistoryProps) {
  const [renewalLogs, setRenewalLogs] = useState<RenewalLog[]>([]);
  const [inventory, setInventory] = useState<VehicleInventory | null>(null);

  useEffect(() => {
    db.getRenewalLogs(vehicle.id).then(setRenewalLogs);
    db.getVehicleInventory(vehicle.id).then(setInventory);
  }, [vehicle.id]);

  const events: HistoryEvent[] = [];

  // 1. Vehicle registration
  if (vehicle.created_at) {
    events.push({
      date: vehicle.created_at.split("T")[0],
      type: "registro",
      label: "Vehículo Registrado",
      description: `${vehicle.brand} ${vehicle.vehicle_name} · ${vehicle.plate_number} · ${vehicle.model}`,
    });
  }

  // 2. Maintenance events (including wear parts)
  for (const m of maintenances.filter((m) => m.vehicle_id === vehicle.id)) {
    const isWear = m.description.startsWith("[REEMPLAZO PIEZA]") || m.description.startsWith("[PIEZA DESGASTE]");
    events.push({
      date: m.maintenance_date,
      type: isWear ? "desgaste" : "mantenimiento",
      label: isWear ? "Reemplazo de Pieza" : "Mantenimiento",
      description: isWear
        ? m.description.replace(/^\[REEMPLAZO PIEZA\]\s*/, "").replace(/^\[PIEZA DESGASTE\]\s*/, "")
        : m.description,
      cost: m.cost,
    });
  }

  // 3. Assignment events
  for (const a of assignments.filter((a) => a.vehicle_id === vehicle.id)) {
    const driverName = getDriverName(drivers, a.driver_id);
    events.push({
      date: a.created_at.split("T")[0],
      type: "asignacion",
      label: a.action_type === "ASSIGN" ? "Asignación" : "Retiro",
      description: a.action_type === "ASSIGN"
        ? `Asignado a ${driverName}${a.reason ? ` — ${a.reason}` : ""}`
        : `Retirado de ${driverName}${a.reason ? ` — ${a.reason}` : ""}`,
    });
  }

  // 4. Service pause events
  if (vehicle.status === "in_service" && vehicle.service_out_date) {
    events.push({
      date: vehicle.service_out_date,
      type: "servicio",
      label: "Servicio / Pausa",
      description: `Vehículo retirado a servicio${vehicle.service_return_date ? `, regresó ${vehicle.service_return_date}` : ", actualmente en servicio"}`,
    });
  }

  // 5. Renewal events
  for (const r of renewalLogs) {
    events.push({
      date: r.created_at.split("T")[0],
      type: r.type === "CIRCULACION" ? "renovacion_circ" : "renovacion_seguro",
      label: r.type === "CIRCULACION" ? "Renovó Circulación" : "Renovó Seguro",
      description: `Vence: ${r.new_expiration}${r.previous_expiration ? ` (antes: ${r.previous_expiration})` : ""}`,
    });
  }

  // 6. Checklist events
  if (checklists) {
    for (const c of checklists.filter((c) => c.vehicle_id === vehicle.id)) {
      const items = c.checklist_items;
      const okCount = [items.lights, items.brakes, items.tires, items.bodywork, items.documents].filter(Boolean).length;
      events.push({
        date: c.created_at.split("T")[0],
        type: "checklist",
        label: c.type === "DELIVERY" ? "Checklist de Entrega" : "Checklist Semanal",
        description: `${okCount}/5 ok · ${c.mileage.toLocaleString()} km · Gasolina ${c.gasoline_level}${c.irregularities ? ` · Novedades: ${c.irregularities}` : ""}`,
      });
    }
  }

  // 7. Inventory events
  if (inventory && inventory.photos && inventory.photos.length > 0) {
    const photoAngles = inventory.photos.filter((p) => p.url).map((p) => p.angle).join(", ");
    events.push({
      date: inventory.created_at?.split("T")[0] || vehicle.created_at?.split("T")[0] || "",
      type: "inventario",
      label: "Inventario de Fotos",
      description: `${inventory.photos.filter((p) => p.url).length} foto(s) registrada(s)${photoAngles ? ` (${photoAngles})` : ""}${inventory.items?.length ? ` · ${inventory.items.length} ítem(s)` : ""}`,
    });
  }

  // 8. Weekly rental events
  if (weeklyRentals) {
    for (const r of weeklyRentals.filter((r) => {
      // Match by driver assignment — find if this vehicle was assigned to this driver during this week
      const assignment = assignments.find(
        (a) => a.driver_id === r.driver_id && a.vehicle_id === vehicle.id
      );
      return !!assignment;
    })) {
      const paid = r.paid_amount || 0;
      const total = r.rent_amount || 0;
      events.push({
        date: r.week_start,
        type: "renta",
        label: "Renta Semanal",
        description: `Semana del ${r.week_start} · Pagado: $${paid.toLocaleString()}${total ? ` de $${total.toLocaleString()}` : ""}`,
        cost: paid,
      });
    }
  }

  // Sort newest first
  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (events.length === 0) return null;

  const iconMap: Record<string, React.ReactNode> = {
    mantenimiento: <Wrench className="w-4 h-4 text-blue-400" />,
    desgaste: <AlertTriangle className="w-4 h-4 text-amber-400" />,
    asignacion: <ArrowLeftRight className="w-4 h-4 text-purple-400" />,
    servicio: <Wrench className="w-4 h-4 text-amber-500" />,
    renovacion_circ: <RefreshCcw className="w-4 h-4 text-primary" />,
    renovacion_seguro: <Shield className="w-4 h-4 text-emerald-400" />,
    checklist: <ClipboardCheck className="w-4 h-4 text-sky-400" />,
    inventario: <Camera className="w-4 h-4 text-pink-400" />,
    registro: <CalendarPlus className="w-4 h-4 text-green-400" />,
    renta: <CreditCard className="w-4 h-4 text-violet-400" />,
  };

  return (
    <div className="pt-4 border-t border-border/40">
      <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground/80 mb-3">Historial del Auto</h4>
      <div className="bg-muted/20 rounded-xl border border-border/60 p-4 space-y-2">
        {events.map((ev, i) => (
          <motion.div
            key={`${ev.type}-${i}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-start gap-3 py-2 border-b border-border/30 last:border-0">
            <div className="mt-0.5 shrink-0">{iconMap[ev.type]}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-foreground text-sm">{ev.label}</span>
                <span className="text-xs text-muted-foreground/60 ml-auto shrink-0">{ev.date}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-snug mt-1">{ev.description}</p>
              {ev.cost != null && ev.cost > 0 && (
                <div className="flex items-center gap-1 mt-1">
                  <DollarSign className="w-3 h-3 text-amber-400" />
                  <span className="text-xs font-bold text-amber-400">${ev.cost.toLocaleString()}</span>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
