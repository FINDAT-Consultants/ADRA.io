-- Assurance Regent v6.3.87 — unified budget personnel directory
-- Budget costing treats every approved company account as personnel regardless of
-- operational role (Country Director/CEO, HR, Finance, managers, executives,
-- supervisors and ordinary employees). The platform Developer role is excluded.

create or replace function public.assurance_regent_browser_budget_personnel_exists(
  p_company_id text,
  p_employee_id text
)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1
    from public.assurance_regent_state s
    cross join lateral jsonb_array_elements(coalesce(s.state_value->'auth'->'accounts','[]'::jsonb)) a
    where s.state_key='browser-client-state'
      and lower(trim(coalesce(a->>'id','')))=lower(trim(coalesce(p_employee_id,'')))
      and trim(coalesce(a->>'companyId',''))=trim(coalesce(p_company_id,''))
      and lower(trim(coalesce(a->>'role',''))) <> 'developer'
      and upper(trim(coalesce(a->>'approvalStatus','APPROVED')))='APPROVED'
  );
$$;

revoke all on function public.assurance_regent_browser_budget_personnel_exists(text,text) from public, anon, authenticated;

create or replace function public.assurance_regent_browser_budget_personnel_directory(
  p_company_id text
)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  with personnel as (
    select distinct on (lower(trim(coalesce(a->>'id',''))))
      trim(coalesce(a->>'id','')) as employee_id,
      trim(coalesce(a->>'name',a->>'username','')) as employee_name,
      trim(coalesce(a->>'position','')) as position,
      trim(coalesce(a->>'role','Employee')) as system_role,
      trim(coalesce(a->>'department','')) as department,
      coalesce((a->>'active')::boolean,true) as active,
      upper(trim(coalesce(a->>'approvalStatus','APPROVED'))) as approval_status
    from public.assurance_regent_state s
    cross join lateral jsonb_array_elements(coalesce(s.state_value->'auth'->'accounts','[]'::jsonb)) a
    where s.state_key='browser-client-state'
      and trim(coalesce(a->>'id',''))<>''
      and trim(coalesce(a->>'companyId',''))=trim(coalesce(p_company_id,''))
      and lower(trim(coalesce(a->>'role',''))) <> 'developer'
      and upper(trim(coalesce(a->>'approvalStatus','APPROVED')))='APPROVED'
    order by lower(trim(coalesce(a->>'id',''))), coalesce((a->>'active')::boolean,true) desc
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
        'approvalStatus',approval_status
      )
      order by lower(employee_name),lower(employee_id)
    ),
    '[]'::jsonb
  )
  from personnel;
$$;

revoke all on function public.assurance_regent_browser_budget_personnel_directory(text) from public, anon, authenticated;

