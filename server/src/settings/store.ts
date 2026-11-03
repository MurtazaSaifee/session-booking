import type { Db } from "../db.js";

export type Profile = { title: string | null; bio: string | null };

export async function findProfile(db: Db, userId: string): Promise<Profile | undefined> {
  return db<Profile & { id: string }>("users").select(["title", "bio"]).where({ id: userId }).first();
}
