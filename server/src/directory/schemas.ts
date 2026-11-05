import { z } from "zod";

export const professionalIdSchema = z.uuid();

// The directory's cursor holds the name of the last professional seen.
export const professionalCursorValueSchema = z.string();
