import type { AppDeps } from "../app.js";
import { ErrorCode, HttpError } from "../errors.js";
import { checkStart, refuse } from "../booking/rules.js";
import { retryOnDeadlock } from "../db.js";
import { overlapRefusal } from "../booking/store.js";
import type { SignedInUser } from "../roles.js";
import { SessionStatus } from "../session-status.js";
import { formatSessionTime } from "../session-time.js";
import { sessionEnd } from "../slots/slots.js";
import { findToReschedule } from "../slots/store.js";
import { refuseIfTooLateToChange } from "./change-notice.js";
import { sessionIdOr404, sessionNotFound } from "./lookup.js";
import { moveSession } from "./store.js";

export async function rescheduleMySession(
  deps: AppDeps,
  member: SignedInUser,
  id: unknown,
  start: Date,
): Promise<void> {
  const now = deps.now();
  const found = await findToReschedule(deps.db, { sessionId: sessionIdOr404(id), memberId: member.id, now });
  // A cancelled session can't be moved, and to the member it looks like one that isn't there.
  if (!found || found.session.status === SessionStatus.CANCELLED) throw sessionNotFound();
  const { session, inputs } = found;

  refuseIfTooLateToChange(session.start, now);
  if (start.getTime() === session.start.getTime()) {
    throw new HttpError(
      400,
      ErrorCode.VALIDATION,
      "That is already your session's time. Please pick another.",
    );
  }
  const refusal = checkStart({ start, now, ...inputs });
  if (refusal) throw refuse(refusal);

  try {
    // A booking for the same time can leave the two waiting on each other. The retry gets the normal refusal.
    const moved = await retryOnDeadlock(() =>
      moveSession(deps.db, {
        id: session.id,
        currentStart: session.start,
        start,
        end: sessionEnd(start),
        recipientId: session.professionalId,
        text: `${session.memberName} moved your session from ${formatSessionTime(session.start, inputs.timezone)} to ${formatSessionTime(start, inputs.timezone)}`,
        now,
      }),
    );
    if (!moved) throw sessionNotFound();
  } catch (err) {
    const lost = overlapRefusal(err);
    if (lost) throw refuse(lost);
    throw err;
  }
}
