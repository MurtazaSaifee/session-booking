alter table working_hours add column if not exists deleted_at timestamptz;

drop index if exists working_hours_professional_id_idx;
create index if not exists working_hours_professional_id_idx on working_hours (professional_id) where deleted_at is null;
