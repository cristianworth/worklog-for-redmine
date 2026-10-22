import { isWorkDate, validatePeriod } from "../shared/worklogs";

export interface PeriodPreference {
  from: string;
  to: string;
  endMode: "fixed" | "today";
}
export const periodStorageKey = "worklog.period";

export function localDate(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function dateRange(from: string, to: string): string[] {
  validatePeriod(from, to);
  const dates: string[] = [];
  const day = new Date(`${from}T12:00:00Z`);
  while (true) {
    const key = day.toISOString().slice(0, 10);
    dates.push(key);
    if (key === to) return dates;
    day.setUTCDate(day.getUTCDate() + 1);
  }
}

export function endDate(period: PeriodPreference, today: string): string {
  return period.endMode === "today" ? today : period.to;
}

export function restorePeriod(
  value: unknown,
  now = new Date(),
): PeriodPreference {
  const today = localDate(now);
  if (value && typeof value === "object") {
    const period = value as Partial<PeriodPreference>;
    if (
      typeof period.from === "string" &&
      typeof period.to === "string" &&
      isWorkDate(period.to) &&
      (period.endMode === "fixed" || period.endMode === "today")
    ) {
      try {
        validatePeriod(
          period.from,
          period.endMode === "today" ? today : period.to,
        );
        return period as PeriodPreference;
      } catch {
        /* Invalid saved preferences fall back to a recent period. */
      }
    }
  }
  const start = new Date(now);
  start.setDate(start.getDate() - 6);
  return { from: localDate(start), to: today, endMode: "today" };
}

export const shortDate = (date: string): string =>
  date.split("-").reverse().join("/");
export const dayLabel = (date: string): string =>
  new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
