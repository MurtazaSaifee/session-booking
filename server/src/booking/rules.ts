import { ErrorCode, HttpError } from "../errors.js";
import { bookingWindowEnd, buildSlots, overlaps, type SlotInputs } from "../slots/slots.js";

const refusals = {
  [ErrorCode.SLOT_NOT_AVAILABLE]: { status: 422, message: "That time isn't available." },
  [ErrorCode.MEMBER_OVERLAP]: { status: 409, message: "You already have a session at that time." },
  [ErrorCode.SLOT_TAKEN]: { status: 409, message: "That time was just booked. Please pick another." },
};

export type BookingRefusal = keyof typeof refusals;

export function refuse(refusal: BookingRefusal): HttpError {
  return new HttpError(refusals[refusal].status, refusal, refusals[refusal].message);
}

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
