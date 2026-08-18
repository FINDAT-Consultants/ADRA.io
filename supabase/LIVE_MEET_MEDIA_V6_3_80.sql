-- Assurance Regent v6.3.80 — Developer-managed live Google Meet Media connection
-- Restricted OAuth tokens are server-only. The browser receives only a short-lived access token
-- after an authorized recruitment action has been validated by the Edge Function.

create table if not exists public.assurance_regent_meet_media_connections (
  actor_id text primary key,
  gmail_email text not null,
  google_subject text not null default '',
  refresh_token text not null,
  granted_scope text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create table if not exists public.assurance_regent_meet_media_oauth_states (
  state_hash text primary key,
  actor_id text not null,
  return_to text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

create index if not exists assurance_regent_meet_media_oauth_states_expiry_idx
  on public.assurance_regent_meet_media_oauth_states(expires_at);

alter table public.assurance_regent_meet_media_connections enable row level security;
alter table public.assurance_regent_meet_media_oauth_states enable row level security;

revoke all on table public.assurance_regent_meet_media_connections from public, anon, authenticated;
revoke all on table public.assurance_regent_meet_media_oauth_states from public, anon, authenticated;
grant select, insert, update, delete on table public.assurance_regent_meet_media_connections to service_role;
grant select, insert, update, delete on table public.assurance_regent_meet_media_oauth_states to service_role;

comment on table public.assurance_regent_meet_media_connections is
  'Server-only Developer platform OAuth refresh token for the restricted Google Meet Media API.';
comment on table public.assurance_regent_meet_media_oauth_states is
  'Short-lived CSRF state records for Developer-only Google Meet Media authorization.';
