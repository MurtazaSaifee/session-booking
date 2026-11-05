export const SessionStatus = { BOOKED: "BOOKED", CANCELLED: "CANCELLED" } as const;
export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];
