import { Role } from "../roles";
import { SessionStatus, type MySession } from "./api";

export const TOO_LATE_MESSAGE =
  "This session starts in less than 24 hours, so it can't be cancelled or rescheduled. It's still booked.";

const MINUTE_MS = 60_000;
const CHANGE_NOTICE_MS = 24 * 60 * MINUTE_MS;

export const CancelButtonState = { HIDDEN: "HIDDEN", ENABLED: "ENABLED", DISABLED: "DISABLED" } as const;
export type CancelButtonState = (typeof CancelButtonState)[keyof typeof CancelButtonState];

// The server decides for real; this only keeps the screen from offering what it would refuse.
export function cancelButtonState(session: MySession, role: Role, now: Date): CancelButtonState {
  if (session.status !== SessionStatus.BOOKED) return CancelButtonState.HIDDEN;
  if (role === Role.PROFESSIONAL) return CancelButtonState.ENABLED;
  if (new Date(session.end) <= now) return CancelButtonState.HIDDEN;
  const untilStart = new Date(session.start).getTime() - now.getTime();
  return untilStart < CHANGE_NOTICE_MS ? CancelButtonState.DISABLED : CancelButtonState.ENABLED;
}
