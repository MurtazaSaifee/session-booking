create table if not exists reminders (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null constraint reminders_session_id_fkey references sessions (id),
  recipient_id uuid not null constraint reminders_recipient_id_fkey references users (id),
  kind text not null,
  due_at timestamptz not null,
  status text not null,
  sent_at timestamptz
);

-- Sent reminders pile up forever, so the checker's index holds only the ones still waiting.
create index if not exists reminders_pending_due_idx on reminders (due_at) where status = 'PENDING';
