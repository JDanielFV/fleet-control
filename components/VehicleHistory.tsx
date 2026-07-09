"use client";

import React, { useState, useEffect } from "react";
import { db, type Maintenance, type Assignment, type Driver, type RenewalLog, type Vehicle } from "@/lib/db";
import { getDriverName } from "@/lib/lookups";
import { Wrench, AlertTriangle, ArrowLeftRight, RefreshCcw, Shield, DollarSign } from "lucide-react";
import { motion } from "framer-motion";

interface VehicleHistoryProps {
  vehicle: Vehicle;
  maintenances: Maintenance[];
  assignments: Assignment[];
  drivers: Driver[];
}

interface HistoryEvent {
  date: string;
  type: "mantenimiento" | "desgaste" | "asignacion" | "servicio" | "renovacion_circ" | "renovacion_seguro";
  label: string;
  description: string;
  cost?: number;
}

export default function VehicleHistory({ vehicle, maintenances, assignments, drivers }: VehicleHistoryProps) {
  const [renewalLogs, setRenewalLogs] = useState<RenewalLog[]>([]);

  useEffect(() => {
    db.getRenewalLogs(vehicle.id).then(setRenewalLogs);
  }, [vehicle.id]);

  const events: HistoryEvent[] = [];

  // Maintenance events
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

  // Assignment events
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

  // Service pause events
  if (vehicle.status === "in_service" && vehicle.service_out_date) {
    events.push({
      date: vehicle.service_out_date,
      type: "servicio",
      label: "Servicio / Pausa",
      description: `Vehículo retirado a servicio${vehicle.service_return_date ? `, regresó ${vehicle.service_return_date}` : ", actualmente en servicio"}`,
    });
  }

  // Renewal events
  for (const r of renewalLogs) {
    events.push({
      date: r.created_at.split("T")[0],
      type: r.type === "CIRCULACION" ? "renovacion_circ" : "renovacion_seguro",
      label: r.type === "CIRCULACION" ? "Renovó Circulación" : "Renovó Seguro",
      description: `Vence: ${r.new_expiration}${r.previous_expiration ? ` (antes: ${r.previous_expiration})` : ""}`,
    });
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
  };

  return (
    <div className="pt-4 border-t border-border/40">
      <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground/80 mb-3">Historial del Auto</h4>
      <div className="bg-muted/20 rounded-xl border border-border/60 p-4 space-y-2">
        {events.map((ev, i) => (
          <motion.div
            key={i}
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
