// en-GB reads naturally for a 12-hour clock ("9:00 am") and puts the day before the month.
const LOCALE = "en-GB";

// Plain dates have no zone, so they are formatted as UTC midnight to keep them from shifting.
function utcMidnight(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

// Newer ICU versions put a narrow no-break space before am/pm; a plain space keeps the output predictable.
export function formatTime(instant: string, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, { timeZone, hour: "numeric", minute: "2-digit", hour12: true })
    .format(new Date(instant))
    .replace(/\s/g, " ");
}

export function formatDay(date: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(utcMidnight(date));
}

export function formatMonth(date: string): string {
  return new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", month: "short" }).format(utcMidnight(date));
}
