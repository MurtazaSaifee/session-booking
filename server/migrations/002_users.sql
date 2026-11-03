create table users (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('member', 'professional')),
  name text not null,
  email text not null,
  password_hash text not null,
  timezone text not null,
  title text,
  bio text,
  created_at timestamptz not null default now()
);

create unique index users_email_key on users (lower(email));

create table refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
