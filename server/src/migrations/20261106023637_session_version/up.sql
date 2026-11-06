-- Goes up on every move and cancel, so a change built on an old read can tell the session has changed since,
-- even if it moved away and came back to the same start.
alter table sessions add column if not exists version integer not null default 0;
