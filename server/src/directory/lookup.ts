import type { AppDeps } from "../app.js";
import { ErrorCode, HttpError } from "../errors.js";
import { professionalIdSchema } from "./schemas.js";
import { findProfessional, type Professional } from "./store.js";

export function professionalNotFound() {
  return new HttpError(404, ErrorCode.NOT_FOUND, "We couldn't find that professional.");
}

// The id is checked before any query because Postgres throws on a malformed uuid.
export function parseProfessionalId(id: unknown): string {
  const parsed = professionalIdSchema.safeParse(id);
  if (!parsed.success) throw professionalNotFound();
  return parsed.data;
}

// A bad id, a missing id and a member's id all look the same, so none reveals whether an account exists.
export async function professionalOr404(deps: AppDeps, id: unknown): Promise<Professional> {
  const professional = await findProfessional(deps.db, parseProfessionalId(id));
  if (!professional) throw professionalNotFound();
  return professional;
}
