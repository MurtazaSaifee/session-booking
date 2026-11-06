import type { AppDeps } from "../app.js";
import { parseProfessionalId, professionalNotFound } from "../directory/lookup.js";
import { findSlotInputs } from "./store.js";

export async function slotInputsOr404(
  deps: AppDeps,
  input: { professionalId: unknown; memberId: string; now: Date; ignoreSessionId?: string },
) {
  const professionalId = parseProfessionalId(input.professionalId);
  const inputs = await findSlotInputs(deps.db, { ...input, professionalId });
  if (!inputs) throw professionalNotFound();
  return { professionalId, inputs };
}
