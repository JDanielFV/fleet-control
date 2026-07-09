import type { VerificationSchedule } from "./types";

// Generate a unique id. Prefer crypto.randomUUID (122 bits, available in
// secure contexts: localhost + https) over the legacy Math.random base36
// scheme (~45 bits). Fall back for non-secure-context plain-HTTP hosts.
export function genId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 11);
}

// Postgres DATE columns reject empty strings ("invalid input syntax for type
// date: \"\""). Normalize any empty-string date field to null before upsert so
// forms that leave dates blank (e.g. permanent-license drivers) still save.
export function normalizeEmptyDates<T extends Record<string, unknown>>(
  obj: T,
  dateKeys: readonly string[]
): T {
  const out = { ...obj };
  for (const key of dateKeys) {
    if (out[key] === "") (out as Record<string, unknown>)[key] = null;
  }
  return out;
}

export const DRIVER_DATE_KEYS = ["dob", "license_issue_date", "license_expiration_date"] as const;
export const VEHICLE_DATE_KEYS = ["circulation_expiration_date", "insurance_expiration_date", "verification_expiration_date", "service_out_date", "service_return_date"] as const;

// Mexican Verification Rules Helper
// Returns the months and color based on the last numeric digit of the license plate
export function getVerificationSchedule(plate: string): VerificationSchedule {
  // Extract last digit of plate number
  const match = plate.replace(/\D/g, "");
  const lastDigitStr = match ? match.slice(-1) : "5";
  const lastDigit = parseInt(lastDigitStr, 10);

  switch (lastDigit) {
    case 5:
    case 6:
      return {
        color: "Amarillo",
        months: "Feb-Mar / Ago-Sep",
        semester1: "Febrero - Marzo",
        semester2: "Agosto - Septiembre",
        lastDigits: [5, 6],
      };
    case 7:
    case 8:
      return {
        color: "Rosa",
        months: "Mar-Abr / Sep-Oct",
        semester1: "Marzo - Abril",
        semester2: "Septiembre - Octubre",
        lastDigits: [7, 8],
      };
    case 3:
    case 4:
      return {
        color: "Rojo",
        months: "Abr-May / Oct-Nov",
        semester1: "Abril - Mayo",
        semester2: "Octubre - Noviembre",
        lastDigits: [3, 4],
      };
    case 1:
    case 2:
      return {
        color: "Verde",
        months: "May-Jun / Nov-Dic",
        semester1: "Mayo - Junio",
        semester2: "Noviembre - Diciembre",
        lastDigits: [1, 2],
      };
    case 9:
    case 0:
    default:
      return {
        color: "Azul",
        months: "Jun-Jul / Dic-Ene",
        semester1: "Junio - Julio",
        semester2: "Diciembre - Enero",
        lastDigits: [9, 0],
      };
  }
}

/**
 * Calculate the next verification expiration date based on the plate's schedule.
 * Returns the last day of the next verification period (e.g. "2027-03-31").
 */
export function getNextVerificationDate(plate: string): string {
  const schedule = getVerificationSchedule(plate);
  const now = new Date();
  const year = now.getFullYear();

  // Parse semester end months
  const sem1EndMonth = getEndMonth(schedule.semester1); // e.g. "Marzo" → 3
  const sem2EndMonth = getEndMonth(schedule.semester2); // e.g. "Septiembre" → 9

  const currentMonth = now.getMonth() + 1; // 1-indexed

  // Determine which semester we're in and what's next
  // If current month is before or in sem1 end month → next is sem2 of same year
  // If current month is after sem1 end month → next is sem1 of next year
  // If current month is after sem2 end month → next is sem1 of next year

  let nextYear: number;
  let nextEndMonth: number;

  if (currentMonth <= sem1EndMonth) {
    // We're in or before semester 1 → next is semester 2 of same year
    nextYear = year;
    nextEndMonth = sem2EndMonth;
  } else if (currentMonth <= sem2EndMonth) {
    // We're in or before semester 2 → next is semester 1 of next year
    nextYear = year + 1;
    nextEndMonth = sem1EndMonth;
  } else {
    // Past semester 2 → next is semester 1 of next year
    nextYear = year + 1;
    nextEndMonth = sem1EndMonth;
  }

  // Return the last day of the end month
  const lastDay = new Date(nextYear, nextEndMonth, 0).getDate();
  return `${nextYear}-${String(nextEndMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

function getEndMonth(period: string): number {
  const months: Record<string, number> = {
    "Enero": 1, "Febrero": 2, "Marzo": 3, "Abril": 4,
    "Mayo": 5, "Junio": 6, "Julio": 7, "Agosto": 8,
    "Septiembre": 9, "Octubre": 10, "Noviembre": 11, "Diciembre": 12,
  };
  // period is like "Febrero - Marzo" → take the last month
  const parts = period.split(" - ");
  const lastMonthName = parts[parts.length - 1]?.trim() || "Enero";
  return months[lastMonthName] || 1;
}
