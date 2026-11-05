-- The unique reminder is the backstop: even if the claim logic were wrong, a second delivery fails here.
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null constraint notifications_recipient_id_fkey references users (id),
  reminder_id uuid not null
    constraint notifications_reminder_id_key unique
    constraint notifications_reminder_id_fkey references reminders (id),
  text text not null,
  created_at timestamptz not null,
  read_at timestamptz
);
