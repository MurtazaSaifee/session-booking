alter table sessions
  add column if not exists cancelled_by uuid constraint sessions_cancelled_by_fkey references users (id),
  add column if not exists cancelled_at timestamptz;
