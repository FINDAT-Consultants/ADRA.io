-- Assurance Regent v6.1.0 — Scalability, Traffic Management & Jivan Resilience
-- Run AFTER v6.0.0 RECOVERY_ASSURANCE_V6_0_0.sql.
-- This migration is additive. It preserves existing application data and security boundaries.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Query/index hardening for high-concurrency paths
-- ---------------------------------------------------------------------------
create index if not exists ar_auth_sessions_user_expiry_idx
  on public.assurance_regent_auth_sessions(user_id, expires_at desc);
create index if not exists ar_auth_sessions_expiry_idx
  on public.assurance_regent_auth_sessions(expires_at);
create index if not exists ar_credentials_status_idx
  on public.assurance_regent_browser_credentials(approval_status, active, updated_at desc);
create index if not exists ar_agent_messages_user_created_idx
  on public.assurance_regent_agent_messages(user_id, created_at desc);
create index if not exists ar_agent_tasks_queue_idx
  on public.assurance_regent_agent_tasks(status, priority, updated_at, created_at)
  where status in ('QUEUED','RUNNING','WAITING_USER');
create index if not exists ar_agent_tasks_company_status_idx
  on public.assurance_regent_agent_tasks(company_id, status, updated_at desc);
create index if not exists ar_agent_audit_status_created_idx
  on public.assurance_regent_agent_audit(status, created_at desc);
create index if not exists ar_leave_company_status_created_idx
  on public.assurance_regent_leave_requests(company_id, status, created_at desc);
create index if not exists ar_work_status_company_updated_idx
  on public.assurance_regent_work_status(company_id, updated_at desc);
create index if not exists ar_work_status_history_company_created_idx
  on public.assurance_regent_work_status_history(company_id, created_at desc);
create index if not exists ar_recovery_approvals_passport_stage_created_idx
  on public.assurance_regent_recovery_approvals(passport_id, stage, created_at desc);
create index if not exists ar_recovery_passport_keys_passport_idx
  on public.assurance_regent_recovery_passport_keys(passport_id, key_name);
create index if not exists ar_recovery_journal_lines_batch_idx
  on public.assurance_regent_recovery_journal_lines(batch_id, line_no);

-- ---------------------------------------------------------------------------
-- 2. Per-user/scoped rate-limit buckets used by Jivan and high-cost operations
-- ---------------------------------------------------------------------------
create table if not exists public.assurance_regent_rate_limit_buckets (
  subject_key text not null,
  scope text not null,
  window_start timestamptz not null,
  request_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key(subject_key, scope)
);
create index if not exists ar_rate_limit_updated_idx
  on public.assurance_regent_rate_limit_buckets(updated_at);
alter table public.assurance_regent_rate_limit_buckets enable row level security;
revoke all on public.assurance_regent_rate_limit_buckets from public,anon,authenticated;

create or replace function public.assurance_regent_browser_rate_limit_take(
  p_token text,
  p_scope text,
  p_limit integer default 30,
  p_window_seconds integer default 60
) returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_actor jsonb;
  v_uid text;
  v_scope text:=upper(trim(coalesce(p_scope,'GENERAL')));
  v_limit integer:=greatest(1,least(coalesce(p_limit,30),600));
  v_window integer:=greatest(10,least(coalesce(p_window_seconds,60),3600));
  v_now timestamptz:=clock_timestamp();
  v_row public.assurance_regent_rate_limit_buckets%rowtype;
  v_allowed boolean;
  v_retry integer:=0;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  v_uid:=coalesce(v_actor->>'id','');
  if v_uid='' then raise exception 'A valid Assurance Regent session is required.'; end if;
  if v_scope !~ '^[A-Z0-9_-]{1,40}$' then raise exception 'Invalid rate-limit scope.'; end if;

  insert into public.assurance_regent_rate_limit_buckets(subject_key,scope,window_start,request_count,updated_at)
  values(v_uid,v_scope,v_now,0,v_now)
  on conflict(subject_key,scope) do nothing;

  select * into v_row
  from public.assurance_regent_rate_limit_buckets
  where subject_key=v_uid and scope=v_scope
  for update;

  if v_row.window_start <= v_now - make_interval(secs=>v_window) then
    update public.assurance_regent_rate_limit_buckets
      set window_start=v_now, request_count=1, updated_at=v_now
      where subject_key=v_uid and scope=v_scope
      returning * into v_row;
    v_allowed:=true;
  elsif v_row.request_count < v_limit then
    update public.assurance_regent_rate_limit_buckets
      set request_count=request_count+1, updated_at=v_now
      where subject_key=v_uid and scope=v_scope
      returning * into v_row;
    v_allowed:=true;
  else
    v_allowed:=false;
    v_retry:=greatest(1,ceil(extract(epoch from ((v_row.window_start + make_interval(secs=>v_window)) - v_now)))::integer);
  end if;

  return jsonb_build_object(
    'allowed',v_allowed,
    'scope',v_scope,
    'limit',v_limit,
    'windowSeconds',v_window,
    'used',v_row.request_count,
    'remaining',greatest(0,v_limit-v_row.request_count),
    'retryAfterSeconds',v_retry
  );
