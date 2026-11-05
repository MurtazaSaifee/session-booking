import type { Db } from "../db.js";
import { reminderText } from "./reminder-text.js";
import { claimDueReminders, saveOutcomes, type Delivery } from "./store.js";

const BATCH_SIZE = 100;

// Saving the notification and marking the reminder sent commit together, which is what makes delivery exactly
// once. Returns how many reminders it claimed.
export function deliverBatch(db: Db, now: Date, limit: number): Promise<number> {
  return db.transaction(async (trx) => {
    const due = await claimDueReminders(trx, now, limit);
    if (due.length === 0) return 0;

    const deliveries: Delivery[] = [];
    const skippedIds: string[] = [];
    for (const reminder of due) {
      if (reminder.start > now) {
        deliveries.push({
          reminderId: reminder.id,
          recipientId: reminder.recipientId,
          text: reminderText(reminder),
        });
      } else {
        skippedIds.push(reminder.id);
      }
    }
    await saveOutcomes(trx, { deliveries, skippedIds, now });
    return due.length;
  });
}

// Each batch is its own short transaction, so a long backlog never holds its locks for the whole run.
export async function deliverDueReminders(db: Db, now: Date, batchSize = BATCH_SIZE): Promise<void> {
  let claimed: number;
  do {
    claimed = await deliverBatch(db, now, batchSize);
  } while (claimed === batchSize);
}
