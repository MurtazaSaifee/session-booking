import { sessionTime } from "../session-time.js";

// Written when the reminder is delivered, so a late one still states the real time on the reader's own clock.
export function reminderText(reminder: { otherPersonName: string; start: Date; timezone: string }): string {
  return `Your session with ${reminder.otherPersonName} is on ${sessionTime(reminder.start, reminder.timezone)}`;
}
