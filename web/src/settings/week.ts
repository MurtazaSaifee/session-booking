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

// A range being edited. The key keeps React's rows stable while the times change.
export type EditableRange = TimeRange & { key: string };

export function toEditable(ranges: TimeRange[]): EditableRange[] {
  return ranges.map((range) => ({ ...range, key: crypto.randomUUID() }));
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
