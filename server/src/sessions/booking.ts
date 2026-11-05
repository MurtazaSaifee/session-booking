import { ErrorCode } from "../errors.js";
import type { TimeRange } from "../settings/hours.js";
import { SESSION_MINUTES, bookingWindowEnd, buildSlots, overlaps, type Interval } from "../slots/slots.js";

const MINUTE_MS = 60_000;

export function sessionEnd(start: Date): Date {
  return new Date(start.getTime() + SESSION_MINUTES * MINUTE_MS);
}

export type BookingRefusal =
  typeof ErrorCode.SLOT_NOT_AVAILABLE | typeof ErrorCode.MEMBER_OVERLAP | typeof ErrorCode.SLOT_TAKEN;

// Returns why a start time can't be booked, or null if it can.
// The member's own clash is checked before the professional's, so someone retrying a booking
// that already went through is told they already have that session, not that someone else took it.
export function checkStart(input: {
  start: Date;
  ranges: TimeRange[];
  timezone: string;
  now: Date;
  memberBusy: Interval[];
  professionalBusy: Interval[];
}): BookingRefusal | null {
  const { start, ranges, timezone, now, memberBusy, professionalBusy } = input;
  const slot = buildSlots({ ranges, timezone, now, windowEnd: bookingWindowEnd(now), busy: [] }).find(
    (candidate) => candidate.start.getTime() === start.getTime(),
  );

  if (!slot) return ErrorCode.SLOT_NOT_AVAILABLE;
  if (memberBusy.some((interval) => overlaps(slot, interval))) return ErrorCode.MEMBER_OVERLAP;
  if (professionalBusy.some((interval) => overlaps(slot, interval))) return ErrorCode.SLOT_TAKEN;
  return null;
}
