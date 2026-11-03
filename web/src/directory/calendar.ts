// Days are "YYYY-MM-DD" strings on the viewer's own calendar. Callers pass the viewer's profile timezone,
// not the browser's, so the calendar matches the zone the member chose.
export function localDate(instant: string | Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(instant));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function groupByLocalDay<T extends { start: string }>(slots: T[], timezone: string): Map<string, T[]> {
  const days = new Map<string, T[]>();
  for (const slot of slots) {
    const day = localDate(slot.start, timezone);
    const group = days.get(day);
    if (group) group.push(slot);
    else days.set(day, [slot]);
  }
  return days;
}

// Plain dates are added in UTC, which has no clock changes, so a day is always exactly one day.
function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function daysSinceMonday(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
}

// Monday-first weeks covering firstDay to lastDay, padded out to whole weeks.
export function calendarWeeks(firstDay: string, lastDay: string): string[][] {
  const end = addDays(lastDay, 6 - daysSinceMonday(lastDay));
  const weeks: string[][] = [];
  let monday = addDays(firstDay, -daysSinceMonday(firstDay));
  while (monday <= end) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(monday, i)));
    monday = addDays(monday, 7);
  }
  return weeks;
}
