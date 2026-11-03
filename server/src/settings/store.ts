import type { Db } from "../db.js";

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

// A working-hours range on the professional's own clock, e.g. Monday (1) "09:00" to "12:00".
export type TimeRange = { weekday: number; start: string; end: string };

type WorkingHoursRow = {
  professional_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  deleted_at: Date | null;
};

export async function listHours(db: Db, professionalId: string): Promise<TimeRange[]> {
  const rows = await db<WorkingHoursRow>("working_hours")
    .select(["weekday", "start_time", "end_time"])
    .where({ professional_id: professionalId })
    .whereNull("deleted_at")
    .orderBy(["weekday", "start_time"]);
  // Postgres returns times as "09:00:00"; the API speaks "09:00".
  return rows.map((row) => ({
    weekday: row.weekday,
    start: row.start_time.slice(0, 5),
    end: row.end_time.slice(0, 5),
  }));
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
    await trx<UserRow>("users").select("id").where({ id: professionalId }).forUpdate().first();
    await trx<WorkingHoursRow>("working_hours")
      .where({ professional_id: professionalId })
      .whereNull("deleted_at")
      .update({ deleted_at: now });
    if (ranges.length > 0) {
      await trx<WorkingHoursRow>("working_hours").insert(
        ranges.map((range) => ({
          professional_id: professionalId,
          weekday: range.weekday,
          start_time: range.start,
          end_time: range.end,
        })),
      );
    }
    return listHours(trx, professionalId);
  });
}
