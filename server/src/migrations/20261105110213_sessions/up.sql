create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null constraint sessions_member_id_fkey references users (id),
  professional_id uuid not null constraint sessions_professional_id_fkey references users (id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null,
  created_at timestamptz not null default now(),
  constraint sessions_professional_overlap exclude using gist
    (professional_id with =, tstzrange(starts_at, ends_at) with &&) where (status = 'BOOKED'),
  constraint sessions_member_overlap exclude using gist
    (member_id with =, tstzrange(starts_at, ends_at) with &&) where (status = 'BOOKED')
);
