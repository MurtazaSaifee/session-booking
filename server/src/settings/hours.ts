import type { TimeRange } from "./store.js";

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
