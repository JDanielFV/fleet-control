import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Build a CSV (UTF-8, BOM-prefixed) from headers + rows and trigger a browser
 * download as `${prefix}_YYYY-MM-DD.csv`. Replaces the duplicated Blob+link+revoke
 * boilerplate that lived in VehiclesSlice and FinancesSlice.
 */
export function downloadCSV(prefix: string, headers: string[], rows: (string | number)[][]): void {
  const csvContent =
    "﻿" +
    [headers.join(","), ...rows.map((r) => r.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${prefix}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Format an ISO date string for display. Returns "—" for null/undefined/invalid
 * values so callers don't need their own guards. Defaults to es-MX to keep the
 * fleet app's locale consistent (previously mixed es-MX with the host default).
 */
export function formatDate(iso: string | null | undefined, locale = "es-MX"): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(locale);
}

/**
 * Return a new array sorted by `key` (an ISO date field) descending — newest
 * first. Replaces the repeated `[...arr].sort((a,b) => new Date(b.x) - new Date(a.x))`.
 */
export function sortByDateDesc<T>(arr: T[], key: keyof T): T[] {
  return [...arr].sort(
    (a, b) => new Date(String(b[key])).getTime() - new Date(String(a[key])).getTime()
  );
}

/**
 * Return the ISO date (YYYY-MM-DD) of the Monday that starts the week
 * containing `date`. Sunday rolls back to the previous Monday.
 */
export function getMondayOf(date: Date): string {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon, ... 6=Sat
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Compute the prorated rent for a partial first week.
 *   - Monday → 7 days (full week)
 *   - Tuesday → 6 days, Wednesday → 5, ..., Sunday → 1 day
 *
 * If the caller passes a date that falls before the Monday (e.g. an
 * assignment logged at 00:00 on Monday but really created on Sunday
 * night), we floor to 1 day so the result is never zero or negative.
 */
export function prorateRent(
  fullWeekAmount: number,
  assignmentDate: Date
): { amount: number; days: number } {
  const monday = new Date(assignmentDate);
  const day = monday.getDay();
  const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);

  // Days remaining in the week (including today) — Monday=7, Tuesday=6, ... Sunday=1.
  // If the date is somehow before Monday, floor to 1 day.
  const msPerDay = 24 * 60 * 60 * 1000;
  const elapsedDays = Math.floor((assignmentDate.getTime() - monday.getTime()) / msPerDay);
  const days = Math.max(1, Math.min(7, 7 - elapsedDays));
  const amount = Math.round((fullWeekAmount * days) / 7);
  return { amount, days };
}

/**
 * FIFO payment application: spread `amount` across the driver's rentals
 * starting from the oldest unpaid week. Returns:
 *   - updatedRentals: a new array with payments applied and statuses refreshed
 *   - appliedPerWeek: how much of the payment went to each week (for UI)
 *   - leftover: amount that exceeded the total pending debt (becomes driver credit)
 *
 * Pure function — does not mutate the input. Status is recomputed from
 * paid_amount vs rent_amount on every rental, not stored separately.
 */
export function applyPayment<
  T extends {
    week_start: string;
    rent_amount: number;
    paid_amount: number;
    status: "PAID" | "PARTIAL" | "UNPAID";
    payments_log: { amount: number; date: string }[];
  },
>(rentals: T[], amount: number, paymentDate: string): {
  updatedRentals: T[];
  appliedPerWeek: { week_start: string; amount: number }[];
  leftover: number;
} {
  let remaining = amount;
  const appliedPerWeek: { week_start: string; amount: number }[] = [];

  // Sort ascending by week_start so the oldest is first.
  const ordered = [...rentals].sort(
    (a, b) => new Date(a.week_start).getTime() - new Date(b.week_start).getTime()
  );

  const updated = ordered.map<T>((rental) => {
    if (remaining <= 0) return rental;

    const pending = Math.max(0, rental.rent_amount - rental.paid_amount);
    if (pending <= 0) return rental; // already fully paid

    const apply = Math.min(pending, remaining);
    remaining -= apply;
    appliedPerWeek.push({ week_start: rental.week_start, amount: apply });

    const newPaid = rental.paid_amount + apply;
    const newStatus: "PAID" | "PARTIAL" | "UNPAID" =
      newPaid >= rental.rent_amount ? "PAID" : newPaid > 0 ? "PARTIAL" : "UNPAID";

    return {
      ...rental,
      paid_amount: newPaid,
      status: newStatus,
      payments_log: [
        ...rental.payments_log,
        { amount: apply, date: paymentDate },
      ],
    };
  });

  return { updatedRentals: updated, appliedPerWeek, leftover: remaining };
}
