import type { Db } from "../db.js";
import { PAGE_QUERY_LIMIT, type Page, type Position } from "../paging.js";
import { newRemindersCte, newRemindersParams } from "../reminders/new-reminders.js";
import { ReminderStatus } from "../reminders/reminder-values.js";
import { Role, type SignedInUser } from "../roles.js";
import { SessionStatus } from "../session-status.js";
import { SLOT_INPUT_COLUMNS, toSlotInputs, type SlotInputsRow } from "../slots/store.js";
import type { SlotInputs } from "../slots/slots.js";
import { rowsToPage, toMySession, type MySession, type MySessions, type SessionRow } from "./my-session.js";
import { SessionList } from "./session-list.js";

type ListRow = SessionRow & { list: SessionList };

const sides = {
  [Role.MEMBER]: { own: "s.member_id", other: "s.professional_id" },
  [Role.PROFESSIONAL]: { own: "s.professional_id", other: "s.member_id" },
};

// Every read of a person's sessions starts here, so they can only ever reach their own. The one exception is
// findToReschedule, which joins the slot inputs in the same query and checks the member itself.
function ownSessions(db: Db, viewer: SignedInUser) {
  const { own, other } = sides[viewer.role];
  return db("sessions as s")
    .join("users as u", "u.id", other)
    .where(own, viewer.id)
    .select(
      "s.id",
      "s.starts_at",
      "s.ends_at",
      "s.status",
      "s.cancelled_by",
      "u.name as other_person_name",
      "u.id as other_person_id",
    );
}

// What each list holds and how it sorts. A session in progress is still upcoming: it only becomes past
// once its end time has gone by.
const listRules = {
  [SessionList.UPCOMING]: { status: SessionStatus.BOOKED, endsAt: ">", order: "asc", after: ">" },
  [SessionList.PAST]: { status: SessionStatus.BOOKED, endsAt: "<=", order: "desc", after: "<" },
  [SessionList.CANCELLED]: { status: SessionStatus.CANCELLED, endsAt: null, order: "desc", after: "<" },
} as const;

function listQuery(db: Db, viewer: SignedInUser, list: SessionList, now: Date, after?: Position) {
  const rules = listRules[list];
  const { order } = rules;
  const query = ownSessions(db, viewer)
    .where("s.status", rules.status)
    .select(
      db.raw("cast(? as text) as list", [list]),
      db.raw(`row_number() over (order by s.ends_at ${order}, s.id ${order}) as list_order`),
    )
    .orderBy([
      { column: "s.ends_at", order },
      { column: "s.id", order },
    ])
    .limit(PAGE_QUERY_LIMIT);

  if (rules.endsAt) query.where("s.ends_at", rules.endsAt, now);
  if (after) query.whereRaw(`(s.ends_at, s.id) ${rules.after} (?, ?)`, [after.value, after.id]);
  return query;
}

// One round trip for all three lists. Postgres doesn't promise a union keeps each part's order, hence list_order.
export async function listMySessions(db: Db, viewer: SignedInUser, now: Date): Promise<MySessions> {
  const rows: ListRow[] = await db
    .queryBuilder()
    .unionAll(
      Object.values(SessionList).map((list) => listQuery(db, viewer, list, now)),
      true,
    )
    .orderBy("list_order");
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
  viewer: SignedInUser,
  input: { list: SessionList; after: Position; now: Date },
): Promise<Page<MySession>> {
  const rows: ListRow[] = await listQuery(db, viewer, input.list, input.now, input.after);
  return rowsToPage(rows, viewer);
}

export async function findMySession(
  db: Db,
  viewer: SignedInUser,
  id: string,
): Promise<MySession | undefined> {
  const row: SessionRow | undefined = await ownSessions(db, viewer).where("s.id", id).first();
  return row && toMySession(row, viewer);
}

type CancelTargetRow = SessionRow & {
  viewer_name: string;
  other_person_timezone: string;
};

export type CancelTarget = {
  id: string;
  status: SessionStatus;
  start: Date;
  viewerName: string;
  otherPersonId: string;
  otherPersonTimezone: string;
};

