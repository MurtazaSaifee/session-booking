import type { AppDeps } from "../app.js";
import { ErrorCode, HttpError } from "../errors.js";
import { professionalIdSchema } from "./schemas.js";
import { findProfessional, type Professional } from "./store.js";

function notFound() {
  return new HttpError(404, ErrorCode.NOT_FOUND, "We couldn't find that professional.");
}

// A bad id, a missing id and a member's id all look the same, so none reveals whether an account exists.
// The id is checked before the query because Postgres throws on a malformed uuid.
export async function professionalOr404(deps: AppDeps, id: unknown): Promise<Professional> {
  const parsed = professionalIdSchema.safeParse(id);
  if (!parsed.success) throw notFound();
  const professional = await findProfessional(deps.db, parsed.data);
  if (!professional) throw notFound();
  return professional;
}
