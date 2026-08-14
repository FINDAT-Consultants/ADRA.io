-- Assurance Regent v6.2.0 — Developer Jivan Studio, specialist agents and external communications
-- Run AFTER v6.1.0 SCALABILITY_RESILIENCE_V6_1_0.sql.
-- Additive migration. Existing business, recovery, HR, governance and resilience data are preserved.

create extension if not exists pgcrypto;

create table if not exists public.assurance_regent_jivan_studio_versions (
  id uuid primary key default gen_random_uuid(),
  version_no bigint generated always as identity unique,
  status text not null default 'DRAFT',
  apply_scope text not null default 'DEVELOPER_ONLY',
  note text not null default '',
  config jsonb not null default '{}'::jsonb,
  config_hash text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now(),
  activated_by text not null default '',
  activated_at timestamptz,
  constraint ar_jivan_studio_status_check check (status in ('DRAFT','ACTIVE','ARCHIVED')),
  constraint ar_jivan_studio_scope_check check (apply_scope in ('DEVELOPER_ONLY','ALL_JIVAN'))
);
create unique index if not exists ar_jivan_studio_one_active_idx
  on public.assurance_regent_jivan_studio_versions((status)) where status='ACTIVE';
create index if not exists ar_jivan_studio_created_idx
  on public.assurance_regent_jivan_studio_versions(created_at desc);
alter table public.assurance_regent_jivan_studio_versions enable row level security;
revoke all on public.assurance_regent_jivan_studio_versions from public,anon,authenticated;

create table if not exists public.assurance_regent_jivan_communication_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id text not null default '',
  channel text not null,
  provider text not null default '',
  recipient text not null default '',
  subject text not null default '',
  body_excerpt text not null default '',
  status text not null default 'QUEUED',
  provider_reference text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  constraint ar_jivan_comm_channel_check check (channel in ('EMAIL','WHATSAPP','VOICE_CALL')),
  constraint ar_jivan_comm_status_check check (status in ('QUEUED','SENT','FAILED','COMPLETED','CANCELED'))
);
create index if not exists ar_jivan_comm_created_idx on public.assurance_regent_jivan_communication_log(created_at desc);
create index if not exists ar_jivan_comm_channel_created_idx on public.assurance_regent_jivan_communication_log(channel,created_at desc);
alter table public.assurance_regent_jivan_communication_log enable row level security;
revoke all on public.assurance_regent_jivan_communication_log from public,anon,authenticated;

create or replace function public.assurance_regent_jivan_default_studio_config()
returns jsonb
language sql
immutable
as $$
select jsonb_build_object(
  'identity', jsonb_build_object(
    'displayName','Jivan',
    'persona','Calm, concise, technically capable operations intelligence for Assurance Regent.'
  ),
  'runtime', jsonb_build_object(
    'reasoningProfile','ADVANCED_BALANCED',
    'autonomy','GUARDED_ADVANCED',
    'maxToolSteps',20,
    'specialistRouting',true,
    'routingMode','AUTO',
    'backgroundDelegation',true,
    'autoDiagnostics',true
  ),
  'rules', jsonb_build_object(
    'additionalRules','',
    'allowMessageDrafting',true,
    'allowExternalEmail',false,
    'allowExternalWhatsApp',false,
    'allowExternalCalls',false,
    'requireExplicitSendConfirmation',true
  ),
  'agents', jsonb_build_array(
    jsonb_build_object('id','systems-engineer','name','Systems Engineer','enabled',true,'domains',jsonb_build_array('system','error','performance','scalability','database','edge function','maintenance'),'instructions','Diagnose Assurance Regent reliability, performance, integration and deployment problems. Recommend bounded repairs; never weaken security controls.'),
    jsonb_build_object('id','communications','name','Communications Agent','enabled',true,'domains',jsonb_build_array('email','whatsapp','message','call','communication','contact'),'instructions','Draft professional external communications. Preserve recipient intent, privacy and consent requirements. Sending remains explicitly confirmed.'),
    jsonb_build_object('id','recovery-finance','name','Recovery & Finance Agent','enabled',true,'domains',jsonb_build_array('recovery','finance','payroll','journal','donor','budget','voucher'),'instructions','Assist with Recovery Assurance, financial analysis and accounting drafts while preserving human approval boundaries.'),
    jsonb_build_object('id','people-hr','name','People & HR Agent','enabled',true,'domains',jsonb_build_array('employee','leave','hr','recruitment','onboarding','people'),'instructions','Assist with HR operations within role and company boundaries. Do not make unauthorized employment decisions.'),
    jsonb_build_object('id','research-analytics','name','Research & Analytics Agent','enabled',true,'domains',jsonb_build_array('research','analyze','analytics','report','forecast','visualization'),'instructions','Perform evidence-grounded research, quantitative analysis and reporting. Clearly distinguish facts, calculations and inference.'),
    jsonb_build_object('id','projects-programs','name','Projects & Programs Agent','enabled',true,'domains',jsonb_build_array('project','program','programme','portfolio','activity','workplan'),'instructions','Assist with project/program oversight, delivery analysis and managed-team workflows within authorization boundaries.')
  ),
  'connectors', jsonb_build_object(
    'email',jsonb_build_object('provider','RESEND','enabled',false,'fromAddress','','secretAlias','RESEND_API_KEY'),
    'whatsapp',jsonb_build_object('provider','TWILIO','enabled',false,'fromNumber','','secretAlias','TWILIO_AUTH_TOKEN'),
    'voice',jsonb_build_object('provider','TWILIO','enabled',false,'fromNumber','','secretAlias','TWILIO_AUTH_TOKEN')
  ),
  'maintenance',jsonb_build_object(
    'autoRequeueStaleTasks',true,
    'incidentDiagnostics',true,
    'cacheSelfRepair',true,
    'allowAutomaticCodeChanges',false,
    'allowAutomaticSecurityChanges',false
  ),
  'visual',jsonb_build_object('hologramEnabled',true,'motionLevel','FULL')
)
$$;

