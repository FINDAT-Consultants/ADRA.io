-- Assurance Regent v6.3.9 HOTFIX 1
-- Repairs databases installed with the incomplete v6.3.9 consolidated setup.
-- Safe target: a database that already has the v5.4 Assurance Regent browser/governance setup.
-- Applies the omitted migrations in dependency order, then restores the complete health contract.



-- ============================================================================
-- BEGIN LEAVE_WORK_STATUS_V5_8_0.sql
-- ============================================================================
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

-- END LEAVE_WORK_STATUS_V5_8_0.sql


-- ============================================================================
-- BEGIN JIVAN_BACKGROUND_TASKS_V5_9_0.sql
-- ============================================================================
-- Assurance Regent v5.9.0 — Jivan delegated/background task queue
-- Run AFTER DEVELOPER_GOVERNANCE_V5_4_0.sql and LEAVE_WORK_STATUS_V5_8_0.sql.
-- Keeps delegated work role-scoped to the signed-in Assurance Regent user.

create extension if not exists pgcrypto;

create table if not exists public.assurance_regent_agent_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  user_role text not null,
  company_id text not null default '',
  title text not null default 'Jivan delegated task',
  instruction text not null,
  priority text not null default 'NORMAL' check (priority in ('LOW','NORMAL','HIGH')),
  status text not null default 'QUEUED' check (status in ('QUEUED','RUNNING','WAITING_USER','COMPLETED','FAILED','CANCELLED')),
  result_text text not null default '',
  result_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists assurance_regent_agent_tasks_user_status_idx
  on public.assurance_regent_agent_tasks(user_id,status,created_at desc);
create index if not exists assurance_regent_agent_tasks_company_idx
  on public.assurance_regent_agent_tasks(company_id,created_at desc);

alter table public.assurance_regent_agent_tasks enable row level security;
revoke all on public.assurance_regent_agent_tasks from public,anon,authenticated;

create or replace function public.assurance_regent_browser_agent_task_create(
  p_token text,
  p_title text,
  p_instruction text,
  p_priority text default 'NORMAL'
) returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_actor jsonb;
  v_priority text:=upper(trim(coalesce(p_priority,'NORMAL')));
  v_row public.assurance_regent_agent_tasks;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  if trim(coalesce(p_instruction,''))='' then raise exception 'A delegated task instruction is required.'; end if;
  if length(p_instruction)>12000 then raise exception 'The delegated task is too long.'; end if;
  if v_priority not in ('LOW','NORMAL','HIGH') then v_priority:='NORMAL'; end if;

  insert into public.assurance_regent_agent_tasks(
    user_id,user_role,company_id,title,instruction,priority,status
  ) values (
    coalesce(v_actor->>'id',''),
    coalesce(v_actor->>'role','Employee'),
    coalesce(v_actor->>'companyId',''),
    left(coalesce(nullif(trim(p_title),''),'Jivan delegated task'),180),
    left(trim(p_instruction),12000),
    v_priority,
    'QUEUED'
  ) returning * into v_row;
  return to_jsonb(v_row);
end $$;

create or replace function public.assurance_regent_browser_agent_task_list(
  p_token text,
  p_limit integer default 30
) returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_actor jsonb;
  v_uid text;
  v_limit integer:=greatest(1,least(coalesce(p_limit,30),100));
  v_rows jsonb;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  v_uid:=coalesce(v_actor->>'id','');
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb)
  into v_rows
  from (
    select id,user_id,user_role,company_id,title,instruction,priority,status,result_text,result_metadata,created_at,started_at,completed_at,updated_at
    from public.assurance_regent_agent_tasks
    where user_id=v_uid
    order by created_at desc
    limit v_limit
  ) x;
  return coalesce(v_rows,'[]'::jsonb);
end $$;

create or replace function public.assurance_regent_browser_agent_task_claim_next(p_token text)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_actor jsonb;
  v_uid text;
  v_id uuid;
  v_row public.assurance_regent_agent_tasks;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  v_uid:=coalesce(v_actor->>'id','');

  select id into v_id
  from public.assurance_regent_agent_tasks
  where user_id=v_uid
    and (status='QUEUED' or (status='RUNNING' and updated_at < now() - interval '10 minutes'))
  order by case when status='RUNNING' then 0 else 1 end, case priority when 'HIGH' then 0 when 'NORMAL' then 1 else 2 end, created_at asc
  for update skip locked
  limit 1;

  if v_id is null then return null; end if;
  update public.assurance_regent_agent_tasks
    set status='RUNNING',started_at=coalesce(started_at,now()),updated_at=now()
  where id=v_id and user_id=v_uid
    and (status='QUEUED' or (status='RUNNING' and updated_at < now() - interval '10 minutes'))
  returning * into v_row;
  if v_row.id is null then return null; end if;
  return to_jsonb(v_row);
end $$;

