import { supabase } from "./index";
import type { WeeklyRental } from "./types";
import { getLocalData, setLocalData, mergePendingLocal, addPendingId, clearPendingIds } from "./localStorage";
import { seedWeeklyRentals } from "./seed";
import { genId } from "./utils";
import { applyPayment } from "../utils";

export async function getWeeklyRentals(): Promise<WeeklyRental[]> {
  if (supabase) {
    const { data, error } = await supabase.from("weekly_rentals").select("*").order("week_start", { ascending: false });
    if (!error) return mergePendingLocal("weekly_rentals", data, seedWeeklyRentals);
  }
  return getLocalData("weekly_rentals", seedWeeklyRentals);
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
    return { rentals: getLocalData("weekly_rentals", seedWeeklyRentals), appliedPerWeek: [], leftover: 0 };
  }

  const allRentals = getLocalData("weekly_rentals", seedWeeklyRentals);
  const driverRentals = allRentals.filter((r) => r.driver_id === driverId);
  const otherRentals = allRentals.filter((r) => r.driver_id !== driverId);

  const { updatedRentals, appliedPerWeek, leftover } = applyPayment(driverRentals, amount, paymentDate);

  const merged = [...updatedRentals, ...otherRentals];
  setLocalData("weekly_rentals", merged);

  if (leftover > 0) {
    const credits = getLocalData<{ driver_id: string; amount: number; updated_at: string }>("driver_credits", []);
    const idx = credits.findIndex((c) => c.driver_id === driverId);
    const now = new Date().toISOString();
    if (idx >= 0) {
      credits[idx] = { driver_id: driverId, amount: credits[idx].amount + leftover, updated_at: now };
    } else {
      credits.push({ driver_id: driverId, amount: leftover, updated_at: now });
    }
    setLocalData("driver_credits", credits);
  }

  if (supabase) {
    for (const r of updatedRentals) {
      const { error } = await supabase.from("weekly_rentals").upsert(r).eq("id", r.id);
      if (error) addPendingId("weekly_rentals", r.id);
      else clearPendingIds("weekly_rentals", [r.id]);
    }
  } else {
    for (const r of updatedRentals) addPendingId("weekly_rentals", r.id);
  }

  return { rentals: updatedRentals, appliedPerWeek, leftover };
}

export async function getDriverDebt(driverId: string): Promise<number> {
  const rentals = getLocalData("weekly_rentals", seedWeeklyRentals);
  return rentals
    .filter((r) => r.driver_id === driverId && r.status !== "PAID")
    .reduce((acc, r) => acc + Math.max(0, r.rent_amount - r.paid_amount), 0);
}

export async function getDriverCredit(driverId: string): Promise<number> {
  const credits = getLocalData<{ driver_id: string; amount: number; updated_at: string }>("driver_credits", []);
  return credits.find((c) => c.driver_id === driverId)?.amount ?? 0;
}

export async function addDriverCredit(driverId: string, amount: number): Promise<void> {
  const credits = getLocalData<{ driver_id: string; amount: number; updated_at: string }>("driver_credits", []);
  const existing = credits.find((c) => c.driver_id === driverId);
  if (existing) {
    existing.amount += amount;
    existing.updated_at = new Date().toISOString();
  } else {
    credits.push({ driver_id: driverId, amount, updated_at: new Date().toISOString() });
  }
  setLocalData("driver_credits", credits);
  addPendingId("driver_credits", driverId);
}

export async function createWeeklyRental(
  rental: Omit<WeeklyRental, "id" | "created_at" | "payments_log">
): Promise<WeeklyRental | null> {
  const existing = getLocalData("weekly_rentals", seedWeeklyRentals);
  const dup = existing.find((r) => r.driver_id === rental.driver_id && r.week_start === rental.week_start);
  if (dup) {
    console.warn(`[fleet] Duplicate weekly rental skipped: driver=${rental.driver_id} week=${rental.week_start}`);
    return null;
  }

  const fullRental: WeeklyRental = {
    id: genId(),
    payments_log: [],
    created_at: new Date().toISOString(),
    ...rental,
  };
  if (supabase) {
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
  if (supabase) {
    const { data, error } = await supabase.from("weekly_rentals").upsert(rental).select().single();
    if (!error && data) {
      clearPendingIds("weekly_rentals", [rental.id]);
      return data;
    }
  }
  const rentals = getLocalData("weekly_rentals", seedWeeklyRentals);
  const idx = rentals.findIndex((r) => r.id === rental.id);
  if (idx >= 0) {
    rentals[idx] = rental;
  } else {
    rentals.unshift(rental);
  }
  setLocalData("weekly_rentals", rentals);
  addPendingId("weekly_rentals", rental.id);
  return rental;
}
