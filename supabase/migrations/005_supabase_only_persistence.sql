-- Assurance Regent — Supabase-only durable application state and private file storage.
-- Run after migrations 001-004.

create table if not exists public.assurance_regent_state (
  state_key text primary key,
  state_value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.assurance_regent_state enable row level security;
revoke all on table public.assurance_regent_state from anon, authenticated;
grant all on table public.assurance_regent_state to service_role;

comment on table public.assurance_regent_state is
  'Server-only durable state for Assurance Regent control center, live operational engine, AI advisor threads/activity, and trained model metadata.';


create table if not exists public.assurance_regent_auth_sessions (
  token_hash text primary key,
  user_id text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists assurance_regent_auth_sessions_expiry_idx
  on public.assurance_regent_auth_sessions(expires_at);

alter table public.assurance_regent_auth_sessions enable row level security;
revoke all on table public.assurance_regent_auth_sessions from anon, authenticated;
grant all on table public.assurance_regent_auth_sessions to service_role;

comment on table public.assurance_regent_auth_sessions is
  'Server-only authenticated session registry. Only SHA-256 token hashes are stored; raw cookie tokens are never persisted.';

insert into storage.buckets (id, name, public, file_size_limit)
values ('assurance-regent-files', 'assurance-regent-files', false, 8388608)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

-- Browser users are intentionally not granted direct access to this private bucket.
-- The Assurance Regent server uses the Supabase secret key and returns short-lived signed URLs.

-- Store MTS supporting files in Supabase Storage rather than base64 in Postgres.
alter table public.mts_work_sessions add column if not exists document_path text;
-- Existing document_data values are preserved for backward compatibility. New uploads use document_path.

-- Rework is a valid live workflow status used by the application.
alter table public.mts_work_sessions drop constraint if exists mts_work_sessions_status_check;
alter table public.mts_work_sessions add constraint mts_work_sessions_status_check check (status in ('active','completed','rework_required'));
