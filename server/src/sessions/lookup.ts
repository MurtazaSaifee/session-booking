import type { AppDeps } from "../app.js";
import { ErrorCode, HttpError } from "../errors.js";
import type { SignedInUser } from "../roles.js";
import type { MySessionDetail } from "./my-session.js";
import { sessionIdSchema } from "./schemas.js";
import { findMySession } from "./store.js";

// A bad id, a missing id and someone else's session all look the same, so none reveals that a session exists.
export function sessionNotFound(): HttpError {
  return new HttpError(404, ErrorCode.NOT_FOUND, "We couldn't find that session.");
}

export function sessionIdOr404(id: unknown): string {
  const parsed = sessionIdSchema.safeParse(id);
  if (!parsed.success) throw sessionNotFound();
  return parsed.data;
}

export async function mySessionOr404(
  deps: AppDeps,
  viewer: SignedInUser,
  id: unknown,
): Promise<MySessionDetail> {
  const session = await findMySession(deps.db, viewer, sessionIdOr404(id));
  if (!session) throw sessionNotFound();
  return session;
}
