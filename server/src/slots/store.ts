import type { Db } from "../db.js";
import { Role } from "../roles.js";
import { SessionStatus } from "../session-status.js";
import { toTimeRange, type HoursColumns } from "../settings/hours.js";
import type { Interval, SlotInputs } from "./slots.js";

type BusyJson = { start: string; end: string }[];

type SlotInputsRow = {
  timezone: string;
  ranges: HoursColumns[];
  member_busy: BusyJson;
  professional_busy: BusyJson;
};

function toIntervals(busy: BusyJson): Interval[] {
  return busy.map((row) => ({ start: new Date(row.start), end: new Date(row.end) }));
}

// The hours, timezone and both busy lists as columns of one row. `u` is the professional. `:ignoreSessionId`
// leaves one session out of both busy lists (a move must not clash with itself); null leaves none out.
const SLOT_INPUT_COLUMNS = `
  u.timezone,
  coalesce((select json_agg(json_build_object(
              'weekday', h.weekday,
              'start_time', h.start_time,
              'end_time', h.end_time))
            from working_hours h
            where h.professional_id = u.id and h.deleted_at is null), '[]') as ranges,
  coalesce((select json_agg(json_build_object('start', s.starts_at, 'end', s.ends_at))
            from sessions s
            where s.member_id = :memberId and s.status = :booked and s.ends_at > :now
              and s.id is distinct from cast(:ignoreSessionId as uuid)), '[]')
    as member_busy,
  coalesce((select json_agg(json_build_object('start', s.starts_at, 'end', s.ends_at))
            from sessions s
            where s.professional_id = u.id and s.status = :booked and s.ends_at > :now
              and s.id is distinct from cast(:ignoreSessionId as uuid)), '[]')
    as professional_busy`;

function toSlotInputs(row: SlotInputsRow): SlotInputs {
  return {
    timezone: row.timezone,
    ranges: row.ranges.map(toTimeRange),
    memberBusy: toIntervals(row.member_busy),
    professionalBusy: toIntervals(row.professional_busy),
  };
}

// Raw SQL so the hours, timezone and both busy lists come back in one round trip, instead of one per table.
export async function findSlotInputs(
  db: Db,
  input: { professionalId: string; memberId: string; now: Date },
): Promise<SlotInputs | undefined> {
  const result = await db.raw<{ rows: SlotInputsRow[] }>(
    `
    select ${SLOT_INPUT_COLUMNS}
    from users u
    where u.id = :professionalId and u.role = :professional
    `,
    {
      memberId: input.memberId,
      professionalId: input.professionalId,
      now: input.now,
      ignoreSessionId: null,
      booked: SessionStatus.BOOKED,
      professional: Role.PROFESSIONAL,
    },
  );
  const row = result.rows[0];
  return row && toSlotInputs(row);
}

type RescheduleRow = SlotInputsRow & {
  session_id: string;
  session_status: SessionStatus;
  session_start: Date;
  professional_id: string;
  member_name: string;
};

export type RescheduleTarget = {
  id: string;
  status: SessionStatus;
  start: Date;
  professionalId: string;
  memberName: string;
};

// A member's own session and everything needed to check a new start for it, in one round trip. Only the
// member's own session matches, so another person's looks the same as a missing one.
export async function findToReschedule(
  db: Db,
  input: { sessionId: string; memberId: string; now: Date },
): Promise<{ session: RescheduleTarget; inputs: SlotInputs } | undefined> {
  const result = await db.raw<{ rows: RescheduleRow[] }>(
    `
    select ${SLOT_INPUT_COLUMNS},
      cur.id as session_id, cur.status as session_status, cur.starts_at as session_start,
      u.id as professional_id, me.name as member_name
    from sessions cur
    join users u on u.id = cur.professional_id
    join users me on me.id = cur.member_id
    where cur.id = :sessionId and cur.member_id = :memberId
    `,
    {
      sessionId: input.sessionId,
      ignoreSessionId: input.sessionId,
      memberId: input.memberId,
      now: input.now,
      booked: SessionStatus.BOOKED,
    },
  );
  const row = result.rows[0];
  return (
    row && {
      session: {
        id: row.session_id,
        status: row.session_status,
        start: row.session_start,
        professionalId: row.professional_id,
        memberName: row.member_name,
      },
      inputs: toSlotInputs(row),
    }
  );
}