create or replace function public.assurance_regent_browser_agent_task_finish(
  p_token text,
  p_task_id uuid,
  p_status text,
  p_result_text text default '',
  p_result_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_actor jsonb;
  v_uid text;
  v_status text:=upper(trim(coalesce(p_status,'')));
  v_row public.assurance_regent_agent_tasks;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  v_uid:=coalesce(v_actor->>'id','');
  if v_status not in ('WAITING_USER','COMPLETED','FAILED','CANCELLED') then raise exception 'Unsupported task completion status.'; end if;

  update public.assurance_regent_agent_tasks
  set status=v_status,
      result_text=left(coalesce(p_result_text,''),24000),
      result_metadata=coalesce(p_result_metadata,'{}'::jsonb),
      completed_at=case when v_status in ('COMPLETED','FAILED','CANCELLED') then now() else completed_at end,
      updated_at=now()
  where id=p_task_id and user_id=v_uid and status in ('QUEUED','RUNNING','WAITING_USER')
  returning * into v_row;
  if v_row.id is null then raise exception 'The delegated task is unavailable or no longer active.'; end if;
  return to_jsonb(v_row);
end $$;

create or replace function public.assurance_regent_browser_agent_task_cancel(
  p_token text,
  p_task_id uuid
) returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_actor jsonb;
  v_uid text;
  v_row public.assurance_regent_agent_tasks;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  v_uid:=coalesce(v_actor->>'id','');
  update public.assurance_regent_agent_tasks
  set status='CANCELLED',completed_at=now(),updated_at=now()
  where id=p_task_id and user_id=v_uid and status in ('QUEUED','RUNNING','WAITING_USER')
  returning * into v_row;
  if v_row.id is null then raise exception 'The delegated task is unavailable or already finished.'; end if;
  return to_jsonb(v_row);
end $$;

revoke all on function public.assurance_regent_browser_agent_task_create(text,text,text,text) from public;
revoke all on function public.assurance_regent_browser_agent_task_list(text,integer) from public;
revoke all on function public.assurance_regent_browser_agent_task_claim_next(text) from public;
revoke all on function public.assurance_regent_browser_agent_task_finish(text,uuid,text,text,jsonb) from public;
revoke all on function public.assurance_regent_browser_agent_task_cancel(text,uuid) from public;

grant execute on function public.assurance_regent_browser_agent_task_create(text,text,text,text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_agent_task_list(text,integer) to anon,authenticated;
grant execute on function public.assurance_regent_browser_agent_task_claim_next(text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_agent_task_finish(text,uuid,text,text,jsonb) to anon,authenticated;
grant execute on function public.assurance_regent_browser_agent_task_cancel(text,uuid) to anon,authenticated;

-- END JIVAN_BACKGROUND_TASKS_V5_9_0.sql


-- ============================================================================
-- BEGIN DEPARTMENTAL_AUTHORITY_V5_10_0.sql
-- ============================================================================
-- Assurance Regent / Jivan v5.10.0 — Departmental Authority, Company-Country Leave Policy & Governance
-- Run AFTER: DEVELOPER_GOVERNANCE_V5_4_0.sql, LEAVE_WORK_STATUS_V5_8_0.sql, JIVAN_BACKGROUND_TASKS_V5_9_0.sql
-- This upgrade preserves the three system roles (Developer / Administrator / Employee)
-- while adding functional authority based on supervisoryRole, position and department.

create or replace function public.assurance_regent_browser_functional_authority(p_actor jsonb)
returns text language plpgsql immutable as $$
declare
  v_role text:=coalesce(p_actor->>'role','Employee');
  v_text text:=lower(concat_ws(' ',coalesce(p_actor->>'supervisoryRole',''),coalesce(p_actor->>'position',''),coalesce(p_actor->>'department','')));
begin
  if v_role='Developer' then return 'DEVELOPER'; end if;
  if v_text ~ '(^|[^a-z])(chief executive officer|ceo)([^a-z]|$)' then return 'CEO'; end if;
  if v_text ~ '(human resources|human resource|(^|[^a-z])hr([^a-z]|$))' and v_text ~ '(manager|director|head)' then return 'HR_MANAGER'; end if;
  if v_text ~ 'finance' and v_text ~ '(manager|director|head)' then return 'FINANCE_MANAGER'; end if;
  if v_text ~ 'program(me)?s?' and v_text ~ '(manager|director|head)' then return 'PROGRAMS_MANAGER'; end if;
  if v_text ~ 'project' and v_text ~ '(manager|director|head)' then return 'PROJECT_MANAGER'; end if;
  if coalesce(p_actor->>'supervisoryRole','')='Head of Department' then return 'HEAD_OF_DEPARTMENT'; end if;
  if coalesce(p_actor->>'supervisoryRole','')='Supervisor' then return 'SUPERVISOR'; end if;
  if v_role='Administrator' then return 'ADMINISTRATOR'; end if;
  return 'EMPLOYEE';
end $$;

revoke all on function public.assurance_regent_browser_functional_authority(jsonb) from public,anon,authenticated;

create or replace function public.assurance_regent_browser_can_manage_leave(p_actor jsonb)
returns boolean language sql immutable as $$
  select public.assurance_regent_browser_functional_authority(p_actor) in ('DEVELOPER','CEO','ADMINISTRATOR','HR_MANAGER');
$$;
revoke all on function public.assurance_regent_browser_can_manage_leave(jsonb) from public,anon,authenticated;

create or replace function public.assurance_regent_browser_manager_scope_allows(p_actor jsonb,p_employee jsonb)
returns boolean language plpgsql security definer set search_path=public,extensions as $$
declare
  v_auth text:=public.assurance_regent_browser_functional_authority(p_actor);
  v_actor_company text:=coalesce(p_actor->>'companyId','');
  v_target_company text:=coalesce(p_employee->>'companyId',p_employee->>'company_id',v_actor_company);
  v_actor_emp jsonb:=public.assurance_regent_browser_employee_for_actor(p_actor);
  v_actor_dept text:=lower(trim(coalesce(p_actor->>'department',v_actor_emp->>'department','')));
  v_target_dept text:=lower(trim(coalesce(p_employee->>'department','')));
  v_supervisor text:=lower(trim(coalesce(p_employee->>'supervisor','')));
  v_actor_id text:=lower(trim(coalesce(p_actor->>'id','')));
  v_actor_name text:=lower(trim(coalesce(p_actor->>'name','')));
begin
  if v_auth='DEVELOPER' then return true; end if;
  if v_target_company<>v_actor_company then return false; end if;
  if v_auth in ('CEO','ADMINISTRATOR','HR_MANAGER') then return true; end if;
  if v_auth in ('FINANCE_MANAGER','PROJECT_MANAGER','PROGRAMS_MANAGER','HEAD_OF_DEPARTMENT','SUPERVISOR') then
    return (v_actor_dept<>'' and v_target_dept=v_actor_dept) or (v_supervisor<>'' and v_supervisor in (v_actor_id,v_actor_name));
  end if;
  return false;
end $$;
revoke all on function public.assurance_regent_browser_manager_scope_allows(jsonb,jsonb) from public,anon,authenticated;

-- Functional-authority aware user management. CEO may manage company users and assign departmental managers,
-- but only a Developer may assign CEO or Developer authority.
create or replace function public.assurance_regent_browser_admin_update_user(
  p_token text,p_user_id text,p_role text,p_company_id text,p_position text,p_department text,p_supervisor text,p_supervisory_role text
)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare
  v_actor jsonb; v_state jsonb; v_accounts jsonb; v_target jsonb; v_idx int; v_actor_role text; v_auth text; v_target_auth text; v_company text:=trim(coalesce(p_company_id,''));
  v_requested_auth text:=lower(trim(coalesce(p_supervisory_role,'')));
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token); v_actor_role:=coalesce(v_actor->>'role',''); v_auth:=public.assurance_regent_browser_functional_authority(v_actor);
  if v_auth not in ('DEVELOPER','CEO','ADMINISTRATOR') then raise exception 'Administrator, CEO or Developer permission is required.'; end if;
  if p_role not in ('Developer','Administrator','Employee') then raise exception 'Invalid system role.'; end if;

  select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state' for update;
  v_accounts:=coalesce(v_state#>'{auth,accounts}','[]'::jsonb);
  select value,ordinality-1 into v_target,v_idx from jsonb_array_elements(v_accounts) with ordinality as t(value,ordinality) where value->>'id'=p_user_id limit 1;
  if v_target is null then raise exception 'User not found.'; end if;

  v_target_auth:=public.assurance_regent_browser_functional_authority(v_target);
  if v_auth<>'DEVELOPER' then
    if coalesce(v_target->>'companyId','')<>coalesce(v_actor->>'companyId','') then raise exception 'You may only manage users in your company.'; end if;
    if coalesce(v_target->>'role','')='Developer' or p_role='Developer' then raise exception 'Only Developers may assign or change Developer authority.'; end if;
    if v_auth='ADMINISTRATOR' and v_target_auth in ('CEO','HR_MANAGER','FINANCE_MANAGER','PROJECT_MANAGER','PROGRAMS_MANAGER') then raise exception 'Administrators cannot override CEO or senior departmental authority. CEO or Developer approval is required.'; end if;
    if v_requested_auth like '%chief executive officer%' or v_requested_auth='ceo' then raise exception 'Only a Developer may assign CEO authority.'; end if;
    if v_auth='ADMINISTRATOR' and v_requested_auth in ('human resources manager','finance manager','project manager','programs manager','programs director') then raise exception 'Department-manager authority can only be assigned by the CEO or Developer.'; end if;
    v_company:=coalesce(v_actor->>'companyId','');
  else
    if lower(p_user_id)='dvp' and p_role<>'Developer' then raise exception 'The permanent Developer account must remain Developer.'; end if;
    if p_role='Developer' then v_company:=''; end if;
    if p_role<>'Developer' then
      if v_company='' then raise exception 'Select a company before assigning Administrator or Employee authority.'; end if;
      if not exists(select 1 from jsonb_array_elements(coalesce(v_state#>'{auth,companies}','[]'::jsonb)) c where c->>'id'=v_company) then raise exception 'Select a valid company.'; end if;
    end if;
  end if;

  v_target:=v_target || jsonb_build_object(
    'role',p_role,'companyId',v_company,'position',trim(coalesce(p_position,'')),'department',trim(coalesce(p_department,'')),
    'supervisor',trim(coalesce(p_supervisor,'')),'supervisoryRole',trim(coalesce(p_supervisory_role,'')),
    'hiddenFromDirectory',(p_role='Developer'),'updatedAt',now(),'updatedBy',v_actor->>'id'
  );
  v_accounts:=jsonb_set(v_accounts,array[v_idx::text],v_target,false);
  v_state:=jsonb_set(v_state,'{auth,accounts}',v_accounts,true);
  update public.assurance_regent_state set state_value=v_state,updated_at=now() where state_key='browser-client-state';
  return v_target;
end $$;

-- Developer-only immutable company-registration country update.
create or replace function public.assurance_regent_browser_admin_company_registration(
  p_token text,p_company_id text,p_country text,p_country_code text default ''
)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_actor jsonb; v_state jsonb; v_companies jsonb; v_company jsonb; v_idx int;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  if public.assurance_regent_browser_functional_authority(v_actor)<>'DEVELOPER' then raise exception 'Developer permission is required.'; end if;
  if trim(coalesce(p_country,''))='' then raise exception 'Registered country is required.'; end if;
  select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state' for update;
  v_companies:=coalesce(v_state#>'{auth,companies}','[]'::jsonb);
  select value,ordinality-1 into v_company,v_idx from jsonb_array_elements(v_companies) with ordinality t(value,ordinality) where value->>'id'=p_company_id limit 1;
  if v_company is null then raise exception 'Company not found.'; end if;
  if trim(coalesce(v_company->>'registeredCountry',''))<>'' and lower(trim(v_company->>'registeredCountry'))<>lower(trim(p_country)) then
    raise exception 'Registered country is fixed to the company original registration country. Create a controlled correction migration if the historical registration record is wrong.';
  end if;
  v_company:=v_company||jsonb_build_object('registeredCountry',trim(p_country),'registeredCountryCode',upper(trim(coalesce(p_country_code,''))),'registrationUpdatedAt',coalesce(v_company->'registrationUpdatedAt',to_jsonb(now())),'registrationUpdatedBy',coalesce(v_company->>'registrationUpdatedBy',v_actor->>'id'));
  v_companies:=jsonb_set(v_companies,array[v_idx::text],v_company,false);
  v_state:=jsonb_set(v_state,'{auth,companies}',v_companies,true);
  update public.assurance_regent_state set state_value=v_state,updated_at=now() where state_key='browser-client-state';
  return v_company;
end $$;

-- Leave bundle: HR/CEO/Admin get company leave decisions; Department/Project/Programs managers get managed-team work-status visibility; Developer gets all.
create or replace function public.assurance_regent_browser_leave_bundle(p_token text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_actor jsonb; v_auth text; v_company text; v_employee jsonb; v_employee_id text; v_requests jsonb; v_statuses jsonb; v_policies jsonb; v_state jsonb;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token); v_auth:=public.assurance_regent_browser_functional_authority(v_actor); v_company:=coalesce(v_actor->>'companyId','');
  v_employee:=public.assurance_regent_browser_employee_for_actor(v_actor); v_employee_id:=coalesce(v_employee->>'employeeId',v_actor->>'id','');
  if v_auth='DEVELOPER' then
    select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc),'[]'::jsonb) into v_requests from public.assurance_regent_leave_requests r;
    select coalesce(jsonb_agg(to_jsonb(s) order by s.updated_at desc),'[]'::jsonb) into v_statuses from public.assurance_regent_work_status s where s.until_date is null or s.until_date>=current_date;
    select coalesce(jsonb_agg(to_jsonb(p) order by p.updated_at desc),'[]'::jsonb) into v_policies from public.assurance_regent_leave_policies p;
  elsif public.assurance_regent_browser_can_manage_leave(v_actor) then
    select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc),'[]'::jsonb) into v_requests from public.assurance_regent_leave_requests r where r.company_id=v_company;
    select coalesce(jsonb_agg(to_jsonb(s) order by s.updated_at desc),'[]'::jsonb) into v_statuses from public.assurance_regent_work_status s where s.company_id=v_company and (s.until_date is null or s.until_date>=current_date);
    select coalesce(jsonb_agg(to_jsonb(p) order by p.updated_at desc),'[]'::jsonb) into v_policies from public.assurance_regent_leave_policies p where p.company_id=v_company;
  elsif v_auth in ('FINANCE_MANAGER','PROJECT_MANAGER','PROGRAMS_MANAGER','HEAD_OF_DEPARTMENT','SUPERVISOR') then
    select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state';
    select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc),'[]'::jsonb) into v_requests from public.assurance_regent_leave_requests r where r.company_id=v_company and (r.requester_user_id=v_actor->>'id' or lower(r.employee_id)=lower(v_employee_id));
    select coalesce(jsonb_agg(to_jsonb(s) order by s.updated_at desc),'[]'::jsonb) into v_statuses
    from public.assurance_regent_work_status s
    where s.company_id=v_company and (s.until_date is null or s.until_date>=current_date)
      and exists(
        select 1 from jsonb_array_elements(coalesce(v_state#>'{live,employees}','[]'::jsonb)) e
        where lower(trim(coalesce(e->>'employeeId',e->>'employee_id','')))=lower(s.employee_id)
          and public.assurance_regent_browser_manager_scope_allows(v_actor,e)
      );
    select coalesce(jsonb_agg(to_jsonb(p) order by p.updated_at desc),'[]'::jsonb) into v_policies from public.assurance_regent_leave_policies p where p.company_id=v_company;
  else
    select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc),'[]'::jsonb) into v_requests from public.assurance_regent_leave_requests r where r.company_id=v_company and (r.requester_user_id=v_actor->>'id' or lower(r.employee_id)=lower(v_employee_id));
    select coalesce(jsonb_agg(to_jsonb(s) order by s.updated_at desc),'[]'::jsonb) into v_statuses from public.assurance_regent_work_status s where s.company_id=v_company and lower(s.employee_id)=lower(v_employee_id) and (s.until_date is null or s.until_date>=current_date);
    select coalesce(jsonb_agg(to_jsonb(p) order by p.updated_at desc),'[]'::jsonb) into v_policies from public.assurance_regent_leave_policies p where p.company_id=v_company;
  end if;
  return jsonb_build_object('actor',v_actor,'authority',v_auth,'employee',v_employee,'requests',coalesce(v_requests,'[]'::jsonb),'statuses',coalesce(v_statuses,'[]'::jsonb),'policies',coalesce(v_policies,'[]'::jsonb),'schemaVersion','5.10.0');
end $$;

create or replace function public.assurance_regent_browser_leave_apply(
  p_token text,p_employee_id text,p_leave_type text,p_start_date date,p_end_date date,p_requested_days numeric,p_reason text default '',p_medical_certificate_name text default '',p_multiple_birth boolean default false
) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_actor jsonb; v_auth text; v_company text; v_employee jsonb; v_self_id text; v_target_id text; v_name text:=''; v_state jsonb; v_target jsonb; v_row public.assurance_regent_leave_requests;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token); v_auth:=public.assurance_regent_browser_functional_authority(v_actor); v_company:=coalesce(v_actor->>'companyId','');
  v_employee:=public.assurance_regent_browser_employee_for_actor(v_actor); v_self_id:=coalesce(v_employee->>'employeeId',v_actor->>'id','');
  v_target_id:=trim(coalesce(p_employee_id,'')); if not public.assurance_regent_browser_can_manage_leave(v_actor) or v_target_id='' then v_target_id:=v_self_id; end if;
  if p_start_date is null or p_end_date is null or p_end_date<p_start_date then raise exception 'Choose a valid leave date range.'; end if;
  if upper(trim(coalesce(p_leave_type,''))) not in ('ANNUAL','MATERNITY','PATERNITY','SICK','COMPASSIONATE','FAMILY_RESPONSIBILITY','OTHER') then raise exception 'Unsupported leave type.'; end if;
  select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state';
  select value into v_target from jsonb_array_elements(coalesce(v_state#>'{live,employees}','[]'::jsonb)) t(value) where lower(trim(coalesce(value->>'employeeId',value->>'employee_id','')))=lower(v_target_id) limit 1;
  if v_target is not null then
    v_name:=coalesce(v_target->>'name',v_target->>'employee_name',v_target_id);
    if v_auth<>'DEVELOPER' and coalesce(v_target->>'companyId',v_company)<>v_company then raise exception 'That employee is outside your company scope.'; end if;
    if v_auth='DEVELOPER' then v_company:=coalesce(v_target->>'companyId',v_company); end if;
  else v_name:=case when lower(v_target_id)=lower(v_self_id) then coalesce(v_actor->>'name',v_target_id) else v_target_id end; end if;
  insert into public.assurance_regent_leave_requests(company_id,requester_user_id,employee_id,employee_name,leave_type,start_date,end_date,requested_days,reason,medical_certificate_name,multiple_birth)
  values(v_company,v_actor->>'id',v_target_id,v_name,upper(trim(p_leave_type)),p_start_date,p_end_date,greatest(coalesce(p_requested_days,1),0.25),coalesce(p_reason,''),coalesce(p_medical_certificate_name,''),coalesce(p_multiple_birth,false)) returning * into v_row;
  return to_jsonb(v_row);
end $$;

create or replace function public.assurance_regent_browser_leave_decide(p_token text,p_request_id uuid,p_action text,p_note text default '')
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_actor jsonb; v_auth text; v_company text; v_action text; v_row public.assurance_regent_leave_requests;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token); v_auth:=public.assurance_regent_browser_functional_authority(v_actor); v_company:=coalesce(v_actor->>'companyId','');
  if not public.assurance_regent_browser_can_manage_leave(v_actor) then raise exception 'HR, Administrator, CEO or Developer leave authority is required.'; end if;
  v_action:=upper(trim(coalesce(p_action,''))); if v_action not in ('APPROVE','REJECT') then raise exception 'Leave action must be APPROVE or REJECT.'; end if;
  select * into v_row from public.assurance_regent_leave_requests where id=p_request_id for update; if v_row.id is null then raise exception 'Leave request not found.'; end if;
  if v_auth<>'DEVELOPER' and v_row.company_id<>v_company then raise exception 'That leave request is outside your company scope.'; end if;
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
declare v_actor jsonb; v_auth text; v_company text; v_employee jsonb; v_self_id text; v_target_id text; v_status text; v_state jsonb; v_target jsonb; v_name text; v_row public.assurance_regent_work_status; v_can_manage boolean;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token); v_auth:=public.assurance_regent_browser_functional_authority(v_actor); v_company:=coalesce(v_actor->>'companyId','');
  v_employee:=public.assurance_regent_browser_employee_for_actor(v_actor); v_self_id:=coalesce(v_employee->>'employeeId',v_actor->>'id','');
  v_target_id:=trim(coalesce(p_employee_id,'')); if v_target_id='' then v_target_id:=v_self_id; end if;
  v_status:=upper(trim(coalesce(p_status,''))); if v_status not in ('OFFICE','WFH','FIELD','TRAVEL','LEAVE','SICK','OFF_DUTY') then raise exception 'Unsupported work status.'; end if;
  select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state';
  select value into v_target from jsonb_array_elements(coalesce(v_state#>'{live,employees}','[]'::jsonb)) t(value) where lower(trim(coalesce(value->>'employeeId',value->>'employee_id','')))=lower(v_target_id) limit 1;
  if lower(v_target_id)=lower(v_self_id) then v_can_manage:=true; else v_can_manage:=public.assurance_regent_browser_manager_scope_allows(v_actor,coalesce(v_target,'{}'::jsonb)); end if;
  if not v_can_manage then raise exception 'That employee is outside your work-status management scope.'; end if;
  v_name:=coalesce(v_target->>'name',v_target->>'employee_name',case when lower(v_target_id)=lower(v_self_id) then v_actor->>'name' else v_target_id end,v_target_id);
  if v_target is not null then
    if v_auth='DEVELOPER' then v_company:=coalesce(v_target->>'companyId',v_company);
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
declare v_actor jsonb; v_auth text; v_company text; v_row public.assurance_regent_leave_policies;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token); v_auth:=public.assurance_regent_browser_functional_authority(v_actor); v_company:=case when v_auth='DEVELOPER' then trim(coalesce(p_company_id,'')) else coalesce(v_actor->>'companyId','') end;
  if not public.assurance_regent_browser_can_manage_leave(v_actor) then raise exception 'HR, Administrator, CEO or Developer authority is required to edit leave policy.'; end if;
  if v_company='' then raise exception 'Select a company before editing leave policy.'; end if;
  insert into public.assurance_regent_leave_policies(company_id,annual_accrual_days_per_month,annual_use_window_months,maternity_weeks,maternity_multiple_birth_extra_weeks,paternity_days,compassionate_days,policy_note,updated_by,updated_at)
  values(v_company,greatest(coalesce(p_annual_accrual,0),0),greatest(coalesce(p_annual_use_window,0),0),greatest(coalesce(p_maternity_weeks,0),0),greatest(coalesce(p_maternity_extra,0),0),greatest(coalesce(p_paternity_days,0),0),greatest(coalesce(p_compassionate_days,0),0),coalesce(nullif(trim(p_note),''),'Company leave policy must be verified against the current law of the registered country, contracts and any more favourable collective terms.'),v_actor->>'id',now())
  on conflict(company_id) do update set annual_accrual_days_per_month=excluded.annual_accrual_days_per_month,annual_use_window_months=excluded.annual_use_window_months,maternity_weeks=excluded.maternity_weeks,maternity_multiple_birth_extra_weeks=excluded.maternity_multiple_birth_extra_weeks,paternity_days=excluded.paternity_days,compassionate_days=excluded.compassionate_days,policy_note=excluded.policy_note,updated_by=excluded.updated_by,updated_at=now() returning * into v_row;
  return to_jsonb(v_row);
end $$;

create or replace function public.assurance_regent_browser_agent_context(p_token text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_actor jsonb; v_state jsonb; v_leave jsonb;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  update public.assurance_regent_auth_sessions set updated_at=now(),expires_at=now()+interval '12 hours' where token_hash=encode(digest(convert_to(p_token,'UTF8'),'sha256'),'hex');
  select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state';
  v_leave:=public.assurance_regent_browser_leave_bundle(p_token);
  return jsonb_build_object('actor',v_actor,'authority',public.assurance_regent_browser_functional_authority(v_actor),'state',coalesce(v_state,'{}'::jsonb)||jsonb_build_object('leaveModule',v_leave),'schemaVersion','5.10.0');
end $$;

revoke all on function public.assurance_regent_browser_admin_update_user(text,text,text,text,text,text,text,text) from public;
revoke all on function public.assurance_regent_browser_admin_company_registration(text,text,text,text) from public;
revoke all on function public.assurance_regent_browser_leave_bundle(text) from public;
revoke all on function public.assurance_regent_browser_leave_apply(text,text,text,date,date,numeric,text,text,boolean) from public;
revoke all on function public.assurance_regent_browser_leave_decide(text,uuid,text,text) from public;
revoke all on function public.assurance_regent_browser_work_status_set(text,text,text,text,date) from public;
revoke all on function public.assurance_regent_browser_leave_policy_update(text,text,numeric,integer,integer,integer,integer,integer,text) from public;
revoke all on function public.assurance_regent_browser_agent_context(text) from public;

grant execute on function public.assurance_regent_browser_admin_update_user(text,text,text,text,text,text,text,text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_admin_company_registration(text,text,text,text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_leave_bundle(text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_leave_apply(text,text,text,date,date,numeric,text,text,boolean) to anon,authenticated;
grant execute on function public.assurance_regent_browser_leave_decide(text,uuid,text,text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_work_status_set(text,text,text,text,date) to anon,authenticated;
grant execute on function public.assurance_regent_browser_leave_policy_update(text,text,numeric,integer,integer,integer,integer,integer,text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_agent_context(text) to anon,authenticated;

-- Existing companies created before country capture will retain a blank registration country until a Developer sets it.
-- The frontend shows 'Registration country not set' until a Developer records the historical registration country once; after that the RPC prevents casual country changes.

-- END DEPARTMENTAL_AUTHORITY_V5_10_0.sql


-- ============================================================================
-- BEGIN RECOVERY_ASSURANCE_V6_0_0.sql
-- ============================================================================
-- Assurance Regent v6.0.0 — Recovery Assurance & Accounting
-- Run AFTER the v5.10 departmental-authority migration and v5.9 background-task migration.
-- Adds normalized, append-only recovery assurance records without removing legacy application state.

create extension if not exists pgcrypto;

-- v6 adds a read-only Auditor / Internal Auditor functional authority without changing the three base account roles.
create or replace function public.assurance_regent_browser_functional_authority(p_actor jsonb)
returns text language plpgsql immutable as $$
declare
  v_role text:=coalesce(p_actor->>'role','Employee');
  v_text text:=lower(concat_ws(' ',coalesce(p_actor->>'supervisoryRole',''),coalesce(p_actor->>'position',''),coalesce(p_actor->>'department','')));
begin
  if v_role='Developer' then return 'DEVELOPER'; end if;
  if v_text ~ '(^|[^a-z])(chief executive officer|ceo)([^a-z]|$)' then return 'CEO'; end if;
  if v_text ~ '(internal audit|internal auditor|auditor|audit manager|audit director|head of audit)' then return 'AUDITOR'; end if;
  if v_text ~ '(human resources|human resource|(^|[^a-z])hr([^a-z]|$))' and v_text ~ '(manager|director|head)' then return 'HR_MANAGER'; end if;
  if v_text ~ 'finance' and v_text ~ '(manager|director|head)' then return 'FINANCE_MANAGER'; end if;
  if v_text ~ 'program(me)?s?' and v_text ~ '(manager|director|head)' then return 'PROGRAMS_MANAGER'; end if;
  if v_text ~ 'project' and v_text ~ '(manager|director|head)' then return 'PROJECT_MANAGER'; end if;
  if coalesce(p_actor->>'supervisoryRole','')='Head of Department' then return 'HEAD_OF_DEPARTMENT'; end if;
  if coalesce(p_actor->>'supervisoryRole','')='Supervisor' then return 'SUPERVISOR'; end if;
  if v_role='Administrator' then return 'ADMINISTRATOR'; end if;
  return 'EMPLOYEE';
end $$;
revoke all on function public.assurance_regent_browser_functional_authority(jsonb) from public,anon,authenticated;


-- v6 authority-assignment hardening. Auditor/Internal Audit is senior functional authority:
-- CEO or Developer may assign it; ordinary Administrators may not assign or override it.
create or replace function public.assurance_regent_browser_admin_update_user(
  p_token text,p_user_id text,p_role text,p_company_id text,p_position text,p_department text,p_supervisor text,p_supervisory_role text
)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare
  v_actor jsonb; v_state jsonb; v_accounts jsonb; v_target jsonb; v_idx int; v_auth text; v_target_auth text; v_company text:=trim(coalesce(p_company_id,''));
  v_requested_auth text:=lower(trim(coalesce(p_supervisory_role,'')));
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token); v_auth:=public.assurance_regent_browser_functional_authority(v_actor);
  if v_auth not in ('DEVELOPER','CEO','ADMINISTRATOR') then raise exception 'Administrator, CEO or Developer permission is required.'; end if;
  if p_role not in ('Developer','Administrator','Employee') then raise exception 'Invalid system role.'; end if;

  select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state' for update;
  v_accounts:=coalesce(v_state#>'{auth,accounts}','[]'::jsonb);
  select value,ordinality-1 into v_target,v_idx from jsonb_array_elements(v_accounts) with ordinality as t(value,ordinality) where value->>'id'=p_user_id limit 1;
  if v_target is null then raise exception 'User not found.'; end if;

  v_target_auth:=public.assurance_regent_browser_functional_authority(v_target);
  if v_auth<>'DEVELOPER' then
    if coalesce(v_target->>'companyId','')<>coalesce(v_actor->>'companyId','') then raise exception 'You may only manage users in your company.'; end if;
    if coalesce(v_target->>'role','')='Developer' or p_role='Developer' then raise exception 'Only Developers may assign or change Developer authority.'; end if;
    if v_auth='ADMINISTRATOR' and v_target_auth in ('CEO','HR_MANAGER','FINANCE_MANAGER','PROJECT_MANAGER','PROGRAMS_MANAGER','AUDITOR') then
      raise exception 'Administrators cannot override CEO, Auditor or senior departmental authority. CEO or Developer approval is required.';
    end if;
    if v_requested_auth like '%chief executive officer%' or v_requested_auth='ceo' then raise exception 'Only a Developer may assign CEO authority.'; end if;
    if v_auth='ADMINISTRATOR' and v_requested_auth in ('human resources manager','finance manager','project manager','programs manager','programs director','auditor / internal audit','auditor','internal audit','internal auditor') then
      raise exception 'Senior functional authority can only be assigned by the CEO or Developer.';
    end if;
    v_company:=coalesce(v_actor->>'companyId','');
  else
    if lower(p_user_id)='dvp' and p_role<>'Developer' then raise exception 'The permanent Developer account must remain Developer.'; end if;
    if p_role='Developer' then v_company:=''; end if;
    if p_role<>'Developer' then
      if v_company='' then raise exception 'Select a company before assigning Administrator or Employee authority.'; end if;
      if not exists(select 1 from jsonb_array_elements(coalesce(v_state#>'{auth,companies}','[]'::jsonb)) c where c->>'id'=v_company) then raise exception 'Select a valid company.'; end if;
    end if;
  end if;

  v_target:=v_target || jsonb_build_object(
    'role',p_role,'companyId',v_company,'position',trim(coalesce(p_position,'')),'department',trim(coalesce(p_department,'')),
    'supervisor',trim(coalesce(p_supervisor,'')),'supervisoryRole',trim(coalesce(p_supervisory_role,'')),
    'hiddenFromDirectory',(p_role='Developer'),'updatedAt',now(),'updatedBy',v_actor->>'id'
  );
  v_accounts:=jsonb_set(v_accounts,array[v_idx::text],v_target,false);
  v_state:=jsonb_set(v_state,'{auth,accounts}',v_accounts,true);
  update public.assurance_regent_state set state_value=v_state,updated_at=now() where state_key='browser-client-state';
  return v_target;
end $$;
revoke all on function public.assurance_regent_browser_admin_update_user(text,text,text,text,text,text,text,text) from public;
grant execute on function public.assurance_regent_browser_admin_update_user(text,text,text,text,text,text,text,text) to anon,authenticated;

create table if not exists public.assurance_regent_recovery_donor_rules (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  donor text not null default '',
  project_code text not null default '',
  rule_key text not null,
  numeric_value numeric,
  text_value text not null default '',
  effective_from date,
  effective_to date,
  active boolean not null default true,
  supersedes_id uuid,
  created_by text not null,
  created_at timestamptz not null default now(),
  constraint assurance_regent_recovery_rule_key_check check (rule_key in ('EVIDENCE_REQUIRED','MAX_HOURLY_COST','MAX_PERSONNEL_CHARGE','CURRENCY','ALLOW_ADMIN','CUSTOM'))
);

create table if not exists public.assurance_regent_recovery_evidence_links (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  reporting_month date not null,
  project_code text not null,
  employee_id text not null default '',
  document_id text not null,
  document_name text not null default '',
  evidence_type text not null default 'SUPPORTING_DOCUMENT',
  file_hash text not null default '',
  created_by text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists assurance_regent_recovery_evidence_unique_idx on public.assurance_regent_recovery_evidence_links(company_id,reporting_month,project_code,employee_id,document_id);

create table if not exists public.assurance_regent_recovery_passports (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  reporting_month date not null,
  project_code text not null,
  employee_id text not null default '',
  version integer not null,
  final_status text not null,
  recovery_gate smallint not null,
  raw_cost numeric not null default 0,
  recoverable_cost numeric not null default 0,
  amount_at_risk numeric not null default 0,
  currency text not null default 'USD',
  payload jsonb not null,
  payload_hash text not null,
  source_state_hash text not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  constraint assurance_regent_recovery_passport_status_check check (final_status in ('RECOVERABLE','BLOCKED')),
  constraint assurance_regent_recovery_passport_gate_check check (recovery_gate in (0,1)),
  unique(company_id,reporting_month,project_code,employee_id,version)
);

create table if not exists public.assurance_regent_recovery_passport_keys (
  id uuid primary key default gen_random_uuid(),
  passport_id uuid not null references public.assurance_regent_recovery_passports(id),
  key_name text not null,
  result text not null,
  reason text not null default '',
  created_at timestamptz not null default now(),
  constraint assurance_regent_recovery_key_name_check check (key_name in ('evidence','capacity','eligibility','budget','approval')),
  constraint assurance_regent_recovery_key_result_check check (result in ('PASS','FAIL','REVIEW')),
  unique(passport_id,key_name)
);

create table if not exists public.assurance_regent_recovery_approvals (
  id uuid primary key default gen_random_uuid(),
  passport_id uuid not null references public.assurance_regent_recovery_passports(id),
  stage text not null,
  decision text not null,
  actor_id text not null,
  actor_name text not null default '',
  authority text not null default '',
  note text not null default '',
  created_at timestamptz not null default now(),
  constraint assurance_regent_recovery_approval_stage_check check (stage in ('SUPERVISOR_ASSURANCE','FINANCE_ASSURANCE')),
  constraint assurance_regent_recovery_approval_decision_check check (decision in ('APPROVE','REJECT'))
);

create table if not exists public.assurance_regent_recovery_journal_batches (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  passport_id uuid not null references public.assurance_regent_recovery_passports(id),
  status text not null default 'DRAFT',
  posting_period date not null,
  currency text not null default 'USD',
  total_amount numeric not null default 0,
  debit_account text not null,
  credit_account text not null,
  description text not null default '',
  created_by text not null,
  created_at timestamptz not null default now(),
  approved_by text not null default '',
  approved_at timestamptz,
  exported_by text not null default '',
  exported_at timestamptz,
  constraint assurance_regent_recovery_journal_status_check check (status in ('DRAFT','APPROVED','EXPORTED','CANCELLED'))
);
create unique index if not exists assurance_regent_recovery_journal_active_passport_idx on public.assurance_regent_recovery_journal_batches(passport_id) where status<>'CANCELLED';

create table if not exists public.assurance_regent_recovery_journal_lines (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.assurance_regent_recovery_journal_batches(id),
  line_no integer not null,
  account_code text not null,
  debit numeric not null default 0,
  credit numeric not null default 0,
  project_code text not null default '',
  employee_id text not null default '',
  reference text not null default '',
  created_at timestamptz not null default now(),
  unique(batch_id,line_no)
);

create table if not exists public.assurance_regent_recovery_audit_events (
  id bigint generated always as identity primary key,
  company_id text not null,
  event_type text not null,
  ref_type text not null default '',
  ref_id text not null default '',
  action text not null,
  status text not null default 'OK',
  detail jsonb not null default '{}'::jsonb,
  actor_id text not null,
  authority text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists ar_recovery_passport_scope_idx on public.assurance_regent_recovery_passports(company_id,reporting_month desc,created_at desc);
create index if not exists ar_recovery_evidence_scope_idx on public.assurance_regent_recovery_evidence_links(company_id,reporting_month desc,project_code,employee_id);
create index if not exists ar_recovery_rules_scope_idx on public.assurance_regent_recovery_donor_rules(company_id,project_code,donor,created_at desc);
create index if not exists ar_recovery_journal_scope_idx on public.assurance_regent_recovery_journal_batches(company_id,posting_period desc,created_at desc);
create index if not exists ar_recovery_audit_scope_idx on public.assurance_regent_recovery_audit_events(company_id,created_at desc);

alter table public.assurance_regent_recovery_donor_rules enable row level security;
alter table public.assurance_regent_recovery_evidence_links enable row level security;
alter table public.assurance_regent_recovery_passports enable row level security;
alter table public.assurance_regent_recovery_passport_keys enable row level security;
alter table public.assurance_regent_recovery_approvals enable row level security;
alter table public.assurance_regent_recovery_journal_batches enable row level security;
alter table public.assurance_regent_recovery_journal_lines enable row level security;
alter table public.assurance_regent_recovery_audit_events enable row level security;

revoke all on public.assurance_regent_recovery_donor_rules from public,anon,authenticated;
revoke all on public.assurance_regent_recovery_evidence_links from public,anon,authenticated;
revoke all on public.assurance_regent_recovery_passports from public,anon,authenticated;
revoke all on public.assurance_regent_recovery_passport_keys from public,anon,authenticated;
revoke all on public.assurance_regent_recovery_approvals from public,anon,authenticated;
revoke all on public.assurance_regent_recovery_journal_batches from public,anon,authenticated;
revoke all on public.assurance_regent_recovery_journal_lines from public,anon,authenticated;
revoke all on public.assurance_regent_recovery_audit_events from public,anon,authenticated;

-- Immutable financial evidence: snapshots, key results and approval events are append-only.
create or replace function public.assurance_regent_recovery_immutable_guard()
returns trigger language plpgsql as $$
begin
  raise exception 'Recovery assurance evidence is immutable. Create a new version/reversal instead of changing historical records.';
end $$;

drop trigger if exists assurance_regent_recovery_passport_immutable on public.assurance_regent_recovery_passports;
create trigger assurance_regent_recovery_passport_immutable before update or delete on public.assurance_regent_recovery_passports for each row execute function public.assurance_regent_recovery_immutable_guard();
drop trigger if exists assurance_regent_recovery_keys_immutable on public.assurance_regent_recovery_passport_keys;
create trigger assurance_regent_recovery_keys_immutable before update or delete on public.assurance_regent_recovery_passport_keys for each row execute function public.assurance_regent_recovery_immutable_guard();
drop trigger if exists assurance_regent_recovery_approvals_immutable on public.assurance_regent_recovery_approvals;
create trigger assurance_regent_recovery_approvals_immutable before update or delete on public.assurance_regent_recovery_approvals for each row execute function public.assurance_regent_recovery_immutable_guard();
drop trigger if exists assurance_regent_recovery_evidence_immutable on public.assurance_regent_recovery_evidence_links;
create trigger assurance_regent_recovery_evidence_immutable before update or delete on public.assurance_regent_recovery_evidence_links for each row execute function public.assurance_regent_recovery_immutable_guard();

create or replace function public.assurance_regent_browser_recovery_company(p_actor jsonb,p_requested text default '')
returns text language plpgsql immutable as $$
declare v_auth text:=public.assurance_regent_browser_functional_authority(p_actor); v_company text;
begin
  if v_auth='DEVELOPER' then
    v_company:=trim(coalesce(p_requested,''));
    if v_company='' then return ''; end if;
    return v_company;
  end if;
  return coalesce(p_actor->>'companyId','');
end $$;
revoke all on function public.assurance_regent_browser_recovery_company(jsonb,text) from public,anon,authenticated;

create or replace function public.assurance_regent_browser_recovery_can_finance(p_actor jsonb)
returns boolean language sql immutable as $$
  select public.assurance_regent_browser_functional_authority(p_actor) in ('DEVELOPER','CEO','ADMINISTRATOR','FINANCE_MANAGER');
$$;
revoke all on function public.assurance_regent_browser_recovery_can_finance(jsonb) from public,anon,authenticated;

create or replace function public.assurance_regent_browser_recovery_can_read_finance(p_actor jsonb)
returns boolean language sql immutable as $$
  select public.assurance_regent_browser_functional_authority(p_actor) in ('DEVELOPER','CEO','ADMINISTRATOR','FINANCE_MANAGER','AUDITOR');
$$;
revoke all on function public.assurance_regent_browser_recovery_can_read_finance(jsonb) from public,anon,authenticated;

create or replace function public.assurance_regent_browser_recovery_audit_write(p_actor jsonb,p_company text,p_event text,p_ref_type text,p_ref_id text,p_action text,p_status text,p_detail jsonb)
returns void language plpgsql security definer set search_path=public,extensions as $$
begin
  insert into public.assurance_regent_recovery_audit_events(company_id,event_type,ref_type,ref_id,action,status,detail,actor_id,authority)
  values(p_company,upper(trim(coalesce(p_event,'RECOVERY'))),coalesce(p_ref_type,''),coalesce(p_ref_id,''),coalesce(p_action,''),coalesce(p_status,'OK'),coalesce(p_detail,'{}'::jsonb),coalesce(p_actor->>'id',''),public.assurance_regent_browser_functional_authority(p_actor));
end $$;
revoke all on function public.assurance_regent_browser_recovery_audit_write(jsonb,text,text,text,text,text,text,jsonb) from public,anon,authenticated;

create or replace function public.assurance_regent_browser_recovery_bundle(p_token text,p_month date default null,p_company_id text default '')
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_actor jsonb; v_auth text; v_company text; v_rules jsonb; v_evidence jsonb; v_passports jsonb; v_keys jsonb; v_approvals jsonb; v_journals jsonb; v_lines jsonb; v_audit jsonb;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token); v_auth:=public.assurance_regent_browser_functional_authority(v_actor); v_company:=public.assurance_regent_browser_recovery_company(v_actor,p_company_id);
  if not public.assurance_regent_browser_recovery_can_read_finance(v_actor) then raise exception 'Finance, Auditor, Administrator, CEO or Developer authority is required for Recovery Assurance.'; end if;
  if v_auth='DEVELOPER' and v_company='' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into v_rules from public.assurance_regent_recovery_donor_rules x where p_month is null or x.effective_from is null or x.effective_from<=p_month;
    select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into v_evidence from public.assurance_regent_recovery_evidence_links x where p_month is null or x.reporting_month=p_month;
    select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into v_passports from public.assurance_regent_recovery_passports x where p_month is null or x.reporting_month=p_month;
  else
    select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into v_rules from public.assurance_regent_recovery_donor_rules x where x.company_id=v_company and (p_month is null or x.effective_from is null or x.effective_from<=p_month);
    select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into v_evidence from public.assurance_regent_recovery_evidence_links x where x.company_id=v_company and (p_month is null or x.reporting_month=p_month);
    select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into v_passports from public.assurance_regent_recovery_passports x where x.company_id=v_company and (p_month is null or x.reporting_month=p_month);
  end if;
  select coalesce(jsonb_agg(to_jsonb(k) order by k.created_at),'[]'::jsonb) into v_keys from public.assurance_regent_recovery_passport_keys k where k.passport_id in (select (p->>'id')::uuid from jsonb_array_elements(v_passports) p);
  select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc),'[]'::jsonb) into v_approvals from public.assurance_regent_recovery_approvals a where a.passport_id in (select (p->>'id')::uuid from jsonb_array_elements(v_passports) p);
  select coalesce(jsonb_agg(to_jsonb(j) order by j.created_at desc),'[]'::jsonb) into v_journals from public.assurance_regent_recovery_journal_batches j where (v_auth='DEVELOPER' and v_company='') or j.company_id=v_company;
  select coalesce(jsonb_agg(to_jsonb(l) order by l.line_no),'[]'::jsonb) into v_lines from public.assurance_regent_recovery_journal_lines l where l.batch_id in (select (j->>'id')::uuid from jsonb_array_elements(v_journals) j);
  select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc),'[]'::jsonb) into v_audit from (select * from public.assurance_regent_recovery_audit_events e where ((v_auth='DEVELOPER' and v_company='') or e.company_id=v_company) order by e.created_at desc limit 250) a;
  return jsonb_build_object('schemaVersion','6.0.0','authority',v_auth,'companyId',v_company,'rules',coalesce(v_rules,'[]'::jsonb),'evidence',coalesce(v_evidence,'[]'::jsonb),'passports',coalesce(v_passports,'[]'::jsonb),'keys',coalesce(v_keys,'[]'::jsonb),'approvals',coalesce(v_approvals,'[]'::jsonb),'journals',coalesce(v_journals,'[]'::jsonb),'journalLines',coalesce(v_lines,'[]'::jsonb),'audit',coalesce(v_audit,'[]'::jsonb));
end $$;

create or replace function public.assurance_regent_browser_recovery_exception_bundle(p_token text,p_month date default null,p_company_id text default '')
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_actor jsonb; v_auth text; v_company text; v_state jsonb; v_rules jsonb; v_evidence jsonb;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token); v_auth:=public.assurance_regent_browser_functional_authority(v_actor);
  if v_auth not in ('DEVELOPER','CEO','ADMINISTRATOR','FINANCE_MANAGER','AUDITOR','PROJECT_MANAGER','PROGRAMS_MANAGER','HEAD_OF_DEPARTMENT','SUPERVISOR') then raise exception 'Management or audit authority is required for Recovery Exceptions.'; end if;
  v_company:=case when v_auth='DEVELOPER' then trim(coalesce(p_company_id,'')) else coalesce(v_actor->>'companyId','') end;
  if v_company='' then raise exception 'Select a company for Recovery Exceptions.'; end if;
  select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state';
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into v_rules
    from public.assurance_regent_recovery_donor_rules x
    where x.company_id=v_company and (p_month is null or x.effective_from is null or x.effective_from<=p_month);
  if v_auth in ('DEVELOPER','CEO','ADMINISTRATOR','FINANCE_MANAGER','AUDITOR') then
    select coalesce(jsonb_agg(jsonb_build_object('reporting_month',x.reporting_month,'project_code',x.project_code,'employee_id',x.employee_id,'evidence_type',x.evidence_type) order by x.created_at desc),'[]'::jsonb) into v_evidence
      from public.assurance_regent_recovery_evidence_links x
      where x.company_id=v_company and (p_month is null or x.reporting_month=p_month);
  else
    select coalesce(jsonb_agg(jsonb_build_object('reporting_month',x.reporting_month,'project_code',x.project_code,'employee_id',x.employee_id,'evidence_type',x.evidence_type) order by x.created_at desc),'[]'::jsonb) into v_evidence
      from public.assurance_regent_recovery_evidence_links x
      where x.company_id=v_company and (p_month is null or x.reporting_month=p_month) and (
        trim(coalesce(x.employee_id,''))='' or exists(
          select 1 from jsonb_array_elements(coalesce(v_state#>'{live,employees}','[]'::jsonb)) e(value)
          where lower(trim(coalesce(e.value->>'employeeId',e.value->>'employee_id','')))=lower(trim(x.employee_id))
            and public.assurance_regent_browser_manager_scope_allows(v_actor,e.value)
        )
      );
  end if;
  return jsonb_build_object('schemaVersion','6.0.0','authority',v_auth,'companyId',v_company,'rules',coalesce(v_rules,'[]'::jsonb),'evidence',coalesce(v_evidence,'[]'::jsonb));
end $$;
revoke all on function public.assurance_regent_browser_recovery_exception_bundle(text,date,text) from public;
grant execute on function public.assurance_regent_browser_recovery_exception_bundle(text,date,text) to anon,authenticated;

create or replace function public.assurance_regent_browser_recovery_rule_create(
  p_token text,p_company_id text,p_donor text,p_project_code text,p_rule_key text,p_numeric_value numeric default null,p_text_value text default '',p_effective_from date default null,p_effective_to date default null
) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_actor jsonb; v_company text; v_row public.assurance_regent_recovery_donor_rules;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  if not public.assurance_regent_browser_recovery_can_finance(v_actor) then raise exception 'Finance, Administrator, CEO or Developer authority is required to configure donor rules.'; end if;
  v_company:=public.assurance_regent_browser_recovery_company(v_actor,p_company_id); if v_company='' then raise exception 'Select a company.'; end if;
  if upper(trim(p_rule_key)) not in ('EVIDENCE_REQUIRED','MAX_HOURLY_COST','MAX_PERSONNEL_CHARGE','CURRENCY','ALLOW_ADMIN','CUSTOM') then raise exception 'Invalid donor-rule type.'; end if;
  if p_effective_from is not null and p_effective_to is not null and p_effective_to<p_effective_from then raise exception 'Donor-rule effective-to date cannot be before effective-from date.'; end if;
  if upper(trim(p_rule_key))='EVIDENCE_REQUIRED' and (p_numeric_value is null or p_numeric_value<0 or p_numeric_value<>trunc(p_numeric_value)) then raise exception 'Evidence-required rule needs a non-negative whole-number value.'; end if;
  if upper(trim(p_rule_key)) in ('MAX_HOURLY_COST','MAX_PERSONNEL_CHARGE') and (p_numeric_value is null or p_numeric_value<=0) then raise exception 'Cost ceiling rules require a positive numeric value.'; end if;
  if upper(trim(p_rule_key))='CURRENCY' and length(upper(trim(coalesce(p_text_value,''))))<>3 then raise exception 'Currency rule requires a three-letter currency code.'; end if;
  if upper(trim(p_rule_key))='ALLOW_ADMIN' and lower(trim(coalesce(p_text_value,''))) not in ('yes','no','true','false','1','0','allowed','disallowed') then raise exception 'Administration rule must state yes/no, true/false, 1/0, allowed/disallowed.'; end if;
  if upper(trim(p_rule_key))='CUSTOM' and trim(coalesce(p_text_value,''))='' then raise exception 'Custom donor-rule notes cannot be empty.'; end if;
  insert into public.assurance_regent_recovery_donor_rules(company_id,donor,project_code,rule_key,numeric_value,text_value,effective_from,effective_to,created_by)
  values(v_company,trim(coalesce(p_donor,'')),upper(trim(coalesce(p_project_code,''))),upper(trim(p_rule_key)),p_numeric_value,trim(coalesce(p_text_value,'')),p_effective_from,p_effective_to,v_actor->>'id') returning * into v_row;
  perform public.assurance_regent_browser_recovery_audit_write(v_actor,v_company,'DONOR_RULE','DONOR_RULE',v_row.id::text,'CREATE','OK',to_jsonb(v_row));
  return to_jsonb(v_row);
end $$;

create or replace function public.assurance_regent_browser_recovery_evidence_link(
  p_token text,p_company_id text,p_reporting_month date,p_project_code text,p_employee_id text,p_document_id text,p_document_name text,p_evidence_type text default 'SUPPORTING_DOCUMENT',p_file_hash text default ''
) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_actor jsonb; v_company text; v_auth text; v_emp jsonb; v_state jsonb; v_doc jsonb:='{}'::jsonb; v_hash text:=''; v_row public.assurance_regent_recovery_evidence_links;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token); v_auth:=public.assurance_regent_browser_functional_authority(v_actor); v_company:=public.assurance_regent_browser_recovery_company(v_actor,p_company_id);
  if v_company='' then raise exception 'A company is required.'; end if;
  if not public.assurance_regent_browser_recovery_can_finance(v_actor) then
    v_emp:=public.assurance_regent_browser_employee_for_actor(v_actor);
    if lower(trim(coalesce(p_employee_id,'')))<>lower(trim(coalesce(v_emp->>'employeeId',v_emp->>'employee_id',''))) then raise exception 'You may only link evidence to your own recovery record.'; end if;
  end if;
  if trim(coalesce(p_document_id,''))='' then raise exception 'Select a stored Assurance Regent document.'; end if;
  select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state';
  select d.value into v_doc from jsonb_array_elements(coalesce(v_state#>'{control,documents}','[]'::jsonb)) d(value) where trim(coalesce(d.value->>'id',''))=trim(p_document_id) limit 1;
  if coalesce(v_doc,'{}'::jsonb)='{}'::jsonb then raise exception 'The selected supporting document is not stored in Assurance Regent.'; end if;
  if trim(coalesce(v_doc->>'companyId',v_doc->>'company_id',''))<>'' and trim(coalesce(v_doc->>'companyId',v_doc->>'company_id',''))<>v_company then raise exception 'Cross-company supporting evidence is not permitted.'; end if;
  if upper(trim(coalesce(v_doc->>'status',''))) not in ('APPROVED','PENDING_REVIEW') then raise exception 'Only an approved or pending-review stored document can be linked as recovery evidence.'; end if;
  if exists(select 1 from public.assurance_regent_recovery_evidence_links where company_id=v_company and reporting_month=p_reporting_month and project_code=upper(trim(p_project_code)) and employee_id=trim(coalesce(p_employee_id,'')) and document_id=trim(p_document_id)) then raise exception 'This document is already linked to the selected recovery record.'; end if;
  v_hash:=case when coalesce(v_doc->>'data','')<>'' then encode(digest(convert_to(v_doc->>'data','UTF8'),'sha256'),'hex') else trim(coalesce(p_file_hash,'')) end;
  insert into public.assurance_regent_recovery_evidence_links(company_id,reporting_month,project_code,employee_id,document_id,document_name,evidence_type,file_hash,created_by)
  values(v_company,p_reporting_month,upper(trim(p_project_code)),trim(coalesce(p_employee_id,'')),trim(p_document_id),coalesce(nullif(trim(v_doc->>'name'),''),trim(coalesce(p_document_name,''))),upper(trim(coalesce(p_evidence_type,'SUPPORTING_DOCUMENT'))),v_hash,v_actor->>'id') returning * into v_row;
  perform public.assurance_regent_browser_recovery_audit_write(v_actor,v_company,'EVIDENCE','EVIDENCE',v_row.id::text,'LINK','OK',to_jsonb(v_row));
  return to_jsonb(v_row);
end $$;

create or replace function public.assurance_regent_browser_recovery_passport_snapshot(
  p_token text,p_company_id text,p_reporting_month date,p_project_code text,p_employee_id text,p_currency text,p_payload jsonb
) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_actor jsonb; v_company text; v_state jsonb; v_keys jsonb; v_gate int; v_status text; v_raw numeric; v_payload_raw numeric; v_hours numeric; v_hourly numeric; v_rec numeric; v_risk numeric; v_version int; v_hash text; v_state_hash text; v_row public.assurance_regent_recovery_passports; v_key text; v_result text; v_reason text;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  if not public.assurance_regent_browser_recovery_can_finance(v_actor) then raise exception 'Finance, Administrator, CEO or Developer authority is required to snapshot a Recovery Passport.'; end if;
  v_company:=public.assurance_regent_browser_recovery_company(v_actor,p_company_id); if v_company='' then raise exception 'Select a company.'; end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Recovery Passport payload is required.'; end if;
  if coalesce(p_payload->>'reportingMonth',p_payload->>'reporting_month','')<>p_reporting_month::text then raise exception 'Recovery Passport reporting month does not match the requested snapshot period.'; end if;
  if upper(trim(coalesce(p_payload->>'projectCode',p_payload->>'project_code','')))<>upper(trim(coalesce(p_project_code,''))) then raise exception 'Recovery Passport project does not match the requested snapshot project.'; end if;
  if lower(trim(coalesce(p_payload->>'employeeId',p_payload->>'employee_id','')))<>lower(trim(coalesce(p_employee_id,''))) then raise exception 'Recovery Passport employee does not match the requested snapshot employee.'; end if;
  v_keys:=coalesce(p_payload->'keys','{}'::jsonb);
  if not (v_keys ?& array['evidence','capacity','eligibility','budget','approval']) then raise exception 'Recovery Passport must contain all five control keys.'; end if;
  v_gate:=case when (v_keys->>'evidence')='PASS' and (v_keys->>'capacity')='PASS' and (v_keys->>'eligibility')='PASS' and (v_keys->>'budget')='PASS' and (v_keys->>'approval')='PASS' then 1 else 0 end;
  v_status:=case when v_gate=1 then 'RECOVERABLE' else 'BLOCKED' end;
  v_hours:=greatest(0,coalesce((p_payload->>'approvedProjectHours')::numeric,(p_payload->>'approved_project_hours')::numeric,0));
  v_hourly:=greatest(0,coalesce((p_payload->>'hourlyCost')::numeric,(p_payload->>'hourly_cost')::numeric,0));
  v_raw:=round(v_hours*v_hourly,2);
  v_payload_raw:=greatest(0,coalesce((p_payload->>'rawCost')::numeric,(p_payload->>'raw_cost')::numeric,0));
  if abs(v_payload_raw-v_raw)>0.02 then raise exception 'Recovery Passport raw cost does not reconcile to approved hours x employment hourly cost.'; end if;
  v_rec:=case when v_gate=1 then v_raw else 0 end;
  v_risk:=greatest(0,v_raw-v_rec);
  select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state';
  v_state_hash:=encode(digest(convert_to(coalesce(v_state->'live','{}'::jsonb)::text,'UTF8'),'sha256'),'hex');
  v_hash:=encode(digest(convert_to(p_payload::text,'UTF8'),'sha256'),'hex');
  select coalesce(max(version),0)+1 into v_version from public.assurance_regent_recovery_passports where company_id=v_company and reporting_month=p_reporting_month and project_code=upper(trim(p_project_code)) and employee_id=trim(coalesce(p_employee_id,''));
  insert into public.assurance_regent_recovery_passports(company_id,reporting_month,project_code,employee_id,version,final_status,recovery_gate,raw_cost,recoverable_cost,amount_at_risk,currency,payload,payload_hash,source_state_hash,created_by)
  values(v_company,p_reporting_month,upper(trim(p_project_code)),trim(coalesce(p_employee_id,'')),v_version,v_status,v_gate,v_raw,v_rec,v_risk,upper(trim(coalesce(p_currency,'USD'))),p_payload,v_hash,v_state_hash,v_actor->>'id') returning * into v_row;
  foreach v_key in array array['evidence','capacity','eligibility','budget','approval'] loop
    v_result:=coalesce(v_keys->>v_key,'FAIL'); v_reason:=coalesce(p_payload#>>array['keyReasons',v_key],'');
    insert into public.assurance_regent_recovery_passport_keys(passport_id,key_name,result,reason) values(v_row.id,v_key,case when v_result in ('PASS','FAIL','REVIEW') then v_result else 'FAIL' end,v_reason);
  end loop;
  perform public.assurance_regent_browser_recovery_audit_write(v_actor,v_company,'PASSPORT','PASSPORT',v_row.id::text,'SNAPSHOT','OK',jsonb_build_object('version',v_version,'status',v_status,'payloadHash',v_hash,'sourceStateHash',v_state_hash));
  return to_jsonb(v_row);
end $$;

create or replace function public.assurance_regent_browser_recovery_approve(
  p_token text,p_passport_id uuid,p_stage text,p_decision text,p_note text default ''
) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_actor jsonb; v_auth text; v_pass public.assurance_regent_recovery_passports; v_stage text:=upper(trim(p_stage)); v_decision text:=upper(trim(p_decision)); v_row public.assurance_regent_recovery_approvals; v_state jsonb; v_employee jsonb:='{}'::jsonb;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token); v_auth:=public.assurance_regent_browser_functional_authority(v_actor);
  select * into v_pass from public.assurance_regent_recovery_passports where id=p_passport_id; if v_pass.id is null then raise exception 'Recovery Passport not found.'; end if;
  if v_auth<>'DEVELOPER' and v_pass.company_id<>coalesce(v_actor->>'companyId','') then raise exception 'Cross-company Recovery Passport access is not permitted.'; end if;
  if v_stage='FINANCE_ASSURANCE' and v_auth not in ('DEVELOPER','CEO','ADMINISTRATOR','FINANCE_MANAGER') then raise exception 'Finance assurance authority is required.'; end if;
  if v_stage='SUPERVISOR_ASSURANCE' and v_auth not in ('DEVELOPER','CEO','ADMINISTRATOR','PROJECT_MANAGER','PROGRAMS_MANAGER','HEAD_OF_DEPARTMENT','SUPERVISOR','FINANCE_MANAGER') then raise exception 'Supervisor or management assurance authority is required.'; end if;
  if v_stage not in ('SUPERVISOR_ASSURANCE','FINANCE_ASSURANCE') or v_decision not in ('APPROVE','REJECT') then raise exception 'Invalid recovery approval stage or decision.'; end if;
  if v_decision='REJECT' and trim(coalesce(p_note,''))='' then raise exception 'A rejection reason is required.'; end if;
  if v_stage='SUPERVISOR_ASSURANCE' and v_auth in ('PROJECT_MANAGER','PROGRAMS_MANAGER','HEAD_OF_DEPARTMENT','SUPERVISOR') then
    select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state';
    select e.value into v_employee from jsonb_array_elements(coalesce(v_state#>'{live,employees}','[]'::jsonb)) e(value)
      where lower(trim(coalesce(e.value->>'employeeId',e.value->>'employee_id','')))=lower(trim(v_pass.employee_id)) limit 1;
    if coalesce(v_employee,'{}'::jsonb)='{}'::jsonb or not public.assurance_regent_browser_manager_scope_allows(v_actor,v_employee) then raise exception 'This Recovery Passport is outside your managed employee scope.'; end if;
  end if;
  insert into public.assurance_regent_recovery_approvals(passport_id,stage,decision,actor_id,actor_name,authority,note)
  values(v_pass.id,v_stage,v_decision,v_actor->>'id',coalesce(v_actor->>'name',v_actor->>'id',''),v_auth,trim(coalesce(p_note,''))) returning * into v_row;
  perform public.assurance_regent_browser_recovery_audit_write(v_actor,v_pass.company_id,'APPROVAL','PASSPORT',v_pass.id::text,v_stage||':'||v_decision,'OK',to_jsonb(v_row));
  return to_jsonb(v_row);
end $$;

create or replace function public.assurance_regent_browser_recovery_journal_create(
  p_token text,p_passport_id uuid,p_debit_account text,p_credit_account text,p_description text default ''
) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_actor jsonb; v_pass public.assurance_regent_recovery_passports; v_row public.assurance_regent_recovery_journal_batches; v_fin text;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token); if not public.assurance_regent_browser_recovery_can_finance(v_actor) then raise exception 'Finance, Administrator, CEO or Developer authority is required to create a journal draft.'; end if;
  select * into v_pass from public.assurance_regent_recovery_passports where id=p_passport_id; if v_pass.id is null then raise exception 'Recovery Passport not found.'; end if;
  if public.assurance_regent_browser_functional_authority(v_actor)<>'DEVELOPER' and v_pass.company_id<>coalesce(v_actor->>'companyId','') then raise exception 'Cross-company journal creation is not permitted.'; end if;
  if v_pass.final_status<>'RECOVERABLE' or v_pass.recovery_gate<>1 or v_pass.recoverable_cost<=0 then raise exception 'Only a RECOVERABLE immutable Passport can create a journal draft.'; end if;
  select decision into v_fin from public.assurance_regent_recovery_approvals where passport_id=v_pass.id and stage='FINANCE_ASSURANCE' order by created_at desc limit 1;
  if coalesce(v_fin,'')<>'APPROVE' then raise exception 'Finance assurance approval is required before a journal draft can be created.'; end if;
  if exists(select 1 from public.assurance_regent_recovery_journal_batches where passport_id=v_pass.id and status<>'CANCELLED') then raise exception 'An active journal already exists for this Recovery Passport.'; end if;
  if trim(coalesce(p_debit_account,''))='' or trim(coalesce(p_credit_account,''))='' then raise exception 'Debit and credit account codes are required.'; end if;
  if trim(p_debit_account)=trim(p_credit_account) then raise exception 'Debit and credit accounts must be different.'; end if;
  insert into public.assurance_regent_recovery_journal_batches(company_id,passport_id,posting_period,currency,total_amount,debit_account,credit_account,description,created_by)
  values(v_pass.company_id,v_pass.id,v_pass.reporting_month,v_pass.currency,v_pass.recoverable_cost,trim(p_debit_account),trim(p_credit_account),coalesce(nullif(trim(p_description),''),'Recovery Passport '||v_pass.id::text),v_actor->>'id') returning * into v_row;
  insert into public.assurance_regent_recovery_journal_lines(batch_id,line_no,account_code,debit,credit,project_code,employee_id,reference) values
    (v_row.id,1,v_row.debit_account,v_row.total_amount,0,v_pass.project_code,v_pass.employee_id,'Recovery Passport '||v_pass.id::text),
    (v_row.id,2,v_row.credit_account,0,v_row.total_amount,v_pass.project_code,v_pass.employee_id,'Recovery Passport '||v_pass.id::text);
  perform public.assurance_regent_browser_recovery_audit_write(v_actor,v_pass.company_id,'JOURNAL','JOURNAL',v_row.id::text,'CREATE_DRAFT','OK',to_jsonb(v_row));
  return to_jsonb(v_row);
end $$;

create or replace function public.assurance_regent_browser_recovery_journal_status(
  p_token text,p_batch_id uuid,p_action text
) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_actor jsonb; v_auth text; v_row public.assurance_regent_recovery_journal_batches; v_action text:=upper(trim(p_action));
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token); v_auth:=public.assurance_regent_browser_functional_authority(v_actor); if not public.assurance_regent_browser_recovery_can_finance(v_actor) then raise exception 'Finance, Administrator, CEO or Developer authority is required.'; end if;
  select * into v_row from public.assurance_regent_recovery_journal_batches where id=p_batch_id for update; if v_row.id is null then raise exception 'Journal batch not found.'; end if;
  if v_auth<>'DEVELOPER' and v_row.company_id<>coalesce(v_actor->>'companyId','') then raise exception 'Cross-company journal access is not permitted.'; end if;
  if v_action='APPROVE' then
    if v_row.status<>'DRAFT' then raise exception 'Only a DRAFT journal can be approved.'; end if;
    update public.assurance_regent_recovery_journal_batches set status='APPROVED',approved_by=v_actor->>'id',approved_at=now() where id=v_row.id returning * into v_row;
  elsif v_action='EXPORTED' then
    if v_row.status not in ('APPROVED','EXPORTED') then raise exception 'Approve the journal before marking it exported.'; end if;
    update public.assurance_regent_recovery_journal_batches set status='EXPORTED',exported_by=v_actor->>'id',exported_at=now() where id=v_row.id returning * into v_row;
  elsif v_action='CANCEL' then
    if v_row.status='EXPORTED' then raise exception 'An exported journal cannot be cancelled. Use a controlled reversal.'; end if;
    update public.assurance_regent_recovery_journal_batches set status='CANCELLED' where id=v_row.id returning * into v_row;
  else raise exception 'Invalid journal action.';
  end if;
  perform public.assurance_regent_browser_recovery_audit_write(v_actor,v_row.company_id,'JOURNAL','JOURNAL',v_row.id::text,v_action,'OK',to_jsonb(v_row));
  return to_jsonb(v_row);
end $$;

create or replace function public.assurance_regent_browser_recovery_audit_append(p_token text,p_company_id text,p_event_type text,p_ref_type text,p_ref_id text,p_action text,p_status text,p_detail jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_actor jsonb; v_company text;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token); v_company:=public.assurance_regent_browser_recovery_company(v_actor,p_company_id); if v_company='' then raise exception 'A company is required.'; end if;
  if public.assurance_regent_browser_functional_authority(v_actor) not in ('DEVELOPER','CEO','ADMINISTRATOR','FINANCE_MANAGER','AUDITOR') then raise exception 'Finance/audit authority is required.'; end if;
  perform public.assurance_regent_browser_recovery_audit_write(v_actor,v_company,p_event_type,p_ref_type,p_ref_id,p_action,p_status,p_detail);
  return jsonb_build_object('ok',true);
end $$;

-- Extend Jivan context with a compact Recovery Assurance summary for finance-capable users.
create or replace function public.assurance_regent_browser_agent_context(p_token text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_actor jsonb; v_state jsonb; v_leave jsonb; v_auth text; v_company text; v_recovery jsonb:='{}'::jsonb;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token); v_auth:=public.assurance_regent_browser_functional_authority(v_actor); v_company:=coalesce(v_actor->>'companyId','');
  update public.assurance_regent_auth_sessions set updated_at=now(),expires_at=now()+interval '12 hours' where token_hash=encode(digest(convert_to(p_token,'UTF8'),'sha256'),'hex');
  select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state';
  begin v_leave:=public.assurance_regent_browser_leave_bundle(p_token); exception when others then v_leave:='{}'::jsonb; end;
  if v_auth in ('DEVELOPER','CEO','ADMINISTRATOR','FINANCE_MANAGER','AUDITOR') then
    select jsonb_build_object(
      'passportCount',count(*),
      'recoverableCount',count(*) filter(where final_status='RECOVERABLE'),
      'blockedCount',count(*) filter(where final_status='BLOCKED'),
      'amountAtRisk',coalesce(sum(amount_at_risk),0),
      'recoverableCost',coalesce(sum(recoverable_cost),0)
    ) into v_recovery from public.assurance_regent_recovery_passports p where v_auth='DEVELOPER' or p.company_id=v_company;
  end if;
  return jsonb_build_object('actor',v_actor,'authority',v_auth,'state',coalesce(v_state,'{}'::jsonb)||jsonb_build_object('leaveModule',v_leave,'recoveryAssurance',coalesce(v_recovery,'{}'::jsonb)),'schemaVersion','6.0.0');
end $$;

revoke all on function public.assurance_regent_browser_recovery_bundle(text,date,text) from public;
revoke all on function public.assurance_regent_browser_recovery_rule_create(text,text,text,text,text,numeric,text,date,date) from public;
revoke all on function public.assurance_regent_browser_recovery_evidence_link(text,text,date,text,text,text,text,text,text) from public;
revoke all on function public.assurance_regent_browser_recovery_passport_snapshot(text,text,date,text,text,text,jsonb) from public;
revoke all on function public.assurance_regent_browser_recovery_approve(text,uuid,text,text,text) from public;
revoke all on function public.assurance_regent_browser_recovery_journal_create(text,uuid,text,text,text) from public;
revoke all on function public.assurance_regent_browser_recovery_journal_status(text,uuid,text) from public;
revoke all on function public.assurance_regent_browser_recovery_audit_append(text,text,text,text,text,text,text,jsonb) from public;
revoke all on function public.assurance_regent_browser_agent_context(text) from public;

grant execute on function public.assurance_regent_browser_recovery_bundle(text,date,text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_recovery_rule_create(text,text,text,text,text,numeric,text,date,date) to anon,authenticated;
grant execute on function public.assurance_regent_browser_recovery_evidence_link(text,text,date,text,text,text,text,text,text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_recovery_passport_snapshot(text,text,date,text,text,text,jsonb) to anon,authenticated;
grant execute on function public.assurance_regent_browser_recovery_approve(text,uuid,text,text,text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_recovery_journal_create(text,uuid,text,text,text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_recovery_journal_status(text,uuid,text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_recovery_audit_append(text,text,text,text,text,text,text,jsonb) to anon,authenticated;
grant execute on function public.assurance_regent_browser_agent_context(text) to anon,authenticated;

-- END RECOVERY_ASSURANCE_V6_0_0.sql


-- ============================================================================
-- BEGIN SCALABILITY_RESILIENCE_V6_1_0.sql
-- ============================================================================
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

-- END SCALABILITY_RESILIENCE_V6_1_0.sql


-- ============================================================================
-- BEGIN JIVAN_STUDIO_V6_2_0.sql
-- ============================================================================
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

-- END JIVAN_STUDIO_V6_2_0.sql


-- ============================================================================
-- BEGIN JIVAN_VOICE_ACCESS_V6_3_9.sql
-- ============================================================================
-- Assurance Regent v6.3.9 — Jivan voice-access enrollment and verification
-- Run in Supabase SQL Editor after the v6.3.8 database setup.
-- Voice biometrics are private security data. Tables and stored samples are never granted to browser roles.

create extension if not exists pgcrypto;

create table if not exists public.assurance_regent_voice_profiles (
  user_id text primary key references public.assurance_regent_browser_credentials(user_id) on delete cascade,
  template jsonb not null default '{}'::jsonb,
  sample_refs jsonb not null default '[]'::jsonb,
  sample_count integer not null default 0,
  phrase_version integer not null default 1,
  active boolean not null default true,
  enrolled_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_verified_at timestamptz,
  failed_attempts integer not null default 0
);

create table if not exists public.assurance_regent_voice_challenges (
  id uuid primary key default gen_random_uuid(),
  phrase text not null,
  requested_user text not null default '',
  ip_hash text not null default '',
  expires_at timestamptz not null,
  used_at timestamptz,
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists assurance_regent_voice_challenges_expiry_idx
  on public.assurance_regent_voice_challenges(expires_at desc);
create index if not exists assurance_regent_voice_challenges_ip_idx
  on public.assurance_regent_voice_challenges(ip_hash, created_at desc);

create table if not exists public.assurance_regent_voice_access_audit (
  id bigserial primary key,
  event_type text not null,
  user_id text not null default '',
  success boolean not null default false,
  score numeric,
  ip_hash text not null default '',
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists assurance_regent_voice_access_audit_ip_idx
  on public.assurance_regent_voice_access_audit(ip_hash, created_at desc);
create index if not exists assurance_regent_voice_access_audit_user_idx
  on public.assurance_regent_voice_access_audit(user_id, created_at desc);

alter table public.assurance_regent_voice_profiles enable row level security;
alter table public.assurance_regent_voice_challenges enable row level security;
alter table public.assurance_regent_voice_access_audit enable row level security;

revoke all on table public.assurance_regent_voice_profiles from public, anon, authenticated;
revoke all on table public.assurance_regent_voice_challenges from public, anon, authenticated;
revoke all on table public.assurance_regent_voice_access_audit from public, anon, authenticated;
revoke all on sequence public.assurance_regent_voice_access_audit_id_seq from public, anon, authenticated;

-- Private bucket for enrollment recordings. Supabase service-role Edge Functions bypass Storage RLS.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('assurance-regent-voiceprints','assurance-regent-voiceprints',false,2097152,array['audio/wav'])
on conflict(id) do update set public=false,file_size_limit=2097152,allowed_mime_types=array['audio/wav'];

-- Password proof for voice enrollment. Only the service-role Edge Function may call it.
create or replace function public.assurance_regent_browser_voice_enrollment_authorize(p_user_id text,p_password text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_cred record;
begin
  if trim(coalesce(p_user_id,''))='' or coalesce(p_password,'')='' then raise exception 'Username and password are required for voice enrollment.'; end if;
  select * into v_cred from public.assurance_regent_browser_credentials
  where lower(user_id)=lower(trim(p_user_id)) or lower(username)=lower(trim(p_user_id)) or (email<>'' and lower(email)=lower(trim(p_user_id))) limit 1;
  if v_cred.user_id is null or crypt(p_password,v_cred.password_hash)<>v_cred.password_hash then raise exception 'Voice enrollment authorization failed.'; end if;
  if coalesce(v_cred.approval_status,'APPROVED') in ('REJECTED','SUSPENDED') or not coalesce(v_cred.active,true) and coalesce(v_cred.approval_status,'APPROVED')<>'PENDING' then
    raise exception 'This account is not eligible for voice enrollment.';
  end if;
  return jsonb_build_object('ok',true,'user_id',v_cred.user_id,'approval_status',coalesce(v_cred.approval_status,'APPROVED'));
end $$;

revoke all on function public.assurance_regent_browser_voice_enrollment_authorize(text,text) from public,anon,authenticated;
grant execute on function public.assurance_regent_browser_voice_enrollment_authorize(text,text) to service_role;

-- Browser health extension. Existing setup remains valid; this is an additive readiness check.
create or replace function public.assurance_regent_browser_voice_access_health()
returns jsonb language sql security definer set search_path=public as $$
  select jsonb_build_object(
    'ok',true,
    'voiceProfilesReady',to_regclass('public.assurance_regent_voice_profiles') is not null,
    'voiceChallengesReady',to_regclass('public.assurance_regent_voice_challenges') is not null,
    'voiceAuditReady',to_regclass('public.assurance_regent_voice_access_audit') is not null,
    'voiceBucketReady',exists(select 1 from storage.buckets where id='assurance-regent-voiceprints')
  );
$$;
revoke all on function public.assurance_regent_browser_voice_access_health() from public;
grant execute on function public.assurance_regent_browser_voice_access_health() to anon,authenticated;

-- Remove expired one-time challenges opportunistically when the migration is run.
delete from public.assurance_regent_voice_challenges where expires_at < now() - interval '1 day';

-- END JIVAN_VOICE_ACCESS_V6_3_9.sql

-- ============================================================================
-- FINAL v6.3.9 HEALTH CONTRACT
-- ============================================================================
create or replace function public.assurance_regent_browser_health()
returns jsonb language sql security definer set search_path=public as $$
  select jsonb_build_object(
    'ok', true,
    'schemaVersion', '6.3.9',
    'developerReady', exists(
      select 1 from public.assurance_regent_browser_credentials
      where user_id='Dvp' and active=true and approval_status='APPROVED'
    ),
    'stateReady', exists(
      select 1 from public.assurance_regent_state
      where state_key='browser-client-state'
    ),
    'governanceReady', exists(
      select 1 from information_schema.columns
      where table_schema='public'
        and table_name='assurance_regent_browser_credentials'
        and column_name='approval_status'
    ),
    'recoveryReady', to_regclass('public.assurance_regent_recovery_passports') is not null,
    'scalabilityReady', to_regclass('public.assurance_regent_system_incidents') is not null,
    'trafficManagementReady', to_regclass('public.assurance_regent_rate_limit_buckets') is not null,
    'studioReady', exists(
      select 1 from public.assurance_regent_jivan_studio_versions
      where status='ACTIVE'
    ),
    'voiceReady',
      to_regclass('public.assurance_regent_voice_profiles') is not null
      and to_regclass('public.assurance_regent_voice_challenges') is not null
      and to_regprocedure('public.assurance_regent_browser_voice_access_health()') is not null,
    'updatedAt', coalesce(
      (select updated_at from public.assurance_regent_state where state_key='browser-client-state'),
      now()
    )
  );
$$;

revoke all on function public.assurance_regent_browser_health() from public;
grant execute on function public.assurance_regent_browser_health() to anon,authenticated;
notify pgrst, 'reload schema';

-- Immediate result: this row must show ok/developerReady/stateReady/governanceReady/
-- scalabilityReady/studioReady = true for the sign-in gate to open.
select public.assurance_regent_browser_health() as browser_health_after_hotfix;
