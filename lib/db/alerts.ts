import type { Alert, Vehicle, Driver, Maintenance, Checklist } from "./types";
import { getLocalData, setLocalData } from "./localStorage";
import { getVerificationSchedule } from "./utils";
import { estimateServiceDate } from "../utils";
import { getOwnerId } from "./owner";
import { computeUsageStats } from "../usageStats";

export function computeAlerts(
  drivers: Driver[],
  vehicles: Vehicle[],
  maintenances: Maintenance[],
  checklists: Checklist[]
): Alert[] {
  const alerts: Alert[] = [];
  const today = new Date();

  // 1. Driver License Alerts
  drivers.forEach((driver) => {
    if (driver.license_is_permanent) return;
    if (!driver.license_expiration_date) return;

    const expDate = new Date(driver.license_expiration_date);
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 30) {
      alerts.push({
        id: `alert-lic-${driver.id}-${driver.license_expiration_date}`,
        type: "LICENSE",
        title: `Licencia de Conducir Vencida / Por Vencer`,
        description: `La licencia de ${driver.first_name} ${driver.paternal_last_name} vence en ${diffDays} días (${driver.license_expiration_date}).`,
        targetId: driver.id,
        severity: diffDays <= 0 ? "critical" : diffDays <= 7 ? "warning" : "info",
        dueDate: driver.license_expiration_date,
      });
    }
  });

  // 2. Vehicle Insurance Alerts
  vehicles.forEach((vehicle) => {
    if (!vehicle.insurance_expiration_date) return;

    const expDate = new Date(vehicle.insurance_expiration_date);
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 30) {
      alerts.push({
        id: `alert-ins-${vehicle.id}-${vehicle.insurance_expiration_date}`,
        type: "INSURANCE",
        title: `Seguro del Vehículo Vencido / Por Vencer`,
        description: `La póliza de seguro del auto ${vehicle.brand} ${vehicle.vehicle_name} (${vehicle.plate_number}) vence en ${diffDays} días.`,
        targetId: vehicle.id,
        severity: diffDays <= 0 ? "critical" : diffDays <= 10 ? "warning" : "info",
        dueDate: vehicle.insurance_expiration_date,
      });
    }

    // 3. Vehicle Verification Alerts
    if (vehicle.plate_number) {
      const schedule = getVerificationSchedule(vehicle.plate_number);
      const match = vehicle.plate_number.replace(/\D/g, "");
      const lastDigit = match ? parseInt(match.slice(-1), 10) : 5;

      type Window = { startMonth: number; endMonth: number; limitDate: string; period: string };
      let activeWindow: Window | null = null;

      if (lastDigit === 5 || lastDigit === 6) {
        activeWindow = today.getMonth() <= 2
          ? { startMonth: 0, endMonth: 2, limitDate: `${today.getFullYear()}-03-31`, period: "Primer Semestre (Feb-Mar)" }
          : { startMonth: 6, endMonth: 8, limitDate: `${today.getFullYear()}-09-30`, period: "Segundo Semestre (Ago-Sep)" };
      } else if (lastDigit === 7 || lastDigit === 8) {
        activeWindow = today.getMonth() <= 3
          ? { startMonth: 1, endMonth: 3, limitDate: `${today.getFullYear()}-04-30`, period: "Primer Semestre (Mar-Abr)" }
          : { startMonth: 7, endMonth: 9, limitDate: `${today.getFullYear()}-10-31`, period: "Segundo Semestre (Sep-Oct)" };
      } else if (lastDigit === 3 || lastDigit === 4) {
        activeWindow = today.getMonth() <= 4
          ? { startMonth: 2, endMonth: 4, limitDate: `${today.getFullYear()}-05-31`, period: "Primer Semestre (Abr-May)" }
          : { startMonth: 8, endMonth: 10, limitDate: `${today.getFullYear()}-11-30`, period: "Segundo Semestre (Oct-Nov)" };
      } else if (lastDigit === 1 || lastDigit === 2) {
        activeWindow = today.getMonth() <= 5
          ? { startMonth: 3, endMonth: 5, limitDate: `${today.getFullYear()}-06-30`, period: "Primer Semestre (May-Jun)" }
          : { startMonth: 9, endMonth: 11, limitDate: `${today.getFullYear()}-12-31`, period: "Segundo Semestre (Nov-Dic)" };
      } else {
        activeWindow = today.getMonth() >= 10 || today.getMonth() === 0
          ? { startMonth: 10, endMonth: 0, limitDate: `${today.getMonth() === 0 ? today.getFullYear() : today.getFullYear() + 1}-01-31`, period: "Segundo Semestre (Dic-Ene)" }
          : { startMonth: 4, endMonth: 6, limitDate: `${today.getFullYear()}-07-31`, period: "Primer Semestre (Jun-Jul)" };
      }

      if (activeWindow) {
        const limit = new Date(activeWindow.limitDate);
        const daysUntilLimit = Math.ceil((limit.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const shouldAlert = daysUntilLimit <= 30 || daysUntilLimit < 0;
        const severity = daysUntilLimit <= 0 ? "critical" : daysUntilLimit <= 7 ? "warning" : "info";

        if (shouldAlert) {
          alerts.push({
            id: `alert-ver-${vehicle.id}-${activeWindow.limitDate}`,
            type: "VERIFICATION",
            title: daysUntilLimit < 0 ? `Verificación Vehicular Vencida` : `Verificación Vehicular Próxima`,
            description: daysUntilLimit < 0
              ? `La verificación del vehículo ${vehicle.brand} ${vehicle.vehicle_name} (${vehicle.plate_number}) con terminación ${lastDigit} (Engomado ${schedule.color}) venció el ${activeWindow.limitDate}.`
              : `El vehículo ${vehicle.brand} ${vehicle.vehicle_name} (${vehicle.plate_number}) con terminación ${lastDigit} (Engomado ${schedule.color}) debe verificar en ${activeWindow.period}. Quedan ${daysUntilLimit} días.`,
            targetId: vehicle.id,
            severity,
            dueDate: activeWindow.limitDate,
          });
        }
      }
    }
  });

  // 4. Maintenance Alerts
  maintenances.forEach((maint) => {
    if (!maint.next_maintenance_date) return;
    const nextDate = new Date(maint.next_maintenance_date);
    const diffTime = nextDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 30) {
      alerts.push({
        id: `alert-maint-${maint.id}-${maint.next_maintenance_date}`,
        type: "MAINTENANCE",
        title: `Mantenimiento Programado`,
        description: `Próximo servicio programado para el vehículo en ${diffDays} días (${maint.next_maintenance_date}).`,
        targetId: maint.vehicle_id,
        severity: diffDays <= 0 ? "critical" : diffDays <= 10 ? "warning" : "info",
        dueDate: maint.next_maintenance_date,
      });
    }
  });

  // 5. Mileage-based maintenance alerts
  for (const vehicle of vehicles) {
    if (!vehicle.next_service_mileage) continue;

    const vChecklists = checklists.filter((c) => c.vehicle_id === vehicle.id);
    if (vChecklists.length === 0) continue;

    const sorted = [...vChecklists].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const latestMileage = sorted[0].mileage;
    const kmRemaining = Math.max(0, vehicle.next_service_mileage - latestMileage);

    if (kmRemaining > 1000) continue;

    const stats = computeUsageStats(vChecklists);
    const est = estimateServiceDate(latestMileage, vehicle.next_service_mileage, stats.monthlyAverage);

    const severity: "critical" | "warning" | "info" =
      kmRemaining <= 0 ? "critical" : kmRemaining <= 200 ? "warning" : "info";

    alerts.push({
      id: `alert-mileage-${vehicle.id}-${vehicle.next_service_mileage}`,
      type: "MAINTENANCE",
      title: kmRemaining <= 0
        ? `Mantenimiento Vencido — ${vehicle.brand} ${vehicle.vehicle_name}`
        : `Mantenimiento Próximo — ${vehicle.brand} ${vehicle.vehicle_name}`,
      description: kmRemaining <= 0
        ? `El vehículo ${vehicle.brand} ${vehicle.vehicle_name} (${vehicle.plate_number}) superó el kilometraje de servicio (${vehicle.next_service_mileage} km). Odómetro actual: ${latestMileage.toLocaleString()} km.`
        : `El vehículo ${vehicle.brand} ${vehicle.vehicle_name} (${vehicle.plate_number}) está a ${kmRemaining} km del servicio de ${vehicle.next_service_mileage.toLocaleString()} km. Odómetro actual: ${latestMileage.toLocaleString()} km.${est?.estimatedDate && est.estimatedDate !== "—" ? ` Fecha estimada: ${est.estimatedDate}.` : ""}`,
      targetId: vehicle.id,
      severity,
      dueDate: est?.estimatedDate && est.estimatedDate !== "—" ? est.estimatedDate : new Date().toISOString().split("T")[0],
    });
  }

  const completed = getLocalData("completed_alerts", [] as string[]);
  return alerts.filter((a) => !completed.includes(a.id));
}

