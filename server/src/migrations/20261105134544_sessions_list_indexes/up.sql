-- The overlap constraints' indexes only hold booked sessions, so they can't serve a list of cancelled ones.
-- Ordering by end time also lets a page stop after its rows, and skips past sessions when finding future ones.
-- Building an index here blocks writes. On a big table, build it with CONCURRENTLY as a deploy step first,
-- and this finds it and does nothing.
create index if not exists sessions_member_list_idx on sessions (member_id, status, ends_at, id);
create index if not exists sessions_professional_list_idx on sessions (professional_id, status, ends_at, id);
