import type { Db } from "../db.js";
import type { TimeRange } from "./hours.js";

export type Profile = { title: string | null; bio: string | null };

type UserRow = Profile & { id: string };

export async function findProfile(db: Db, userId: string): Promise<Profile | undefined> {
  return db<UserRow>("users").select(["title", "bio"]).where({ id: userId }).first();
}

// Knex leaves undefined fields out of the update, so only the changed columns are written.
export async function updateProfile(
  db: Db,
  userId: string,
  changes: Partial<Profile>,
): Promise<Profile | undefined> {
  const rows: Profile[] = await db<UserRow>("users")
    .where({ id: userId })
    .update({ title: changes.title, bio: changes.bio })
    .returning(["title", "bio"]);
  return rows[0];
}

type WorkingHoursRow = {
  professional_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  deleted_at: Date | null;
};

type HoursColumns = Pick<WorkingHoursRow, "weekday" | "start_time" | "end_time">;

// Postgres returns times as "09:00:00"; the API speaks "09:00".
function toTimeRange(row: HoursColumns): TimeRange {
  return { weekday: row.weekday, start: row.start_time.slice(0, 5), end: row.end_time.slice(0, 5) };
}

export async function listHours(db: Db, professionalId: string): Promise<TimeRange[]> {
  const rows = await db<WorkingHoursRow>("working_hours")
    .select(["weekday", "start_time", "end_time"])
    .where({ professional_id: professionalId })
    .whereNull("deleted_at")
    .orderBy(["weekday", "start_time"]);
  return rows.map(toTimeRange);
}

export async function replaceHours(
  db: Db,
  professionalId: string,
  ranges: TimeRange[],
  now: Date,
): Promise<TimeRange[]> {
  return db.transaction(async (trx) => {
    // Two saves at once would each soft-delete only the rows they can see and both insert,
    // so the professional's row is locked first and the second save waits for the first.
    // The lock is its own statement: a statement's snapshot is fixed when it starts, before any
    // lock wait, so a waiting save in the same statement would soft-delete only the rows it saw
    // before the wait.
    await trx<UserRow>("users").select("id").where({ id: professionalId }).forUpdate().first();
    const result = await trx.raw<{ rows: HoursColumns[] }>(
      `
      with removed as (
        update working_hours set deleted_at = :now
        where professional_id = :professionalId and deleted_at is null
      ),
      added as (
        insert into working_hours (professional_id, weekday, start_time, end_time)
        select :professionalId, r.weekday, r.start_time, r.end_time
        from json_to_recordset(cast(:ranges as json)) as r(weekday smallint, start_time time, end_time time)
        returning weekday, start_time, end_time
      )
      select * from added order by weekday, start_time
      `,
      {
        now,
        professionalId,
        ranges: JSON.stringify(
          ranges.map((range) => ({ weekday: range.weekday, start_time: range.start, end_time: range.end })),
        ),
      },
    );
    return result.rows.map(toTimeRange);
  });
}
