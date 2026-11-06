import { z } from "zod";
import { bookSessionSchema } from "../booking/schemas.js";
import { cursorSchema } from "../paging.js";
import { SessionList } from "./session-list.js";

export const sessionIdSchema = z.uuid();

export const sessionsPageSchema = z.object({
  list: z.enum(SessionList, "Please choose which list of sessions to show."),
  cursor: cursorSchema,
});

export const rescheduleSchema = bookSessionSchema.pick({ start: true });
