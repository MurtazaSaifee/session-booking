alter table working_hours add column deleted_at timestamptz;

drop index working_hours_professional_id_idx;
create index working_hours_professional_id_idx on working_hours (professional_id) where deleted_at is null;
