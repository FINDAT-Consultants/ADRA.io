-- Assurance Regent v6.3.16 — company interview room verification
select
  to_regprocedure('public.assurance_regent_browser_admin_company_interview_room(text,text,text)') is not null as developer_room_config_ready,
  to_regprocedure('public.assurance_regent_company_interview_meet_url(text)') is not null as company_room_resolver_ready,
  to_regprocedure('public.assurance_regent_browser_recruitment_interview_schedule(text,uuid,timestamptz,text,text)') is not null as interview_scheduler_ready;

select
  c->>'id' as company_id,
  c->>'name' as company_name,
  coalesce(c->>'interviewMeetUrl','') as interview_meet_url
from public.assurance_regent_state s,
     jsonb_array_elements(coalesce(s.state_value#>'{auth,companies}','[]'::jsonb)) c
where s.state_key='browser-client-state'
order by c->>'name';

select company_id,status,count(*) as interviews,
       count(*) filter(where meet_url='') as missing_room,
       count(*) filter(where meet_url='https://meet.google.com/syq-rsnj-cwi') as old_shared_room
from public.assurance_regent_recruitment_interviews
group by company_id,status
order by company_id,status;
