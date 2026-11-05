import { z } from "zod";

export const notificationsPageSchema = z.object({
  cursor: z.string("That page link isn't valid.").optional(),
});
