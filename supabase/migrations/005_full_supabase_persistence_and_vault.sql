-- Assurance Regent — full mutable-state persistence, durable sessions, secure Vault access.
-- Run after migrations 001-004.

create extension if not exists pgcrypto;

create table if not exists public.app_state_documents (
  state_key text primary key,
  state_value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists app_state_documents_updated_idx on public.app_state_documents(updated_at desc);

create table if not exists public.app_auth_sessions (
  token_hash text primary key,
  user_id text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists app_auth_sessions_user_idx on public.app_auth_sessions(user_id);
create index if not exists app_auth_sessions_expiry_idx on public.app_auth_sessions(expires_at);

-- The application uses server-side Supabase credentials. Browser users receive no direct table policies.
alter table public.app_state_documents enable row level security;
alter table public.app_auth_sessions enable row level security;
alter table public.agent_memories enable row level security;
alter table public.agent_session_items enable row level security;
alter table public.system_records enable row level security;
alter table public.agent_action_log enable row level security;

-- MTS application code supports rework_required in addition to active/completed.
alter table public.mts_work_sessions drop constraint if exists mts_work_sessions_status_check;
alter table public.mts_work_sessions
  add constraint mts_work_sessions_status_check
  check (status in ('active','completed','rework_required'));

-- Private Storage bucket for approved document archive copies.
insert into storage.buckets (id, name, public, file_size_limit)
values ('approved-documents','approved-documents',false,52428800)
on conflict (id) do update
set public=false,
    file_size_limit=excluded.file_size_limit;

-- Server-only function used by the Node application to retrieve named Supabase Vault secrets.
-- It is intentionally not executable by anon/authenticated browser roles.
create or replace function public.get_server_secret(secret_name text)
returns text
language sql
security definer
set search_path = ''
as $$
  select ds.decrypted_secret
  from vault.decrypted_secrets as ds
  where ds.name = $1
  order by ds.updated_at desc
  limit 1;
$$;

revoke all on function public.get_server_secret(text) from public;
revoke all on function public.get_server_secret(text) from anon;
revoke all on function public.get_server_secret(text) from authenticated;
grant execute on function public.get_server_secret(text) to service_role;

comment on table public.app_state_documents is 'Server-only JSONB persistence for Assurance Regent mutable application state such as control center, live state, AI brain, activity trace and trained model state.';
comment on table public.app_auth_sessions is 'Server-only hashed bearer-session records. Raw session tokens are never stored.';
comment on function public.get_server_secret(text) is 'Server-only accessor for named Supabase Vault secrets. Never grant this function to browser roles.';

-- OPENAI KEY SETUP (do this after the schema succeeds):
-- 1) If no OPENAI_API_KEY secret exists yet, replace the placeholder and run:
-- select vault.create_secret('PASTE_YOUR_OPENAI_API_KEY_HERE', 'OPENAI_API_KEY', 'Assurance Regent OpenAI server key');
--
-- 2) To rotate an existing named secret, find its id and update it:
-- select id, name, updated_at from vault.decrypted_secrets where name='OPENAI_API_KEY';
-- select vault.update_secret('PASTE_SECRET_UUID_HERE', 'PASTE_NEW_OPENAI_API_KEY_HERE', 'OPENAI_API_KEY', 'Assurance Regent OpenAI server key');
--
-- Do not put the real OpenAI key in GitHub, public JavaScript, index.html, or a normal public table.
