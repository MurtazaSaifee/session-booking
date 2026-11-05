import { api, type Page } from "../api";

export const SessionStatus = { BOOKED: "BOOKED", CANCELLED: "CANCELLED" } as const;
export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];

export const SessionList = { UPCOMING: "UPCOMING", PAST: "PAST", CANCELLED: "CANCELLED" } as const;
export type SessionList = (typeof SessionList)[keyof typeof SessionList];

export const CancelledBy = { YOU: "YOU", OTHER_PERSON: "OTHER_PERSON" } as const;
export type CancelledBy = (typeof CancelledBy)[keyof typeof CancelledBy];

export type MySession = {
  id: string;
  otherPersonName: string;
  start: string;
  end: string;
  status: SessionStatus;
  cancelledBy: CancelledBy | null;
};

export type MySessions = Record<Lowercase<SessionList>, Page<MySession>>;

export function getMySessions(): Promise<MySessions> {
  return api<MySessions>("/sessions");
}

export function getNextSessions(list: SessionList, cursor: string): Promise<Page<MySession>> {
  return api<Page<MySession>>(`/sessions?list=${list}&cursor=${encodeURIComponent(cursor)}`);
}
