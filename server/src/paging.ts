import { z } from "zod";
import { ErrorCode, HttpError } from "./errors.js";
import { hasNul, parseInput } from "./validation.js";

export const PAGE_SIZE = 20;
// One row more than a page shows whether another page follows, without counting anything.
export const PAGE_QUERY_LIMIT = PAGE_SIZE + 1;

// Where a list's sort order had got to: the sort value of the last row seen, and its id to break ties.
export type Position = { value: string; id: string };

// A cursor for a list sorted by time holds that time. The server writes these in UTC, and Postgres has no
// year 0000, though the format allows it.
export const timeCursorValueSchema = z.iso.datetime().refine((value) => !value.startsWith("0000"));

export type Page<T> = { items: T[]; next: string | null };

export function encodeCursor(position: Position): string {
  return Buffer.from(JSON.stringify([position.value, position.id])).toString("base64url");
}

const INVALID_CURSOR_MESSAGE = "That page link isn't valid.";

export const cursorSchema = z.string(INVALID_CURSOR_MESSAGE);

const pageQuerySchema = z.object({ cursor: cursorSchema.optional() });

function invalidCursor() {
  return new HttpError(400, ErrorCode.VALIDATION, INVALID_CURSOR_MESSAGE);
}

// Checked before any query because Postgres throws on a malformed uuid or date.
export function decodeCursor(cursor: string, value: z.ZodType<string>): Position {
  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(cursor, "base64url").toString());
  } catch {
    throw invalidCursor();
  }
  const parsed = z.tuple([value, z.uuid()]).safeParse(decoded);
  if (!parsed.success || hasNul(parsed.data)) throw invalidCursor();
  return { value: parsed.data[0], id: parsed.data[1] };
}

// For a list whose first page has no cursor: where to continue from, or undefined to start at the top.
export function pageAfter(query: unknown, value: z.ZodType<string>): Position | undefined {
  const { cursor } = parseInput(pageQuerySchema, query);
  return cursor === undefined ? undefined : decodeCursor(cursor, value);
}

// Takes rows fetched with PAGE_QUERY_LIMIT.
export function toPage<T>(rows: T[], position: (row: T) => Position): Page<T> {
  const items = rows.slice(0, PAGE_SIZE);
  const hasMore = rows.length > PAGE_SIZE;
  return { items, next: hasMore ? encodeCursor(position(items[items.length - 1])) : null };
}
