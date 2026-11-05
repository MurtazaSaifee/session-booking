export const ErrorCode = {
  VALIDATION: "VALIDATION",
  UNSUPPORTED_MEDIA_TYPE: "UNSUPPORTED_MEDIA_TYPE",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  WRONG_ROLE: "WRONG_ROLE",
  RANGES_OVERLAP: "RANGES_OVERLAP",
  SLOT_NOT_AVAILABLE: "SLOT_NOT_AVAILABLE",
  SLOT_TAKEN: "SLOT_TAKEN",
  MEMBER_OVERLAP: "MEMBER_OVERLAP",
  BAD_CREDENTIALS: "BAD_CREDENTIALS",
  EMAIL_TAKEN: "EMAIL_TAKEN",
  NOT_FOUND: "NOT_FOUND",
  DATABASE_UNAVAILABLE: "DATABASE_UNAVAILABLE",
  INTERNAL: "INTERNAL",
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export class HttpError extends Error {
  status: number;
  code: ErrorCode;

  constructor(status: number, code: ErrorCode, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
