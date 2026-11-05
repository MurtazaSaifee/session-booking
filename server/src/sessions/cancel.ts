import type { AppDeps } from "../app.js";
import { ErrorCode, HttpError } from "../errors.js";
import { Role, type SignedInUser } from "../roles.js";
import { SessionStatus } from "../session-status.js";
import { formatSessionTime } from "../session-time.js";
import { sessionIdOr404, sessionNotFound } from "./lookup.js";
import { cancelSession, findToCancel } from "./store.js";

const MINUTE_MS = 60_000;
const CHANGE_NOTICE_MS = 24 * 60 * MINUTE_MS;

// Real elapsed time, so a clock change can't shift it. Exactly 24 hours before the start is still allowed.
function tooLateForMember(start: Date, now: Date): boolean {
  return start.getTime() - now.getTime() < CHANGE_NOTICE_MS;
}

export async function cancelMySession(deps: AppDeps, viewer: SignedInUser, id: unknown): Promise<void> {
  const target = await findToCancel(deps.db, viewer, sessionIdOr404(id));
  if (!target) throw sessionNotFound();
  if (target.status === SessionStatus.CANCELLED) return;

  const now = deps.now();
  if (viewer.role === Role.MEMBER && tooLateForMember(target.start, now)) {
    throw new HttpError(
      409,
      ErrorCode.TOO_LATE_TO_CHANGE,
      "This session starts in less than 24 hours, so it can't be cancelled or rescheduled. It's still booked.",
    );
  }

  await cancelSession(deps.db, {
    id: target.id,
    cancelledBy: viewer.id,
    recipientId: target.otherPersonId,
    text: `${target.viewerName} cancelled your session on ${formatSessionTime(target.start, target.otherPersonTimezone)}`,
    now,
  });
}
