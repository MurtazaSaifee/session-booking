-- A cancel finds one session's pending reminders here, instead of reading every pending reminder under its lock.
-- Building an index here blocks writes. On a big table, build it with CONCURRENTLY as a deploy step first,
-- and this finds it and does nothing.
create index if not exists reminders_pending_session_idx on reminders (session_id) where status = 'PENDING';
