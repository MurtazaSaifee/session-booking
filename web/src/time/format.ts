// en-GB reads naturally for a 12-hour clock ("9:00 am") and puts the day before the month.
const LOCALE = "en-GB";

// Plain dates have no zone, so they are formatted as UTC midnight to keep them from shifting.
function utcMidnight(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

// Days are "YYYY-MM-DD" strings on the viewer's own calendar. Callers pass the viewer's profile timezone,
// not the browser's, so dates match the zone the viewer chose.
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

// Newer ICU versions put a narrow no-break space before am/pm; a plain space keeps the output predictable.
export function formatTime(instant: string, timezone: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(new Date(instant))
    .replace(/\s/g, " ");
}

// Clocks go back by an hour almost everywhere, and by 30 minutes on Lord Howe Island.
const CLOCK_BACK_MINUTES = [-60, -30, 30, 60];

function isRepeatedTime(instant: string, timezone: string): boolean {
  const clock = formatTime(instant, timezone);
  return CLOCK_BACK_MINUTES.some((minutes) => {
    const shifted = new Date(new Date(instant).getTime() + minutes * 60_000).toISOString();
    return formatTime(shifted, timezone) === clock;
  });
}

function utcOffset(instant: string, timezone: string): string {
  const formatter = new Intl.DateTimeFormat(LOCALE, { timeZone: timezone, timeZoneName: "shortOffset" });
  return formatter.formatToParts(new Date(instant)).find((part) => part.type === "timeZoneName")?.value ?? "";
}

// The night clocks go back, two different slots can read 1:00 am. The offset tells them apart.
export function formatTimeRange(slot: { start: string; end: string }, timezone: string): string {
  const range = `${formatTime(slot.start, timezone)} – ${formatTime(slot.end, timezone)}`;
  return isRepeatedTime(slot.start, timezone) ? `${range} (${utcOffset(slot.start, timezone)})` : range;
}

const LONG_DAY = { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" } as const;

export function formatDay(date: string): string {
  return new Intl.DateTimeFormat(LOCALE, LONG_DAY).format(utcMidnight(date));
}

// With the year, for lists that can reach back further than this year.
export function formatFullDay(date: string): string {
  return new Intl.DateTimeFormat(LOCALE, { ...LONG_DAY, year: "numeric" }).format(utcMidnight(date));
}

export function formatMonth(date: string): string {
  return new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", month: "short" }).format(utcMidnight(date));
}
