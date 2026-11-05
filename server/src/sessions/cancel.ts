import type { AppDeps } from "../app.js";
import type { SignedInUser } from "../roles.js";
import { sessionTime } from "../session-time.js";
import { SessionStatus } from "../session-status.js";
import { cancelSession, findToCancel } from "./cancel-store.js";
import { sessionNotFound } from "./lookup.js";
import { sessionIdSchema } from "./schemas.js";

export async function cancelMySession(deps: AppDeps, viewer: SignedInUser, id: unknown): Promise<void> {
  const parsed = sessionIdSchema.safeParse(id);
  const target = parsed.success ? await findToCancel(deps.db, viewer.id, parsed.data) : undefined;
  if (!target) throw sessionNotFound();
  if (target.status === SessionStatus.CANCELLED) return;

  await cancelSession(deps.db, {
    id: target.id,
    cancelledBy: viewer.id,
    recipientId: target.otherPersonId,
    text: `${target.viewerName} cancelled your session on ${sessionTime(target.start, target.otherPersonTimezone)}`,
    now: deps.now(),
  });
}
