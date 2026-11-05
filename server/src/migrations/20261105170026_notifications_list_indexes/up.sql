-- A person's list, newest first, so a page stops after its rows. The unread index only holds unread rows,
-- which stay few however long the list grows, so counting them on every bell refresh stays cheap.
-- Building an index here blocks writes. On a big table, build it with CONCURRENTLY as a deploy step first,
-- and this finds it and does nothing.
create index if not exists notifications_recipient_list_idx on notifications (recipient_id, created_at desc, id desc);
create index if not exists notifications_unread_idx on notifications (recipient_id) where read_at is null;
