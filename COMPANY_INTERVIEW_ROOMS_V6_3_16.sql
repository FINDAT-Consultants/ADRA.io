-- Assurance Regent v6.3.16 — Company-Specific Google Meet Interview Rooms
-- Developer owns each company interview room. No global/shared fallback is allowed.

begin;

alter table public.assurance_regent_recruitment_interviews
  alter column meet_url drop default;

create or replace function public.assurance_regent_company_interview_meet_url(p_company_id text)
returns text
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_state jsonb;
  v_url text:='';
begin
  select state_value into v_state
  from public.assurance_regent_state
  where state_key='browser-client-state';

  select trim(coalesce(c->>'interviewMeetUrl','')) into v_url
  from jsonb_array_elements(coalesce(v_state#>'{auth,companies}','[]'::jsonb)) c
  where c->>'id'=trim(coalesce(p_company_id,''))
  limit 1;

  if v_url !~* '^https://meet[.]google[.]com/[A-Za-z0-9_-]+(-[A-Za-z0-9_-]+)+([/?#].*)?$' then
    return '';
  end if;
  return rtrim(split_part(split_part(v_url,'?',1),'#',1),'/');
end $$;

revoke all on function public.assurance_regent_company_interview_meet_url(text) from public,anon,authenticated;
grant execute on function public.assurance_regent_company_interview_meet_url(text) to service_role;

create or replace function public.assurance_regent_browser_admin_company_interview_room(
  p_token text,
  p_company_id text,
  p_meet_url text
)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_actor jsonb;
  v_state jsonb;
  v_companies jsonb;
  v_company jsonb;
  v_idx int;
  v_url text:=trim(coalesce(p_meet_url,''));
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  if public.assurance_regent_browser_functional_authority(v_actor)<>'DEVELOPER' then
    raise exception 'Developer permission is required to configure company interview rooms.';
  end if;
  if v_url !~* '^https://meet[.]google[.]com/[A-Za-z0-9_-]+(-[A-Za-z0-9_-]+)+([/?#].*)?$' then
    raise exception 'Enter a valid Google Meet URL such as https://meet.google.com/abc-defg-hij.';
  end if;
  v_url:=rtrim(split_part(split_part(v_url,'?',1),'#',1),'/');

  select state_value into v_state
  from public.assurance_regent_state
  where state_key='browser-client-state'
  for update;

  v_companies:=coalesce(v_state#>'{auth,companies}','[]'::jsonb);
  if exists(
    select 1
    from jsonb_array_elements(v_companies) c
    where c->>'id'<>trim(coalesce(p_company_id,''))
      and lower(rtrim(split_part(split_part(trim(coalesce(c->>'interviewMeetUrl','')),'?',1),'#',1),'/'))=lower(v_url)
  ) then
    raise exception 'That Google Meet room is already assigned to another company. Configure a unique interview room for each organization.';
  end if;

  select value,ordinality-1 into v_company,v_idx
  from jsonb_array_elements(v_companies) with ordinality t(value,ordinality)
  where value->>'id'=trim(coalesce(p_company_id,''))
  limit 1;
  if v_company is null then raise exception 'Company not found.'; end if;

  v_company:=v_company || jsonb_build_object(
    'interviewMeetUrl',v_url,
    'interviewRoomUpdatedAt',now(),
    'interviewRoomUpdatedBy',coalesce(v_actor->>'id','Developer')
  );
  v_companies:=jsonb_set(v_companies,array[v_idx::text],v_company,false);
  v_state:=jsonb_set(v_state,'{auth,companies}',v_companies,true);
  update public.assurance_regent_state
  set state_value=v_state,updated_at=now()
  where state_key='browser-client-state';

  -- Existing interviews that still carry the old global room are remapped to the company room.
  update public.assurance_regent_recruitment_interviews
  set meet_url=v_url,updated_at=now()
  where company_id=trim(coalesce(p_company_id,''))
    and (meet_url='' or meet_url='https://meet.google.com/syq-rsnj-cwi');

  return v_company;
end $$;

revoke all on function public.assurance_regent_browser_admin_company_interview_room(text,text,text) from public;
grant execute on function public.assurance_regent_browser_admin_company_interview_room(text,text,text) to anon,authenticated;

-- Remove the old cross-company fallback from legacy interview rows. Where a company already
-- has a configured room, migrate the row to it; otherwise leave the room blank until Developer setup.
with company_rooms as (
  select c->>'id' as company_id,
         case when trim(coalesce(c->>'interviewMeetUrl','')) ~* '^https://meet[.]google[.]com/[A-Za-z0-9_-]+(-[A-Za-z0-9_-]+)+([/?#].*)?$'
              then rtrim(split_part(split_part(trim(c->>'interviewMeetUrl'),'?',1),'#',1),'/') else '' end as meet_url
  from public.assurance_regent_state s,
       jsonb_array_elements(coalesce(s.state_value#>'{auth,companies}','[]'::jsonb)) c
  where s.state_key='browser-client-state'
)
update public.assurance_regent_recruitment_interviews i
set meet_url=coalesce(r.meet_url,''),updated_at=now()
from company_rooms r
where i.company_id=r.company_id
  and (i.meet_url='' or i.meet_url='https://meet.google.com/syq-rsnj-cwi');

update public.assurance_regent_recruitment_interviews
set meet_url='',updated_at=now()
where meet_url='https://meet.google.com/syq-rsnj-cwi';

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
           experience_years,qualification,skills_summary,attachments,ai_score,ai_rank,ai_summary,ai_reviewed_at
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
  v_actor jsonb;
  v_role text;
  v_company text;
  v_meet_url text;
  v_app public.assurance_regent_recruitment_applications%rowtype;
  v_row public.assurance_regent_recruitment_interviews%rowtype;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  if not public.assurance_regent_recruitment_hr_allowed(v_actor) then raise exception 'Human Resources recruitment permission is required.'; end if;
  if p_scheduled_at is null then raise exception 'Interview date and time are required.'; end if;
  v_role:=coalesce(v_actor->>'role','Employee');v_company:=coalesce(v_actor->>'companyId','');
  select * into v_app from public.assurance_regent_recruitment_applications where id=p_application_id for update;
  if v_app.id is null then raise exception 'Application not found.'; end if;
  if v_role<>'Developer' and v_app.company_id<>v_company then raise exception 'This application belongs to another company.'; end if;

  v_meet_url:=public.assurance_regent_company_interview_meet_url(v_app.company_id);
  if coalesce(v_meet_url,'')='' then
    raise exception 'The Developer must configure a unique Google Meet interview room for this company before HR can schedule interviews.';
  end if;

  insert into public.assurance_regent_recruitment_interviews(
    company_id,application_id,vacancy_id,vacancy_title,candidate_name,candidate_email,scheduled_at,time_zone,meet_url,status,notes,created_by
  ) values(
    v_app.company_id,v_app.id,v_app.vacancy_id,v_app.vacancy_title,v_app.applicant_name,v_app.email,p_scheduled_at,
    left(coalesce(nullif(trim(p_time_zone),''),'Africa/Lusaka'),80),v_meet_url,'SCHEDULED',left(trim(coalesce(p_notes,'')),5000),coalesce(v_actor->>'id','HR')
  ) returning * into v_row;

  update public.assurance_regent_recruitment_applications set status='INTERVIEW',updated_at=now() where id=v_app.id;
  update public.assurance_regent_recruitment_notifications set read_at=coalesce(read_at,now()),read_by=coalesce(v_actor->>'id','HR') where application_id=v_app.id and read_at is null;
  return to_jsonb(v_row);
end $$;

commit;
