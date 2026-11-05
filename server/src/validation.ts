import type { z } from "zod";
import { ErrorCode, HttpError } from "./errors.js";

// Postgres text can't hold a NUL and throws on one, which would answer a bad request with a 500.
export function hasNul(value: unknown): boolean {
  if (typeof value === "string") return value.includes("\u0000");
  if (typeof value === "object" && value !== null) return Object.values(value).some(hasNul);
  return false;
}

export function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new HttpError(400, ErrorCode.VALIDATION, result.error.issues[0].message);
  }
  if (hasNul(result.data)) {
    throw new HttpError(400, ErrorCode.VALIDATION, "That contains a character we can't accept.");
  }
  return result.data;
}
