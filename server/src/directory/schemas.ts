import { z } from "zod";

export const professionalIdSchema = z.uuid();

export const professionalsPageSchema = z.object({
  cursor: z.string("That page link isn't valid.").optional(),
});

// The directory's cursor holds the name of the last professional seen.
export const professionalCursorValue = z.string();