create or replace function public.assurance_regent_browser_budget_import_finalize(p_token text,p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor jsonb;
  v_auth text;
  v_batch public.assurance_regent_budget_import_batches;
  v_projects integer;
  v_rates integer;
  v_rules integer;
  v_unknown_employees integer;
  v_unknown_projects integer;
  v_errors jsonb:='[]'::jsonb;
  v_summary jsonb;
  v_hash text;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  select * into v_batch from public.assurance_regent_budget_import_batches where id=p_batch_id for update;
  if not found then raise exception 'Budget import batch was not found.'; end if;
  v_auth:=public.assurance_regent_browser_functional_authority(v_actor);
  if coalesce(v_actor->>'id','')<>v_batch.uploaded_by and v_auth<>'DEVELOPER' then raise exception 'Only the batch uploader can submit this batch.'; end if;
  if v_batch.status<>'DRAFT' then raise exception 'Only a draft batch can be submitted.'; end if;

  select count(*) into v_projects from public.assurance_regent_budget_import_projects where batch_id=p_batch_id;
  select count(*) into v_rates from public.assurance_regent_budget_import_rates where batch_id=p_batch_id;
  select count(*) into v_rules from public.assurance_regent_budget_import_rules where batch_id=p_batch_id;
  if v_projects=0 then
    v_errors:=v_errors||jsonb_build_array(jsonb_build_object('type','PROJECT_BUDGET_REQUIRED','message','At least one Project Budget row is required.'));
  end if;

  select count(*) into v_unknown_employees
  from public.assurance_regent_budget_import_rates r
  where r.batch_id=p_batch_id
    and not public.assurance_regent_browser_budget_personnel_exists(v_batch.company_id,r.employee_id);

  if v_unknown_employees>0 then
    v_errors:=v_errors||jsonb_build_array(
      jsonb_build_object(
        'type','UNKNOWN_PERSONNEL',
        'count',v_unknown_employees,
        'message',format('%s personnel rate row(s) reference IDs not found in the approved company personnel directory. Country Director, HR, Finance, managers, executives, supervisors and ordinary employees are eligible; Developer is excluded.',v_unknown_employees)
      )
    );
  end if;

  select count(*) into v_unknown_projects
  from public.assurance_regent_budget_import_projects p
  where p.batch_id=p_batch_id
    and not exists (
      select 1
      from public.assurance_regent_state s
      cross join lateral jsonb_array_elements(coalesce(s.state_value->'live'->'projects','[]'::jsonb)) j
      where s.state_key='browser-client-state'
        and upper(trim(coalesce(j->>'code',j->>'projectCode','')))=upper(trim(p.project_code))
        and (coalesce(j->>'companyId','')='' or j->>'companyId'=v_batch.company_id)
    );

  v_summary:=jsonb_build_object(
    'projectCount',v_projects,
    'employeeRateCount',v_rates,
    'donorRuleCount',v_rules,
    'unknownProjectCount',v_unknown_projects,
    'currency',v_batch.currency,
    'totalPersonnelBudget',(select coalesce(sum(personnel_budget),0) from public.assurance_regent_budget_import_projects where batch_id=p_batch_id)
  );

  select encode(digest(convert_to(coalesce((select string_agg(x,'|' order by x) from (
    select to_jsonb(p)::text x from public.assurance_regent_budget_import_projects p where p.batch_id=p_batch_id
    union all select to_jsonb(r)::text from public.assurance_regent_budget_import_rates r where r.batch_id=p_batch_id
    union all select to_jsonb(d)::text from public.assurance_regent_budget_import_rules d where d.batch_id=p_batch_id
  ) q),''),'UTF8'),'sha256'),'hex') into v_hash;

  update public.assurance_regent_budget_import_batches
  set summary=v_summary,
      validation_errors=v_errors,
      content_hash=v_hash,
      finalized_at=now(),
      status=case when jsonb_array_length(v_errors)>0 then 'VALIDATION_FAILED' else 'PENDING_FINANCE_REVIEW' end
  where id=p_batch_id returning * into v_batch;

  perform public.assurance_regent_browser_recovery_audit_write(
    v_actor,v_batch.company_id,'BUDGET_IMPORT','BUDGET_IMPORT',v_batch.id::text,'FINALIZE',v_batch.status,
    jsonb_build_object('summary',v_summary,'validationErrors',v_errors,'personnelDirectory','AUTH_ACCOUNTS_EXCEPT_DEVELOPER')
  );
  return to_jsonb(v_batch);
end;
$$;

create or replace function public.assurance_regent_browser_budget_import_bundle(p_token text,p_company_id text default '')
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor jsonb;
  v_company text;
  v_auth text;
  v_batches jsonb;
  v_active jsonb;
  v_personnel jsonb;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  v_auth:=public.assurance_regent_browser_functional_authority(v_actor);
  if not (
    public.assurance_regent_browser_budget_import_can_upload(v_actor)
    or public.assurance_regent_browser_budget_import_can_country_approve(v_actor)
    or public.assurance_regent_browser_recovery_can_read_finance(v_actor)
  ) then
    raise exception 'Finance, Country Director, Auditor, Administrator, CEO or Developer authority is required.';
  end if;

  v_company:=public.assurance_regent_browser_recovery_company(v_actor,p_company_id);
  if v_company='' then raise exception 'Select a company.'; end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.uploaded_at desc),'[]'::jsonb)
    into v_batches
  from (
    select * from public.assurance_regent_budget_import_batches
    where company_id=v_company
    order by uploaded_at desc
    limit 40
  ) x;

  select to_jsonb(x) into v_active
  from (
    select * from public.assurance_regent_budget_import_batches
    where company_id=v_company and status='ACTIVE'
    order by activated_at desc
    limit 1
  ) x;

  v_personnel:=public.assurance_regent_browser_budget_personnel_directory(v_company);

  return jsonb_build_object(
    'schemaVersion','6.3.87',
    'authority',v_auth,
    'companyId',v_company,
    'batches',coalesce(v_batches,'[]'::jsonb),
    'activeBatch',coalesce(v_active,'null'::jsonb),
    'personnelDirectory',coalesce(v_personnel,'[]'::jsonb),
    'personnelClassification','ALL_APPROVED_COMPANY_ACCOUNTS_EXCEPT_DEVELOPER',
    'canUpload',public.assurance_regent_browser_budget_import_can_upload(v_actor),
    'canFinanceReview',public.assurance_regent_browser_budget_import_can_finance_review(v_actor),
    'canCountryApprove',public.assurance_regent_browser_budget_import_can_country_approve(v_actor)
  );
end;
$$;

-- Existing public RPC privileges remain unchanged by CREATE OR REPLACE.
