-- Assurance Regent recruitment external application visibility hotfix v6.3.20
-- Fixes two production defects:
-- 1) recruitment bundle referenced nonexistent ai_reviewed_at instead of ai_assessed_at
-- 2) HR permission rule rejected positions such as "Human Resource Manager"

create or replace function public.assurance_regent_recruitment_hr_allowed(p_actor jsonb)
returns boolean
language sql
immutable
security definer
set search_path to 'public'
as $function$
  select
    coalesce(p_actor->>'role','') in ('Developer','Administrator')
    or lower(coalesce(p_actor->>'position','')) ~ '(^|[^a-z])(human resources?|hr)([^a-z]|$)'
    or lower(coalesce(p_actor->>'position','')) ~ '(people[^a-z]*(manager|director|head|lead|officer|operations))'
    or lower(coalesce(p_actor->>'position','')) ~ '(talent[^a-z]*(manager|lead|director|head|officer|acquisition))'
    or lower(coalesce(p_actor->>'position','')) ~ '(recruit(ment|ing)[^a-z]*(manager|lead|director|head|officer))'
    or lower(coalesce(p_actor->>'position','')) ~ '(chief executive officer|(^|[^a-z])ceo([^a-z]|$))';
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
  v_meet_url text:='';
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  if not public.assurance_regent_recruitment_hr_allowed(v_actor) then
    raise exception 'Human Resources recruitment permission is required.';
  end if;

  v_role:=coalesce(v_actor->>'role','Employee');
  v_company:=coalesce(v_actor->>'companyId','');
  if v_company<>'' then
    v_meet_url:=public.assurance_regent_company_interview_meet_url(v_company);
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.applied_at desc),'[]'::jsonb)
  into v_apps
  from (
    select id,company_id,vacancy_id,vacancy_title,applicant_name,email,phone,location,cover_note,
           resume_path,resume_name,resume_type,source,status,hr_notes,candidate_id,consent_at,applied_at,updated_at,
           experience_years,qualification,skills_summary,attachments,ai_score,ai_rank,ai_summary,
           ai_assessed_at,
           ai_assessed_at as ai_reviewed_at,
           ai_model
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
    'meetUrl',coalesce(v_meet_url,''),
    'generatedAt',now()
  );
end
$function$;
