import { Checklist } from "./db";

/**
 * A "fleet week" starts on Monday and ends on Sunday. Given any date, return
 * the ISO date string (YYYY-MM-DD) of the Monday that begins its week. Used to
 * bucket checklists into weeks without having to think about locale-dependent
 * Date#getDay semantics.
 */
function getMondayOfWeek(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // getDay: 0 = Sunday, 1 = Monday, ... 6 = Saturday. We want Monday as start.
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export interface WeekUsage {
  weekStart: string; // Monday ISO date
  km: number;        // km driven in this week (last reading minus last reading of previous week)
  kmPerDay: number;  // km / 7
}

export interface UsageSummary {
  weeks: WeekUsage[];
  /** Average of `kmPerDay` over the last 4 weeks that had data. Null if no data. */
  monthlyAverage: number | null;
}

/**
 * Compute per-week usage and a 4-week rolling daily average from a vehicle's
 * checklists.
 *
 * Algorithm:
 *  1. Sort checklists ascending by created_at.
 *  2. For each week (Monday→Sunday), find the LAST checklist of that week.
 *  3. Week km = (last of this week).mileage − (last of the previous week).mileage.
 *     The first observed week is treated as the "delivery baseline" and is
 *     dropped from the per-week list because there's no prior reading to
 *     subtract.
 *  4. kmPerDay = weekKm / 7 (per the user's spec — always divide by 7).
 *  5. monthlyAverage = mean of the last 4 weeks' kmPerDay. Returns null when
 *     there isn't at least one full week of data.
 */
export function computeUsageStats(checklists: Checklist[]): UsageSummary {
  if (checklists.length === 0) {
    return { weeks: [], monthlyAverage: null };
  }

  const sorted = [...checklists].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // Map of weekStart -> { lastMileage, lastCreatedAt }
  const lastPerWeek = new Map<string, { mileage: number; createdAt: number }>();
  for (const c of sorted) {
    const weekStart = getMondayOfWeek(new Date(c.created_at));
    const prev = lastPerWeek.get(weekStart);
    if (!prev || new Date(c.created_at).getTime() >= prev.createdAt) {
      lastPerWeek.set(weekStart, {
        mileage: c.mileage,
        createdAt: new Date(c.created_at).getTime(),
      });
    }
  }

  const orderedWeeks = Array.from(lastPerWeek.entries()).sort(
    (a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime()
  );

  const weeks: WeekUsage[] = [];
  for (let i = 1; i < orderedWeeks.length; i++) {
    const [weekStart, current] = orderedWeeks[i];
    const previous = orderedWeeks[i - 1][1];
    const km = current.mileage - previous.mileage;
    // Negative deltas happen if the odometer is reset or entries are typed in
    // wrong. Skip them so they don't poison the average.
    if (km < 0) continue;
    weeks.push({
      weekStart,
      km,
      kmPerDay: km / 7,
    });
  }

  const lastFour = weeks.slice(-4);
  const monthlyAverage =
    lastFour.length > 0
      ? lastFour.reduce((acc, w) => acc + w.kmPerDay, 0) / lastFour.length
      : null;

  return { weeks, monthlyAverage };
}
