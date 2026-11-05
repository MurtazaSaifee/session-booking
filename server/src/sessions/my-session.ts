import { toPage, type Page } from "../paging.js";
import type { Role } from "../roles.js";
import type { SessionStatus } from "../session-status.js";
import type { SessionList } from "./session-list.js";

type Viewer = { id: string; role: Role };

export type SessionRow = {
  id: string;
  starts_at: Date;
  ends_at: Date;
  status: SessionStatus;
  cancelled_by: string | null;
  other_person_name: string;
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

function cancelledBy(row: SessionRow, viewer: Viewer): CancelledBy | null {
  if (row.cancelled_by === null) return null;
  return row.cancelled_by === viewer.id ? CancelledBy.YOU : CancelledBy.OTHER_PERSON;
}

export function toMySession(row: SessionRow, viewer: Viewer): MySession {
  return {
    id: row.id,
    otherPersonName: row.other_person_name,
    start: row.starts_at,
    end: row.ends_at,
    status: row.status,
    cancelledBy: cancelledBy(row, viewer),
  };
}

export function rowsToPage(rows: SessionRow[], viewer: Viewer): Page<MySession> {
  const page = toPage(rows, (row) => ({ value: row.ends_at.toISOString(), id: row.id }));
  return { ...page, items: page.items.map((row) => toMySession(row, viewer)) };
}