end $$;

-- ---------------------------------------------------------------------------
-- 3. Incident register: Jivan/client can report faults without exposing tables
-- ---------------------------------------------------------------------------
create table if not exists public.assurance_regent_system_incidents (
  id bigint generated always as identity primary key,
  company_id text not null default '',
  fingerprint text not null,
  component text not null,
  severity text not null default 'WARNING',
  status text not null default 'OPEN',
  message text not null,
  detail jsonb not null default '{}'::jsonb,
  occurrence_count integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  reported_by text not null default '',
  resolved_at timestamptz,
  resolved_by text not null default '',
  resolution text not null default '',
  constraint ar_system_incident_severity_check check (severity in ('INFO','WARNING','HIGH','CRITICAL')),
  constraint ar_system_incident_status_check check (status in ('OPEN','RESOLVED'))
);
create unique index if not exists ar_system_incident_open_unique_idx
  on public.assurance_regent_system_incidents(company_id,fingerprint)
  where status='OPEN';
create index if not exists ar_system_incident_scope_idx
  on public.assurance_regent_system_incidents(company_id,status,severity,last_seen_at desc);
alter table public.assurance_regent_system_incidents enable row level security;
revoke all on public.assurance_regent_system_incidents from public,anon,authenticated;

create or replace function public.assurance_regent_browser_system_incident_report(
  p_token text,
  p_component text,
  p_severity text,
  p_message text,
  p_detail jsonb default '{}'::jsonb,
  p_fingerprint text default ''
) returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_actor jsonb;
  v_uid text;
  v_company text;
  v_component text:=left(trim(coalesce(p_component,'client')),80);
  v_severity text:=upper(trim(coalesce(p_severity,'WARNING')));
  v_message text:=left(trim(coalesce(p_message,'')),1200);
  v_fingerprint text;
  v_row public.assurance_regent_system_incidents%rowtype;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  v_uid:=coalesce(v_actor->>'id','');
  v_company:=coalesce(v_actor->>'companyId','');
  if v_severity not in ('INFO','WARNING','HIGH','CRITICAL') then v_severity:='WARNING'; end if;
  if v_message='' then raise exception 'Incident message is required.'; end if;
  v_fingerprint:=lower(trim(coalesce(p_fingerprint,'')));
  if v_fingerprint='' then
    v_fingerprint:=encode(digest(convert_to(v_company||'|'||v_component||'|'||v_message,'UTF8'),'sha256'),'hex');
  else
    v_fingerprint:=left(v_fingerprint,128);
  end if;

  insert into public.assurance_regent_system_incidents(
    company_id,fingerprint,component,severity,status,message,detail,occurrence_count,first_seen_at,last_seen_at,reported_by
  ) values (
    v_company,v_fingerprint,v_component,v_severity,'OPEN',v_message,coalesce(p_detail,'{}'::jsonb),1,now(),now(),v_uid
  )
  on conflict(company_id,fingerprint) where status='OPEN'
  do update set
    severity=case
      when excluded.severity='CRITICAL' then 'CRITICAL'
      when excluded.severity='HIGH' and assurance_regent_system_incidents.severity not in ('CRITICAL') then 'HIGH'
      when excluded.severity='WARNING' and assurance_regent_system_incidents.severity='INFO' then 'WARNING'
      else assurance_regent_system_incidents.severity end,
    message=excluded.message,
    detail=excluded.detail,
    occurrence_count=assurance_regent_system_incidents.occurrence_count+1,
    last_seen_at=now(),
    reported_by=excluded.reported_by
  returning * into v_row;

  return to_jsonb(v_row);
