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

-- ---------------------------------------------------------------------------
-- Permanent Developer bootstrap account
-- ---------------------------------------------------------------------------
-- Keeps the Developer identity in Supabase as Dvp and replaces any older
-- Developer bootstrap record without deleting Administrator/Employee users.
-- The value stored below is a salted scrypt verifier, not a plaintext password.
do $$
declare
  dev jsonb := jsonb_build_object(
    'id','Dvp',
    'username','Dvp',
    'name','Developer',
    'email','',
    'position','System Developer',
    'companyId','',
    'role','Developer',
    'profilePhoto','',
    'passwordHash','8b403a864a040c65c95f6be9862db40d:ec726b8cac7fda21c6bf5ad94d7528b586850cabf6934f43f25e6d2cfcaeb7c2c23a2c85c60d8a13e49ac4d542104855ad7efb1a8cdc23184e9e8f19eca56bb6',
    'hiddenFromDirectory',true,
    'canReview',true,
    'canManageSettings',true,
    'active',true
  );
  current_state jsonb;
  retained_users jsonb;
begin
  select state_value
    into current_state
    from public.assurance_regent_state
   where state_key='control-center'
   for update;

  if current_state is null then
    current_state := '{}'::jsonb;
  end if;

  select coalesce(jsonb_agg(u), '[]'::jsonb)
    into retained_users
    from jsonb_array_elements(
      case when jsonb_typeof(current_state->'users')='array'
           then current_state->'users'
           else '[]'::jsonb end
    ) as u
   where lower(coalesce(u->>'id','')) <> 'dvp'
     and lower(coalesce(u->>'username','')) <> 'dvp'
     and coalesce(u->>'role','') <> 'Developer';

  current_state := jsonb_set(current_state, '{users}', retained_users || jsonb_build_array(dev), true);
  current_state := jsonb_set(current_state, '{version}', '2'::jsonb, true);

  insert into public.assurance_regent_state(state_key,state_value,updated_at)
  values ('control-center', current_state, now())
  on conflict (state_key) do update
    set state_value=excluded.state_value,
        updated_at=excluded.updated_at;
end $$;

