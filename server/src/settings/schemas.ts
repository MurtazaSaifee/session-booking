import { z } from "zod";
import { professionalFields } from "../auth/schemas.js";

// Only the fields that changed are sent, so two tabs editing different fields don't undo each other.
export const profileChangesSchema = z
  .object(professionalFields)
  .partial()
  .refine((changes) => Object.keys(changes).length > 0, "Nothing to update.");

const MAX_RANGES = 50;

const timeOfDay = z
  .string("Times must look like 09:00.")
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Times must look like 09:00.");

const timeRange = z
  .object({
    weekday: z
      .int("Please choose a weekday from Monday to Sunday.")
      .min(1, "Please choose a weekday from Monday to Sunday.")
      .max(7, "Please choose a weekday from Monday to Sunday."),
    start: timeOfDay,
    end: timeOfDay,
  })
  // Zero-padded "HH:MM" strings compare in time order. This also refuses ranges that cross midnight.
  .refine((range) => range.start < range.end, "Each time range must end after it starts, on the same day.");

export const hoursSchema = z.object({
  ranges: z
    .array(timeRange, "Please send your working hours as a list of time ranges.")
    .max(MAX_RANGES, `You can save at most ${MAX_RANGES} time ranges.`),
});
