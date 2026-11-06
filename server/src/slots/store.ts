import type { Db } from "../db.js";
import { Role } from "../roles.js";
import { SessionStatus } from "../session-status.js";
import { toTimeRange, type HoursColumns } from "../settings/hours.js";
import { DEFAULT_MINIMUM_NOTICE_MINUTES, type Interval, type SlotInputs } from "./slots.js";

type BusyJson = { start: string; end: string }[];

export type SlotInputsRow = {
  timezone: string;
  ranges: HoursColumns[];
  minimum_notice_minutes: number | null;
  member_busy: BusyJson;
  professional_busy: BusyJson;
};

function toIntervals(busy: BusyJson): Interval[] {
  return busy.map((row) => ({ start: new Date(row.start), end: new Date(row.end) }));
}

// The hours, timezone, minimum notice and both busy lists as columns of one row. `u` is the professional.
// `:ignoreSessionId` leaves one session out of both busy lists (a move must not clash with itself), but only if
// it is the member's own, so naming someone else's session can't reveal that it is there. Null leaves none out.
export const SLOT_INPUT_COLUMNS = `
  u.timezone,
  u.minimum_notice_minutes,
  coalesce((select json_agg(json_build_object(
              'weekday', h.weekday,
              'start_time', h.start_time,
              'end_time', h.end_time))
            from working_hours h
            where h.professional_id = u.id and h.deleted_at is null), '[]') as ranges,
  coalesce((select json_agg(json_build_object('start', s.starts_at, 'end', s.ends_at))
            from sessions s
            where s.member_id = :memberId and s.status = :booked and s.ends_at > :now
              and (s.id is distinct from cast(:ignoreSessionId as uuid) or s.member_id <> :memberId)), '[]')
    as member_busy,
  coalesce((select json_agg(json_build_object('start', s.starts_at, 'end', s.ends_at))
            from sessions s
            where s.professional_id = u.id and s.status = :booked and s.ends_at > :now
              and (s.id is distinct from cast(:ignoreSessionId as uuid) or s.member_id <> :memberId)), '[]')
    as professional_busy`;

export function toSlotInputs(row: SlotInputsRow): SlotInputs {
  return {
    timezone: row.timezone,
    ranges: row.ranges.map(toTimeRange),
    minimumNoticeMinutes: row.minimum_notice_minutes ?? DEFAULT_MINIMUM_NOTICE_MINUTES,
    memberBusy: toIntervals(row.member_busy),
    professionalBusy: toIntervals(row.professional_busy),
  };
}

// Raw SQL so everything a slot is worked out from comes back in one round trip, instead of one per table.
export async function findSlotInputs(
  db: Db,
  input: { professionalId: string; memberId: string; now: Date; ignoreSessionId?: string },
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
      ignoreSessionId: input.ignoreSessionId ?? null,
      booked: SessionStatus.BOOKED,
      professional: Role.PROFESSIONAL,
    },
  );
  const row = result.rows[0];
  return row && toSlotInputs(row);
}
