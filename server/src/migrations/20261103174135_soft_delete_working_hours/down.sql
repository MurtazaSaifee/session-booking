-- Without the column, deleted rows would read as live ones, so they go first. A second run finds the column
-- already gone, and a plain delete would fail on it.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = current_schema() and table_name = 'working_hours' and column_name = 'deleted_at'
  ) then
    delete from working_hours where deleted_at is not null;
  end if;
end $$;

drop index if exists working_hours_professional_id_idx;
create index if not exists working_hours_professional_id_idx on working_hours (professional_id);

alter table working_hours drop column if exists deleted_at;
