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

-- Developer-only company-registration country correction/update.
create or replace function public.assurance_regent_browser_admin_company_registration(
  p_token text,p_company_id text,p_country text,p_country_code text default ''
)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_actor jsonb; v_state jsonb; v_companies jsonb; v_company jsonb; v_idx int; v_history jsonb; v_old_country text; v_old_code text;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  if public.assurance_regent_browser_functional_authority(v_actor)<>'DEVELOPER' then raise exception 'Developer permission is required.'; end if;
  if trim(coalesce(p_country,''))='' or upper(trim(coalesce(p_country_code,''))) !~ '^[A-Z]{2}$' then raise exception 'A valid registered country is required.'; end if;
  select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state' for update;
  v_companies:=coalesce(v_state#>'{auth,companies}','[]'::jsonb);
  select value,ordinality-1 into v_company,v_idx from jsonb_array_elements(v_companies) with ordinality t(value,ordinality) where value->>'id'=p_company_id limit 1;
  if v_company is null then raise exception 'Company not found.'; end if;
  v_old_country:=coalesce(v_company->>'registeredCountry','');
  v_old_code:=upper(coalesce(v_company->>'registeredCountryCode',''));
  if lower(trim(v_old_country))<>lower(trim(p_country)) or v_old_code<>upper(trim(p_country_code)) then
    v_history:=coalesce(v_company->'registrationHistory','[]'::jsonb)||jsonb_build_array(jsonb_build_object(
      'changedAt',now(),'changedBy',v_actor->>'id','source','developer-country-editor-v6.3.129',
      'fromCountry',v_old_country,'fromCountryCode',v_old_code,
      'toCountry',trim(p_country),'toCountryCode',upper(trim(p_country_code))
    ));
    v_company:=v_company||jsonb_build_object('registrationHistory',v_history);
  end if;
  v_company:=v_company||jsonb_build_object(
    'registeredCountry',trim(p_country),'registeredCountryCode',upper(trim(p_country_code)),
    'country',trim(p_country),'countryCode',upper(trim(p_country_code)),
    'registrationUpdatedAt',now(),'registrationUpdatedBy',v_actor->>'id'
  );
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
