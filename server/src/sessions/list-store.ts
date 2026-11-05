import type { Db } from "../db.js";
import { PAGE_QUERY_LIMIT, toPage, type Page } from "../paging.js";
import { Role } from "../roles.js";
import { SessionStatus } from "../session-status.js";

// Upcoming will happen, past did happen, cancelled won't or didn't.
export const SessionList = { UPCOMING: "UPCOMING", PAST: "PAST", CANCELLED: "CANCELLED" } as const;
export type SessionList = (typeof SessionList)[keyof typeof SessionList];

type Viewer = { id: string; role: Role };

type ListRow = {
  list: SessionList;
  id: string;
  starts_at: Date;
  ends_at: Date;
  status: SessionStatus;
  cancelled_by: string | null;
  other_person_name: string;
};

// Exactly what a person may see of their own session: never the other person's id or email.
export type MySession = {
  id: string;
  otherPersonName: string;
  start: Date;
  end: Date;
  status: SessionStatus;
  cancelledByYou: boolean;
};

export type MySessions = Record<Lowercase<SessionList>, Page<MySession>>;

const sides = {
  [Role.MEMBER]: { own: "s.member_id", other: "s.professional_id" },
  [Role.PROFESSIONAL]: { own: "s.professional_id", other: "s.member_id" },
};

function toMySession(row: ListRow, viewer: Viewer): MySession {
  return {
    id: row.id,
    otherPersonName: row.other_person_name,
    start: row.starts_at,
    end: row.ends_at,
    status: row.status,
    cancelledByYou: row.cancelled_by === viewer.id,
  };
}

function rowsToPage(rows: ListRow[], viewer: Viewer): Page<MySession> {
  const page = toPage(rows, (row) => ({ value: row.ends_at.toISOString(), id: row.id }));
  return { ...page, items: page.items.map((row) => toMySession(row, viewer)) };
}

// A session in progress is still upcoming: it only becomes past once its end time has gone by.
function listQuery(db: Db, viewer: Viewer, list: SessionList, now: Date) {
  const { own, other } = sides[viewer.role];
  const order = list === SessionList.UPCOMING ? "asc" : "desc";
  const query = db("sessions as s")
    .join("users as u", "u.id", other)
    .where(own, viewer.id)
    .select(
      "s.id",
      "s.starts_at",
      "s.ends_at",
      "s.status",
      "s.cancelled_by",
      "u.name as other_person_name",
      db.raw("cast(? as text) as list", [list]),
      db.raw(`row_number() over (order by s.ends_at ${order}, s.id ${order}) as position`),
    )
    .orderBy([
      { column: "s.ends_at", order },
      { column: "s.id", order },
    ])
    .limit(PAGE_QUERY_LIMIT);

  if (list === SessionList.CANCELLED) return query.where("s.status", SessionStatus.CANCELLED);
  return query
    .where("s.status", SessionStatus.BOOKED)
    .where("s.ends_at", list === SessionList.UPCOMING ? ">" : "<=", now);
}

// One round trip for all three lists. Postgres doesn't promise a union keeps each part's order, hence position.
export async function listMySessions(db: Db, viewer: Viewer, now: Date): Promise<MySessions> {
  const rows: ListRow[] = await db
    .queryBuilder()
    .unionAll(
      Object.values(SessionList).map((list) => listQuery(db, viewer, list, now)),
      true,
    )
    .orderBy("position");
  const pageOf = (list: SessionList) =>
    rowsToPage(
      rows.filter((row) => row.list === list),
      viewer,
    );
  return {
    upcoming: pageOf(SessionList.UPCOMING),
    past: pageOf(SessionList.PAST),
    cancelled: pageOf(SessionList.CANCELLED),
  };
}
