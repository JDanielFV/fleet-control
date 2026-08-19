"use client";

import { useEffect, useRef } from "react";
import { getSupabase } from "@/lib/db";
import { getOwnerId } from "@/lib/session";
import { computeAlerts } from "@/lib/db/alerts";
import type { DataStoreValue } from "./useDataStore";

type RealtimeTable = "drivers" | "vehicles" | "assignments" | "checklists" | "weekly_rentals" | "maintenances";

/**
 * Subscribes to Supabase Realtime changes on the 6 main entity tables.
 * When a row is inserted, updated, or deleted, the corresponding store
 * setter is called incrementally — no full re-fetch needed.
 *
 * Also tracks connection status and exposes it via the store so the UI
 * can show a green/red indicator.
 *
 * Safety: Supabase Realtime respects RLS, so the client only receives
 * changes for rows the current user is allowed to see.
 */
export function useRealtimeSync(store: DataStoreValue) {
  const storeRef = useRef(store);
  storeRef.current = store;

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      storeRef.current.setRealtimeStatus("disabled");
      return;
    }

    storeRef.current.setRealtimeStatus("connecting");

    const ownerId = getOwnerId();
    const filter = ownerId ? `owner_id=eq.${ownerId}` : undefined;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setterMap: Record<RealtimeTable, React.Dispatch<React.SetStateAction<any[]>>> = {
      drivers: storeRef.current.setDrivers as React.Dispatch<React.SetStateAction<any[]>>,
      vehicles: storeRef.current.setVehicles as React.Dispatch<React.SetStateAction<any[]>>,
      assignments: storeRef.current.setAssignments as React.Dispatch<React.SetStateAction<any[]>>,
      checklists: storeRef.current.setChecklists as React.Dispatch<React.SetStateAction<any[]>>,
      weekly_rentals: storeRef.current.setWeeklyRentals as React.Dispatch<React.SetStateAction<any[]>>,
      maintenances: storeRef.current.setMaintenances as React.Dispatch<React.SetStateAction<any[]>>,
    };

    // Use type assertion to bypass supabase-js's narrow Realtime typing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channel = (supabase as any).channel("fleet-realtime");

    for (const table of Object.keys(setterMap) as RealtimeTable[]) {
      const config: Record<string, unknown> = { event: "*", schema: "public", table };
      if (filter) config.filter = filter;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      channel.on("postgres_changes", config, (payload: any) => {
        const setter = setterMap[table];
        if (!setter) return;

        if (payload.eventType === "INSERT") {
          setter((prev: any[]) => {
            if (prev.some((item: { id: string }) => item.id === payload.new.id)) return prev;
            return [payload.new, ...prev];
          });
        } else if (payload.eventType === "UPDATE") {
          setter((prev: any[]) =>
            prev.map((item: { id: string }) =>
              item.id === payload.new.id ? payload.new : item
            )
          );
        } else if (payload.eventType === "DELETE") {
          const deletedId = payload.old?.id;
          if (deletedId) {
            setter((prev: any[]) => prev.filter((item: { id: string }) => item.id !== deletedId));
          }
        }

        // Recompute alerts (storeRef always holds latest state)
        const s = storeRef.current;
        const newAlerts = computeAlerts(s.drivers, s.vehicles, s.maintenances, s.checklists);
        s.setAlerts(newAlerts);
      });
    }

    // Track connection status via the system event
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    channel.on("system" as any, { event: "connected" }, () => {
      storeRef.current.setRealtimeStatus("connected");
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    channel.on("system" as any, { event: "disconnected" }, () => {
      storeRef.current.setRealtimeStatus("disconnected");
    });

    channel.subscribe((status: string) => {
      if (status === "SUBSCRIBED") {
        storeRef.current.setRealtimeStatus("connected");
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        storeRef.current.setRealtimeStatus("disconnected");
      }
    });

    return () => {
      channel.unsubscribe();
    };
  }, []); // Empty deps — store ref is always current
}
