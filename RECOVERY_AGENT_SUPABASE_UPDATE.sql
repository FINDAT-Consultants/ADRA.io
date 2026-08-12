-- Assurance Regent v4.7.0 — Recovery Agent Supabase upgrade
-- Run this in Supabase SQL Editor AFTER the v4.6.0 direct-browser setup.
-- This adds per-user Recovery Agent conversation storage and session-validated context RPCs.

create extension if not exists pgcrypto;

create table if not exists public.assurance_regent_agent_messages (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  role text not null check (role in ('user','assistant')),
  content text not null,
  source text not null default 'conversation',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists assurance_regent_agent_messages_user_created_idx
  on public.assurance_regent_agent_messages(user_id, created_at desc);

alter table public.assurance_regent_agent_messages enable row level security;
revoke all on table public.assurance_regent_agent_messages from anon, authenticated;

create or replace function public.assurance_regent_browser_agent_context(p_token text)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_uid text;
  v_state jsonb;
  v_actor jsonb;
begin
  select user_id into v_uid
  from public.assurance_regent_auth_sessions
  where token_hash=encode(digest(convert_to(coalesce(p_token,''),'UTF8'),'sha256'),'hex')
    and expires_at>now();

  if v_uid is null then
    raise exception 'Your Assurance Regent session has expired. Sign in again.';
  end if;

  update public.assurance_regent_auth_sessions
  set updated_at=now(),expires_at=now()+interval '12 hours'
  where token_hash=encode(digest(convert_to(p_token,'UTF8'),'sha256'),'hex');

  select state_value into v_state
  from public.assurance_regent_state
  where state_key='browser-client-state';

  if v_uid='Dvp' then
    v_actor:=jsonb_build_object(
      'id','Dvp','username','Dvp','name','Developer','email','',
      'position','System Developer','companyId','','role','Developer',
      'hiddenFromDirectory',true,'active',true
    );
  else
    select value into v_actor
    from jsonb_array_elements(coalesce(v_state#>'{auth,accounts}','[]'::jsonb)) as t(value)
    where lower(coalesce(value->>'id',''))=lower(v_uid)
    limit 1;
  end if;

  if v_actor is null then
    raise exception 'The signed-in Assurance Regent account could not be resolved.';
  end if;

  return jsonb_build_object(
    'actor',v_actor,
    'state',coalesce(v_state,'{}'::jsonb),
    'schemaVersion','4.7.0'
  );
end $$;

create or replace function public.assurance_regent_browser_agent_thread(p_token text,p_limit integer default 80)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_uid text;
  v_rows jsonb;
  v_limit integer:=greatest(1,least(coalesce(p_limit,80),150));
begin
  select user_id into v_uid
  from public.assurance_regent_auth_sessions
  where token_hash=encode(digest(convert_to(coalesce(p_token,''),'UTF8'),'sha256'),'hex')
    and expires_at>now();

  if v_uid is null then
    raise exception 'Your Assurance Regent session has expired. Sign in again.';
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at asc),'[]'::jsonb)
  into v_rows
  from (
    select id,role,content,source,metadata,created_at
    from public.assurance_regent_agent_messages
    where user_id=v_uid
    order by created_at desc
    limit v_limit
  ) x;

  return coalesce(v_rows,'[]'::jsonb);
end $$;

create or replace function public.assurance_regent_browser_agent_append(
  p_token text,
  p_role text,
  p_content text,
  p_source text default 'conversation',
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_uid text;
  v_row public.assurance_regent_agent_messages%rowtype;
begin
  select user_id into v_uid
  from public.assurance_regent_auth_sessions
  where token_hash=encode(digest(convert_to(coalesce(p_token,''),'UTF8'),'sha256'),'hex')
    and expires_at>now();

  if v_uid is null then
    raise exception 'Your Assurance Regent session has expired. Sign in again.';
  end if;
  if p_role not in ('user','assistant') then raise exception 'Invalid Recovery Agent role.'; end if;
  if length(trim(coalesce(p_content,'')))=0 then raise exception 'Recovery Agent message cannot be empty.'; end if;
  if length(p_content)>20000 then raise exception 'Recovery Agent message is too long.'; end if;

  insert into public.assurance_regent_agent_messages(user_id,role,content,source,metadata)
  values(v_uid,p_role,trim(p_content),coalesce(nullif(trim(p_source),''),'conversation'),coalesce(p_metadata,'{}'::jsonb))
  returning * into v_row;

  return to_jsonb(v_row);
end $$;

create or replace function public.assurance_regent_browser_agent_clear(p_token text)
returns integer
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_uid text;
  v_count integer;
begin
  select user_id into v_uid
  from public.assurance_regent_auth_sessions
  where token_hash=encode(digest(convert_to(coalesce(p_token,''),'UTF8'),'sha256'),'hex')
    and expires_at>now();

  if v_uid is null then
    raise exception 'Your Assurance Regent session has expired. Sign in again.';
  end if;

  delete from public.assurance_regent_agent_messages where user_id=v_uid;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

create or replace function public.assurance_regent_browser_health()
returns jsonb language sql security definer set search_path=public as $$
  select jsonb_build_object(
    'ok', true,
    'schemaVersion', '4.7.0',
    'developerReady', exists(select 1 from public.assurance_regent_browser_credentials where user_id='Dvp' and active=true),
    'stateReady', exists(select 1 from public.assurance_regent_state where state_key='browser-client-state'),
    'recoveryAgentReady', to_regclass('public.assurance_regent_agent_messages') is not null,
    'updatedAt', coalesce((select updated_at from public.assurance_regent_state where state_key='browser-client-state'), now())
  );
$$;

revoke all on function public.assurance_regent_browser_agent_context(text) from public;
revoke all on function public.assurance_regent_browser_agent_thread(text,integer) from public;
revoke all on function public.assurance_regent_browser_agent_append(text,text,text,text,jsonb) from public;
revoke all on function public.assurance_regent_browser_agent_clear(text) from public;
revoke all on function public.assurance_regent_browser_health() from public;

grant execute on function public.assurance_regent_browser_agent_context(text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_agent_thread(text,integer) to anon,authenticated;
grant execute on function public.assurance_regent_browser_agent_append(text,text,text,text,jsonb) to anon,authenticated;
grant execute on function public.assurance_regent_browser_agent_clear(text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_health() to anon,authenticated;

notify pgrst, 'reload schema';
