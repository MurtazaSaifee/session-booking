export const ReminderKind = { DAY_BEFORE: "DAY_BEFORE", HOUR_BEFORE: "HOUR_BEFORE" } as const;
export type ReminderKind = (typeof ReminderKind)[keyof typeof ReminderKind];

export const ReminderStatus = { PENDING: "PENDING" } as const;
export type ReminderStatus = (typeof ReminderStatus)[keyof typeof ReminderStatus];
