import type { Db } from "../db.js";
import { ReminderStatus } from "./reminder-values.js";

export type DueReminder = {
  id: string;
  recipientId: string;
  start: Date;
  timezone: string;
  otherPersonName: string;
};

export type Delivery = { reminderId: string; recipientId: string; text: string };

// Run inside a transaction: the locks last until it ends. Rows another checker holds are skipped, not waited
// for. If that checker has just finished, Postgres re-checks the status and drops the row as no longer pending.
export async function claimDueReminders(trx: Db, now: Date, limit: number): Promise<DueReminder[]> {
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

export async function saveOutcomes(
  trx: Db,
  outcomes: { deliveries: Delivery[]; skippedIds: string[]; now: Date },
): Promise<void> {
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
      now: outcomes.now,
      deliveries: JSON.stringify(outcomes.deliveries),
      sent: ReminderStatus.SENT,
      skipped: ReminderStatus.SKIPPED,
      skippedIds: outcomes.skippedIds,
    },
  );
}
