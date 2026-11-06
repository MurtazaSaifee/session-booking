import type { Db } from "../db.js";
import type { Role } from "../roles.js";

export type PublicUser = {
  id: string;
  role: Role;
  name: string;
  email: string;
  timezone: string;
  title: string | null;
  bio: string | null;
};

type UserRow = PublicUser & { password_hash: string };

export const publicColumns: (keyof PublicUser)[] = [
  "id",
  "role",
  "name",
  "email",
  "timezone",
  "title",
  "bio",
];

function emailTaken(err: unknown): boolean {
  const pgError = err as { code?: string; constraint?: string };
  return pgError.code === "23505" && pgError.constraint === "users_email_key";
}

export type NewRefreshToken = { tokenHash: string; expiresAt: Date };

// One statement saves the user and their first refresh token, so either both exist or neither does.
// Returns null when the email is already taken.
export async function createUserWithRefreshToken(
  db: Db,
  user: {
    role: Role;
    name: string;
    email: string;
    passwordHash: string;
    timezone: string;
    title: string | null;
    bio: string | null;
  },
  token: NewRefreshToken,
): Promise<PublicUser | null> {
  try {
    const result = await db.raw<{ rows: PublicUser[] }>(
      `
      with new_user as (
        insert into users (role, name, email, password_hash, timezone, title, bio)
        values (:role, :name, :email, :passwordHash, :timezone, :title, :bio)
        returning ${publicColumns.join(", ")}
      ),
      saved_token as (
        insert into refresh_tokens (user_id, token_hash, expires_at)
        select id, :tokenHash, :expiresAt from new_user
      )
      select * from new_user
      `,
      { ...user, tokenHash: token.tokenHash, expiresAt: token.expiresAt },
    );
    return result.rows[0];
  } catch (err) {
    if (emailTaken(err)) return null;
    throw err;
  }
}

export async function findUserByEmail(
  db: Db,
  email: string,
): Promise<{ user: PublicUser; passwordHash: string } | undefined> {
  const row = await db<UserRow>("users")
    .select([...publicColumns, "password_hash"])
    .whereRaw("lower(email) = lower(?)", [email])
    .first();
  if (!row) return undefined;
  const { password_hash: passwordHash, ...user } = row;
  return { user, passwordHash };
}

export async function findUserById(db: Db, id: string): Promise<PublicUser | undefined> {
  return db<PublicUser>("users").select(publicColumns).where({ id }).first();
}

export async function updateUser(
  db: Db,
  id: string,
  changes: { name?: string; timezone?: string },
): Promise<PublicUser | undefined> {
  const updateData: { name?: string; timezone?: string } = {};
  if (changes.name !== undefined) updateData.name = changes.name;
  if (changes.timezone !== undefined) updateData.timezone = changes.timezone;

  if (Object.keys(updateData).length === 0) {
    return findUserById(db, id);
  }

  const rows = await db<PublicUser>("users").where({ id }).update(updateData).returning(publicColumns);
  return rows[0];
}
