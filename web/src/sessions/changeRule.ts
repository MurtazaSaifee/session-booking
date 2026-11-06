import { Role } from "../roles";
import { SessionStatus, type MySession } from "./api";

export const TOO_LATE_MESSAGE =
  "This session starts in less than 24 hours, so it can't be cancelled or rescheduled. It's still booked.";

const MINUTE_MS = 60_000;
const CHANGE_NOTICE_MS = 24 * 60 * MINUTE_MS;

export const ChangeButtonState = { HIDDEN: "HIDDEN", ENABLED: "ENABLED", DISABLED: "DISABLED" } as const;
export type ChangeButtonState = (typeof ChangeButtonState)[keyof typeof ChangeButtonState];

// The server decides for real; this only keeps the screen from offering what it would refuse.
export function changeButtonState(session: MySession, role: Role, now: Date): ChangeButtonState {
  if (session.status !== SessionStatus.BOOKED) return ChangeButtonState.HIDDEN;
  if (role === Role.PROFESSIONAL) return ChangeButtonState.ENABLED;
  if (new Date(session.end) <= now) return ChangeButtonState.HIDDEN;
  const untilStart = new Date(session.start).getTime() - now.getTime();
  return untilStart < CHANGE_NOTICE_MS ? ChangeButtonState.DISABLED : ChangeButtonState.ENABLED;
}
