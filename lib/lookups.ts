import type { Driver, Vehicle } from "@/lib/db";

/**
 * Shared display-name lookups. These were duplicated inline in every slice
 * (Assignments, Finances, Vehicles, Maintenance) with subtly different
 * fallbacks; centralising them keeps the formatting consistent.
 */

export function getDriverName(drivers: Driver[], id: string | null | undefined, fallback = "Desconocido"): string {
  if (!id) return "No asignado";
  const d = drivers.find((x) => x.id === id);
  return d ? `${d.first_name} ${d.paternal_last_name}` : fallback;
}

export function getVehicleName(vehicles: Vehicle[], id: string | null | undefined, fallback = "Desconocido"): string {
  if (!id) return fallback;
  const v = vehicles.find((x) => x.id === id);
  return v ? `${v.brand} ${v.vehicle_name} (${v.plate_number})` : fallback;
}