import type { Db } from "../db.js";
import { ReminderStatus } from "../reminders/reminder-values.js";
import { SessionStatus } from "../session-status.js";

export type CancelTarget = {
  id: string;
  status: SessionStatus;
  start: Date;
  viewerName: string;
  otherPersonId: string;
  otherPersonTimezone: string;
};

// Only a session the viewer is part of is found, so someone else's looks like a missing one.
export async function findToCancel(db: Db, viewerId: string, id: string): Promise<CancelTarget | undefined> {
  const result = await db.raw<{ rows: CancelTarget[] }>(
    `
    select s.id, s.status, s.starts_at as start, me.name as "viewerName",
      other.id as "otherPersonId", other.timezone as "otherPersonTimezone"
    from sessions s
    join users me on me.id = :viewerId
    join users other on other.id = case when s.member_id = me.id then s.professional_id else s.member_id end
    where s.id = :id and (s.member_id = me.id or s.professional_id = me.id)
    `,
    { viewerId, id },
  );
  return result.rows[0];
}

type CancelInput = { id: string; cancelledBy: string; recipientId: string; text: string; now: Date };

// One statement, so the session, its reminders and the notice all change together or not at all. The status
// check makes a second cancel at the same moment do nothing, and a reminder the checker is delivering at that
// moment is waited for, not cancelled.
export async function cancelSession(db: Db, input: CancelInput): Promise<void> {
  await db.raw(
    `
    with cancelled as (
      update sessions
      set status = :cancelled, cancelled_by = :cancelledBy, cancelled_at = :now, updated_at = :now
      where id = :id and status = :booked
      returning id
    ),
    cancelled_reminders as (
      update reminders set status = :reminderCancelled
      where session_id in (select id from cancelled) and status = :pending
    ),
    notice as (
      insert into notifications (recipient_id, session_id, text, created_at)
      select :recipientId, id, :text, cast(:now as timestamptz) from cancelled
    )
    select id from cancelled
    `,
    {
      ...input,
      booked: SessionStatus.BOOKED,
      cancelled: SessionStatus.CANCELLED,
      pending: ReminderStatus.PENDING,
      reminderCancelled: ReminderStatus.CANCELLED,
    },
  );
}
