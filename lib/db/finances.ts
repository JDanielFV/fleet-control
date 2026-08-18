import { getSupabase } from "./index";
import type { WeeklyRental, DriverCredit } from "./types";
import { getLocalData, setLocalData, mergePendingLocal, addPendingId, clearPendingIds } from "./localStorage";
import { seedWeeklyRentals } from "./seed";
import { genId } from "./utils";
import { applyPayment } from "../utils";
import { getOwnerId, ownerScoped } from "./owner";
import { getSession } from "@/lib/session";

export async function getWeeklyRentals(): Promise<WeeklyRental[]> {
  const session = getSession();
  const ownerId = session?.userId;
  const isAdmin = session?.role === "admin";
  const supabase = getSupabase(); if (supabase) {
    let query = supabase.from("weekly_rentals").select("*");
    if (ownerId && !isAdmin) query = query.or(`owner_id.eq.${ownerId},owner_id.is.null`);
    const { data, error } = await query.order("week_start", { ascending: false });
    if (!error) return mergePendingLocal("weekly_rentals", data, seedWeeklyRentals, ownerId);
  }
  return ownerScoped(getLocalData("weekly_rentals", seedWeeklyRentals));
}

export async function addPayment(
  driverId: string,
  amount: number,
  paymentDate: string = new Date().toISOString().split("T")[0]
): Promise<{
  rentals: WeeklyRental[];
  appliedPerWeek: { week_start: string; amount: number }[];
  leftover: number;
}> {
  if (amount <= 0) {
    return { rentals: await getWeeklyRentals(), appliedPerWeek: [], leftover: 0 };
  }

  const supabase = getSupabase();
  if (supabase) {
    // Server-side: RPC `apply_payment` hace la aplicación de forma atómica
    // y convierte el sobrante en crédito.
    const res = await fetch("/api/finances/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driverId, amount, paymentDate }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      applied?: { week_start: string; amount: number }[];
      leftover?: number;
      error?: string;
    };
    if (!res.ok) {
      console.error("[fleet] addPayment failed:", data.error);
      return { rentals: await getWeeklyRentals(), appliedPerWeek: [], leftover: 0 };
    }
    return {
      rentals: await getWeeklyRentals(),
      appliedPerWeek: data.applied ?? [],
      leftover: data.leftover ?? 0,
    };
  }

  const allRentals = getLocalData<WeeklyRental>("weekly_rentals", seedWeeklyRentals);
  const ownerId = getOwnerId();
  const ownerRentals = ownerId ? allRentals.filter((r) => r.owner_id === ownerId) : [];
  const otherRentals = ownerId ? allRentals.filter((r) => r.owner_id !== ownerId) : allRentals;
  const driverRentals = ownerRentals.filter((r) => r.driver_id === driverId);

  const { updatedRentals, appliedPerWeek, leftover } = applyPayment(driverRentals, amount, paymentDate);

  const merged = [...updatedRentals, ...otherRentals];
  setLocalData("weekly_rentals", merged);

  if (leftover > 0) {
    const credits = getLocalData<DriverCredit & { owner_id?: string | null }>("driver_credits", []);
    const idx = credits.findIndex((c) => c.driver_id === driverId && c.owner_id === ownerId);
    const now = new Date().toISOString();
    if (idx >= 0) {
      credits[idx].amount += leftover;
      credits[idx].updated_at = now;
    } else {
      credits.push({ driver_id: driverId, owner_id: ownerId ?? undefined, amount: leftover, updated_at: now });
    }
    setLocalData("driver_credits", credits);
  }

  for (const r of updatedRentals) addPendingId("weekly_rentals", r.id);

  return { rentals: updatedRentals, appliedPerWeek, leftover };
}

/**
 * Pago sobre un rental concreto (flujo de la UI). Con Supabase se delega al
 * servidor (RPC `apply_rental_payment`, atómico); en modo local replica la
 * lógica de incremento + recálculo de status.
 */
export async function applyRentalPayment(
  rentalId: string,
  amount: number,
  paymentDate: string = new Date().toISOString().split("T")[0]
): Promise<WeeklyRental | null> {
  if (amount <= 0) return null;

  const supabase = getSupabase();
  if (supabase) {
    const res = await fetch("/api/finances/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rentalId, amount, paymentDate }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      rental?: { id: string; paid_amount: number; status: WeeklyRental["status"] };
      error?: string;
    };
    if (!res.ok || !data.rental) {
      console.error("[fleet] applyRentalPayment failed:", data.error);
      return null;
    }
    const rentals = await getWeeklyRentals();
    return rentals.find((r) => r.id === data.rental!.id) ?? null;
  }

  const rentals = getLocalData<WeeklyRental>("weekly_rentals", seedWeeklyRentals);
  const rental = rentals.find((r) => r.id === rentalId);
  if (!rental) return null;

  const updated: WeeklyRental = {
    ...rental,
    paid_amount: rental.paid_amount + amount,
  };
  const effectiveRent = rental.rent_amount - (rental.condoned_amount || 0);
  if (updated.paid_amount >= effectiveRent) updated.status = "PAID";
  else if (updated.paid_amount > 0) updated.status = "PARTIAL";
  else updated.status = "UNPAID";
  updated.payments_log = [
    ...(rental.payments_log || []),
    { amount, date: paymentDate },
  ];

  const idx = rentals.findIndex((r) => r.id === rentalId);
  if (idx >= 0) rentals[idx] = updated;
  setLocalData("weekly_rentals", rentals);
  addPendingId("weekly_rentals", rentalId);
  return updated;
}

