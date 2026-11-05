import type { Db } from "../db.js";
import { PAGE_QUERY_LIMIT, toPage, type Page, type Position } from "../paging.js";

export type MyNotification = { id: string; text: string; createdAt: Date };

export type MyNotifications = Page<MyNotification> & { unreadCount: number };

// With no notifications on this page, the left join still returns one row of nulls to carry the count.
type ListRow = { unread_count: string } & (
  { id: string; text: string; created_at: Date } | { id: null; text: null; created_at: null }
);

// One round trip for the page and the unread count, on every page, since the bell reads the count from here.
export async function listMyNotifications(
  db: Db,
  recipientId: string,
  after?: Position,
): Promise<MyNotifications> {
  const result = await db.raw<{ rows: ListRow[] }>(
    `
    select unread.unread_count, page.id, page.text, page.created_at
    from (
      select count(*) as unread_count from notifications where recipient_id = :recipientId and read_at is null
    ) unread
    left join lateral (
      select id, text, created_at
      from notifications
      where recipient_id = :recipientId ${after ? "and (created_at, id) < (:afterValue, :afterId)" : ""}
      order by created_at desc, id desc
      limit :limit
    ) page on true
    order by page.created_at desc, page.id desc
    `,
    { recipientId, limit: PAGE_QUERY_LIMIT, afterValue: after?.value, afterId: after?.id },
  );
  const rows = result.rows.flatMap((row) =>
    row.id === null ? [] : [{ id: row.id, text: row.text, createdAt: row.created_at }],
  );
  return {
    ...toPage(rows, (row) => ({ value: row.createdAt.toISOString(), id: row.id })),
    unreadCount: Number(result.rows[0].unread_count),
  };
}

export async function markAllRead(db: Db, recipientId: string, now: Date): Promise<void> {
  await db("notifications")
    .where({ recipient_id: recipientId })
    .whereNull("read_at")
    .update({ read_at: now });
}
