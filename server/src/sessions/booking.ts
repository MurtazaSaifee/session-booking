import { bookingWindowEnd, buildSlots, type Interval } from "../directory/slots.js";
import { ErrorCode } from "../errors.js";
import type { TimeRange } from "../settings/hours.js";

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
  const windowEnd = bookingWindowEnd(now);
  const isSlot = (busy: Interval[]) =>
    buildSlots({ ranges, timezone, now, windowEnd, busy }).some(
      (slot) => slot.start.getTime() === start.getTime(),
    );

  if (!isSlot([])) return ErrorCode.SLOT_NOT_AVAILABLE;
  if (!isSlot(memberBusy)) return ErrorCode.MEMBER_OVERLAP;
  if (!isSlot(professionalBusy)) return ErrorCode.SLOT_TAKEN;
  return null;
}