export async function getDriverDebt(driverId: string): Promise<number> {
  const rentals = await getWeeklyRentals();
  return rentals
    .filter((r) => r.driver_id === driverId && r.status !== "PAID")
    .reduce((acc, r) => acc + Math.max(0, r.rent_amount - r.paid_amount), 0);
}

export async function getDriverCredit(driverId: string): Promise<number> {
  const ownerId = getOwnerId();
  const supabase = getSupabase();
  if (supabase) {
    const res = await fetch(`/api/finances/credits?driverId=${encodeURIComponent(driverId)}`);
    const data = (await res.json().catch(() => ({}))) as { amount?: number; error?: string };
    if (res.ok && typeof data.amount === "number") return data.amount;
    console.error("[fleet] getDriverCredit failed:", data.error);
  }
  const credits = getLocalData<(DriverCredit & { owner_id?: string | null })>("driver_credits", []);
  return credits.find((c) => c.driver_id === driverId && c.owner_id === ownerId)?.amount ?? 0;
}

export async function addDriverCredit(driverId: string, amount: number): Promise<void> {
  const ownerId = getOwnerId();
  const supabase = getSupabase();
  if (supabase) {
    const res = await fetch("/api/finances/credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driverId, delta: amount }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) console.error("[fleet] addDriverCredit failed:", data.error);
    return;
  }
  const credits = getLocalData<(DriverCredit & { owner_id?: string | null })>("driver_credits", []);
  const existing = credits.find((c) => c.driver_id === driverId && c.owner_id === ownerId);
  if (existing) {
    existing.amount += amount;
    existing.updated_at = new Date().toISOString();
  } else {
    credits.push({ driver_id: driverId, owner_id: ownerId ?? undefined, amount, updated_at: new Date().toISOString() });
  }
  setLocalData("driver_credits", credits);
  addPendingId("driver_credits", driverId);
}

export async function createWeeklyRental(
  rental: Omit<WeeklyRental, "id" | "created_at" | "payments_log">
): Promise<WeeklyRental | null> {
  const ownerId = getOwnerId();
  const existing = ownerScoped(getLocalData<WeeklyRental>("weekly_rentals", seedWeeklyRentals));
  const dup = existing.find((r) => r.driver_id === rental.driver_id && r.week_start === rental.week_start);
  if (dup) {
    console.warn(`[fleet] Duplicate weekly rental skipped: driver=${rental.driver_id} week=${rental.week_start}`);
    return null;
  }

  const fullRental: WeeklyRental = {
    id: genId(),
    owner_id: ownerId ?? undefined,
    payments_log: [],
    created_at: new Date().toISOString(),
    ...rental,
  };
  const supabase = getSupabase(); if (supabase) {
    const { data, error } = await supabase.from("weekly_rentals").insert(fullRental).select().single();
    if (!error && data) {
      clearPendingIds("weekly_rentals", [fullRental.id]);
      return data;
    }
  }
  const rentals = getLocalData("weekly_rentals", seedWeeklyRentals);
  rentals.unshift(fullRental);
  setLocalData("weekly_rentals", rentals);
  addPendingId("weekly_rentals", fullRental.id);
  return fullRental;
}

export async function saveWeeklyRental(rental: WeeklyRental): Promise<WeeklyRental> {
  const fullRental: WeeklyRental = {
    ...rental,
    owner_id: rental.owner_id ?? getOwnerId() ?? undefined,
  };
  const supabase = getSupabase(); if (supabase) {
    const { data, error } = await supabase.from("weekly_rentals").upsert(fullRental).select().single();
    if (!error && data) {
      clearPendingIds("weekly_rentals", [rental.id]);
      return data;
    }
  }
  const rentals = getLocalData("weekly_rentals", seedWeeklyRentals);
  const idx = rentals.findIndex((r) => r.id === rental.id);
  if (idx >= 0) {
    rentals[idx] = fullRental;
  } else {
    rentals.unshift(fullRental);
  }
  setLocalData("weekly_rentals", rentals);
  addPendingId("weekly_rentals", rental.id);
  return fullRental;
}
