import type { Knex } from "knex";
import type { Db } from "../db.js";
import { decideOutcomes, type DueReminder, type ReminderOutcomes } from "./reminder-outcomes.js";
import { ReminderStatus } from "./reminder-values.js";

// Saving the notification and marking the reminder sent commit together, which is what makes delivery exactly
// once. Returns how many reminders it claimed.
export function deliverBatch(db: Db, now: Date, limit: number): Promise<number> {
  return db.transaction(async (trx) => {
    const due = await claimDueReminders(trx, now, limit);
    if (due.length === 0) return 0;
    await saveOutcomes(trx, decideOutcomes(due, now), now);
    return due.length;
  });
}

// The locks last until the transaction ends. Rows another checker holds are skipped, not waited
// for. If that checker has just finished, Postgres re-checks the status and drops the row as no longer pending.
async function claimDueReminders(trx: Knex.Transaction, now: Date, limit: number): Promise<DueReminder[]> {
  const result = await trx.raw<{ rows: DueReminder[] }>(
    `
    select r.id, r.recipient_id as "recipientId", s.starts_at as start, recipient.timezone,
      other.name as "otherPersonName"
    from reminders r
    join sessions s on s.id = r.session_id
    join users recipient on recipient.id = r.recipient_id
    join users other
      on other.id = case when r.recipient_id = s.member_id then s.professional_id else s.member_id end
    where r.status = :pending and r.due_at <= :now
    order by r.due_at
    limit :limit
    for update of r skip locked
    `,
    { pending: ReminderStatus.PENDING, now, limit },
  );
  return result.rows;
}

async function saveOutcomes(trx: Knex.Transaction, outcomes: ReminderOutcomes, now: Date): Promise<void> {
  await trx.raw(
    `
    with delivered as (
      insert into notifications (recipient_id, reminder_id, text, created_at)
      select d."recipientId", d."reminderId", d.text, cast(:now as timestamptz)
      from jsonb_to_recordset(cast(:deliveries as jsonb))
        as d ("reminderId" uuid, "recipientId" uuid, text text)
      returning reminder_id
    ),
    sent as (
      update reminders set status = :sent, sent_at = :now
      where id in (select reminder_id from delivered)
    )
    update reminders set status = :skipped
    where id = any(cast(:skippedIds as uuid[]))
    `,
    {
      now,
      deliveries: JSON.stringify(outcomes.deliveries),
      sent: ReminderStatus.SENT,
      skipped: ReminderStatus.SKIPPED,
      skippedIds: outcomes.skippedIds,
    },
  );
}
