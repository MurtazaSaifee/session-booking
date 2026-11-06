import { ErrorCode, HttpError } from "../errors.js";

const MINUTE_MS = 60_000;
const CHANGE_NOTICE_MS = 24 * 60 * MINUTE_MS;

// Real elapsed time, so a clock change can't shift it. Exactly 24 hours before the start is still allowed.
export function refuseIfTooLateToChange(start: Date, now: Date): void {
  if (start.getTime() - now.getTime() < CHANGE_NOTICE_MS) {
    throw new HttpError(
      409,
      ErrorCode.TOO_LATE_TO_CHANGE,
      "This session starts in less than 24 hours, so it can't be cancelled or rescheduled. It's still booked.",
    );
  }
}
