import type { z } from "zod";
import { ErrorCode, HttpError } from "./errors.js";

export function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new HttpError(400, ErrorCode.VALIDATION, result.error.issues[0].message);
  }
  return result.data;
}
