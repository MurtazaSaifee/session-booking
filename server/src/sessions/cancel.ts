import type { AppDeps } from "../app.js";
import { ErrorCode, HttpError } from "../errors.js";
import { Role, type SignedInUser } from "../roles.js";
import { SessionStatus } from "../session-status.js";
import { formatSessionTime } from "../session-time.js";
import { refuseIfTooLateToChange } from "./change-notice.js";
import { sessionIdOr404, sessionNotFound } from "./lookup.js";
import { cancelSession, findToCancel } from "./store.js";

// A move between the read and the save makes the cancel miss. The second try reads the session as it is now,
// so the 24-hour rule and the notice's time are the move's, not the old ones.
export async function cancelMySession(deps: AppDeps, viewer: SignedInUser, id: unknown): Promise<void> {
  const sessionId = sessionIdOr404(id);
  if (await tryCancel(deps, viewer, sessionId)) return;
  if (await tryCancel(deps, viewer, sessionId)) return;
  throw sessionNotFound();
}

// Returns false when the session changed after it was read.
async function tryCancel(deps: AppDeps, viewer: SignedInUser, sessionId: string): Promise<boolean> {
  const target = await findToCancel(deps.db, viewer, sessionId);
  if (!target) throw sessionNotFound();
  if (target.status === SessionStatus.CANCELLED) return true;

  const now = deps.now();
  if (target.end <= now) {
    throw new HttpError(400, ErrorCode.VALIDATION, "A session that has already ended cannot be cancelled.");
  }
  if (viewer.role === Role.MEMBER) refuseIfTooLateToChange(target.start, now);

  return cancelSession(deps.db, {
    id: target.id,
    version: target.version,
    cancelledBy: viewer.id,
    recipientId: target.otherPersonId,
    text: `${target.viewerName} cancelled your session on ${formatSessionTime(target.start, target.otherPersonTimezone)}`,
    now,
  });
}
