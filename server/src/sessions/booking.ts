import { ErrorCode } from "../errors.js";
import { bookingWindowEnd, buildSlots, overlaps, type SlotInputs } from "../slots/slots.js";

export type BookingRefusal =
  typeof ErrorCode.SLOT_NOT_AVAILABLE | typeof ErrorCode.MEMBER_OVERLAP | typeof ErrorCode.SLOT_TAKEN;

// The member's own clash is checked before the professional's, so someone retrying after their
// session already went through is told they already have it, not that someone else took it.
export function checkStart(input: SlotInputs & { start: Date; now: Date }): BookingRefusal | null {
  const { start, ranges, timezone, now, memberBusy, professionalBusy } = input;
  const slot = buildSlots({ ranges, timezone, now, windowEnd: bookingWindowEnd(now), busy: [] }).find(
    (candidate) => candidate.start.getTime() === start.getTime(),
  );

  if (!slot) return ErrorCode.SLOT_NOT_AVAILABLE;
  if (memberBusy.some((interval) => overlaps(slot, interval))) return ErrorCode.MEMBER_OVERLAP;
  if (professionalBusy.some((interval) => overlaps(slot, interval))) return ErrorCode.SLOT_TAKEN;
  return null;
}
