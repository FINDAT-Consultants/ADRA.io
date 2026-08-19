-- Assurance Regent v6.3.105 — persisted HR selections and onboarding transfer
create table if not exists public.assurance_regent_recruitment_selections (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  application_id uuid not null references public.assurance_regent_recruitment_applications(id) on delete cascade,
  candidate_id text not null default '',
  status text not null default 'SELECTED' check (status in ('SELECTED','DESELECTED','ONBOARDING_SENT')),
  selected_by text not null default '',
  selected_at timestamptz not null default now(),
  onboarding_sent_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(application_id)
);

create index if not exists assurance_regent_recruitment_selections_company_idx
  on public.assurance_regent_recruitment_selections(company_id, status, selected_at desc);

alter table public.assurance_regent_recruitment_selections enable row level security;
revoke all on table public.assurance_regent_recruitment_selections from anon, authenticated;

create or replace function public.assurance_regent_browser_recruitment_selection_update(
  p_token text,
  p_application_ids uuid[],
  p_selected boolean
) returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  v_actor jsonb;
  v_role text;
  v_company text;
  v_actor_id text;
  v_requested int;
  v_scoped int;
  v_result jsonb;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  if not public.assurance_regent_recruitment_hr_allowed(v_actor) then
    raise exception 'Human Resources recruitment permission is required.';
  end if;
  v_role:=coalesce(v_actor->>'role','Employee');
  v_company:=coalesce(v_actor->>'companyId','');
  v_actor_id:=coalesce(v_actor->>'id',v_actor->>'name','');
  v_requested:=coalesce(array_length(p_application_ids,1),0);
  if v_requested=0 then raise exception 'Choose at least one applicant.'; end if;

  select count(*) into v_scoped
  from public.assurance_regent_recruitment_applications a
  where a.id=any(p_application_ids)
    and (v_role='Developer' or a.company_id=v_company);
  if v_scoped<>v_requested then raise exception 'One or more applications are unavailable or belong to another company.'; end if;

  if p_selected then
    insert into public.assurance_regent_recruitment_selections(company_id,application_id,status,selected_by,selected_at,updated_at)
    select a.company_id,a.id,'SELECTED',v_actor_id,now(),now()
    from public.assurance_regent_recruitment_applications a
    where a.id=any(p_application_ids)
    on conflict(application_id) do update
      set status=case when assurance_regent_recruitment_selections.status='ONBOARDING_SENT' then 'ONBOARDING_SENT' else 'SELECTED' end,
          selected_by=excluded.selected_by,
          selected_at=case when assurance_regent_recruitment_selections.status='ONBOARDING_SENT' then assurance_regent_recruitment_selections.selected_at else now() end,
          updated_at=now();
  else
    update public.assurance_regent_recruitment_selections s
       set status=case when s.status='ONBOARDING_SENT' then 'ONBOARDING_SENT' else 'DESELECTED' end,
           updated_at=now()
     where s.application_id=any(p_application_ids)
       and (v_role='Developer' or s.company_id=v_company);
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.selected_at desc),'[]'::jsonb)
    into v_result
  from (
    select id,company_id,application_id,candidate_id,status,selected_by,selected_at,onboarding_sent_at,updated_at
    from public.assurance_regent_recruitment_selections
    where (v_role='Developer' or company_id=v_company)
      and status in ('SELECTED','ONBOARDING_SENT')
  ) x;
  return coalesce(v_result,'[]'::jsonb);
end
$function$;

