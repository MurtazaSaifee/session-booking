create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  role text not null,
  name text not null,
  email text not null,
  password_hash text not null,
  timezone text not null,
  title text,
  bio text,
  created_at timestamptz not null default now(),
  constraint users_role_check check (role in ('MEMBER', 'PROFESSIONAL'))
);

create unique index if not exists users_email_key on users (lower(email));

create table if not exists refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null constraint refresh_tokens_user_id_fkey references users (id) on delete cascade,
  token_hash text not null constraint refresh_tokens_token_hash_key unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
