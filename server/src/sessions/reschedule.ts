import type { AppDeps } from "../app.js";
import { checkStart, refuse } from "../booking/rules.js";
import { overlapRefusal } from "../booking/store.js";
import { retryOnDeadlock } from "../db.js";
import { ErrorCode, HttpError } from "../errors.js";
import type { SignedInUser } from "../roles.js";
import { formatSessionTime } from "../session-time.js";
import { sessionEnd } from "../slots/slots.js";
import { refuseIfTooLateToChange } from "./change-notice.js";
import { sessionIdOr404, sessionNotFound } from "./lookup.js";
import { findToReschedule, moveSession } from "./store.js";

// Another change to the session between the read and the save makes the move miss. The second try reads the
// session as it is now and checks everything again, so a cancel gives a 404 and another move is built on.
export async function rescheduleMySession(
  deps: AppDeps,
  member: SignedInUser,
  id: unknown,
  start: Date,
): Promise<void> {
  const sessionId = sessionIdOr404(id);
  if (await tryReschedule(deps, member, sessionId, start)) return;
  if (await tryReschedule(deps, member, sessionId, start)) return;
  throw sessionNotFound();
}

// Returns false when the session changed after it was read.
async function tryReschedule(
  deps: AppDeps,
  member: SignedInUser,
  sessionId: string,
  start: Date,
): Promise<boolean> {
  const now = deps.now();
  const found = await findToReschedule(deps.db, { sessionId, memberId: member.id, now });
  if (!found) throw sessionNotFound();
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
    // Two moves to the same time can leave the two waiting on each other. The retry gets the normal refusal.
    return await retryOnDeadlock(() =>
      moveSession(deps.db, {
        id: session.id,
        version: session.version,
        start,
        end: sessionEnd(start),
        recipientId: session.professionalId,
        text: `${session.memberName} moved your session from ${formatSessionTime(session.start, inputs.timezone)} to ${formatSessionTime(start, inputs.timezone)}`,
        now,
      }),
    );
  } catch (err) {
    const lost = overlapRefusal(err);
    if (lost) throw refuse(lost);
    throw err;
  }
}
