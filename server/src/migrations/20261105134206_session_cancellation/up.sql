alter table sessions
  add column cancelled_by uuid constraint sessions_cancelled_by_fkey references users (id),
  add column cancelled_at timestamptz;
