import { runInBatches } from "../batches.js";
import type { Db } from "../db.js";
import { publicColumns, type NewRefreshToken, type PublicUser } from "./store.js";

export async function saveRefreshToken(db: Db, token: NewRefreshToken & { userId: string }): Promise<void> {
  await db("refresh_tokens").insert({
    user_id: token.userId,
    token_hash: token.tokenHash,
    expires_at: token.expiresAt,
  });
}

// The refresh token is single-use, so a stolen copy stops working once the real user refreshes.
// One statement revokes the old token, reads its user and saves the new token. Two racing refreshes
// can't both win: the second waits on the row, then finds it already revoked and matches nothing.
export async function rotateRefreshToken(
  db: Db,
  oldTokenHash: string,
  newToken: NewRefreshToken,
  now: Date,
): Promise<PublicUser | null> {
  const result = await db.raw<{ rows: PublicUser[] }>(
    `
    with redeemed as (
      update refresh_tokens t set revoked_at = :now
      from users u
      where u.id = t.user_id and t.token_hash = :oldTokenHash
        and t.revoked_at is null and t.expires_at > :now
      returning ${publicColumns.map((column) => `u.${column}`).join(", ")}
    ),
    saved_token as (
      insert into refresh_tokens (user_id, token_hash, expires_at)
      select id, :newTokenHash, :expiresAt from redeemed
    )
    select * from redeemed
    `,
    { now, oldTokenHash, newTokenHash: newToken.tokenHash, expiresAt: newToken.expiresAt },
  );
  return result.rows[0] ?? null;
}

export async function revokeRefreshToken(db: Db, tokenHash: string, now: Date): Promise<void> {
  await db("refresh_tokens")
    .where({ token_hash: tokenHash })
    .whereNull("revoked_at")
    .update({ revoked_at: now });
}

const DEAD_TOKEN_BATCH_SIZE = 1000;

// The one real delete in the app, an exception to soft deletes: a dead token is a spent credential that nothing
// reads again, a missing one gets the same 401, and marking it deleted wouldn't stop the table growing.
export function deleteDeadRefreshTokens(db: Db, now: Date, batchSize = DEAD_TOKEN_BATCH_SIZE): Promise<void> {
  return runInBatches(batchSize, () =>
    db("refresh_tokens")
      .whereIn(
        "id",
        db("refresh_tokens")
          .select("id")
          .whereRaw("coalesce(revoked_at, expires_at) <= ?", [now])
          .limit(batchSize),
      )
      .delete(),
  );
}
