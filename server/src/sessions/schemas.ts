import { z } from "zod";
import { cursorSchema } from "../paging.js";
import { SessionList } from "./session-list.js";

export const sessionIdSchema = z.uuid();

export const sessionsPageSchema = z.object({
  list: z.enum(SessionList, "Please choose which list of sessions to show."),
  cursor: cursorSchema,
});
