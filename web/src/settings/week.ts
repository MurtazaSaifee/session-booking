import type { TimeRange } from "./api";

export const WEEKDAYS = [
  { weekday: 1, name: "Monday" },
  { weekday: 2, name: "Tuesday" },
  { weekday: 3, name: "Wednesday" },
  { weekday: 4, name: "Thursday" },
  { weekday: 5, name: "Friday" },
  { weekday: 6, name: "Saturday" },
  { weekday: 7, name: "Sunday" },
] as const;

export const MON_TO_FRI = [1, 2, 3, 4, 5];
export const SAT_AND_SUN = [6, 7];
export const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];

// A range being edited. The key keeps React's rows stable while the times change.
export type EditableRange = TimeRange & { key: string };

// A counter, not crypto.randomUUID(): browsers only offer that on HTTPS or localhost.
let nextKey = 0;

export function toEditable(ranges: TimeRange[]): EditableRange[] {
  return ranges.map((range) => ({ ...range, key: String(nextKey++) }));
}

export function toRanges(editable: EditableRange[]): TimeRange[] {
  return editable.map(({ weekday, start, end }) => ({ weekday, start, end }));
}

// The range "Add hours" starts with: an hour after the day's latest end, or 09:00 to 17:00 on an empty day.
export function newRange(weekday: number, dayRanges: TimeRange[]): TimeRange {
  const ends = dayRanges.map((range) => range.end).filter(Boolean);
  if (ends.length === 0) return { weekday, start: "09:00", end: "17:00" };
  // "HH:MM" strings sort the same as the times they stand for.
  const start = ends.reduce((latest, end) => (end > latest ? end : latest));
  const nextHour = Number(start.slice(0, 2)) + 1;
  const end = nextHour > 23 ? "23:59" : `${String(nextHour).padStart(2, "0")}${start.slice(2)}`;
  return { weekday, start, end };
}

// Finds overlapping or invalid ranges per day in real-time (Fixes Issue 6)
export function findDayOverlaps(ranges: EditableRange[]): Map<number, string> {
  const errors = new Map<number, string>();

  for (let weekday = 1; weekday <= 7; weekday++) {
    const dayRanges = ranges.filter((r) => r.weekday === weekday);
    if (dayRanges.length === 0) continue;

    // Check if start >= end
    for (const r of dayRanges) {
      if (r.start && r.end && r.end <= r.start) {
        errors.set(weekday, "End time must be after start time.");
        break;
      }
    }

    if (errors.has(weekday)) continue;

    // Check if any ranges overlap
    const sorted = [...dayRanges].sort((a, b) => a.start.localeCompare(b.start));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      if (curr.start < prev.end) {
        errors.set(weekday, "Time ranges overlap on this day. Please adjust the hours.");
        break;
      }
    }
  }

  return errors;
}

// Bulk helpers for weekdays, weekends, or all days (Fixes Issue 4)
export function applyBulkHours(
  current: EditableRange[],
  weekdays: number[],
  hours: { start: string; end: string }[],
): EditableRange[] {
  const kept = current.filter((r) => !weekdays.includes(r.weekday));
  const added: TimeRange[] = [];
  for (const day of weekdays) {
    for (const h of hours) {
      added.push({ weekday: day, start: h.start, end: h.end });
    }
  }
  return [...kept, ...toEditable(added)];
}

export function copyDayHoursTo(
  current: EditableRange[],
  fromWeekday: number,
  targetWeekdays: number[],
): EditableRange[] {
  const sourceRanges = current.filter((r) => r.weekday === fromWeekday);
  const targets = targetWeekdays.filter((w) => w !== fromWeekday);
  const kept = current.filter((r) => !targets.includes(r.weekday));
  const added: TimeRange[] = [];
  for (const day of targets) {
    for (const s of sourceRanges) {
      added.push({ weekday: day, start: s.start, end: s.end });
    }
  }
  return [...kept, ...toEditable(added)];
}

export function clearDays(current: EditableRange[], weekdays: number[]): EditableRange[] {
  return current.filter((r) => !weekdays.includes(r.weekday));
}
