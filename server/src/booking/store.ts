import type { Db } from "../db.js";
import { ErrorCode } from "../errors.js";
import { REMINDER_LEAD_TIME, ReminderKind, ReminderStatus } from "../reminders/reminder-values.js";
import { SessionStatus } from "../session-status.js";
import type { BookingRefusal } from "./rules.js";

type SessionRow = {
  id: string;
  member_id: string;
  professional_id: string;
  starts_at: Date;
  ends_at: Date;
  status: SessionStatus;
};

export type Session = {
  id: string;
  professionalId: string;
  start: Date;
  end: Date;
  status: SessionStatus;
};

// Two requests can both pass the check before either saves, so the database has the last word.
function overlapRefusal(err: unknown): BookingRefusal | undefined {
  const pgError = err as { code?: string; constraint?: string };
  if (pgError.code !== "23P01") return undefined;
  if (pgError.constraint === "sessions_professional_overlap") return ErrorCode.SLOT_TAKEN;
  if (pgError.constraint === "sessions_member_overlap") return ErrorCode.MEMBER_OVERLAP;
  return undefined;
}

// One statement saves the session and its reminders, so either all of them exist or none do.
export async function insertSession(
  db: Db,
  input: { memberId: string; professionalId: string; start: Date; end: Date; now: Date },
): Promise<{ session: Session } | { refusal: BookingRefusal }> {
  try {
    const result = await db.raw<{ rows: SessionRow[] }>(
      `
      with new_session as (
        insert into sessions (member_id, professional_id, starts_at, ends_at, status)
        values (:memberId, :professionalId, :start, :end, :booked)
        returning *
      ),
      new_reminders as (
        insert into reminders (session_id, recipient_id, kind, due_at, status)
        select s.id, recipient.id, reminder.kind, s.starts_at - reminder.lead_time, :pending
        from new_session s
        cross join lateral (values (s.member_id), (s.professional_id)) as recipient (id)
        cross join (
          values
            (:dayBefore, cast(:dayBeforeLeadTime as interval)),
            (:hourBefore, cast(:hourBeforeLeadTime as interval))
        ) as reminder (kind, lead_time)
        where s.starts_at - reminder.lead_time > :now
      )
      select * from new_session
      `,
      {
        ...input,
        booked: SessionStatus.BOOKED,
        pending: ReminderStatus.PENDING,
        dayBefore: ReminderKind.DAY_BEFORE,
        hourBefore: ReminderKind.HOUR_BEFORE,
        dayBeforeLeadTime: REMINDER_LEAD_TIME[ReminderKind.DAY_BEFORE],
        hourBeforeLeadTime: REMINDER_LEAD_TIME[ReminderKind.HOUR_BEFORE],
      },
    );
    const row = result.rows[0];
    return {
      session: {
        id: row.id,
        professionalId: row.professional_id,
        start: row.starts_at,
        end: row.ends_at,
        status: row.status,
      },
    };
  } catch (err) {
    const refusal = overlapRefusal(err);
    if (refusal) return { refusal };
    throw err;
  }
}
