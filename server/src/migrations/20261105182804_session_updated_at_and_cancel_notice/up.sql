alter table sessions add column if not exists updated_at timestamptz not null default now();

-- A cancel notice belongs to a session, not to a reminder.
alter table notifications alter column reminder_id drop not null;
