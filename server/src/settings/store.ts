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
