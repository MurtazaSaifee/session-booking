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

const publicColumns: (keyof PublicUser)[] = ["id", "role", "name", "email", "timezone", "title", "bio"];

function emailTaken(err: unknown): boolean {
  const pgError = err as { code?: string; constraint?: string };
  return pgError.code === "23505" && pgError.constraint === "users_email_key";
}

// Returns null when the email is already taken.
export async function createUser(
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
): Promise<PublicUser | null> {
  try {
    const rows: PublicUser[] = await db<UserRow>("users")
      .insert({
        role: user.role,
        name: user.name,
        email: user.email,
        password_hash: user.passwordHash,
        timezone: user.timezone,
        title: user.title,
        bio: user.bio,
      })
      .returning(publicColumns);
    return rows[0];
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

export async function saveRefreshToken(
  db: Db,
  token: { userId: string; tokenHash: string; expiresAt: Date },
): Promise<void> {
  await db("refresh_tokens").insert({
    user_id: token.userId,
    token_hash: token.tokenHash,
    expires_at: token.expiresAt,
  });
}

// The refresh token is single-use, so a stolen copy stops working once the real user refreshes.
// One statement revokes the token and reads its user, so two racing refreshes can't both win.
export async function redeemRefreshToken(db: Db, tokenHash: string, now: Date): Promise<PublicUser | null> {
  const rows: PublicUser[] = await db("refresh_tokens as t")
    .where("u.id", db.ref("t.user_id"))
    .where("t.token_hash", tokenHash)
    .whereNull("t.revoked_at")
    .where("t.expires_at", ">", now)
    .update({ revoked_at: now })
    .updateFrom("users as u")
    .returning(publicColumns.map((column) => `u.${column}`));
  return rows[0] ?? null;
}

export async function revokeRefreshToken(db: Db, tokenHash: string, now: Date): Promise<void> {
  await db("refresh_tokens")
    .where({ token_hash: tokenHash })
    .whereNull("revoked_at")
    .update({ revoked_at: now });
}