end $$;

create or replace function public.assurance_regent_browser_system_incident_list(
  p_token text,
  p_limit integer default 50,
  p_company_id text default ''
) returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_actor jsonb;
  v_auth text;
  v_company text;
  v_limit integer:=greatest(1,least(coalesce(p_limit,50),200));
  v_rows jsonb;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  v_auth:=public.assurance_regent_browser_functional_authority(v_actor);
  if v_auth not in ('DEVELOPER','CEO','ADMINISTRATOR') then raise exception 'System incident visibility requires Administrator, CEO or Developer authority.'; end if;
  if v_auth='DEVELOPER' then v_company:=trim(coalesce(p_company_id,''));
  else v_company:=coalesce(v_actor->>'companyId',''); end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.last_seen_at desc),'[]'::jsonb)
  into v_rows
  from (
    select id,company_id,fingerprint,component,severity,status,message,detail,occurrence_count,first_seen_at,last_seen_at,reported_by,resolved_at,resolved_by,resolution
    from public.assurance_regent_system_incidents
    where (v_company='' or company_id=v_company)
    order by case status when 'OPEN' then 0 else 1 end,
             case severity when 'CRITICAL' then 0 when 'HIGH' then 1 when 'WARNING' then 2 else 3 end,
             last_seen_at desc
    limit v_limit
  ) x;
  return coalesce(v_rows,'[]'::jsonb);
end $$;

create or replace function public.assurance_regent_browser_system_incident_resolve(
  p_token text,
  p_incident_id bigint,
  p_resolution text default ''
) returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_actor jsonb;
  v_auth text;
  v_company text;
  v_row public.assurance_regent_system_incidents%rowtype;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  v_auth:=public.assurance_regent_browser_functional_authority(v_actor);
  v_company:=coalesce(v_actor->>'companyId','');
  if v_auth not in ('DEVELOPER','CEO','ADMINISTRATOR') then raise exception 'System incident resolution requires Administrator, CEO or Developer authority.'; end if;

  update public.assurance_regent_system_incidents
  set status='RESOLVED',resolved_at=now(),resolved_by=coalesce(v_actor->>'id',''),resolution=left(trim(coalesce(p_resolution,'Resolved after verification.')),1200)
  where id=p_incident_id
    and status='OPEN'
    and (v_auth='DEVELOPER' or company_id=v_company)
  returning * into v_row;
  if v_row.id is null then raise exception 'The incident is unavailable, outside your scope, or already resolved.'; end if;
  return to_jsonb(v_row);
end $$;

