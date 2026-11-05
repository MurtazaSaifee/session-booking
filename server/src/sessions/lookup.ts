import type { AppDeps } from "../app.js";
import { ErrorCode, HttpError } from "../errors.js";
import type { SignedInUser } from "../roles.js";
import type { MySession } from "./my-session.js";
import { sessionIdSchema } from "./schemas.js";
import { findMySession } from "./store.js";

// A bad id, a missing id and someone else's session all look the same, so none reveals that a session exists.
export function sessionNotFound(): HttpError {
  return new HttpError(404, ErrorCode.NOT_FOUND, "We couldn't find that session.");
}

export async function mySessionOr404(deps: AppDeps, viewer: SignedInUser, id: unknown): Promise<MySession> {
  const parsed = sessionIdSchema.safeParse(id);
  const session = parsed.success ? await findMySession(deps.db, viewer, parsed.data) : undefined;
  if (!session) throw sessionNotFound();
  return session;
}
