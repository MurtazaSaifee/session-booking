import type { Db } from "../../src/db.js";
import { ReminderKind, ReminderStatus } from "../../src/reminders/reminder-values.js";

// Gives a person one delivered notification per time. Booking enough sessions through the API to fill a list
// would mean clearing the way for every slot, and these tests are about the list.
export async function giveNotifications(db: Db, sessionId: string, recipientId: string, times: string[]) {
  const reminders: { id: string }[] = await db("reminders")
    .insert(
      times.map((time) => ({
        session_id: sessionId,
        recipient_id: recipientId,
        kind: ReminderKind.HOUR_BEFORE,
        due_at: new Date(time),
        status: ReminderStatus.SENT,
      })),
    )
    .returning("id");
  await db("notifications").insert(
    reminders.map((reminder, index) => ({
      recipient_id: recipientId,
      reminder_id: reminder.id,
      session_id: sessionId,
      text: `Notification ${index}`,
      created_at: new Date(times[index]),
    })),
  );
}
