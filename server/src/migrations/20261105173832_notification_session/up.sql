alter table notifications
  add column if not exists session_id uuid constraint notifications_session_id_fkey references sessions (id);

update notifications n set session_id = r.session_id
from reminders r
where r.id = n.reminder_id and n.session_id is null;

alter table notifications alter column session_id set not null;
