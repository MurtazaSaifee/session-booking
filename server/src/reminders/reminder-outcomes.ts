import { reminderText } from "./reminder-text.js";

export type DueReminder = {
  id: string;
  recipientId: string;
  start: Date;
  timezone: string;
  otherPersonName: string;
};

export type Delivery = { reminderId: string; recipientId: string; text: string };

export type ReminderOutcomes = { deliveries: Delivery[]; skippedIds: string[] };

// A reminder is only worth sending before its session starts, however late the check runs.
export function decideOutcomes(due: DueReminder[], now: Date): ReminderOutcomes {
  const outcomes: ReminderOutcomes = { deliveries: [], skippedIds: [] };
  for (const reminder of due) {
    if (reminder.start > now) {
      outcomes.deliveries.push({
        reminderId: reminder.id,
        recipientId: reminder.recipientId,
        text: reminderText(reminder),
      });
    } else {
      outcomes.skippedIds.push(reminder.id);
    }
  }
  return outcomes;
}