export async function getAlerts(): Promise<Alert[]> {
  const { getDrivers } = await import("./drivers");
  const { getVehicles } = await import("./vehicles");
  const { getMaintenances } = await import("./maintenances");
  const { getChecklists } = await import("./checklists");

  const [drivers, vehicles, maintenances, checklists] = await Promise.all([
    getDrivers(),
    getVehicles(),
    getMaintenances(),
    getChecklists(),
  ]);

  return computeAlerts(drivers, vehicles, maintenances, checklists);
}

export async function dismissAlert(alertId: string): Promise<boolean> {
  const completed = getLocalData("completed_alerts", [] as string[]);
  let resolvedId = alertId;

  if (alertId.startsWith("alert-ver-") && alertId.split("-").length === 3) {
    const vehicleId = alertId.replace("alert-ver-", "");
    const { seedVehicles } = await import("./seed");
    const ownerId = getOwnerId();
    const vehicles = ownerId
      ? getLocalData<Vehicle>("vehicles", seedVehicles).filter((v) => v.owner_id === ownerId)
      : [];
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    if (vehicle && vehicle.plate_number) {
      const today = new Date();
      const match = vehicle.plate_number.replace(/\D/g, "");
      const lastDigit = match ? parseInt(match.slice(-1), 10) : 5;
      let activeLimitDate = "";

      if (lastDigit === 5 || lastDigit === 6) {
        activeLimitDate = today.getMonth() <= 2 ? `${today.getFullYear()}-03-31` : `${today.getFullYear()}-09-30`;
      } else if (lastDigit === 7 || lastDigit === 8) {
        activeLimitDate = today.getMonth() <= 3 ? `${today.getFullYear()}-04-30` : `${today.getFullYear()}-10-31`;
      } else if (lastDigit === 3 || lastDigit === 4) {
        activeLimitDate = today.getMonth() <= 4 ? `${today.getFullYear()}-05-31` : `${today.getFullYear()}-11-30`;
      } else if (lastDigit === 1 || lastDigit === 2) {
        activeLimitDate = today.getMonth() <= 5 ? `${today.getFullYear()}-06-30` : `${today.getFullYear()}-12-31`;
      } else {
        activeLimitDate = today.getMonth() >= 10 || today.getMonth() === 0
          ? `${today.getMonth() === 0 ? today.getFullYear() : today.getFullYear() + 1}-01-31`
          : `${today.getFullYear()}-07-31`;
      }
      resolvedId = `alert-ver-${vehicleId}-${activeLimitDate}`;
    }
  }

  if (!completed.includes(resolvedId)) {
    completed.push(resolvedId);
  }
  if (resolvedId !== alertId && !completed.includes(alertId)) {
    completed.push(alertId);
  }
  setLocalData("completed_alerts", completed);
  return true;
}