-- ---------------------------------------------------------------------------
-- 4. Health snapshot designed for low-cost periodic polling
-- ---------------------------------------------------------------------------
create or replace function public.assurance_regent_browser_scalability_health(
  p_token text,
  p_company_id text default ''
) returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_actor jsonb;
  v_auth text;
  v_company text;
  v_state jsonb;
  v_state_bytes bigint:=0;
  v_active_sessions bigint:=0;
  v_queued bigint:=0;
  v_running bigint:=0;
  v_stale bigint:=0;
  v_open bigint:=0;
  v_high bigint:=0;
  v_recent_errors bigint:=0;
  v_status text:='HEALTHY';
  v_recommendations jsonb:='[]'::jsonb;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  v_auth:=public.assurance_regent_browser_functional_authority(v_actor);
  if v_auth not in ('DEVELOPER','CEO','ADMINISTRATOR') then raise exception 'System Health requires Administrator, CEO or Developer authority.'; end if;
  if v_auth='DEVELOPER' then v_company:=trim(coalesce(p_company_id,''));
  else v_company:=coalesce(v_actor->>'companyId',''); end if;

  select state_value,pg_column_size(state_value) into v_state,v_state_bytes
  from public.assurance_regent_state where state_key='browser-client-state';

  if v_auth='DEVELOPER' and v_company='' then
    select count(*) into v_active_sessions from public.assurance_regent_auth_sessions where expires_at>now();
  elsif v_company<>'' then
    select count(*) into v_active_sessions
    from public.assurance_regent_auth_sessions s
    where s.expires_at>now()
      and exists(
        select 1 from jsonb_array_elements(coalesce(v_state#>'{auth,accounts}','[]'::jsonb)) a
        where a->>'id'=s.user_id and a->>'companyId'=v_company
      );
  end if;

  select count(*) filter(where status='QUEUED'),
         count(*) filter(where status='RUNNING'),
         count(*) filter(where status='RUNNING' and updated_at<now()-interval '10 minutes')
  into v_queued,v_running,v_stale
  from public.assurance_regent_agent_tasks
  where (v_company='' or company_id=v_company);

  select count(*) filter(where status='OPEN'),
         count(*) filter(where status='OPEN' and severity in ('HIGH','CRITICAL'))
  into v_open,v_high
  from public.assurance_regent_system_incidents
  where (v_company='' or company_id=v_company);

  select count(*) into v_recent_errors
  from public.assurance_regent_agent_audit
  where created_at>now()-interval '15 minutes'
    and upper(coalesce(status,'')) not in ('OK','AUTHORIZED','PASS','COMPLETED','QUEUED')
    and (v_company='' or company_id=v_company);

  if v_high>0 then v_status:='CRITICAL';
  elsif v_stale>0 or v_recent_errors>=10 or v_state_bytes>15728640 then v_status:='DEGRADED';
  elsif v_open>0 or v_state_bytes>8388608 then v_status:='ATTENTION';
  end if;

  if v_stale>0 then v_recommendations:=v_recommendations||jsonb_build_array('REQUEUE_STALE_TASKS'); end if;
  if v_auth='DEVELOPER' then v_recommendations:=v_recommendations||jsonb_build_array('PURGE_EXPIRED_SESSIONS'); end if;
  if v_state_bytes>8388608 then v_recommendations:=v_recommendations||jsonb_build_array('STATE_GROWTH_REVIEW'); end if;

  return jsonb_build_object(
    'ok',true,
    'schemaVersion','6.1.0',
    'status',v_status,
    'companyId',v_company,
    'authority',v_auth,
    'activeSessions',v_active_sessions,
    'queuedTasks',v_queued,
    'runningTasks',v_running,
    'staleTasks',v_stale,
    'openIncidents',v_open,
    'highIncidents',v_high,
    'recentErrors15m',v_recent_errors,
    'stateSizeBytes',coalesce(v_state_bytes,0),
    'recommendedSafeActions',v_recommendations,
    'generatedAt',now()
  );
end $$;

-- ---------------------------------------------------------------------------
-- 5. Jivan-safe recovery actions. These cannot change business/financial data.
-- ---------------------------------------------------------------------------
create or replace function public.assurance_regent_browser_system_recover(
  p_token text,
  p_action text,
  p_company_id text default ''
) returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_actor jsonb;
  v_auth text;
  v_uid text;
  v_company text;
  v_action text:=upper(trim(coalesce(p_action,'')));
  v_count integer:=0;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  v_auth:=public.assurance_regent_browser_functional_authority(v_actor);
  if v_auth not in ('DEVELOPER','CEO','ADMINISTRATOR') then raise exception 'System recovery requires Administrator, CEO or Developer authority.'; end if;
  v_uid:=coalesce(v_actor->>'id','');
  if v_auth='DEVELOPER' then v_company:=trim(coalesce(p_company_id,''));
  else v_company:=coalesce(v_actor->>'companyId',''); end if;

  if v_action='REQUEUE_STALE_TASKS' then
    update public.assurance_regent_agent_tasks
    set status='QUEUED',started_at=null,updated_at=now(),
        result_metadata=coalesce(result_metadata,'{}'::jsonb)||jsonb_build_object('recoveredBy','Jivan resilience','recoveredAt',now())
    where status='RUNNING' and updated_at<now()-interval '10 minutes'
      and (v_company='' or company_id=v_company);
    get diagnostics v_count=row_count;
  elsif v_action='PURGE_EXPIRED_SESSIONS' then
    if v_auth<>'DEVELOPER' then raise exception 'Only Developer authority may purge expired sessions.'; end if;
    delete from public.assurance_regent_auth_sessions where expires_at<=now();
    get diagnostics v_count=row_count;
  elsif v_action='PURGE_EXPIRED_RATE_BUCKETS' then
    if v_auth<>'DEVELOPER' then raise exception 'Only Developer authority may purge expired rate-limit buckets.'; end if;
    delete from public.assurance_regent_rate_limit_buckets where updated_at<now()-interval '2 hours';
    get diagnostics v_count=row_count;
  else
    raise exception 'Unsupported safe recovery action.';
  end if;

  insert into public.assurance_regent_system_incidents(
    company_id,fingerprint,component,severity,status,message,detail,occurrence_count,first_seen_at,last_seen_at,reported_by,resolved_at,resolved_by,resolution
  ) values (
    coalesce(v_company,''),
    encode(digest(convert_to(coalesce(v_company,'')||'|recovery|'||v_action||'|'||clock_timestamp()::text,'UTF8'),'sha256'),'hex'),
    'Jivan resilience','INFO','RESOLVED','Safe recovery action completed.',
    jsonb_build_object('action',v_action,'affected',v_count,'authority',v_auth),1,now(),now(),v_uid,now(),v_uid,'Automated safe recovery completed.'
  );

  return jsonb_build_object('ok',true,'action',v_action,'affected',v_count,'companyId',v_company,'completedAt',now());
end $$;

-- ---------------------------------------------------------------------------
-- 6. Upgrade the basic bootstrap health contract without changing old fields
-- ---------------------------------------------------------------------------
create or replace function public.assurance_regent_browser_health()
returns jsonb language sql security definer set search_path=public as $$
  select jsonb_build_object(
    'ok', true,
    'schemaVersion', '6.1.0',
    'developerReady', exists(select 1 from public.assurance_regent_browser_credentials where user_id='Dvp' and active=true and approval_status='APPROVED'),
    'stateReady', exists(select 1 from public.assurance_regent_state where state_key='browser-client-state'),
    'governanceReady', exists(select 1 from information_schema.columns where table_schema='public' and table_name='assurance_regent_browser_credentials' and column_name='approval_status'),
    'recoveryReady', exists(select 1 from information_schema.tables where table_schema='public' and table_name='assurance_regent_recovery_passports'),
    'scalabilityReady', exists(select 1 from information_schema.tables where table_schema='public' and table_name='assurance_regent_system_incidents'),
    'trafficManagementReady', exists(select 1 from information_schema.tables where table_schema='public' and table_name='assurance_regent_rate_limit_buckets'),
    'updatedAt', coalesce((select updated_at from public.assurance_regent_state where state_key='browser-client-state'), now())
  );
$$;

revoke all on function public.assurance_regent_browser_rate_limit_take(text,text,integer,integer) from public;
revoke all on function public.assurance_regent_browser_system_incident_report(text,text,text,text,jsonb,text) from public;
revoke all on function public.assurance_regent_browser_system_incident_list(text,integer,text) from public;
revoke all on function public.assurance_regent_browser_system_incident_resolve(text,bigint,text) from public;
revoke all on function public.assurance_regent_browser_scalability_health(text,text) from public;
revoke all on function public.assurance_regent_browser_system_recover(text,text,text) from public;
revoke all on function public.assurance_regent_browser_health() from public;

grant execute on function public.assurance_regent_browser_rate_limit_take(text,text,integer,integer) to anon,authenticated;
grant execute on function public.assurance_regent_browser_system_incident_report(text,text,text,text,jsonb,text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_system_incident_list(text,integer,text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_system_incident_resolve(text,bigint,text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_scalability_health(text,text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_system_recover(text,text,text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_health() to anon,authenticated;

notify pgrst, 'reload schema';
