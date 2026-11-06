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

export type ReminderOutcomes = { deliveries: Delivery[]; skippedIds: string[]; cancelledIds: string[] };

// A reminder is only worth sending before its session starts, however late the check runs. A cancelled
// session's reminders are cancelled with it, so one still pending here is a backstop catch: it is cancelled, never sent.
export function decideOutcomes(due: DueReminder[], now: Date): ReminderOutcomes {
  const outcomes: ReminderOutcomes = { deliveries: [], skippedIds: [], cancelledIds: [] };
  for (const reminder of due) {
    if (reminder.sessionCancelled) {
      outcomes.cancelledIds.push(reminder.id);
    } else if (reminder.start > now) {
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
