import type { AppDeps } from "../app.js";
import { Role, type SignedInUser } from "../roles.js";
import { SessionStatus } from "../session-status.js";
import { formatSessionTime } from "../session-time.js";
import { refuseIfTooLateToChange } from "./change-notice.js";
import { sessionIdOr404, sessionNotFound } from "./lookup.js";
import { cancelSession, findToCancel } from "./store.js";

export async function cancelMySession(deps: AppDeps, viewer: SignedInUser, id: unknown): Promise<void> {
  const target = await findToCancel(deps.db, viewer, sessionIdOr404(id));
  if (!target) throw sessionNotFound();
  if (target.status === SessionStatus.CANCELLED) return;

  const now = deps.now();
  if (viewer.role === Role.MEMBER) refuseIfTooLateToChange(target.start, now);

  await cancelSession(deps.db, {
    id: target.id,
    cancelledBy: viewer.id,
    recipientId: target.otherPersonId,
    text: `${target.viewerName} cancelled your session on ${formatSessionTime(target.start, target.otherPersonTimezone)}`,
    now,
  });
}
