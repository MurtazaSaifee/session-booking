export const ReminderKind = { DAY_BEFORE: "DAY_BEFORE", HOUR_BEFORE: "HOUR_BEFORE" } as const;
export type ReminderKind = (typeof ReminderKind)[keyof typeof ReminderKind];

// How long before the session each reminder is due, as a Postgres interval.
export const REMINDER_LEAD_TIME = {
  [ReminderKind.DAY_BEFORE]: "24 hours",
  [ReminderKind.HOUR_BEFORE]: "1 hour",
} as const;

export const ReminderStatus = { PENDING: "PENDING", SENT: "SENT", SKIPPED: "SKIPPED" } as const;
export type ReminderStatus = (typeof ReminderStatus)[keyof typeof ReminderStatus];
