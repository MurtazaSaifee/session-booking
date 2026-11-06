import { DateTime } from "luxon";

// A session's start as one person reads it on their own clock, like "Mon 18 Jan at 11:30am".
// The night clocks go back, the same time happens twice, so it also gets its offset.
export function formatSessionTime(start: Date, timezone: string): string {
  const local = DateTime.fromJSDate(start, { zone: timezone }).setLocale("en-US");
  const day = local.toFormat("ccc d LLL");
  const time = `${local.toFormat("h:mm")}${local.toFormat("a").toLowerCase()}`;
  const repeated = local.getPossibleOffsets().length > 1;
  return repeated ? `${day} at ${time} (GMT${local.toFormat("Z")})` : `${day} at ${time}`;
}
