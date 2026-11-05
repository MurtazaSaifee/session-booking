-- Notices without a reminder can't exist under the old rule, so they go with this rollback.
delete from notifications where reminder_id is null;
alter table notifications alter column reminder_id set not null;
alter table sessions drop column if exists updated_at;