insert into public.assurance_regent_jivan_studio_versions(status,apply_scope,note,config,config_hash,created_by,activated_by,activated_at)
select 'ACTIVE','DEVELOPER_ONLY','Initial v6.2 Developer Studio policy',c,encode(digest(c::text,'sha256'),'hex'),'SYSTEM','SYSTEM',now()
from (select public.assurance_regent_jivan_default_studio_config() c) x
where not exists (select 1 from public.assurance_regent_jivan_studio_versions);

create or replace function public.assurance_regent_browser_jivan_studio_get(p_token text)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_actor jsonb;
  v_active public.assurance_regent_jivan_studio_versions%rowtype;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  if coalesce(v_actor->>'role','') <> 'Developer' then raise exception 'Developer authority is required for Jivan Studio.'; end if;
  select * into v_active from public.assurance_regent_jivan_studio_versions where status='ACTIVE' order by version_no desc limit 1;
  return jsonb_build_object(
    'active',case when v_active.id is null then null else to_jsonb(v_active) end,
    'versions',coalesce((select jsonb_agg(to_jsonb(v) order by v.version_no desc) from (select * from public.assurance_regent_jivan_studio_versions order by version_no desc limit 20) v),'[]'::jsonb),
    'communications',coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at desc) from (select * from public.assurance_regent_jivan_communication_log order by created_at desc limit 80) c),'[]'::jsonb)
  );
end $$;

create or replace function public.assurance_regent_browser_jivan_studio_save(
  p_token text,
  p_config jsonb,
  p_apply_scope text default 'DEVELOPER_ONLY',
  p_activate boolean default true,
  p_note text default ''
) returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_actor jsonb;
  v_scope text:=upper(trim(coalesce(p_apply_scope,'DEVELOPER_ONLY')));
  v_row public.assurance_regent_jivan_studio_versions%rowtype;
  v_config jsonb:=coalesce(p_config,'{}'::jsonb);
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  if coalesce(v_actor->>'role','') <> 'Developer' then raise exception 'Developer authority is required for Jivan Studio.'; end if;
  if v_scope <> 'DEVELOPER_ONLY' then raise exception 'Jivan Studio is Developer-only in v6.2.0.'; end if;
  if jsonb_typeof(v_config) <> 'object' then raise exception 'Jivan Studio config must be a JSON object.'; end if;
  if octet_length(v_config::text) > 131072 then raise exception 'Jivan Studio configuration is too large.'; end if;
  -- These safeguards are immutable and cannot be disabled by a saved Studio policy.
  if jsonb_typeof(v_config->'rules') <> 'object' then v_config:=jsonb_set(v_config,'{rules}','{}'::jsonb,true); end if;
  if jsonb_typeof(v_config->'maintenance') <> 'object' then v_config:=jsonb_set(v_config,'{maintenance}','{}'::jsonb,true); end if;
  v_config:=jsonb_set(v_config,'{rules,requireExplicitSendConfirmation}','true'::jsonb,true);
  v_config:=jsonb_set(v_config,'{maintenance,allowAutomaticCodeChanges}','false'::jsonb,true);
  v_config:=jsonb_set(v_config,'{maintenance,allowAutomaticSecurityChanges}','false'::jsonb,true);
  if p_activate then update public.assurance_regent_jivan_studio_versions set status='ARCHIVED' where status='ACTIVE'; end if;
  insert into public.assurance_regent_jivan_studio_versions(status,apply_scope,note,config,config_hash,created_by,activated_by,activated_at)
  values(case when p_activate then 'ACTIVE' else 'DRAFT' end,v_scope,left(coalesce(p_note,''),1000),v_config,encode(digest(v_config::text,'sha256'),'hex'),v_actor->>'id',case when p_activate then v_actor->>'id' else '' end,case when p_activate then now() else null end)
  returning * into v_row;
  return to_jsonb(v_row);
