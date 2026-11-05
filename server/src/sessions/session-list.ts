// Upcoming will happen, past did happen, cancelled won't or didn't.
export const SessionList = { UPCOMING: "UPCOMING", PAST: "PAST", CANCELLED: "CANCELLED" } as const;
export type SessionList = (typeof SessionList)[keyof typeof SessionList];
