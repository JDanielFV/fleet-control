"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import type { Driver, Vehicle, Checklist, WeeklyRental, Maintenance, Assignment, Alert } from "@/lib/db";
import { getVehicles } from "@/lib/db/vehicles";
import { getDrivers } from "@/lib/db/drivers";
import { getAssignments } from "@/lib/db/assignments";
import { getChecklists } from "@/lib/db/checklists";
import { getWeeklyRentals } from "@/lib/db/finances";
import { getMaintenances } from "@/lib/db/maintenances";
import { computeAlerts } from "@/lib/db/alerts";

export type RealtimeConnectionStatus = "connecting" | "connected" | "disconnected" | "disabled";

export interface DataStoreValue {
  vehicles: Vehicle[];
  setVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
  drivers: Driver[];
  setDrivers: React.Dispatch<React.SetStateAction<Driver[]>>;
  assignments: Assignment[];
  setAssignments: React.Dispatch<React.SetStateAction<Assignment[]>>;
  checklists: Checklist[];
  setChecklists: React.Dispatch<React.SetStateAction<Checklist[]>>;
  weeklyRentals: WeeklyRental[];
  setWeeklyRentals: React.Dispatch<React.SetStateAction<WeeklyRental[]>>;
  maintenances: Maintenance[];
  setMaintenances: React.Dispatch<React.SetStateAction<Maintenance[]>>;
  alerts: Alert[];
  setAlerts: React.Dispatch<React.SetStateAction<Alert[]>>;
  stats: { vehicles: number; drivers: number; assigned: number };
  isLoading: boolean;
  reloadAll: () => Promise<void>;
  /** Real-time connection status. "disabled" when Supabase is not configured. */
  realtimeStatus: RealtimeConnectionStatus;
  setRealtimeStatus: React.Dispatch<React.SetStateAction<RealtimeConnectionStatus>>;
}

const DataStoreContext = createContext<DataStoreValue | null>(null);

export function useDataStore(): DataStoreValue {
  const ctx = useContext(DataStoreContext);
  if (!ctx) throw new Error("useDataStore must be used within DataStoreProvider");
  return ctx;
}

/** Minimal wrapper so components can `useContext(DataStoreContext)` directly. */
export { DataStoreContext };

export function DataStoreProvider({ children }: { children: React.ReactNode }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [weeklyRentals, setWeeklyRentals] = useState<WeeklyRental[]>([]);
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState({ vehicles: 0, drivers: 0, assigned: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeConnectionStatus>("connecting");

  const reloadAll = useCallback(async () => {
    const [vList, dList, aList, cList, rList, mList] = await Promise.all([
      getVehicles(),
      getDrivers(),
      getAssignments(),
      getChecklists(),
      getWeeklyRentals(),
      getMaintenances(),
    ]);
    setVehicles(vList);
    setDrivers(dList);
    setAssignments(aList);
    setChecklists(cList);
    setWeeklyRentals(rList);
    setMaintenances(mList);

    const activeAss = aList.filter((x) => x.action_type === "ASSIGN");
    const activeVehicles = new Set(activeAss.map((x) => x.vehicle_id));
    setStats({ vehicles: vList.length, drivers: dList.length, assigned: activeVehicles.size });

    const alertList = computeAlerts(dList, vList, mList, cList);
    setAlerts(alertList);
  }, []);

  // Load data on mount using a ref to avoid re-running on state changes
  const mountedRef = useRef(false);
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    void reloadAll().finally(() => setIsLoading(false));
  }, [reloadAll]);

  return (
    <DataStoreContext.Provider
      value={{
        vehicles, setVehicles,
        drivers, setDrivers,
        assignments, setAssignments,
        checklists, setChecklists,
        weeklyRentals, setWeeklyRentals,
        maintenances, setMaintenances,
        alerts, setAlerts,
        stats,
        isLoading,
        reloadAll,
        realtimeStatus, setRealtimeStatus,
      }}
    >
      {children}
    </DataStoreContext.Provider>
  );
}