export async function findToCancel(
  db: Db,
  viewer: SignedInUser,
  id: string,
): Promise<CancelTarget | undefined> {
  const row: CancelTargetRow | undefined = await ownSessions(db, viewer)
    .join("users as me", "me.id", sides[viewer.role].own)
    .where("s.id", id)
    .select("me.name as viewer_name", "u.timezone as other_person_timezone")
    .first();
  return (
    row && {
      id: row.id,
      status: row.status,
      start: row.starts_at,
      viewerName: row.viewer_name,
      otherPersonId: row.other_person_id,
      otherPersonTimezone: row.other_person_timezone,
    }
  );
}

type CancelInput = { id: string; cancelledBy: string; recipientId: string; text: string; now: Date };

// One statement, so the session, its reminders and the notice all change together or not at all.
export async function cancelSession(db: Db, input: CancelInput): Promise<void> {
  await db.raw(
    `
    with cancelled as (
      update sessions
      set status = :cancelled, cancelled_by = :cancelledBy, cancelled_at = :now, updated_at = :now
      where id = :id and status = :booked
      returning id
    ),
    cancelled_reminders as (
      update reminders set status = :reminderCancelled
      where session_id in (select id from cancelled) and status = :pending
    ),
    notice as (
      insert into notifications (recipient_id, session_id, text, created_at)
      select :recipientId, id, :text, cast(:now as timestamptz) from cancelled
    )
    select id from cancelled
    `,
    {
      ...input,
      booked: SessionStatus.BOOKED,
      cancelled: SessionStatus.CANCELLED,
      pending: ReminderStatus.PENDING,
      reminderCancelled: ReminderStatus.CANCELLED,
    },
  );
}

type MoveInput = {
  id: string;
  // The version the checks were made on. If the session has changed since, the move is dropped.
  version: number;
  start: Date;
  end: Date;
  recipientId: string;
  text: string;
  now: Date;
};

// One statement, so the move, the old reminders going, the new ones and the notice all happen together or not
// at all. Returns false when the session is no longer booked at that version, for instance after a cancel.
export async function moveSession(db: Db, input: MoveInput): Promise<boolean> {
  const result = await db.raw<{ rows: unknown[] }>(
    `
    with moved as (
      update sessions
      set starts_at = :start, ends_at = :end, updated_at = :now, version = version + 1
      where id = :id and status = :booked and version = :version
      returning id, member_id, professional_id, starts_at
    ),
    dropped_reminders as (
      update reminders set status = :reminderCancelled
      where session_id in (select id from moved) and status = :pending
    ),
    ${newRemindersCte("moved")},
    notice as (
      insert into notifications (recipient_id, session_id, text, created_at)
      select :recipientId, id, :text, cast(:now as timestamptz) from moved
    )
    select id from moved
    `,
    {
      ...input,
      ...newRemindersParams,
      booked: SessionStatus.BOOKED,
      reminderCancelled: ReminderStatus.CANCELLED,
    },
  );
  return result.rows.length > 0;
}

type RescheduleRow = SlotInputsRow & {
  session_id: string;
  session_start: Date;
  session_version: number;
  professional_id: string;
  member_name: string;
};

export type RescheduleTarget = {
  id: string;
  start: Date;
  version: number;
  professionalId: string;
  memberName: string;
};

// A member's own booked session and everything needed to check a new start for it, in one round trip. Another
// person's session, or one already cancelled, looks the same as a missing one.
export async function findToReschedule(
  db: Db,
  input: { sessionId: string; memberId: string; now: Date },
): Promise<{ session: RescheduleTarget; inputs: SlotInputs } | undefined> {
  const result = await db.raw<{ rows: RescheduleRow[] }>(
    `
    select ${SLOT_INPUT_COLUMNS},
      cur.id as session_id, cur.starts_at as session_start, cur.version as session_version,
      u.id as professional_id, me.name as member_name
    from sessions cur
    join users u on u.id = cur.professional_id
    join users me on me.id = cur.member_id
    where cur.id = :sessionId and cur.member_id = :memberId and cur.status = :booked
    `,
    {
      sessionId: input.sessionId,
      ignoreSessionId: input.sessionId,
      memberId: input.memberId,
      now: input.now,
      booked: SessionStatus.BOOKED,
    },
  );
  const row = result.rows[0];
  return (
    row && {
      session: {
        id: row.session_id,
        start: row.session_start,
        version: row.session_version,
        professionalId: row.professional_id,
        memberName: row.member_name,
      },
      inputs: toSlotInputs(row),
    }
  );
}
