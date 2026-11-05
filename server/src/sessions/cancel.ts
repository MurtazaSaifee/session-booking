import type { AppDeps } from "../app.js";
import { ErrorCode, HttpError } from "../errors.js";
import { Role, type SignedInUser } from "../roles.js";
import { sessionTime } from "../session-time.js";
import { SessionStatus } from "../session-status.js";
import { cancelSession, findToCancel } from "./cancel-store.js";
import { sessionNotFound } from "./lookup.js";
import { sessionIdSchema } from "./schemas.js";

const CHANGE_NOTICE_MS = 24 * 60 * 60 * 1000;

// Real elapsed time, so a clock change can't shift it. Exactly 24 hours before the start is still allowed.
function tooLateForMember(start: Date, now: Date): boolean {
  return start.getTime() - now.getTime() < CHANGE_NOTICE_MS;
}

export async function cancelMySession(deps: AppDeps, viewer: SignedInUser, id: unknown): Promise<void> {
  const parsed = sessionIdSchema.safeParse(id);
  const target = parsed.success ? await findToCancel(deps.db, viewer.id, parsed.data) : undefined;
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
    text: `${target.viewerName} cancelled your session on ${sessionTime(target.start, target.otherPersonTimezone)}`,
    now,
  });
}
