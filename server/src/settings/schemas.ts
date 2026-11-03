import { z } from "zod";
import { professionalFields } from "../auth/schemas.js";

// Only the fields that changed are sent, so two tabs editing different fields don't undo each other.
export const profileChangesSchema = z
  .object(professionalFields)
  .partial()
  .refine((changes) => Object.keys(changes).length > 0, "Nothing to update.");
