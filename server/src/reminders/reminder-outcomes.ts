import { reminderText } from "./reminder-text.js";

export type DueReminder = {
  id: string;
  recipientId: string;
  sessionId: string;
  start: Date;
  timezone: string;
  otherPersonName: string;
  sessionCancelled: boolean;
};

export type Delivery = { reminderId: string; recipientId: string; sessionId: string; text: string };

export type ReminderOutcomes = { deliveries: Delivery[]; skippedIds: string[] };

// A reminder is only worth sending before its session starts, however late the check runs, and never for a
// cancelled session: a cancel that races a move can leave the new reminders pending.
export function decideOutcomes(due: DueReminder[], now: Date): ReminderOutcomes {
  const outcomes: ReminderOutcomes = { deliveries: [], skippedIds: [] };
  for (const reminder of due) {
    if (reminder.start > now && !reminder.sessionCancelled) {
      outcomes.deliveries.push({
        reminderId: reminder.id,
        recipientId: reminder.recipientId,
        sessionId: reminder.sessionId,
        text: reminderText(reminder),
      });
    } else {
      outcomes.skippedIds.push(reminder.id);
    }
  }
  return outcomes;
}
