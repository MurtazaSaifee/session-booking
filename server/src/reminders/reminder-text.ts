import { DateTime } from "luxon";

// Written when the reminder is delivered, so a late one still states the real time on the reader's own clock.
export function reminderText(reminder: { otherPersonName: string; start: Date; timezone: string }): string {
  const local = DateTime.fromJSDate(reminder.start, { zone: reminder.timezone }).setLocale("en-US");
  const day = local.toFormat("ccc d LLL");
  const time = `${local.toFormat("h:mm")}${local.toFormat("a").toLowerCase()}`;
  return `Your session with ${reminder.otherPersonName} is on ${day} at ${time}`;
}
