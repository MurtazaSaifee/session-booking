import type { Db } from "../db.js";
import type { Interval } from "../directory/slots.js";
import { Role } from "../roles.js";
import type { TimeRange } from "../settings/hours.js";
import { SessionStatus } from "./status.js";

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

export type BookingContext = {
  timezone: string;
  ranges: TimeRange[];
  memberBusy: Interval[];
  professionalBusy: Interval[];
};

type BusyJson = { start: string; end: string }[];

type BookingContextRow = {
  timezone: string;
  ranges: TimeRange[];
  member_busy: BusyJson;
  professional_busy: BusyJson;
};

function toIntervals(busy: BusyJson): Interval[] {
  return busy.map((row) => ({ start: new Date(row.start), end: new Date(row.end) }));
}

// Raw SQL so everything a booking needs comes back in one round trip, instead of one per table.
export async function findBookingContext(
  db: Db,
  input: { professionalId: string; memberId: string; now: Date },
): Promise<BookingContext | undefined> {
  const result = await db.raw<{ rows: BookingContextRow[] }>(
    `
    select u.timezone,
      coalesce((select json_agg(json_build_object(
                  'weekday', h.weekday,
                  'start', left(cast(h.start_time as text), 5),
                  'end', left(cast(h.end_time as text), 5)))
                from working_hours h
                where h.professional_id = u.id and h.deleted_at is null), '[]') as ranges,
      coalesce((select json_agg(json_build_object('start', s.starts_at, 'end', s.ends_at))
                from sessions s
                where s.member_id = :memberId and s.status = :booked and s.ends_at > :now), '[]')
        as member_busy,
      coalesce((select json_agg(json_build_object('start', s.starts_at, 'end', s.ends_at))
                from sessions s
                where s.professional_id = u.id and s.status = :booked and s.ends_at > :now), '[]')
        as professional_busy
    from users u
    where u.id = :professionalId and u.role = :professional
    `,
    {
      memberId: input.memberId,
      professionalId: input.professionalId,
      now: input.now,
      booked: SessionStatus.BOOKED,
      professional: Role.PROFESSIONAL,
    },
  );
  const row = result.rows[0];
  if (!row) return undefined;
  return {
    timezone: row.timezone,
    ranges: row.ranges,
    memberBusy: toIntervals(row.member_busy),
    professionalBusy: toIntervals(row.professional_busy),
  };
}

export async function insertSession(
  db: Db,
  input: { memberId: string; professionalId: string; start: Date; end: Date },
): Promise<Session> {
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
    id: row.id,
    professionalId: row.professional_id,
    start: row.starts_at,
    end: row.ends_at,
    status: row.status,
  };
}
