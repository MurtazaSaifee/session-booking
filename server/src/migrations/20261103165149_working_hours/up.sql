create table if not exists working_hours (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null constraint working_hours_professional_id_fkey references users (id) on delete cascade,
  -- ISO weekday, Monday = 1
  weekday smallint not null,
  start_time time not null,
  end_time time not null
);

create index if not exists working_hours_professional_id_idx on working_hours (professional_id);
