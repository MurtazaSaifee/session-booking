import { Role } from "../roles";
import { SessionStatus, type MySession } from "./api";

export const TOO_LATE_MESSAGE =
  "This session starts in less than 24 hours, so it can't be cancelled or rescheduled. It's still booked.";

const CHANGE_NOTICE_MS = 24 * 60 * 60 * 1000;

export const CancelButton = { HIDDEN: "HIDDEN", ENABLED: "ENABLED", DISABLED: "DISABLED" } as const;
export type CancelButton = (typeof CancelButton)[keyof typeof CancelButton];

// The server decides for real; this only keeps the screen from offering what it would refuse.
export function cancelButton(session: MySession, role: Role, now: Date): CancelButton {
  if (session.status !== SessionStatus.BOOKED) return CancelButton.HIDDEN;
  if (role === Role.PROFESSIONAL) return CancelButton.ENABLED;
  if (new Date(session.end) <= now) return CancelButton.HIDDEN;
  const untilStart = new Date(session.start).getTime() - now.getTime();
  return untilStart < CHANGE_NOTICE_MS ? CancelButton.DISABLED : CancelButton.ENABLED;
}
