-- Assurance Regent v6.3.12 — Public Recruitment Portal + Interview Room
-- Run after v6.3.9 HOTFIX 1 / v6.3.11 application deployment.
-- External applicants never receive direct table access. Public reads/submissions are mediated by
-- the recruitment-public Edge Function using the Supabase service role. HR access is token-scoped.

create extension if not exists pgcrypto;

create table if not exists public.assurance_regent_recruitment_applications (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  vacancy_id text not null,
  vacancy_title text not null default '',
  applicant_name text not null,
  email text not null,
  phone text not null default '',
  location text not null default '',
  cover_note text not null default '',
  resume_path text not null default '',
  resume_name text not null default '',
  resume_type text not null default '',
  source text not null default 'PUBLIC_CAREERS',
  request_hash text not null default '',
  status text not null default 'NEW' check (status in ('NEW','REVIEWING','SHORTLISTED','INTERVIEW','REJECTED','IMPORTED','WITHDRAWN')),
  hr_notes text not null default '',
  candidate_id text not null default '',
  consent_at timestamptz,
  applied_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.assurance_regent_recruitment_applications add column if not exists request_hash text not null default '';

create index if not exists assurance_regent_recruitment_applications_company_idx
  on public.assurance_regent_recruitment_applications(company_id, applied_at desc);
create index if not exists assurance_regent_recruitment_applications_vacancy_idx
  on public.assurance_regent_recruitment_applications(company_id, vacancy_id, applied_at desc);
create index if not exists assurance_regent_recruitment_applications_email_idx
  on public.assurance_regent_recruitment_applications(lower(email), vacancy_id, applied_at desc);
create index if not exists assurance_regent_recruitment_applications_request_idx
  on public.assurance_regent_recruitment_applications(request_hash, applied_at desc);

create table if not exists public.assurance_regent_recruitment_notifications (
  id bigserial primary key,
  company_id text not null,
  application_id uuid references public.assurance_regent_recruitment_applications(id) on delete cascade,
  vacancy_id text not null default '',
  kind text not null default 'NEW_APPLICATION',
  title text not null,
  detail text not null default '',
  created_at timestamptz not null default now(),
  read_at timestamptz,
  read_by text not null default ''
);
create index if not exists assurance_regent_recruitment_notifications_company_idx
  on public.assurance_regent_recruitment_notifications(company_id, read_at, created_at desc);

create table if not exists public.assurance_regent_recruitment_interviews (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  application_id uuid references public.assurance_regent_recruitment_applications(id) on delete cascade,
  vacancy_id text not null,
  vacancy_title text not null default '',
  candidate_name text not null,
  candidate_email text not null default '',
  scheduled_at timestamptz not null,
  time_zone text not null default 'Africa/Lusaka',
  meet_url text not null default 'https://meet.google.com/syq-rsnj-cwi',
  candidate_token uuid not null default gen_random_uuid() unique,
  status text not null default 'SCHEDULED' check (status in ('SCHEDULED','COMPLETED','CANCELLED','NO_SHOW')),
  notes text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists assurance_regent_recruitment_interviews_company_idx
  on public.assurance_regent_recruitment_interviews(company_id, scheduled_at desc);
create index if not exists assurance_regent_recruitment_interviews_application_idx
  on public.assurance_regent_recruitment_interviews(application_id, scheduled_at desc);

alter table public.assurance_regent_recruitment_applications enable row level security;
alter table public.assurance_regent_recruitment_notifications enable row level security;
alter table public.assurance_regent_recruitment_interviews enable row level security;
revoke all on table public.assurance_regent_recruitment_applications from anon, authenticated;
revoke all on table public.assurance_regent_recruitment_notifications from anon, authenticated;
revoke all on table public.assurance_regent_recruitment_interviews from anon, authenticated;
revoke all on sequence public.assurance_regent_recruitment_notifications_id_seq from anon, authenticated;

-- Private CV/resume bucket. The public Edge Function uploads with service-role authority;
-- HR receives only short-lived signed URLs after an authenticated, company-scoped request.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'assurance-regent-recruitment-documents',
  'assurance-regent-recruitment-documents',
  false,
  6291456,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

create or replace function public.assurance_regent_recruitment_hr_allowed(p_actor jsonb)
returns boolean
language sql
immutable
security definer
set search_path=public
as $$
  select
    coalesce(p_actor->>'role','') in ('Developer','Administrator')
    or lower(coalesce(p_actor->>'position','')) ~ '(chief executive officer|\bceo\b|human resources|\bhr\b|people[^a-z]*(manager|director|head)|talent[^a-z]*(manager|lead|director)|recruit(ment|ing)[^a-z]*(manager|lead|director))';
$$;
revoke all on function public.assurance_regent_recruitment_hr_allowed(jsonb) from public,anon,authenticated;

create or replace function public.assurance_regent_browser_recruitment_bundle(p_token text)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_actor jsonb;
  v_role text;
  v_company text;
  v_apps jsonb;
  v_interviews jsonb;
  v_notifications jsonb;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  if not public.assurance_regent_recruitment_hr_allowed(v_actor) then
    raise exception 'Human Resources recruitment permission is required.';
  end if;
  v_role:=coalesce(v_actor->>'role','Employee');
  v_company:=coalesce(v_actor->>'companyId','');

  select coalesce(jsonb_agg(to_jsonb(x) order by x.applied_at desc),'[]'::jsonb)
  into v_apps
  from (
    select id,company_id,vacancy_id,vacancy_title,applicant_name,email,phone,location,cover_note,
           resume_path,resume_name,resume_type,source,status,hr_notes,candidate_id,consent_at,applied_at,updated_at
    from public.assurance_regent_recruitment_applications
    where v_role='Developer' or company_id=v_company
    order by applied_at desc
    limit 500
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.scheduled_at desc),'[]'::jsonb)
  into v_interviews
  from (
    select id,company_id,application_id,vacancy_id,vacancy_title,candidate_name,candidate_email,
           scheduled_at,time_zone,meet_url,candidate_token,status,notes,created_by,created_at,updated_at
    from public.assurance_regent_recruitment_interviews
    where v_role='Developer' or company_id=v_company
    order by scheduled_at desc
    limit 500
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb)
  into v_notifications
  from (
    select id,company_id,application_id,vacancy_id,kind,title,detail,created_at,read_at,read_by
    from public.assurance_regent_recruitment_notifications
    where (v_role='Developer' or company_id=v_company)
      and read_at is null
    order by created_at desc
    limit 100
  ) x;

  return jsonb_build_object(
    'applications',coalesce(v_apps,'[]'::jsonb),
    'interviews',coalesce(v_interviews,'[]'::jsonb),
    'notifications',coalesce(v_notifications,'[]'::jsonb),
    'meetUrl','https://meet.google.com/syq-rsnj-cwi',
    'generatedAt',now()
  );
end $$;

create or replace function public.assurance_regent_browser_recruitment_application_update(
  p_token text,
  p_application_id uuid,
  p_status text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_actor jsonb;
  v_role text;
  v_company text;
  v_row public.assurance_regent_recruitment_applications%rowtype;
  v_status text:=upper(trim(coalesce(p_status,'')));
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  if not public.assurance_regent_recruitment_hr_allowed(v_actor) then raise exception 'Human Resources recruitment permission is required.'; end if;
  v_role:=coalesce(v_actor->>'role','Employee');v_company:=coalesce(v_actor->>'companyId','');
  select * into v_row from public.assurance_regent_recruitment_applications where id=p_application_id for update;
  if v_row.id is null then raise exception 'Application not found.'; end if;
  if v_role<>'Developer' and v_row.company_id<>v_company then raise exception 'This application belongs to another company.'; end if;
  if v_status<>'' and v_status not in ('NEW','REVIEWING','SHORTLISTED','INTERVIEW','REJECTED','IMPORTED','WITHDRAWN') then raise exception 'Invalid recruitment application status.'; end if;
  update public.assurance_regent_recruitment_applications
     set status=case when v_status='' then status else v_status end,
         hr_notes=case when p_notes is null then hr_notes else left(trim(p_notes),6000) end,
         updated_at=now()
   where id=p_application_id
   returning * into v_row;
  return to_jsonb(v_row);
end $$;

create or replace function public.assurance_regent_browser_recruitment_application_imported(
  p_token text,
  p_application_id uuid,
  p_candidate_id text
)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_actor jsonb;v_role text;v_company text;v_row public.assurance_regent_recruitment_applications%rowtype;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  if not public.assurance_regent_recruitment_hr_allowed(v_actor) then raise exception 'Human Resources recruitment permission is required.'; end if;
  v_role:=coalesce(v_actor->>'role','Employee');v_company:=coalesce(v_actor->>'companyId','');
  select * into v_row from public.assurance_regent_recruitment_applications where id=p_application_id for update;
  if v_row.id is null then raise exception 'Application not found.'; end if;
  if v_role<>'Developer' and v_row.company_id<>v_company then raise exception 'This application belongs to another company.'; end if;
  update public.assurance_regent_recruitment_applications
     set status='IMPORTED',candidate_id=left(trim(coalesce(p_candidate_id,'')),160),updated_at=now()
   where id=p_application_id returning * into v_row;
  update public.assurance_regent_recruitment_notifications
     set read_at=coalesce(read_at,now()),read_by=coalesce(nullif(v_actor->>'id',''),'HR')
   where application_id=p_application_id and read_at is null;
  return to_jsonb(v_row);
end $$;

create or replace function public.assurance_regent_browser_recruitment_interview_schedule(
  p_token text,
  p_application_id uuid,
  p_scheduled_at timestamptz,
  p_time_zone text default 'Africa/Lusaka',
  p_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_actor jsonb;v_role text;v_company text;v_app public.assurance_regent_recruitment_applications%rowtype;v_row public.assurance_regent_recruitment_interviews%rowtype;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  if not public.assurance_regent_recruitment_hr_allowed(v_actor) then raise exception 'Human Resources recruitment permission is required.'; end if;
  if p_scheduled_at is null then raise exception 'Interview date and time are required.'; end if;
  v_role:=coalesce(v_actor->>'role','Employee');v_company:=coalesce(v_actor->>'companyId','');
  select * into v_app from public.assurance_regent_recruitment_applications where id=p_application_id for update;
  if v_app.id is null then raise exception 'Application not found.'; end if;
  if v_role<>'Developer' and v_app.company_id<>v_company then raise exception 'This application belongs to another company.'; end if;

  insert into public.assurance_regent_recruitment_interviews(
    company_id,application_id,vacancy_id,vacancy_title,candidate_name,candidate_email,scheduled_at,time_zone,meet_url,status,notes,created_by
  ) values(
    v_app.company_id,v_app.id,v_app.vacancy_id,v_app.vacancy_title,v_app.applicant_name,v_app.email,p_scheduled_at,
    left(coalesce(nullif(trim(p_time_zone),''),'Africa/Lusaka'),80),'https://meet.google.com/syq-rsnj-cwi','SCHEDULED',left(trim(coalesce(p_notes,'')),5000),coalesce(v_actor->>'id','HR')
  ) returning * into v_row;

  update public.assurance_regent_recruitment_applications set status='INTERVIEW',updated_at=now() where id=v_app.id;
  update public.assurance_regent_recruitment_notifications set read_at=coalesce(read_at,now()),read_by=coalesce(v_actor->>'id','HR') where application_id=v_app.id and read_at is null;
  return to_jsonb(v_row);
end $$;

create or replace function public.assurance_regent_browser_recruitment_interview_status(
  p_token text,p_interview_id uuid,p_status text,p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare v_actor jsonb;v_role text;v_company text;v_row public.assurance_regent_recruitment_interviews%rowtype;v_status text:=upper(trim(coalesce(p_status,'')));
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  if not public.assurance_regent_recruitment_hr_allowed(v_actor) then raise exception 'Human Resources recruitment permission is required.'; end if;
  if v_status not in ('SCHEDULED','COMPLETED','CANCELLED','NO_SHOW') then raise exception 'Invalid interview status.'; end if;
  v_role:=coalesce(v_actor->>'role','Employee');v_company:=coalesce(v_actor->>'companyId','');
  select * into v_row from public.assurance_regent_recruitment_interviews where id=p_interview_id for update;
  if v_row.id is null then raise exception 'Interview not found.'; end if;
  if v_role<>'Developer' and v_row.company_id<>v_company then raise exception 'This interview belongs to another company.'; end if;
  update public.assurance_regent_recruitment_interviews set status=v_status,notes=case when p_notes is null then notes else left(trim(p_notes),5000) end,updated_at=now() where id=p_interview_id returning * into v_row;
  return to_jsonb(v_row);
end $$;

create or replace function public.assurance_regent_browser_recruitment_notification_read(p_token text,p_notification_id bigint)
returns boolean
language plpgsql
security definer
set search_path=public,extensions
as $$
declare v_actor jsonb;v_role text;v_company text;v_company_row text;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  if not public.assurance_regent_recruitment_hr_allowed(v_actor) then raise exception 'Human Resources recruitment permission is required.'; end if;
  v_role:=coalesce(v_actor->>'role','Employee');v_company:=coalesce(v_actor->>'companyId','');
  select company_id into v_company_row from public.assurance_regent_recruitment_notifications where id=p_notification_id;
  if v_company_row is null then return false; end if;
  if v_role<>'Developer' and v_company_row<>v_company then raise exception 'This notification belongs to another company.'; end if;
  update public.assurance_regent_recruitment_notifications set read_at=coalesce(read_at,now()),read_by=coalesce(v_actor->>'id','HR') where id=p_notification_id;
  return true;
end $$;

create or replace function public.assurance_regent_browser_recruitment_application_resume_path(p_token text,p_application_id uuid)
returns text
language plpgsql
security definer
set search_path=public,extensions
as $$
declare v_actor jsonb;v_role text;v_company text;v_row public.assurance_regent_recruitment_applications%rowtype;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  if not public.assurance_regent_recruitment_hr_allowed(v_actor) then raise exception 'Human Resources recruitment permission is required.'; end if;
  v_role:=coalesce(v_actor->>'role','Employee');v_company:=coalesce(v_actor->>'companyId','');
  select * into v_row from public.assurance_regent_recruitment_applications where id=p_application_id;
  if v_row.id is null then raise exception 'Application not found.'; end if;
  if v_role<>'Developer' and v_row.company_id<>v_company then raise exception 'This application belongs to another company.'; end if;
  return coalesce(v_row.resume_path,'');
end $$;

revoke all on function public.assurance_regent_browser_recruitment_bundle(text) from public;
revoke all on function public.assurance_regent_browser_recruitment_application_update(text,uuid,text,text) from public;
revoke all on function public.assurance_regent_browser_recruitment_application_imported(text,uuid,text) from public;
revoke all on function public.assurance_regent_browser_recruitment_interview_schedule(text,uuid,timestamptz,text,text) from public;
revoke all on function public.assurance_regent_browser_recruitment_interview_status(text,uuid,text,text) from public;
revoke all on function public.assurance_regent_browser_recruitment_notification_read(text,bigint) from public;
revoke all on function public.assurance_regent_browser_recruitment_application_resume_path(text,uuid) from public;

grant execute on function public.assurance_regent_browser_recruitment_bundle(text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_recruitment_application_update(text,uuid,text,text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_recruitment_application_imported(text,uuid,text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_recruitment_interview_schedule(text,uuid,timestamptz,text,text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_recruitment_interview_status(text,uuid,text,text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_recruitment_notification_read(text,bigint) to anon,authenticated;
grant execute on function public.assurance_regent_browser_recruitment_application_resume_path(text,uuid) to anon,authenticated;

-- Updated health contract. Existing frontend readiness checks remain intact; recruitmentReady is additive.
create or replace function public.assurance_regent_browser_health()
returns jsonb language sql security definer set search_path=public as $$
  select jsonb_build_object(
    'ok', true,
    'schemaVersion', '6.3.12',
    'developerReady', exists(select 1 from public.assurance_regent_browser_credentials where user_id='Dvp' and active=true and approval_status='APPROVED'),
    'stateReady', exists(select 1 from public.assurance_regent_state where state_key='browser-client-state'),
    'governanceReady', exists(select 1 from information_schema.columns where table_schema='public' and table_name='assurance_regent_browser_credentials' and column_name='approval_status'),
    'recoveryReady', to_regclass('public.assurance_regent_recovery_passports') is not null,
    'scalabilityReady', to_regclass('public.assurance_regent_system_incidents') is not null,
    'trafficManagementReady', to_regclass('public.assurance_regent_rate_limit_buckets') is not null,
    'studioReady', exists(select 1 from public.assurance_regent_jivan_studio_versions where status='ACTIVE'),
    'voiceReady', to_regclass('public.assurance_regent_voice_profiles') is not null and to_regclass('public.assurance_regent_voice_challenges') is not null and to_regprocedure('public.assurance_regent_browser_voice_access_health()') is not null,
    'recruitmentReady', to_regclass('public.assurance_regent_recruitment_applications') is not null and to_regclass('public.assurance_regent_recruitment_interviews') is not null,
    'updatedAt', coalesce((select updated_at from public.assurance_regent_state where state_key='browser-client-state'), now())
  );
$$;
revoke all on function public.assurance_regent_browser_health() from public;
grant execute on function public.assurance_regent_browser_health() to anon,authenticated;

notify pgrst, 'reload schema';
