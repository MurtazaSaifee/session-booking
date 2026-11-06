import { z } from "zod";
import { sessionIdSchema } from "../sessions/schemas.js";

// Set by the reschedule calendar, so the session being moved doesn't hide its own time.
export const slotsQuerySchema = z.object({
  ignoreSessionId: sessionIdSchema.optional(),
});