create or replace function public.assurance_regent_browser_recruitment_selection_onboarding(
  p_token text,
  p_application_id uuid,
  p_candidate_id text
) returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  v_actor jsonb;
  v_role text;
  v_company text;
  v_app public.assurance_regent_recruitment_applications%rowtype;
  v_row public.assurance_regent_recruitment_selections%rowtype;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  if not public.assurance_regent_recruitment_hr_allowed(v_actor) then
    raise exception 'Human Resources recruitment permission is required.';
  end if;
  v_role:=coalesce(v_actor->>'role','Employee');
  v_company:=coalesce(v_actor->>'companyId','');
  select * into v_app from public.assurance_regent_recruitment_applications where id=p_application_id;
  if v_app.id is null then raise exception 'Application not found.'; end if;
  if v_role<>'Developer' and v_app.company_id<>v_company then raise exception 'This application belongs to another company.'; end if;

  insert into public.assurance_regent_recruitment_selections(company_id,application_id,candidate_id,status,selected_by,selected_at,onboarding_sent_at,updated_at)
  values(v_app.company_id,v_app.id,coalesce(trim(p_candidate_id),''),'ONBOARDING_SENT',coalesce(v_actor->>'id',v_actor->>'name',''),now(),now(),now())
  on conflict(application_id) do update
    set candidate_id=excluded.candidate_id,
        status='ONBOARDING_SENT',
        onboarding_sent_at=coalesce(assurance_regent_recruitment_selections.onboarding_sent_at,now()),
        updated_at=now()
  returning * into v_row;
  return to_jsonb(v_row);
end
$function$;

create or replace function public.assurance_regent_browser_recruitment_bundle(p_token text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare
  v_actor jsonb;
  v_role text;
  v_company text;
  v_apps jsonb;
  v_interviews jsonb;
  v_notifications jsonb;
  v_selections jsonb;
  v_interview_evaluations jsonb;
  v_meet_url text:='';
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  if not public.assurance_regent_recruitment_hr_allowed(v_actor) then
    raise exception 'Human Resources recruitment permission is required.';
  end if;
  v_role:=coalesce(v_actor->>'role','Employee');
  v_company:=coalesce(v_actor->>'companyId','');
  if v_company<>'' then v_meet_url:=public.assurance_regent_company_interview_meet_url(v_company); end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.applied_at desc),'[]'::jsonb)
  into v_apps
  from (
    select id,company_id,vacancy_id,vacancy_title,applicant_name,email,phone,location,cover_note,
           resume_path,resume_name,resume_type,source,status,hr_notes,candidate_id,consent_at,applied_at,updated_at,
           experience_years,qualification,skills_summary,attachments,ai_score,ai_rank,ai_summary,
           ai_assessed_at,ai_assessed_at as ai_reviewed_at,ai_model
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

  select coalesce(jsonb_agg(to_jsonb(x) order by x.selected_at desc),'[]'::jsonb)
  into v_selections
  from (
    select id,company_id,application_id,candidate_id,status,selected_by,selected_at,onboarding_sent_at,updated_at
    from public.assurance_regent_recruitment_selections
    where v_role='Developer' or company_id=v_company
    order by selected_at desc
    limit 500
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.generated_at desc),'[]'::jsonb)
  into v_interview_evaluations
  from (
    select interview_id,company_id,application_id,vacancy_id,candidate_name,analysis,generated_by,generated_at,updated_at
    from public.assurance_regent_recruitment_interview_notes
    where v_role='Developer' or company_id=v_company
    order by generated_at desc
    limit 500
  ) x;

  return jsonb_build_object(
    'applications',coalesce(v_apps,'[]'::jsonb),
    'interviews',coalesce(v_interviews,'[]'::jsonb),
    'notifications',coalesce(v_notifications,'[]'::jsonb),
    'selections',coalesce(v_selections,'[]'::jsonb),
    'interviewEvaluations',coalesce(v_interview_evaluations,'[]'::jsonb),
    'meetUrl',coalesce(v_meet_url,''),
    'generatedAt',now()
  );
end
$function$;

grant execute on function public.assurance_regent_browser_recruitment_selection_update(text,uuid[],boolean) to anon, authenticated;
grant execute on function public.assurance_regent_browser_recruitment_selection_onboarding(text,uuid,text) to anon, authenticated;
grant execute on function public.assurance_regent_browser_recruitment_bundle(text) to anon, authenticated;
