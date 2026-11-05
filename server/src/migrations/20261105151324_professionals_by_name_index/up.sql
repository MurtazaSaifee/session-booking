-- Professionals are a small share of users, so a partial index lets each page of the directory read only them.
create index users_professionals_by_name_idx on users (name, id) where role = 'PROFESSIONAL';
