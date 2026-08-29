-- Assurance Regent v6.3.90
-- Unify Budget Personnel Directory with operational employees while excluding only platform Developer identities.

create or replace function public.assurance_regent_browser_budget_personnel_directory(p_company_id text)
returns jsonb
language sql
stable
security definer
set search_path to 'public','extensions'
as $$
  with state_row as (
    select state_value
    from public.assurance_regent_state
    where state_key='browser-client-state'
    limit 1
  ),
  developer_principals as (
    select
      lower(trim(coalesce(a->>'id',''))) as principal_id,
      lower(trim(coalesce(a->>'email',''))) as email
    from state_row s
    cross join lateral jsonb_array_elements(coalesce(s.state_value->'auth'->'accounts','[]'::jsonb)) a
    where lower(trim(coalesce(a->>'role','')))='developer'
  ),
  account_personnel as (
    select
      trim(coalesce(a->>'id','')) as employee_id,
      trim(coalesce(a->>'name',a->>'username','')) as employee_name,
      trim(coalesce(a->>'position','')) as position,
      trim(coalesce(a->>'role','Employee')) as system_role,
      trim(coalesce(a->>'department','')) as department,
      case when lower(trim(coalesce(a->>'active','true'))) in ('false','no','inactive','0') then false else true end as active,
      upper(trim(coalesce(a->>'approvalStatus','APPROVED'))) as approval_status,
      'ACCOUNT'::text as source,
      0 as source_priority
    from state_row s
    cross join lateral jsonb_array_elements(coalesce(s.state_value->'auth'->'accounts','[]'::jsonb)) a
    where trim(coalesce(a->>'id',''))<>''
      and trim(coalesce(a->>'companyId',''))=trim(coalesce(p_company_id,''))
      and lower(trim(coalesce(a->>'role',''))) <> 'developer'
      and upper(trim(coalesce(a->>'approvalStatus','APPROVED')))='APPROVED'
  ),
  live_personnel as (
    select
      trim(coalesce(e->>'employeeId','')) as employee_id,
      trim(coalesce(e->>'name','')) as employee_name,
      trim(coalesce(e->>'position','')) as position,
      'Employee'::text as system_role,
      trim(coalesce(e->>'department','')) as department,
      case when lower(trim(coalesce(e->>'active',e->>'employmentStatus','true'))) in ('false','no','inactive','0','terminated') then false else true end as active,
      'APPROVED'::text as approval_status,
      'LIVE_EMPLOYEE'::text as source,
      1 as source_priority
    from state_row s
    cross join lateral jsonb_array_elements(coalesce(s.state_value->'live'->'employees','[]'::jsonb)) e
    where trim(coalesce(e->>'employeeId',''))<>''
      and (
        trim(coalesce(e->>'companyId',''))=trim(coalesce(p_company_id,''))
        or exists (
          select 1
          from jsonb_array_elements(coalesce(s.state_value->'live'->'timeEntries','[]'::jsonb)) t
          where lower(trim(coalesce(t->>'employeeId','')))=lower(trim(coalesce(e->>'employeeId','')))
            and trim(coalesce(t->>'companyId',''))=trim(coalesce(p_company_id,''))
        )
        or exists (
          select 1
          from jsonb_array_elements(coalesce(s.state_value->'live'->'payroll','[]'::jsonb)) p
          where lower(trim(coalesce(p->>'employeeId','')))=lower(trim(coalesce(e->>'employeeId','')))
            and trim(coalesce(p->>'companyId',''))=trim(coalesce(p_company_id,''))
        )
      )
      and not exists (
        select 1 from developer_principals d
        where (d.principal_id<>'' and d.principal_id=lower(trim(coalesce(e->>'employeeId',''))))
           or (d.email<>'' and d.email=lower(trim(coalesce(e->>'email',''))))
      )
  ),
  unioned as (
    select * from account_personnel
    union all
    select * from live_personnel
  ),
  personnel as (
    select distinct on (lower(employee_id))
      employee_id,employee_name,position,system_role,department,active,approval_status,source
    from unioned
    order by lower(employee_id),source_priority,active desc
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'employeeId',employee_id,
        'name',employee_name,
        'position',position,
        'systemRole',system_role,
        'department',department,
        'budgetCategory','EMPLOYEE',
        'active',active,
        'approvalStatus',approval_status,
        'source',source
      )
      order by lower(employee_name),lower(employee_id)
    ),
    '[]'::jsonb
  )
  from personnel;
$$;

create or replace function public.assurance_regent_browser_budget_personnel_exists(p_company_id text,p_employee_id text)
returns boolean
language sql
stable
security definer
set search_path to 'public','extensions'
as $$
  select exists (
    select 1
    from jsonb_array_elements(public.assurance_regent_browser_budget_personnel_directory(p_company_id)) p
    where lower(trim(coalesce(p->>'employeeId','')))=lower(trim(coalesce(p_employee_id,'')))
  );
$$;

revoke all on function public.assurance_regent_browser_budget_personnel_directory(text) from public;
revoke all on function public.assurance_regent_browser_budget_personnel_exists(text,text) from public;
grant execute on function public.assurance_regent_browser_budget_personnel_directory(text) to anon,authenticated,service_role;
grant execute on function public.assurance_regent_browser_budget_personnel_exists(text,text) to anon,authenticated,service_role;
