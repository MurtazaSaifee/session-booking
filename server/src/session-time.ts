import { DateTime } from "luxon";

// A session's start as one person reads it on their own clock, like "Mon 18 Jan at 11:30am".
export function sessionTime(start: Date, timezone: string): string {
  const local = DateTime.fromJSDate(start, { zone: timezone }).setLocale("en-US");
  const day = local.toFormat("ccc d LLL");
  const time = `${local.toFormat("h:mm")}${local.toFormat("a").toLowerCase()}`;
  return `${day} at ${time}`;
}
