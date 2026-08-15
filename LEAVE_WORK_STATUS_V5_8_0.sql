-- Assurance Regent v5.8.0 — Leave Management & Work Location
-- Run AFTER DEVELOPER_GOVERNANCE_V5_4_0.sql.
-- Uses the existing custom Assurance Regent session/role model.

create table if not exists public.assurance_regent_leave_policies (
  company_id text primary key,
  annual_accrual_days_per_month numeric not null default 2,
  annual_use_window_months integer not null default 6,
  annual_full_pay boolean not null default true,
  maternity_weeks integer not null default 14,
  maternity_multiple_birth_extra_weeks integer not null default 4,
  paternity_days integer not null default 5,
  compassionate_days integer not null default 12,
  family_responsibility_days integer not null default 7,
  family_care_days integer not null default 3,
  sick_short_full_days integer not null default 26,
  sick_short_half_days integer not null default 26,
  sick_long_full_months integer not null default 3,
  sick_long_half_months integer not null default 3,
  require_medical_certificate boolean not null default true,
  policy_note text not null default 'Company policy may be more favourable than statutory minimums. Verify contracts, collective agreements and current law.',
  updated_by text,
  updated_at timestamptz not null default now()
);

create table if not exists public.assurance_regent_leave_requests (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  requester_user_id text not null,
  employee_id text not null,
  employee_name text not null default '',
  leave_type text not null check (leave_type in ('ANNUAL','MATERNITY','PATERNITY','SICK','COMPASSIONATE','FAMILY_RESPONSIBILITY','OTHER')),
  start_date date not null,
  end_date date not null,
  requested_days numeric not null default 1,
  reason text not null default '',
  medical_certificate_name text not null default '',
  multiple_birth boolean not null default false,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED','CANCELLED')),
  decision_note text not null default '',
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  check (requested_days > 0)
);

create index if not exists assurance_regent_leave_requests_company_idx on public.assurance_regent_leave_requests(company_id,status,start_date);
create index if not exists assurance_regent_leave_requests_employee_idx on public.assurance_regent_leave_requests(employee_id,created_at desc);

create table if not exists public.assurance_regent_work_status (
  company_id text not null,
  employee_id text not null,
  employee_name text not null default '',
  status text not null default 'OFFICE' check (status in ('OFFICE','WFH','FIELD','TRAVEL','LEAVE','SICK','OFF_DUTY')),
  note text not null default '',
  effective_date date not null default current_date,
  until_date date,
  updated_by text not null,
  updated_at timestamptz not null default now(),
  primary key(company_id,employee_id)
);

create table if not exists public.assurance_regent_work_status_history (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  employee_id text not null,
  employee_name text not null default '',
  status text not null,
  note text not null default '',
  effective_date date not null,
  until_date date,
  updated_by text not null,
  created_at timestamptz not null default now()
);

alter table public.assurance_regent_leave_policies enable row level security;
alter table public.assurance_regent_leave_requests enable row level security;
alter table public.assurance_regent_work_status enable row level security;
alter table public.assurance_regent_work_status_history enable row level security;

revoke all on public.assurance_regent_leave_policies from public,anon,authenticated;
revoke all on public.assurance_regent_leave_requests from public,anon,authenticated;
revoke all on public.assurance_regent_work_status from public,anon,authenticated;
revoke all on public.assurance_regent_work_status_history from public,anon,authenticated;