end $$;

create or replace function public.assurance_regent_browser_jivan_studio_runtime(p_token text)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_actor jsonb;
  v_row public.assurance_regent_jivan_studio_versions%rowtype;
  v_allowed boolean;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  if coalesce(v_actor->>'id','')='' then raise exception 'A valid Assurance Regent session is required.'; end if;
  select * into v_row from public.assurance_regent_jivan_studio_versions where status='ACTIVE' order by version_no desc limit 1;
  if v_row.id is null then return jsonb_build_object('enabled',false); end if;
  v_allowed:=coalesce(v_actor->>'role','')='Developer';
  if not v_allowed then return jsonb_build_object('enabled',false,'version',v_row.version_no,'applyScope',v_row.apply_scope); end if;
  return jsonb_build_object('enabled',true,'version',v_row.version_no,'applyScope',v_row.apply_scope,'config',v_row.config,'configHash',v_row.config_hash);
end $$;

create or replace function public.assurance_regent_browser_jivan_communication_log_append(
  p_token text,
  p_channel text,
  p_provider text,
  p_recipient text,
  p_subject text,
  p_body_excerpt text,
  p_status text,
  p_provider_reference text default '',
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_actor jsonb;
  v_row public.assurance_regent_jivan_communication_log%rowtype;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  if coalesce(v_actor->>'role','') <> 'Developer' then raise exception 'Developer authority is required for external Jivan communications.'; end if;
  insert into public.assurance_regent_jivan_communication_log(actor_id,channel,provider,recipient,subject,body_excerpt,status,provider_reference,metadata)
  values(v_actor->>'id',upper(trim(p_channel)),left(coalesce(p_provider,''),80),left(coalesce(p_recipient,''),500),left(coalesce(p_subject,''),500),left(coalesce(p_body_excerpt,''),1200),upper(trim(p_status)),left(coalesce(p_provider_reference,''),300),coalesce(p_metadata,'{}'::jsonb))
  returning * into v_row;
  return to_jsonb(v_row);
end $$;

grant execute on function public.assurance_regent_browser_jivan_studio_get(text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_jivan_studio_save(text,jsonb,text,boolean,text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_jivan_studio_runtime(text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_jivan_communication_log_append(text,text,text,text,text,text,text,text,jsonb) to anon,authenticated;


-- ---------------------------------------------------------------------------
-- v6.2 bootstrap health contract. Keeps all prior readiness flags and adds
-- Developer Jivan Studio readiness without weakening older checks.
-- ---------------------------------------------------------------------------
create or replace function public.assurance_regent_browser_health()
returns jsonb language sql security definer set search_path=public as $$
  select jsonb_build_object(
    'ok', true,
    'schemaVersion', '6.2.0',
    'developerReady', exists(select 1 from public.assurance_regent_browser_credentials where user_id='Dvp' and active=true and approval_status='APPROVED'),
    'stateReady', exists(select 1 from public.assurance_regent_state where state_key='browser-client-state'),
    'governanceReady', exists(select 1 from information_schema.columns where table_schema='public' and table_name='assurance_regent_browser_credentials' and column_name='approval_status'),
    'recoveryReady', exists(select 1 from information_schema.tables where table_schema='public' and table_name='assurance_regent_recovery_passports'),
    'scalabilityReady', exists(select 1 from information_schema.tables where table_schema='public' and table_name='assurance_regent_system_incidents'),
    'trafficManagementReady', exists(select 1 from information_schema.tables where table_schema='public' and table_name='assurance_regent_rate_limit_buckets'),
    'studioReady', exists(select 1 from public.assurance_regent_jivan_studio_versions where status='ACTIVE'),
    'updatedAt', coalesce((select updated_at from public.assurance_regent_state where state_key='browser-client-state'), now())
  );
$$;

revoke all on function public.assurance_regent_browser_health() from public;
grant execute on function public.assurance_regent_browser_health() to anon,authenticated;
notify pgrst, 'reload schema';
