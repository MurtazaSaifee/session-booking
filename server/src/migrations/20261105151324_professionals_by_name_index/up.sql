-- Professionals are a small share of users, so a partial index lets each page of the directory read only them.
-- Building an index here blocks writes. On a big table, build it with CONCURRENTLY as a deploy step first,
-- and this finds it and does nothing.
create index if not exists users_professionals_by_name_idx on users (name, id) where role = 'PROFESSIONAL';
