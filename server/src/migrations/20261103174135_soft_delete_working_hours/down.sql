-- Without the column, deleted rows would read as live ones, so they go first.
delete from working_hours where deleted_at is not null;

drop index working_hours_professional_id_idx;
create index working_hours_professional_id_idx on working_hours (professional_id);

alter table working_hours drop column deleted_at;
