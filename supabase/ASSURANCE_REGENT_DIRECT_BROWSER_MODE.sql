-- Assurance Regent v4.6.0 — Direct Supabase browser bridge (NO Netlify Functions required)
-- Run this ONCE in Supabase SQL Editor.
-- Browser uses only the Supabase publishable key. Tables stay private; access is through these RPC functions.

create extension if not exists pgcrypto;

create table if not exists public.assurance_regent_state (
  state_key text primary key,
  state_value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.assurance_regent_auth_sessions (
  token_hash text primary key,
  user_id text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assurance_regent_browser_credentials (
  user_id text primary key,
  username text not null unique,
  email text not null default '',
  password_hash text not null,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
create unique index if not exists assurance_regent_browser_credentials_email_idx on public.assurance_regent_browser_credentials(lower(email)) where email<>'';

alter table public.assurance_regent_state enable row level security;
alter table public.assurance_regent_auth_sessions enable row level security;
alter table public.assurance_regent_browser_credentials enable row level security;
revoke all on table public.assurance_regent_state from anon, authenticated;
revoke all on table public.assurance_regent_auth_sessions from anon, authenticated;
revoke all on table public.assurance_regent_browser_credentials from anon, authenticated;

-- Permanent Developer credential. Password remains Dvp / Abcd@1234; only a bcrypt verifier is stored.
insert into public.assurance_regent_browser_credentials(user_id,username,email,password_hash,active,updated_at)
values('Dvp','Dvp','', '$2a$12$uWQWnOKitub4UjCpSGOcaOxwBp.gB1BzK3zX/g8D.sokH22NZdzpS', true, now())
on conflict(user_id) do update set username='Dvp',email='',password_hash=excluded.password_hash,active=true,updated_at=now();

do $$
declare
  v_control jsonb; v_live jsonb; v_mts jsonb; v_accounts jsonb; v_companies jsonb;
begin
  if not exists (select 1 from public.assurance_regent_state where state_key='browser-client-state') then
    select state_value into v_control from public.assurance_regent_state where state_key='control-center';
    select state_value into v_live from public.assurance_regent_state where state_key='live-system-data';
    select state_value into v_mts from public.assurance_regent_state where state_key='mts-runtime';
    v_accounts := coalesce(v_control->'users','[]'::jsonb);
    select coalesce(jsonb_agg(x - 'passwordHash'),'[]'::jsonb) into v_accounts
      from jsonb_array_elements(v_accounts) x
      where lower(coalesce(x->>'id','')) <> 'dvp' and lower(coalesce(x->>'username','')) <> 'dvp';
    v_companies := coalesce(v_control->'companies','[]'::jsonb);
    insert into public.assurance_regent_state(state_key,state_value) values (
      'browser-client-state',
      jsonb_build_object(
        'version',1,
        'auth',jsonb_build_object('accounts',coalesce(v_accounts,'[]'::jsonb),'companies',coalesce(v_companies,'[]'::jsonb)),
        'control',jsonb_build_object(
          'settings',coalesce(v_control->'settings',jsonb_build_object('countryCode','','country','Not configured','currency','USD','currencyName','US Dollar','defaultHourlyRate',0,'employeeHourlyRates','{}'::jsonb,'projectHourlyRates','{}'::jsonb)),
          'documents',coalesce(v_control->'documents','[]'::jsonb),
          'reviews',coalesce(v_control->'reviews','[]'::jsonb),
          'reviewResolutions',coalesce(v_control->'reviewResolutions','{}'::jsonb)
        ),
        'mts',coalesce(v_mts,jsonb_build_object('sessions','[]'::jsonb,'messages','[]'::jsonb)),
        'mappings','[]'::jsonb,
        'live',coalesce(v_live,jsonb_build_object('employees','[]'::jsonb,'projects','[]'::jsonb,'payroll','[]'::jsonb,'calendar','[]'::jsonb,'timeEntries','[]'::jsonb,'sources','[]'::jsonb,'sourceChecks','[]'::jsonb,'vacancies','[]'::jsonb,'candidates','[]'::jsonb,'onboarding','[]'::jsonb))
      )
    );
  end if;
end $$;

create or replace function public.assurance_regent_browser_login(p_username text,p_password text,p_role text default '')
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_cred record; v_state jsonb; v_user jsonb; v_token text; v_requested text:=trim(coalesce(p_role,''));
begin
  if trim(coalesce(p_username,''))='' or coalesce(p_password,'')='' then raise exception 'Username and password are required.'; end if;
  select * into v_cred from public.assurance_regent_browser_credentials where active=true and (lower(username)=lower(trim(p_username)) or (email<>'' and lower(email)=lower(trim(p_username)))) limit 1;
  if v_cred.user_id is null or crypt(p_password,v_cred.password_hash)<>v_cred.password_hash then raise exception 'Invalid username/email or password.'; end if;
  if v_cred.user_id='Dvp' then
    v_user:=jsonb_build_object('id','Dvp','username','Dvp','name','Developer','email','','position','System Developer','companyId','','role','Developer','hiddenFromDirectory',true,'active',true);
  else
    select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state';
    select value into v_user from jsonb_array_elements(coalesce(v_state#>'{auth,accounts}','[]'::jsonb)) as t(value) where value->>'id'=v_cred.user_id limit 1;
    if v_user is null then raise exception 'This account is not present in Assurance Regent application state.'; end if;
    if coalesce((v_user->>'active')::boolean,true)=false then raise exception 'This account is inactive.'; end if;
    if coalesce(v_user->>'role','Employee')<>'Developer' and v_requested<>'' and v_requested<>coalesce(v_user->>'role','Employee') then raise exception 'This account is registered as %.',coalesce(v_user->>'role','Employee'); end if;
  end if;
  delete from public.assurance_regent_auth_sessions where expires_at<=now();
  v_token:=encode(gen_random_bytes(32),'hex');
  insert into public.assurance_regent_auth_sessions(token_hash,user_id,expires_at,created_at,updated_at) values(encode(digest(convert_to(v_token,'UTF8'),'sha256'),'hex'),v_cred.user_id,now()+interval '12 hours',now(),now());
  return jsonb_build_object('token',v_token,'userId',v_cred.user_id,'user',v_user);
end $$;

create or replace function public.assurance_regent_browser_register(p_user_id text,p_company_code text,p_name text,p_position text,p_email text,p_password text,p_role text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_state jsonb; v_accounts jsonb; v_companies jsonb; v_company jsonb; v_account jsonb; v_id text:=trim(coalesce(p_user_id,'')); v_role text:=trim(coalesce(p_role,'')); v_token text;
begin
 if v_id='' or trim(coalesce(p_company_code,''))='' or trim(coalesce(p_name,''))='' or trim(coalesce(p_position,''))='' then raise exception 'User ID, company code, name and position are required.'; end if;
 if length(coalesce(p_password,''))<8 then raise exception 'Password must contain at least 8 characters.'; end if;
 if v_role not in ('Administrator','Employee') then raise exception 'Choose Administrator or Employee registration.'; end if;
 select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state' for update;
 v_accounts:=coalesce(v_state#>'{auth,accounts}','[]'::jsonb);v_companies:=coalesce(v_state#>'{auth,companies}','[]'::jsonb);
 if exists(select 1 from jsonb_array_elements(v_accounts) x where lower(coalesce(x->>'id',''))=lower(v_id) or lower(coalesce(x->>'username',''))=lower(v_id)) then raise exception 'That username is already registered.'; end if;
 if trim(coalesce(p_email,''))<>'' and exists(select 1 from public.assurance_regent_browser_credentials where lower(email)=lower(trim(p_email))) then raise exception 'That email address is already registered.'; end if;
 select value into v_company from jsonb_array_elements(v_companies) as t(value) where lower(coalesce(value->>'code',''))=lower(trim(p_company_code)) limit 1;
 if v_company is null then raise exception 'A valid Developer-created company code is required.'; end if;
 if v_role='Administrator' and p_position !~* '(country director|chief executive officer|ceo|country partner|managing director)' then raise exception 'Administrator registration requires a leadership position.'; end if;
 if v_role='Administrator' and exists(select 1 from jsonb_array_elements(v_accounts) x where x->>'companyId'=v_company->>'id' and x->>'role'='Administrator' and coalesce((x->>'active')::boolean,true)=true) then raise exception 'This company already has an Administrator. Ask the Developer or company Administrator to assign additional Administrator access.'; end if;
 v_account:=jsonb_build_object('id',v_id,'username',v_id,'name',trim(p_name),'email',trim(coalesce(p_email,'')),'position',trim(p_position),'companyId',v_company->>'id','role',v_role,'profilePhoto','','hiddenFromDirectory',false,'active',true,'createdAt',now());
 v_state:=jsonb_set(v_state,'{auth,accounts}',v_accounts||jsonb_build_array(v_account),true);
 update public.assurance_regent_state set state_value=v_state,updated_at=now() where state_key='browser-client-state';
 insert into public.assurance_regent_browser_credentials(user_id,username,email,password_hash,active,updated_at) values(v_id,v_id,trim(coalesce(p_email,'')),crypt(p_password,gen_salt('bf',12)),true,now());
 v_token:=encode(gen_random_bytes(32),'hex');insert into public.assurance_regent_auth_sessions(token_hash,user_id,expires_at) values(encode(digest(convert_to(v_token,'UTF8'),'sha256'),'hex'),v_id,now()+interval '12 hours');
 return jsonb_build_object('token',v_token,'user',v_account);
end $$;

create or replace function public.assurance_regent_browser_admin_upsert_user(p_token text,p_user_id text,p_company_id text,p_name text,p_position text,p_email text,p_password text,p_role text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_actor text; v_state jsonb; v_accounts jsonb; v_account jsonb; v_id text:=trim(coalesce(p_user_id,'')); v_idx int;
begin
 select user_id into v_actor from public.assurance_regent_auth_sessions where token_hash=encode(digest(convert_to(coalesce(p_token,''),'UTF8'),'sha256'),'hex') and expires_at>now();
 if v_actor<>'Dvp' then raise exception 'Developer permission is required.'; end if;
 if v_id='' or trim(coalesce(p_company_id,''))='' or trim(coalesce(p_name,''))='' or trim(coalesce(p_position,''))='' or length(coalesce(p_password,''))<8 then raise exception 'Company, username, name, position and an 8-character password are required.'; end if;
 if p_role not in ('Administrator','Employee') then raise exception 'Choose Administrator or Employee.'; end if;
 select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state' for update;
 if not exists(select 1 from jsonb_array_elements(coalesce(v_state#>'{auth,companies}','[]'::jsonb)) c where c->>'id'=p_company_id) then raise exception 'Select a valid Developer-created company.'; end if;
 v_account:=jsonb_build_object('id',v_id,'username',v_id,'name',trim(p_name),'email',trim(coalesce(p_email,'')),'position',trim(p_position),'companyId',p_company_id,'role',p_role,'profilePhoto','','hiddenFromDirectory',false,'active',true,'createdAt',now(),'createdBy','Dvp');
 v_accounts:=coalesce(v_state#>'{auth,accounts}','[]'::jsonb);
 select ordinality-1 into v_idx from jsonb_array_elements(v_accounts) with ordinality as t(value,ordinality) where lower(coalesce(value->>'id',''))=lower(v_id) limit 1;
 if v_idx is null then v_accounts:=v_accounts||jsonb_build_array(v_account); else v_account:=coalesce(v_accounts->v_idx,'{}'::jsonb)||v_account; v_accounts:=jsonb_set(v_accounts,array[v_idx::text],v_account,false); end if;
 v_state:=jsonb_set(v_state,'{auth,accounts}',v_accounts,true);update public.assurance_regent_state set state_value=v_state,updated_at=now() where state_key='browser-client-state';
 insert into public.assurance_regent_browser_credentials(user_id,username,email,password_hash,active,updated_at) values(v_id,v_id,trim(coalesce(p_email,'')),crypt(p_password,gen_salt('bf',12)),true,now()) on conflict(user_id) do update set username=excluded.username,email=excluded.email,password_hash=excluded.password_hash,active=true,updated_at=now();
 return v_account;
end $$;

create or replace function public.assurance_regent_browser_admin_delete_user(p_token text,p_user_id text)
returns boolean language plpgsql security definer set search_path=public,extensions as $$
declare v_actor text; v_state jsonb; v_accounts jsonb;
begin
 select user_id into v_actor from public.assurance_regent_auth_sessions where token_hash=encode(digest(convert_to(coalesce(p_token,''),'UTF8'),'sha256'),'hex') and expires_at>now();
 if v_actor<>'Dvp' then raise exception 'Developer permission is required.'; end if;
 if lower(trim(coalesce(p_user_id,'')))='dvp' then raise exception 'The permanent Developer account cannot be deleted.'; end if;
 select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state' for update;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into v_accounts from jsonb_array_elements(coalesce(v_state#>'{auth,accounts}','[]'::jsonb)) x where lower(coalesce(x->>'id',''))<>lower(trim(p_user_id));
 v_state:=jsonb_set(v_state,'{auth,accounts}',v_accounts,true);update public.assurance_regent_state set state_value=v_state,updated_at=now() where state_key='browser-client-state';
 delete from public.assurance_regent_browser_credentials where lower(user_id)=lower(trim(p_user_id));
 delete from public.assurance_regent_auth_sessions where lower(user_id)=lower(trim(p_user_id));
 return true;
end $$;

create or replace function public.assurance_regent_browser_read_state(p_token text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_uid text; v_value jsonb;
begin
 select user_id into v_uid from public.assurance_regent_auth_sessions where token_hash=encode(digest(convert_to(coalesce(p_token,''),'UTF8'),'sha256'),'hex') and expires_at>now();
 if v_uid is null then raise exception 'Your Assurance Regent session has expired. Sign in again.'; end if;
 update public.assurance_regent_auth_sessions set updated_at=now(),expires_at=now()+interval '12 hours' where token_hash=encode(digest(convert_to(p_token,'UTF8'),'sha256'),'hex');
 select state_value into v_value from public.assurance_regent_state where state_key='browser-client-state';return coalesce(v_value,'{}'::jsonb);
end $$;

create or replace function public.assurance_regent_browser_write_state(p_token text,p_value jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_uid text; v_role text; v_current jsonb; v_account jsonb; v_next jsonb:=p_value;
begin
 select user_id into v_uid from public.assurance_regent_auth_sessions where token_hash=encode(digest(convert_to(coalesce(p_token,''),'UTF8'),'sha256'),'hex') and expires_at>now();
 if v_uid is null then raise exception 'Your Assurance Regent session has expired. Sign in again.'; end if;
 if p_value is null or jsonb_typeof(p_value)<>'object' then raise exception 'Invalid Assurance Regent state.'; end if;
 select state_value into v_current from public.assurance_regent_state where state_key='browser-client-state' for update;
 if v_uid='Dvp' then v_role:='Developer'; else select value into v_account from jsonb_array_elements(coalesce(v_current#>'{auth,accounts}','[]'::jsonb)) as t(value) where value->>'id'=v_uid limit 1; v_role:=coalesce(v_account->>'role','Employee'); end if;
 if v_role not in ('Developer','Administrator') then v_next:=jsonb_set(v_next,'{auth}',coalesce(v_current->'auth',jsonb_build_object('accounts','[]'::jsonb,'companies','[]'::jsonb)),true); end if;
 insert into public.assurance_regent_state(state_key,state_value,updated_at) values('browser-client-state',v_next,now()) on conflict(state_key) do update set state_value=excluded.state_value,updated_at=excluded.updated_at;
 update public.assurance_regent_auth_sessions set updated_at=now(),expires_at=now()+interval '12 hours' where token_hash=encode(digest(convert_to(p_token,'UTF8'),'sha256'),'hex');return v_next;
end $$;

create or replace function public.assurance_regent_browser_logout(p_token text)
returns boolean language plpgsql security definer set search_path=public,extensions as $$
begin delete from public.assurance_regent_auth_sessions where token_hash=encode(digest(convert_to(coalesce(p_token,''),'UTF8'),'sha256'),'hex');return true;end $$;

create or replace function public.assurance_regent_browser_health()
returns jsonb language sql security definer set search_path=public as $$
  select jsonb_build_object(
    'ok', true,
    'schemaVersion', '4.6.0',
    'developerReady', exists(select 1 from public.assurance_regent_browser_credentials where user_id='Dvp' and active=true),
    'stateReady', exists(select 1 from public.assurance_regent_state where state_key='browser-client-state'),
    'updatedAt', coalesce((select updated_at from public.assurance_regent_state where state_key='browser-client-state'), now())
  );
$$;

revoke all on function public.assurance_regent_browser_login(text,text,text) from public;
revoke all on function public.assurance_regent_browser_register(text,text,text,text,text,text,text) from public;
revoke all on function public.assurance_regent_browser_admin_upsert_user(text,text,text,text,text,text,text,text) from public;
revoke all on function public.assurance_regent_browser_admin_delete_user(text,text) from public;
revoke all on function public.assurance_regent_browser_read_state(text) from public;
revoke all on function public.assurance_regent_browser_write_state(text,jsonb) from public;
revoke all on function public.assurance_regent_browser_logout(text) from public;
revoke all on function public.assurance_regent_browser_health() from public;
grant execute on function public.assurance_regent_browser_login(text,text,text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_register(text,text,text,text,text,text,text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_admin_upsert_user(text,text,text,text,text,text,text,text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_admin_delete_user(text,text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_read_state(text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_write_state(text,jsonb) to anon,authenticated;
grant execute on function public.assurance_regent_browser_logout(text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_health() to anon,authenticated;

notify pgrst, 'reload schema';

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
