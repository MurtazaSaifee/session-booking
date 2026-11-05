import { z } from "zod";
import { SessionList } from "./session-list.js";

export const sessionIdSchema = z.uuid();

export const sessionsPageSchema = z.object({
  list: z.enum(SessionList, "Please choose which list of sessions to show."),
  cursor: z.string("That page link isn't valid."),
});

// A session list's cursor holds the end time of the last row seen. The server writes these in UTC, and
// Postgres has no year 0000, though the format allows it.
export const sessionCursorValue = z.iso.datetime().refine((value) => !value.startsWith("0000"));
