import { toPage, type Page } from "../paging.js";
import { Role, type SignedInUser } from "../roles.js";
import type { SessionStatus } from "../session-status.js";
import type { SessionList } from "./session-list.js";

export type SessionRow = {
  id: string;
  starts_at: Date;
  ends_at: Date;
  status: SessionStatus;
  cancelled_by: string | null;
  other_person_name: string;
  other_person_id: string;
};

export const CancelledBy = { YOU: "YOU", OTHER_PERSON: "OTHER_PERSON" } as const;
export type CancelledBy = (typeof CancelledBy)[keyof typeof CancelledBy];

// Exactly what a person may see of their own session: never the other person's id or email.
export type MySession = {
  id: string;
  otherPersonName: string;
  start: Date;
  end: Date;
  status: SessionStatus;
  cancelledBy: CancelledBy | null;
};

export type MySessions = Record<Lowercase<SessionList>, Page<MySession>>;

function cancelledBy(row: SessionRow, viewer: SignedInUser): CancelledBy | null {
  if (row.cancelled_by === null) return null;
  return row.cancelled_by === viewer.id ? CancelledBy.YOU : CancelledBy.OTHER_PERSON;
}

export function toMySession(row: SessionRow, viewer: SignedInUser): MySession {
  return {
    id: row.id,
    otherPersonName: row.other_person_name,
    start: row.starts_at,
    end: row.ends_at,
    status: row.status,
    cancelledBy: cancelledBy(row, viewer),
  };
}

// What reading one session adds. A member also gets the professional's id, which the directory already shows
// them, so the reschedule page can open that professional's calendar. A professional never gets the member's.
export type MySessionDetail = MySession & { professionalId?: string };

export function toMySessionDetail(row: SessionRow, viewer: SignedInUser): MySessionDetail {
  return {
    ...toMySession(row, viewer),
    ...(viewer.role === Role.MEMBER && { professionalId: row.other_person_id }),
  };
}

export function rowsToPage(rows: SessionRow[], viewer: SignedInUser): Page<MySession> {
  const page = toPage(rows, (row) => ({ value: row.ends_at.toISOString(), id: row.id }));
  return { ...page, items: page.items.map((row) => toMySession(row, viewer)) };
}