create or replace function public.assurance_regent_browser_employee_for_actor(p_actor jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_state jsonb; v_employee jsonb; v_id text:=lower(trim(coalesce(p_actor->>'id',''))); v_email text:=lower(trim(coalesce(p_actor->>'email',''))); v_name text:=lower(trim(coalesce(p_actor->>'name','')));
begin
  select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state';
  select value into v_employee
  from jsonb_array_elements(coalesce(v_state#>'{live,employees}','[]'::jsonb)) t(value)
  where (v_id<>'' and lower(trim(coalesce(value->>'employeeId',value->>'employee_id','')))=v_id)
     or (v_email<>'' and lower(trim(coalesce(value->>'email','')))=v_email)
     or (v_name<>'' and lower(trim(coalesce(value->>'name',value->>'employee_name','')))=v_name)
  limit 1;
  return coalesce(v_employee,jsonb_build_object('employeeId',coalesce(p_actor->>'id',''),'name',coalesce(p_actor->>'name',''),'companyId',coalesce(p_actor->>'companyId','')));
end $$;
revoke all on function public.assurance_regent_browser_employee_for_actor(jsonb) from public,anon,authenticated;

create or replace function public.assurance_regent_browser_leave_bundle(p_token text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_actor jsonb; v_role text; v_company text; v_employee jsonb; v_employee_id text; v_requests jsonb; v_statuses jsonb; v_policies jsonb;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  v_role:=coalesce(v_actor->>'role','Employee'); v_company:=coalesce(v_actor->>'companyId','');
  v_employee:=public.assurance_regent_browser_employee_for_actor(v_actor); v_employee_id:=coalesce(v_employee->>'employeeId',v_actor->>'id','');

  if v_role='Developer' then
    select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc),'[]'::jsonb) into v_requests from public.assurance_regent_leave_requests r;
    select coalesce(jsonb_agg(to_jsonb(s) order by s.employee_name),'[]'::jsonb) into v_statuses from public.assurance_regent_work_status s where s.until_date is null or s.until_date>=current_date;
    select coalesce(jsonb_agg(to_jsonb(p) order by p.company_id),'[]'::jsonb) into v_policies from public.assurance_regent_leave_policies p;
  elsif v_role='Administrator' then
    select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc),'[]'::jsonb) into v_requests from public.assurance_regent_leave_requests r where r.company_id=v_company;
    select coalesce(jsonb_agg(to_jsonb(s) order by s.employee_name),'[]'::jsonb) into v_statuses from public.assurance_regent_work_status s where s.company_id=v_company and (s.until_date is null or s.until_date>=current_date);
    select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) into v_policies from public.assurance_regent_leave_policies p where p.company_id=v_company;
  else
    select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc),'[]'::jsonb) into v_requests from public.assurance_regent_leave_requests r where r.company_id=v_company and (r.requester_user_id=v_actor->>'id' or lower(r.employee_id)=lower(v_employee_id));
    select coalesce(jsonb_agg(to_jsonb(s)),'[]'::jsonb) into v_statuses from public.assurance_regent_work_status s where s.company_id=v_company and lower(s.employee_id)=lower(v_employee_id) and (s.until_date is null or s.until_date>=current_date);
    select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) into v_policies from public.assurance_regent_leave_policies p where p.company_id=v_company;
  end if;
  return jsonb_build_object('actor',v_actor,'employee',v_employee,'requests',coalesce(v_requests,'[]'::jsonb),'statuses',coalesce(v_statuses,'[]'::jsonb),'policies',coalesce(v_policies,'[]'::jsonb),'schemaVersion','5.8.0');
end $$;

