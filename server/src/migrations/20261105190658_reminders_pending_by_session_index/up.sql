-- A cancel finds one session's pending reminders here, instead of reading every pending reminder under its lock.
-- Building this blocks writes, so on a big table build it with CONCURRENTLY first and this does nothing.
create index if not exists reminders_pending_session_idx on reminders (session_id) where status = 'PENDING';
