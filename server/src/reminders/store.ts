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
    const outcomes = decideOutcomes(due, now);
    const saved = await saveOutcomes(trx, outcomes, now);
    if (saved < outcomes.deliveries.length) {
      console.error("A reminder came up for delivery twice. Its unique reference stopped the second one.");
    }
    return due.length;
  });
}

// The locks last until the transaction ends. Rows another checker holds are skipped, not waited
// for. If that checker has just finished, Postgres re-checks the status and drops the row as no longer pending.
async function claimDueReminders(trx: Knex.Transaction, now: Date, limit: number): Promise<DueReminder[]> {
  const result = await trx.raw<{ rows: DueReminder[] }>(
    `
    select r.id, r.recipient_id as "recipientId", r.session_id as "sessionId", s.starts_at as start, recipient.timezone,
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

// Returns how many notifications it added. The unique reminder reference is the backstop against a second
// delivery. Skipping the conflict, rather than failing on it, marks that reminder sent, so one bad row can't
// roll back its batch on every run and stop everyone's reminders.
async function saveOutcomes(trx: Knex.Transaction, outcomes: ReminderOutcomes, now: Date): Promise<number> {
  const result = await trx.raw<{ rows: { saved: string }[] }>(
    `
    with deliveries as (
      select * from jsonb_to_recordset(cast(:deliveries as jsonb))
        as d ("reminderId" uuid, "recipientId" uuid, "sessionId" uuid, text text)
    ),
    delivered as (
      insert into notifications (recipient_id, reminder_id, session_id, text, created_at)
      select d."recipientId", d."reminderId", d."sessionId", d.text, cast(:now as timestamptz)
      from deliveries d
      on conflict (reminder_id) do nothing
      returning reminder_id
    ),
    sent as (
      update reminders set status = :sent, sent_at = coalesce(sent_at, cast(:now as timestamptz))
      where id in (select "reminderId" from deliveries)
    ),
    skipped as (
      update reminders set status = :skipped
      where id = any(cast(:skippedIds as uuid[]))
    )
    select count(*) as saved from delivered
    `,
    {
      now,
      deliveries: JSON.stringify(outcomes.deliveries),
      sent: ReminderStatus.SENT,
      skipped: ReminderStatus.SKIPPED,
      skippedIds: outcomes.skippedIds,
    },
  );
  return Number(result.rows[0].saved);
}
