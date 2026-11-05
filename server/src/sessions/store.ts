import type { Db } from "../db.js";
import { PAGE_QUERY_LIMIT, type Page, type Position } from "../paging.js";
import { Role } from "../roles.js";
import { SessionStatus } from "../session-status.js";
import { rowsToPage, toMySession, type MySession, type MySessions, type SessionRow } from "./my-session.js";
import { SessionList } from "./session-list.js";

type Viewer = { id: string; role: Role };

type ListRow = SessionRow & { list: SessionList };

const sides = {
  [Role.MEMBER]: { own: "s.member_id", other: "s.professional_id" },
  [Role.PROFESSIONAL]: { own: "s.professional_id", other: "s.member_id" },
};

// Every read starts here, so a person can only ever reach their own sessions.
function ownSessions(db: Db, viewer: Viewer) {
  const { own, other } = sides[viewer.role];
  return db("sessions as s")
    .join("users as u", "u.id", other)
    .where(own, viewer.id)
    .select("s.id", "s.starts_at", "s.ends_at", "s.status", "s.cancelled_by", "u.name as other_person_name");
}

// A session in progress is still upcoming: it only becomes past once its end time has gone by.
function listQuery(db: Db, viewer: Viewer, list: SessionList, now: Date, after?: Position) {
  const order = list === SessionList.UPCOMING ? "asc" : "desc";
  const query = ownSessions(db, viewer)
    .select(
      db.raw("cast(? as text) as list", [list]),
      db.raw(`row_number() over (order by s.ends_at ${order}, s.id ${order}) as position`),
    )
    .orderBy([
      { column: "s.ends_at", order },
      { column: "s.id", order },
    ])
    .limit(PAGE_QUERY_LIMIT);

  if (after) {
    query.whereRaw(`(s.ends_at, s.id) ${order === "asc" ? ">" : "<"} (?, ?)`, [after.value, after.id]);
  }
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

export async function listNextSessions(
  db: Db,
  viewer: Viewer,
  input: { list: SessionList; after: Position; now: Date },
): Promise<Page<MySession>> {
  const rows: ListRow[] = await listQuery(db, viewer, input.list, input.now, input.after);
  return rowsToPage(rows, viewer);
}

export async function findMySession(db: Db, viewer: Viewer, id: string): Promise<MySession | undefined> {
  const row: SessionRow | undefined = await ownSessions(db, viewer).where("s.id", id).first();
  return row && toMySession(row, viewer);
}
