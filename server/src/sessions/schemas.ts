import { z } from "zod";
import { SessionList } from "./session-list.js";

export const bookSessionSchema = z.object({
  professionalId: z.string("Please choose a professional."),
  start: z.iso.datetime({ offset: true, error: "Please choose a valid start time." }),
});

export const sessionIdSchema = z.uuid();

export const sessionsPageSchema = z.object({
  list: z.enum(SessionList, "Please choose which list of sessions to show."),
  cursor: z.string("That page link isn't valid."),
});

// A session list's cursor holds the end time of the last row seen.
export const sessionCursorValue = z.iso.datetime({ offset: true });
