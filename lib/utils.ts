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
