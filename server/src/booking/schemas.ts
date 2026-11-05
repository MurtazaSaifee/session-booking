import { z } from "zod";

export const bookSessionSchema = z.object({
  professionalId: z.string("Please choose a professional."),
  start: z.iso.datetime({ offset: true, error: "Please choose a valid start time." }),
});
