-- Assurance Regent v6.3.13 — Branded Recruitment Portal, AI Fit Review, Attachments & Outreach
-- Run after RECRUITMENT_PORTAL_INTERVIEWS_V6_3_12.sql.
-- AI fit analysis is advisory only. Human Resources remains responsible for every employment decision.

alter table public.assurance_regent_recruitment_applications add column if not exists experience_years numeric(5,1) not null default 0;
alter table public.assurance_regent_recruitment_applications add column if not exists qualification text not null default '';
alter table public.assurance_regent_recruitment_applications add column if not exists skills_summary text not null default '';
alter table public.assurance_regent_recruitment_applications add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table public.assurance_regent_recruitment_applications add column if not exists ai_score numeric(5,2);
alter table public.assurance_regent_recruitment_applications add column if not exists ai_rank integer;
alter table public.assurance_regent_recruitment_applications add column if not exists ai_summary text not null default '';
alter table public.assurance_regent_recruitment_applications add column if not exists ai_assessed_at timestamptz;
alter table public.assurance_regent_recruitment_applications add column if not exists ai_model text not null default '';

create table if not exists public.assurance_regent_recruitment_outreach (
  id bigserial primary key,
  company_id text not null,
  application_id uuid references public.assurance_regent_recruitment_applications(id) on delete cascade,
  channel text not null check (channel in ('email','whatsapp')),
  recipient text not null default '',
  subject text not null default '',
  message text not null default '',
  delivery_status text not null default 'PREPARED' check (delivery_status in ('PREPARED','SENT','FAILED')),
  provider text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists assurance_regent_recruitment_outreach_company_idx on public.assurance_regent_recruitment_outreach(company_id,created_at desc);
create index if not exists assurance_regent_recruitment_outreach_application_idx on public.assurance_regent_recruitment_outreach(application_id,created_at desc);
alter table public.assurance_regent_recruitment_outreach enable row level security;
revoke all on table public.assurance_regent_recruitment_outreach from anon,authenticated;
revoke all on sequence public.assurance_regent_recruitment_outreach_id_seq from anon,authenticated;

-- The bucket remains private. Broad recruitment attachments are accepted only after the Edge Function
-- denies executable/script formats and performs file-size controls. Files are never public.
update storage.buckets
set public=false,
    file_size_limit=6291456,
    allowed_mime_types=null
where id='assurance-regent-recruitment-documents';

-- Automatically archive expired live vacancies inside the shared state. Archived jobs disappear from
-- the active HR vacancy list and public portal while recruitment applications/interviews remain intact.
create or replace function public.assurance_regent_recruitment_archive_expired_vacancies()
returns integer
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_state jsonb;
  v_vacancies jsonb;
  v_updated jsonb;
  v_count integer:=0;
begin
  select state_value into v_state
  from public.assurance_regent_state
  where state_key='browser-client-state'
  for update;
  if v_state is null then return 0; end if;
  v_vacancies:=coalesce(v_state#>'{live,vacancies}','[]'::jsonb);
  select coalesce(jsonb_agg(
    case
      when coalesce((x->>'archived')::boolean,false)=false
       and coalesce(x->>'closeDate','') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       and (x->>'closeDate')::date < current_date
      then x || jsonb_build_object('status','Closed','publicVisible',false,'archived',true,'archivedAt',now()::text,'updatedAt',now()::text)
      else x
    end
  ),'[]'::jsonb),
  count(*) filter (
    where coalesce((x->>'archived')::boolean,false)=false
      and coalesce(x->>'closeDate','') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      and (x->>'closeDate')::date < current_date
  )
  into v_updated,v_count
  from jsonb_array_elements(v_vacancies) x;
  if v_count>0 then
    update public.assurance_regent_state
       set state_value=jsonb_set(v_state,'{live,vacancies}',v_updated,true),updated_at=now()
     where state_key='browser-client-state';
  end if;
  return v_count;
end $$;
revoke all on function public.assurance_regent_recruitment_archive_expired_vacancies() from public,anon,authenticated;
grant execute on function public.assurance_regent_recruitment_archive_expired_vacancies() to service_role;

-- Best-effort daily automatic sweep.
-- pg_cron is optional: never reference cron.job unless the relation actually exists.
do $$
declare
  v_jobid bigint;
begin
  if to_regclass('cron.job') is null
     or to_regprocedure('cron.schedule(text,text,text)') is null then
    raise notice 'pg_cron is not fully enabled; deadline expiry remains enforced on public/HR requests.';
    return;
  end if;

  -- Remove an older copy of the same scheduled job, if present.
  begin
    execute 'select jobid from cron.job where jobname = $1 order by jobid desc limit 1'
      into v_jobid
      using 'assurance-regent-recruitment-expiry';

    if v_jobid is not null then
      execute 'select cron.unschedule($1)' using v_jobid;
    end if;
  exception when others then
    raise notice 'Existing recruitment expiry job could not be removed: %', sqlerrm;
  end;

  -- Create the daily 00:17 UTC sweep.
  begin
    execute 'select cron.schedule($1,$2,$3)'
      using
        'assurance-regent-recruitment-expiry',
        '17 0 * * *',
        'select public.assurance_regent_recruitment_archive_expired_vacancies();';
    raise notice 'Daily recruitment expiry job is scheduled.';
  exception when others then
    raise notice 'pg_cron schedule was not created: %. Public/HR requests still enforce deadline expiry.', sqlerrm;
  end;
end $$;

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
  if not public.assurance_regent_recruitment_hr_allowed(v_actor) then raise exception 'Human Resources recruitment permission is required.'; end if;
  v_role:=coalesce(v_actor->>'role','Employee');
  v_company:=coalesce(v_actor->>'companyId','');

  select coalesce(jsonb_agg(to_jsonb(x) order by x.applied_at desc),'[]'::jsonb)
  into v_apps
  from (
    select id,company_id,vacancy_id,vacancy_title,applicant_name,email,phone,location,
           experience_years,qualification,skills_summary,cover_note,
           resume_path,resume_name,resume_type,attachments,source,status,hr_notes,candidate_id,
           ai_score,ai_rank,ai_summary,ai_assessed_at,ai_model,
           consent_at,applied_at,updated_at
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
    where (v_role='Developer' or company_id=v_company) and read_at is null
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
revoke all on function public.assurance_regent_browser_recruitment_bundle(text) from public;
grant execute on function public.assurance_regent_browser_recruitment_bundle(text) to anon,authenticated;

create or replace function public.assurance_regent_browser_health()
returns jsonb language sql security definer set search_path=public as $$
  select jsonb_build_object(
    'ok', true,
    'schemaVersion', '6.3.13',
    'developerReady', exists(select 1 from public.assurance_regent_browser_credentials where user_id='Dvp' and active=true and approval_status='APPROVED'),
    'stateReady', exists(select 1 from public.assurance_regent_state where state_key='browser-client-state'),
    'governanceReady', exists(select 1 from information_schema.columns where table_schema='public' and table_name='assurance_regent_browser_credentials' and column_name='approval_status'),
    'recoveryReady', to_regclass('public.assurance_regent_recovery_passports') is not null,
    'scalabilityReady', to_regclass('public.assurance_regent_system_incidents') is not null,
    'trafficManagementReady', to_regclass('public.assurance_regent_rate_limit_buckets') is not null,
    'studioReady', exists(select 1 from public.assurance_regent_jivan_studio_versions where status='ACTIVE'),
    'voiceReady', to_regclass('public.assurance_regent_voice_profiles') is not null and to_regclass('public.assurance_regent_voice_challenges') is not null and to_regprocedure('public.assurance_regent_browser_voice_access_health()') is not null,
    'recruitmentReady', to_regclass('public.assurance_regent_recruitment_applications') is not null and to_regclass('public.assurance_regent_recruitment_interviews') is not null and to_regclass('public.assurance_regent_recruitment_outreach') is not null,
    'recruitmentAiReady', exists(select 1 from information_schema.columns where table_schema='public' and table_name='assurance_regent_recruitment_applications' and column_name='ai_score'),
    'updatedAt', coalesce((select updated_at from public.assurance_regent_state where state_key='browser-client-state'), now())
  );
$$;
revoke all on function public.assurance_regent_browser_health() from public;
grant execute on function public.assurance_regent_browser_health() to anon,authenticated;

notify pgrst, 'reload schema';
