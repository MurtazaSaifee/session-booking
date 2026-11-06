import { retryOnDeadlock, type Db } from "../db.js";
import { ErrorCode } from "../errors.js";
import { newRemindersCte, newRemindersParams } from "../reminders/new-reminders.js";
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

type BookingInput = { memberId: string; professionalId: string; start: Date; end: Date; now: Date };

// Two requests can both pass the check before either saves, so the database has the last word.
export function overlapRefusal(err: unknown): BookingRefusal | undefined {
  const pgError = err as { code?: string; constraint?: string };
  if (pgError.code !== "23P01") return undefined;
  if (pgError.constraint === "sessions_professional_overlap") return ErrorCode.SLOT_TAKEN;
  if (pgError.constraint === "sessions_member_overlap") return ErrorCode.MEMBER_OVERLAP;
  return undefined;
}

// One statement saves the session and its reminders, so either all of them exist or none do.
async function saveSession(db: Db, input: BookingInput): Promise<Session> {
  const result = await db.raw<{ rows: SessionRow[] }>(
    `
    with new_session as (
      insert into sessions (member_id, professional_id, starts_at, ends_at, status)
      values (:memberId, :professionalId, :start, :end, :booked)
      returning *
    ),
    ${newRemindersCte("new_session")}
    select * from new_session
    `,
    {
      ...input,
      ...newRemindersParams,
      booked: SessionStatus.BOOKED,
    },
  );
  const row = result.rows[0];
  return {
    id: row.id,
    professionalId: row.professional_id,
    start: row.starts_at,
    end: row.ends_at,
    status: row.status,
  };
}

export async function insertSession(
  db: Db,
  input: BookingInput,
): Promise<{ session: Session } | { refusal: BookingRefusal }> {
  try {
    return { session: await retryOnDeadlock(() => saveSession(db, input)) };
  } catch (err) {
    const refusal = overlapRefusal(err);
    if (refusal) return { refusal };
    throw err;
  }
}