create or replace function public.assurance_regent_browser_leave_apply(
  p_token text,p_employee_id text,p_leave_type text,p_start_date date,p_end_date date,p_requested_days numeric,p_reason text default '',p_medical_certificate_name text default '',p_multiple_birth boolean default false
) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_actor jsonb; v_role text; v_company text; v_employee jsonb; v_self_id text; v_target_id text; v_name text:=''; v_state jsonb; v_target jsonb; v_row public.assurance_regent_leave_requests;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token); v_role:=coalesce(v_actor->>'role','Employee'); v_company:=coalesce(v_actor->>'companyId','');
  v_employee:=public.assurance_regent_browser_employee_for_actor(v_actor); v_self_id:=coalesce(v_employee->>'employeeId',v_actor->>'id','');
  v_target_id:=trim(coalesce(p_employee_id,'')); if v_role='Employee' or v_target_id='' then v_target_id:=v_self_id; end if;
  if p_start_date is null or p_end_date is null or p_end_date<p_start_date then raise exception 'Choose a valid leave date range.'; end if;
  if upper(trim(coalesce(p_leave_type,''))) not in ('ANNUAL','MATERNITY','PATERNITY','SICK','COMPASSIONATE','FAMILY_RESPONSIBILITY','OTHER') then raise exception 'Unsupported leave type.'; end if;

  select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state';
  select value into v_target from jsonb_array_elements(coalesce(v_state#>'{live,employees}','[]'::jsonb)) t(value)
   where lower(trim(coalesce(value->>'employeeId',value->>'employee_id','')))=lower(v_target_id) limit 1;
  if v_target is not null then
    v_name:=coalesce(v_target->>'name',v_target->>'employee_name',v_target_id);
    if v_role<>'Developer' and coalesce(v_target->>'companyId',v_company)<>v_company then raise exception 'That employee is outside your company scope.'; end if;
    if v_role='Developer' then v_company:=coalesce(v_target->>'companyId',v_company); end if;
  else v_name:=case when lower(v_target_id)=lower(v_self_id) then coalesce(v_actor->>'name',v_target_id) else v_target_id end; end if;

  if v_role='Employee' and lower(v_target_id)<>lower(v_self_id) then raise exception 'Employees can submit leave only for themselves.'; end if;
  if upper(trim(p_leave_type))='SICK' and coalesce(trim(p_medical_certificate_name),'')='' then raise exception 'A medical certificate or supporting evidence reference is required for sick leave.'; end if;
  if upper(trim(p_leave_type))='PATERNITY' and coalesce(trim(p_medical_certificate_name),'')='' then raise exception 'A birth record or supporting evidence reference is required for paternity leave.'; end if;
  insert into public.assurance_regent_leave_requests(company_id,requester_user_id,employee_id,employee_name,leave_type,start_date,end_date,requested_days,reason,medical_certificate_name,multiple_birth)
  values(v_company,v_actor->>'id',v_target_id,v_name,upper(trim(p_leave_type)),p_start_date,p_end_date,greatest(coalesce(p_requested_days,1),0.25),coalesce(p_reason,''),coalesce(p_medical_certificate_name,''),coalesce(p_multiple_birth,false)) returning * into v_row;
  return to_jsonb(v_row);
end $$;

create or replace function public.assurance_regent_browser_leave_decide(p_token text,p_request_id uuid,p_action text,p_note text default '')
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_actor jsonb; v_role text; v_company text; v_action text; v_row public.assurance_regent_leave_requests;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token); v_role:=coalesce(v_actor->>'role','Employee'); v_company:=coalesce(v_actor->>'companyId','');
  if v_role not in ('Developer','Administrator') then raise exception 'Administrator or Developer approval is required.'; end if;
  v_action:=upper(trim(coalesce(p_action,''))); if v_action not in ('APPROVE','REJECT') then raise exception 'Leave action must be APPROVE or REJECT.'; end if;
  select * into v_row from public.assurance_regent_leave_requests where id=p_request_id for update; if v_row.id is null then raise exception 'Leave request not found.'; end if;
  if v_role='Administrator' and v_row.company_id<>v_company then raise exception 'That leave request is outside your company scope.'; end if;
  if v_row.status<>'PENDING' then raise exception 'Only pending leave requests can be approved or rejected.'; end if;
  update public.assurance_regent_leave_requests set status=case when v_action='APPROVE' then 'APPROVED' else 'REJECTED' end,decision_note=coalesce(p_note,''),decided_by=v_actor->>'id',decided_at=now(),updated_at=now() where id=p_request_id returning * into v_row;
  if v_action='APPROVE' and v_row.start_date<=current_date and v_row.end_date>=current_date then
    insert into public.assurance_regent_work_status(company_id,employee_id,employee_name,status,note,effective_date,until_date,updated_by,updated_at)
    values(v_row.company_id,v_row.employee_id,v_row.employee_name,case when v_row.leave_type='SICK' then 'SICK' else 'LEAVE' end,'Approved '||lower(replace(v_row.leave_type,'_',' '))||' leave',v_row.start_date,v_row.end_date,v_actor->>'id',now())
    on conflict(company_id,employee_id) do update set status=excluded.status,note=excluded.note,effective_date=excluded.effective_date,until_date=excluded.until_date,updated_by=excluded.updated_by,updated_at=now();
  end if;
  return to_jsonb(v_row);
end $$;

create or replace function public.assurance_regent_browser_work_status_set(p_token text,p_employee_id text,p_status text,p_note text default '',p_until_date date default null)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_actor jsonb; v_role text; v_company text; v_employee jsonb; v_self_id text; v_target_id text; v_status text; v_state jsonb; v_target jsonb; v_name text; v_row public.assurance_regent_work_status;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token); v_role:=coalesce(v_actor->>'role','Employee'); v_company:=coalesce(v_actor->>'companyId','');
  v_employee:=public.assurance_regent_browser_employee_for_actor(v_actor); v_self_id:=coalesce(v_employee->>'employeeId',v_actor->>'id','');
  v_target_id:=trim(coalesce(p_employee_id,'')); if v_role='Employee' or v_target_id='' then v_target_id:=v_self_id; end if;
  v_status:=upper(trim(coalesce(p_status,''))); if v_status not in ('OFFICE','WFH','FIELD','TRAVEL','LEAVE','SICK','OFF_DUTY') then raise exception 'Unsupported work status.'; end if;
  if v_role='Employee' and lower(v_target_id)<>lower(v_self_id) then raise exception 'Employees can update only their own work status.'; end if;
  select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state';
  select value into v_target from jsonb_array_elements(coalesce(v_state#>'{live,employees}','[]'::jsonb)) t(value) where lower(trim(coalesce(value->>'employeeId',value->>'employee_id','')))=lower(v_target_id) limit 1;
  v_name:=coalesce(v_target->>'name',v_target->>'employee_name',case when lower(v_target_id)=lower(v_self_id) then v_actor->>'name' else v_target_id end,v_target_id);
  if v_target is not null then
    if v_role='Developer' then v_company:=coalesce(v_target->>'companyId',v_company);
    elsif coalesce(v_target->>'companyId',v_company)<>v_company then raise exception 'That employee is outside your company scope.'; end if;
  end if;
  insert into public.assurance_regent_work_status(company_id,employee_id,employee_name,status,note,effective_date,until_date,updated_by,updated_at)
  values(v_company,v_target_id,v_name,v_status,coalesce(p_note,''),current_date,p_until_date,v_actor->>'id',now())
  on conflict(company_id,employee_id) do update set employee_name=excluded.employee_name,status=excluded.status,note=excluded.note,effective_date=current_date,until_date=excluded.until_date,updated_by=excluded.updated_by,updated_at=now() returning * into v_row;
  insert into public.assurance_regent_work_status_history(company_id,employee_id,employee_name,status,note,effective_date,until_date,updated_by)
  values(v_row.company_id,v_row.employee_id,v_row.employee_name,v_row.status,v_row.note,v_row.effective_date,v_row.until_date,v_actor->>'id');
  return to_jsonb(v_row);
end $$;

create or replace function public.assurance_regent_browser_leave_policy_update(
  p_token text,p_company_id text,p_annual_accrual numeric,p_annual_use_window integer,p_maternity_weeks integer,p_maternity_extra integer,p_paternity_days integer,p_compassionate_days integer,p_note text default ''
) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_actor jsonb; v_role text; v_company text; v_row public.assurance_regent_leave_policies;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token); v_role:=coalesce(v_actor->>'role','Employee'); v_company:=case when v_role='Developer' then trim(coalesce(p_company_id,'')) else coalesce(v_actor->>'companyId','') end;
  if v_role not in ('Developer','Administrator') then raise exception 'Administrator or Developer authority is required to edit leave policy.'; end if;
  if v_company='' then raise exception 'Select a company before editing leave policy.'; end if;
  insert into public.assurance_regent_leave_policies(company_id,annual_accrual_days_per_month,annual_use_window_months,maternity_weeks,maternity_multiple_birth_extra_weeks,paternity_days,compassionate_days,policy_note,updated_by,updated_at)
  values(v_company,greatest(coalesce(p_annual_accrual,2),2),greatest(coalesce(p_annual_use_window,6),0),greatest(coalesce(p_maternity_weeks,14),14),greatest(coalesce(p_maternity_extra,4),4),greatest(coalesce(p_paternity_days,5),5),greatest(coalesce(p_compassionate_days,12),12),coalesce(nullif(trim(p_note),''),'Company policy may be more favourable than statutory minimums. Verify contracts, collective agreements and current law.'),v_actor->>'id',now())
  on conflict(company_id) do update set annual_accrual_days_per_month=excluded.annual_accrual_days_per_month,annual_use_window_months=excluded.annual_use_window_months,maternity_weeks=excluded.maternity_weeks,maternity_multiple_birth_extra_weeks=excluded.maternity_multiple_birth_extra_weeks,paternity_days=excluded.paternity_days,compassionate_days=excluded.compassionate_days,policy_note=excluded.policy_note,updated_by=excluded.updated_by,updated_at=now() returning * into v_row;
  return to_jsonb(v_row);
end $$;

-- Extend Recovery Agent database context with role-scoped leave/work-status information.
create or replace function public.assurance_regent_browser_agent_context(p_token text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_actor jsonb; v_state jsonb; v_leave jsonb;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  update public.assurance_regent_auth_sessions set updated_at=now(),expires_at=now()+interval '12 hours' where token_hash=encode(digest(convert_to(p_token,'UTF8'),'sha256'),'hex');
  select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state';
  v_leave:=public.assurance_regent_browser_leave_bundle(p_token);
  return jsonb_build_object('actor',v_actor,'state',coalesce(v_state,'{}'::jsonb)||jsonb_build_object('leaveModule',v_leave),'schemaVersion','5.8.0');
end $$;

revoke all on function public.assurance_regent_browser_leave_bundle(text) from public;
revoke all on function public.assurance_regent_browser_leave_apply(text,text,text,date,date,numeric,text,text,boolean) from public;
revoke all on function public.assurance_regent_browser_leave_decide(text,uuid,text,text) from public;
revoke all on function public.assurance_regent_browser_work_status_set(text,text,text,text,date) from public;
revoke all on function public.assurance_regent_browser_leave_policy_update(text,text,numeric,integer,integer,integer,integer,integer,text) from public;
revoke all on function public.assurance_regent_browser_agent_context(text) from public;

grant execute on function public.assurance_regent_browser_leave_bundle(text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_leave_apply(text,text,text,date,date,numeric,text,text,boolean) to anon,authenticated;
grant execute on function public.assurance_regent_browser_leave_decide(text,uuid,text,text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_work_status_set(text,text,text,text,date) to anon,authenticated;
grant execute on function public.assurance_regent_browser_leave_policy_update(text,text,numeric,integer,integer,integer,integer,integer,text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_agent_context(text) to anon,authenticated;

-- Seed policy rows for currently configured companies.
insert into public.assurance_regent_leave_policies(company_id)
select distinct value->>'id'
from public.assurance_regent_state s, jsonb_array_elements(coalesce(s.state_value#>'{auth,companies}','[]'::jsonb)) t(value)
where s.state_key='browser-client-state' and coalesce(value->>'id','')<>''
on conflict(company_id) do nothing;
