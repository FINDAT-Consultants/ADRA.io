-- Assurance Regent v6.3.77 — Gmail OAuth connector persistence
-- OAuth client credentials are stored separately in Supabase Vault and are never committed here.

create table if not exists public.assurance_regent_gmail_connections (
  actor_id text primary key,
  company_id text not null default '',
  gmail_email text not null,
  google_subject text not null default '',
  refresh_token text not null,
  granted_scope text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create table if not exists public.assurance_regent_gmail_oauth_states (
  state_hash text primary key,
  actor_id text not null,
  company_id text not null default '',
  login_hint text not null default '',
  return_to text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

create index if not exists assurance_regent_gmail_connections_company_idx
  on public.assurance_regent_gmail_connections(company_id);
create index if not exists assurance_regent_gmail_oauth_states_expiry_idx
  on public.assurance_regent_gmail_oauth_states(expires_at);

alter table public.assurance_regent_gmail_connections enable row level security;
alter table public.assurance_regent_gmail_oauth_states enable row level security;

revoke all on table public.assurance_regent_gmail_connections from public, anon, authenticated;
revoke all on table public.assurance_regent_gmail_oauth_states from public, anon, authenticated;
grant select, insert, update, delete on table public.assurance_regent_gmail_connections to service_role;
grant select, insert, update, delete on table public.assurance_regent_gmail_oauth_states to service_role;

create or replace function public.assurance_regent_gmail_oauth_credentials()
returns jsonb
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_client_id text;
  v_client_secret text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role is required.';
  end if;

  select decrypted_secret into v_client_id
  from vault.decrypted_secrets
  where name = 'assurance_regent_gmail_client_id'
  order by updated_at desc nulls last, created_at desc
  limit 1;

  select decrypted_secret into v_client_secret
  from vault.decrypted_secrets
  where name = 'assurance_regent_gmail_client_secret'
  order by updated_at desc nulls last, created_at desc
  limit 1;

  return jsonb_build_object(
    'client_id', coalesce(v_client_id, ''),
    'client_secret', coalesce(v_client_secret, '')
  );
end;
$$;

revoke all on function public.assurance_regent_gmail_oauth_credentials() from public, anon, authenticated;
grant execute on function public.assurance_regent_gmail_oauth_credentials() to service_role;

comment on table public.assurance_regent_gmail_connections is
  'Server-only Gmail OAuth refresh-token connections for Assurance Regent users.';
comment on table public.assurance_regent_gmail_oauth_states is
  'Short-lived OAuth CSRF state records for Gmail connection handshakes.';
comment on function public.assurance_regent_gmail_oauth_credentials() is
  'Service-role-only reader for Gmail OAuth client credentials stored in Supabase Vault.';
