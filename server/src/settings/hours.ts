import { Info } from "luxon";

// A working-hours range on the professional's own clock, e.g. Monday (1) "09:00" to "12:00".
export type TimeRange = { weekday: number; start: string; end: string };

export type HoursColumns = { weekday: number; start_time: string; end_time: string };

// Postgres returns times as "09:00:00"; the API speaks "09:00".
export function toTimeRange(row: HoursColumns): TimeRange {
  return { weekday: row.weekday, start: row.start_time.slice(0, 5), end: row.end_time.slice(0, 5) };
}

// Returns the first weekday with overlapping ranges, or null. Ranges that only touch
// (one ends at 12:00, the next starts at 12:00) don't overlap.
export function findOverlappingDay(ranges: TimeRange[]): number | null {
  // "HH:MM" strings sort in time order, so they compare without parsing.
  const sorted = ranges.toSorted((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start));
  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    if (current.weekday === previous.weekday && current.start < previous.end) return current.weekday;
  }
  return null;
}

// Weekdays are ISO numbers, Monday = 1, and Luxon lists Monday first.
export function weekdayName(weekday: number): string {
  return Info.weekdays("long", { locale: "en" })[weekday - 1];
}
