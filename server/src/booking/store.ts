import type { Db } from "../db.js";
import { ErrorCode } from "../errors.js";
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

export async function insertSession(
  db: Db,
  input: { memberId: string; professionalId: string; start: Date; end: Date },
): Promise<{ session: Session } | { refusal: BookingRefusal }> {
  try {
    const [row]: SessionRow[] = await db<SessionRow>("sessions")
      .insert({
        member_id: input.memberId,
        professional_id: input.professionalId,
        starts_at: input.start,
        ends_at: input.end,
        status: SessionStatus.BOOKED,
      })
      .returning("*");
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
