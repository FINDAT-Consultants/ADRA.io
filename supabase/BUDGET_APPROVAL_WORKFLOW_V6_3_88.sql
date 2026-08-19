-- Assurance Regent v6.3.88 — budget maker/checker/approver workflow + targeted notifications
-- Normal business flow: Finance Officer/Accountant uploads -> Finance Manager reviews
-- -> Country Director/CEO approves and activates. Developer remains a platform override.

create table if not exists public.assurance_regent_budget_import_notifications (
  id bigserial primary key,
  company_id text not null,
  batch_id uuid not null references public.assurance_regent_budget_import_batches(id) on delete cascade,
  recipient_id text not null,
  kind text not null,
  title text not null,
  detail text not null default '',
  created_at timestamptz not null default now(),
  read_at timestamptz,
  read_by text not null default '',
  constraint ar_budget_import_notification_kind check (
    kind in (
      'FINANCE_REVIEW_REQUIRED',
      'COUNTRY_APPROVAL_REQUIRED',
      'BUDGET_RETURNED',
      'BUDGET_REJECTED',
      'BUDGET_ACTIVATED',
      'FINANCE_REVIEW_COMPLETED'
    )
  ),
  constraint ar_budget_import_notification_uniq unique(batch_id,recipient_id,kind)
);

create index if not exists ar_budget_import_notifications_recipient_idx
  on public.assurance_regent_budget_import_notifications(recipient_id,read_at,created_at desc);
create index if not exists ar_budget_import_notifications_company_idx
  on public.assurance_regent_budget_import_notifications(company_id,created_at desc);

alter table public.assurance_regent_budget_import_notifications enable row level security;
revoke all on table public.assurance_regent_budget_import_notifications from anon, authenticated;
revoke all on sequence public.assurance_regent_budget_import_notifications_id_seq from anon, authenticated;

create or replace function public.assurance_regent_browser_budget_import_can_upload(p_actor jsonb)
returns boolean
language sql
immutable
set search_path = public, extensions
as $$
  with actor as (
    select
      public.assurance_regent_browser_functional_authority(p_actor) as authority,
      lower(concat_ws(' ',
        coalesce(p_actor->>'position',''),
        coalesce(p_actor->>'department',''),
        coalesce(p_actor->>'supervisoryRole',''),
        coalesce(p_actor->>'role','')
      )) as descriptor
  )
  select authority='DEVELOPER'
    or (
      descriptor ~ '(accountant|accounting officer|accounts officer|accounts assistant|finance officer|finance assistant|finance analyst|budget officer|grants accountant|project accountant)'
      and descriptor !~ '(finance manager|finance director|head of finance|chief financial officer|cfo)'
    )
  from actor;
$$;

create or replace function public.assurance_regent_browser_budget_import_can_finance_review(p_actor jsonb)
returns boolean
language sql
immutable
set search_path = public, extensions
as $$
  with actor as (
    select
      public.assurance_regent_browser_functional_authority(p_actor) as authority,
      lower(concat_ws(' ',
        coalesce(p_actor->>'position',''),
        coalesce(p_actor->>'department',''),
        coalesce(p_actor->>'supervisoryRole','')
      )) as descriptor
  )
  select authority in ('DEVELOPER','FINANCE_MANAGER')
    or descriptor ~ '(finance manager|finance director|head of finance|chief financial officer|cfo)'
  from actor;
$$;

create or replace function public.assurance_regent_browser_budget_import_can_country_approve(p_actor jsonb)
returns boolean
language sql
immutable
set search_path = public, extensions
as $$
  select public.assurance_regent_browser_functional_authority(p_actor) in ('DEVELOPER','CEO')
    or lower(concat_ws(' ',
      coalesce(p_actor->>'position',''),
      coalesce(p_actor->>'supervisoryRole','')
    )) ~ '(country director|country representative|country lead)';
$$;

revoke all on function public.assurance_regent_browser_budget_import_can_upload(jsonb) from public, anon, authenticated;
revoke all on function public.assurance_regent_browser_budget_import_can_finance_review(jsonb) from public, anon, authenticated;
revoke all on function public.assurance_regent_browser_budget_import_can_country_approve(jsonb) from public, anon, authenticated;

create or replace function public.assurance_regent_browser_budget_import_notify_user88(
  p_batch_id uuid,
  p_recipient_id text,
  p_kind text,
  p_title text,
  p_detail text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_batch public.assurance_regent_budget_import_batches;
  v_recipient text:=trim(coalesce(p_recipient_id,''));
begin
  if v_recipient='' then return; end if;
  select * into v_batch
  from public.assurance_regent_budget_import_batches
  where id=p_batch_id;
  if not found then return; end if;

  insert into public.assurance_regent_budget_import_notifications(
    company_id,batch_id,recipient_id,kind,title,detail,created_at,read_at,read_by
  )
  values(
    v_batch.company_id,v_batch.id,v_recipient,upper(trim(p_kind)),
    left(trim(coalesce(p_title,'Budget workflow update')),220),
    left(trim(coalesce(p_detail,'')),1800),
    now(),null,''
  )
  on conflict(batch_id,recipient_id,kind) do update
    set title=excluded.title,
        detail=excluded.detail,
        created_at=now(),
        read_at=null,
        read_by='';
end;
$$;

create or replace function public.assurance_regent_browser_budget_import_notify_stage88(
  p_batch_id uuid,
  p_stage text
)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_batch public.assurance_regent_budget_import_batches;
  v_stage text:=upper(trim(coalesce(p_stage,'')));
  v_count integer:=0;
  v_title text;
  v_detail text;
begin
  select * into v_batch
  from public.assurance_regent_budget_import_batches
  where id=p_batch_id;
  if not found then return 0; end if;

  if v_stage='FINANCE' then
    v_title:='Budget batch awaiting Finance Manager review';
    v_detail:=format(
      '%s · Version %s · uploaded by %s. Review totals, personnel rates and donor rules, then approve or return it for correction.',
      coalesce(nullif(v_batch.file_name,''),'Budget workbook'),
      v_batch.version_no,
      coalesce(nullif(v_batch.uploaded_by_name,''),v_batch.uploaded_by)
    );

    insert into public.assurance_regent_budget_import_notifications(
      company_id,batch_id,recipient_id,kind,title,detail
    )
    select
      v_batch.company_id,
      v_batch.id,
      trim(a->>'id'),
      'FINANCE_REVIEW_REQUIRED',
      v_title,
      v_detail
    from public.assurance_regent_state s
    cross join lateral jsonb_array_elements(coalesce(s.state_value->'auth'->'accounts','[]'::jsonb)) a
    where s.state_key='browser-client-state'
      and trim(coalesce(a->>'id',''))<>''
      and trim(coalesce(a->>'companyId',''))=v_batch.company_id
      and lower(trim(coalesce(a->>'role',''))) <> 'developer'
      and upper(trim(coalesce(a->>'approvalStatus','APPROVED')))='APPROVED'
      and coalesce(nullif(a->>'active','')::boolean,true)
      and trim(a->>'id')<>v_batch.uploaded_by
      and public.assurance_regent_browser_budget_import_can_finance_review(a)
    on conflict(batch_id,recipient_id,kind) do update
      set title=excluded.title,detail=excluded.detail,created_at=now(),read_at=null,read_by='';
    get diagnostics v_count = row_count;
    return v_count;
  elsif v_stage='COUNTRY' then
    v_title:='Budget batch awaiting Country Director approval';
    v_detail:=format(
      '%s · Version %s · Finance review completed by %s. Approve & activate, return for correction, or reject.',
      coalesce(nullif(v_batch.file_name,''),'Budget workbook'),
      v_batch.version_no,
      coalesce(nullif(v_batch.finance_reviewed_by_name,''),v_batch.finance_reviewed_by)
    );

    insert into public.assurance_regent_budget_import_notifications(
      company_id,batch_id,recipient_id,kind,title,detail
    )
    select
      v_batch.company_id,
      v_batch.id,
      trim(a->>'id'),
      'COUNTRY_APPROVAL_REQUIRED',
      v_title,
      v_detail
    from public.assurance_regent_state s
    cross join lateral jsonb_array_elements(coalesce(s.state_value->'auth'->'accounts','[]'::jsonb)) a
    where s.state_key='browser-client-state'
      and trim(coalesce(a->>'id',''))<>''
      and trim(coalesce(a->>'companyId',''))=v_batch.company_id
      and lower(trim(coalesce(a->>'role',''))) <> 'developer'
      and upper(trim(coalesce(a->>'approvalStatus','APPROVED')))='APPROVED'
      and coalesce(nullif(a->>'active','')::boolean,true)
      and trim(a->>'id')<>v_batch.uploaded_by
      and trim(a->>'id')<>coalesce(v_batch.finance_reviewed_by,'')
      and public.assurance_regent_browser_budget_import_can_country_approve(a)
    on conflict(batch_id,recipient_id,kind) do update
      set title=excluded.title,detail=excluded.detail,created_at=now(),read_at=null,read_by='';
    get diagnostics v_count = row_count;
    return v_count;
  end if;
  return 0;
end;
$$;

create or replace function public.assurance_regent_browser_budget_import_close_stage88(
  p_batch_id uuid,
  p_stage text,
  p_actor_id text
)
returns void
language sql
security definer
set search_path = public, extensions
as $$
  update public.assurance_regent_budget_import_notifications
  set read_at=coalesce(read_at,now()),
      read_by=case when read_by='' then trim(coalesce(p_actor_id,'')) else read_by end
  where batch_id=p_batch_id
    and read_at is null
    and kind=case upper(trim(coalesce(p_stage,'')))
      when 'FINANCE' then 'FINANCE_REVIEW_REQUIRED'
      when 'COUNTRY' then 'COUNTRY_APPROVAL_REQUIRED'
      else '__NONE__'
    end;
$$;

revoke all on function public.assurance_regent_browser_budget_import_notify_user88(uuid,text,text,text,text) from public, anon, authenticated;
revoke all on function public.assurance_regent_browser_budget_import_notify_stage88(uuid,text) from public, anon, authenticated;
revoke all on function public.assurance_regent_browser_budget_import_close_stage88(uuid,text,text) from public, anon, authenticated;

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
    v_errors:=v_errors||jsonb_build_array(jsonb_build_object(
      'type','UNKNOWN_PERSONNEL',
      'count',v_unknown_employees,
      'message',format('%s personnel rate row(s) reference IDs not found in the approved company personnel directory. Country Director, HR, Finance, managers, executives, supervisors and ordinary employees are eligible; Developer is excluded.',v_unknown_employees)
    ));
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

  if v_batch.status='PENDING_FINANCE_REVIEW' then
    perform public.assurance_regent_browser_budget_import_notify_stage88(v_batch.id,'FINANCE');
  end if;

  perform public.assurance_regent_browser_recovery_audit_write(
    v_actor,v_batch.company_id,'BUDGET_IMPORT','BUDGET_IMPORT',v_batch.id::text,'FINALIZE',v_batch.status,
    jsonb_build_object('summary',v_summary,'validationErrors',v_errors,'personnelDirectory','AUTH_ACCOUNTS_EXCEPT_DEVELOPER','workflow','FINANCE_OFFICER_TO_FINANCE_MANAGER_TO_COUNTRY_DIRECTOR')
  );
  return to_jsonb(v_batch);
end;
$$;

create or replace function public.assurance_regent_browser_budget_import_decide(p_token text,p_batch_id uuid,p_action text,p_note text default '')
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor jsonb;
  v_batch public.assurance_regent_budget_import_batches;
  v_action text:=upper(trim(coalesce(p_action,'')));
  v_actor_id text;
  v_actor_name text;
  v_prior_status text;
  v_uploader text;
  v_finance_reviewer text;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  v_actor_id:=coalesce(v_actor->>'id','');
  v_actor_name:=coalesce(v_actor->>'name',v_actor_id);
  select * into v_batch from public.assurance_regent_budget_import_batches where id=p_batch_id for update;
  if not found then raise exception 'Budget import batch was not found.'; end if;
  if public.assurance_regent_browser_functional_authority(v_actor)<>'DEVELOPER' and coalesce(v_actor->>'companyId','')<>v_batch.company_id then raise exception 'You cannot review another company''s budget batch.'; end if;

  v_prior_status:=v_batch.status;
  v_uploader:=v_batch.uploaded_by;
  v_finance_reviewer:=coalesce(v_batch.finance_reviewed_by,'');

  if v_action='FINANCE_APPROVE' then
    if v_batch.status<>'PENDING_FINANCE_REVIEW' then raise exception 'This batch is not awaiting Finance review.'; end if;
    if not public.assurance_regent_browser_budget_import_can_finance_review(v_actor) then raise exception 'Finance Manager authority is required for financial review.'; end if;
    if v_actor_id=v_batch.uploaded_by then raise exception 'Maker-checker control: the uploader cannot approve their own batch.'; end if;
    update public.assurance_regent_budget_import_batches set status='PENDING_COUNTRY_DIRECTOR',finance_reviewed_by=v_actor_id,finance_reviewed_by_name=v_actor_name,finance_reviewed_at=now(),decision_note=trim(coalesce(p_note,'')) where id=p_batch_id returning * into v_batch;
    perform public.assurance_regent_browser_budget_import_close_stage88(v_batch.id,'FINANCE',v_actor_id);
    perform public.assurance_regent_browser_budget_import_notify_stage88(v_batch.id,'COUNTRY');
    perform public.assurance_regent_browser_budget_import_notify_user88(v_batch.id,v_uploader,'FINANCE_REVIEW_COMPLETED','Finance review completed',format('Version %s was reviewed by %s and is now awaiting Country Director approval.',v_batch.version_no,v_actor_name));

  elsif v_action='RETURN' then
    if v_batch.status not in ('PENDING_FINANCE_REVIEW','PENDING_COUNTRY_DIRECTOR') then raise exception 'Only a pending batch can be returned.'; end if;
    if trim(coalesce(p_note,''))='' then raise exception 'A return note is required.'; end if;
    if v_batch.status='PENDING_FINANCE_REVIEW' and not public.assurance_regent_browser_budget_import_can_finance_review(v_actor) then raise exception 'Finance Manager authority is required.'; end if;
    if v_batch.status='PENDING_COUNTRY_DIRECTOR' and not public.assurance_regent_browser_budget_import_can_country_approve(v_actor) then raise exception 'Country Director authority is required.'; end if;
    update public.assurance_regent_budget_import_batches set status='RETURNED',decision_note=trim(p_note) where id=p_batch_id returning * into v_batch;
    if v_prior_status='PENDING_FINANCE_REVIEW' then perform public.assurance_regent_browser_budget_import_close_stage88(v_batch.id,'FINANCE',v_actor_id); else perform public.assurance_regent_browser_budget_import_close_stage88(v_batch.id,'COUNTRY',v_actor_id); end if;
    perform public.assurance_regent_browser_budget_import_notify_user88(v_batch.id,v_uploader,'BUDGET_RETURNED','Budget batch returned for correction',format('Version %s was returned by %s. Reason: %s Correct the workbook and upload a new revision.',v_batch.version_no,v_actor_name,trim(p_note)));
    if v_prior_status='PENDING_COUNTRY_DIRECTOR' and v_finance_reviewer<>'' and v_finance_reviewer<>v_uploader then
      perform public.assurance_regent_browser_budget_import_notify_user88(v_batch.id,v_finance_reviewer,'BUDGET_RETURNED','Country Director returned the budget batch',format('Version %s was returned for correction. Reason: %s',v_batch.version_no,trim(p_note)));
    end if;

  elsif v_action='REJECT' then
    if v_batch.status not in ('PENDING_FINANCE_REVIEW','PENDING_COUNTRY_DIRECTOR') then raise exception 'Only a pending batch can be rejected.'; end if;
    if trim(coalesce(p_note,''))='' then raise exception 'A rejection note is required.'; end if;
    if v_batch.status='PENDING_FINANCE_REVIEW' and not public.assurance_regent_browser_budget_import_can_finance_review(v_actor) then raise exception 'Finance Manager authority is required.'; end if;
    if v_batch.status='PENDING_COUNTRY_DIRECTOR' and not public.assurance_regent_browser_budget_import_can_country_approve(v_actor) then raise exception 'Country Director authority is required.'; end if;
    update public.assurance_regent_budget_import_batches set status='REJECTED',decision_note=trim(p_note) where id=p_batch_id returning * into v_batch;
    if v_prior_status='PENDING_FINANCE_REVIEW' then perform public.assurance_regent_browser_budget_import_close_stage88(v_batch.id,'FINANCE',v_actor_id); else perform public.assurance_regent_browser_budget_import_close_stage88(v_batch.id,'COUNTRY',v_actor_id); end if;
    perform public.assurance_regent_browser_budget_import_notify_user88(v_batch.id,v_uploader,'BUDGET_REJECTED','Budget batch rejected',format('Version %s was rejected by %s. Reason: %s',v_batch.version_no,v_actor_name,trim(p_note)));
    if v_prior_status='PENDING_COUNTRY_DIRECTOR' and v_finance_reviewer<>'' and v_finance_reviewer<>v_uploader then
      perform public.assurance_regent_browser_budget_import_notify_user88(v_batch.id,v_finance_reviewer,'BUDGET_REJECTED','Country Director rejected the budget batch',format('Version %s was rejected. Reason: %s',v_batch.version_no,trim(p_note)));
    end if;

  elsif v_action='COUNTRY_APPROVE' then
    if v_batch.status<>'PENDING_COUNTRY_DIRECTOR' then raise exception 'This batch has not completed Finance review.'; end if;
    if not public.assurance_regent_browser_budget_import_can_country_approve(v_actor) then raise exception 'Country Director or CEO authority is required for final activation.'; end if;
    if v_actor_id in (v_batch.uploaded_by,coalesce(v_batch.finance_reviewed_by,'')) then raise exception 'Final approval must be independent of the uploader and Finance reviewer.'; end if;
    update public.assurance_regent_budget_import_batches set status='SUPERSEDED',superseded_by=p_batch_id where company_id=v_batch.company_id and status='ACTIVE' and id<>p_batch_id;
    update public.assurance_regent_budget_import_batches set status='ACTIVE',country_approved_by=v_actor_id,country_approved_by_name=v_actor_name,country_approved_at=now(),activated_at=now(),decision_note=trim(coalesce(p_note,'')) where id=p_batch_id returning * into v_batch;
    perform public.assurance_regent_browser_budget_import_close_stage88(v_batch.id,'COUNTRY',v_actor_id);
    perform public.assurance_regent_browser_budget_import_notify_user88(v_batch.id,v_uploader,'BUDGET_ACTIVATED','Budget version approved and activated',format('Version %s was approved by %s and is now the active Recovery Assurance budget source.',v_batch.version_no,v_actor_name));
    if v_finance_reviewer<>'' and v_finance_reviewer<>v_uploader then
      perform public.assurance_regent_browser_budget_import_notify_user88(v_batch.id,v_finance_reviewer,'BUDGET_ACTIVATED','Budget version approved and activated',format('Version %s received Country Director approval and is now active.',v_batch.version_no));
    end if;
  else
    raise exception 'Unknown budget review action.';
  end if;

  perform public.assurance_regent_browser_recovery_audit_write(v_actor,v_batch.company_id,'BUDGET_IMPORT','BUDGET_IMPORT',v_batch.id::text,v_action,v_batch.status,jsonb_build_object('note',p_note,'version',v_batch.version_no,'workflow','FINANCE_OFFICER_TO_FINANCE_MANAGER_TO_COUNTRY_DIRECTOR'));
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
  v_actor_id text;
  v_company text;
  v_auth text;
  v_batches jsonb;
  v_active jsonb;
  v_personnel jsonb;
  v_notifications jsonb;
  v_can_upload boolean;
  v_can_finance boolean;
  v_can_country boolean;
  v_workflow_role text;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  v_actor_id:=coalesce(v_actor->>'id','');
  v_auth:=public.assurance_regent_browser_functional_authority(v_actor);
  v_can_upload:=public.assurance_regent_browser_budget_import_can_upload(v_actor);
  v_can_finance:=public.assurance_regent_browser_budget_import_can_finance_review(v_actor);
  v_can_country:=public.assurance_regent_browser_budget_import_can_country_approve(v_actor);

  if not (v_can_upload or v_can_finance or v_can_country or v_auth in ('DEVELOPER','AUDITOR') or public.assurance_regent_browser_recovery_can_read_finance(v_actor)) then
    raise exception 'Finance Office, Finance Manager, Country Director, Auditor or Developer authority is required.';
  end if;

  v_company:=public.assurance_regent_browser_recovery_company(v_actor,p_company_id);
  if v_company='' then raise exception 'Select a company.'; end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.uploaded_at desc),'[]'::jsonb) into v_batches
  from (select * from public.assurance_regent_budget_import_batches where company_id=v_company order by uploaded_at desc limit 40) x;
  select to_jsonb(x) into v_active
  from (select * from public.assurance_regent_budget_import_batches where company_id=v_company and status='ACTIVE' order by activated_at desc limit 1) x;
  v_personnel:=public.assurance_regent_browser_budget_personnel_directory(v_company);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into v_notifications
  from (
    select id,company_id,batch_id,recipient_id,kind,title,detail,created_at,read_at,read_by
    from public.assurance_regent_budget_import_notifications
    where company_id=v_company and recipient_id=v_actor_id and read_at is null
    order by created_at desc limit 100
  ) x;

  v_workflow_role:=case
    when v_auth='DEVELOPER' then 'DEVELOPER_OVERRIDE'
    when v_can_country then 'COUNTRY_DIRECTOR'
    when v_can_finance then 'FINANCE_MANAGER'
    when v_can_upload then 'FINANCE_OFFICE'
    when v_auth='AUDITOR' or public.assurance_regent_browser_recovery_can_read_finance(v_actor) then 'READ_ONLY'
    else 'NONE'
  end;

  return jsonb_build_object(
    'schemaVersion','6.3.88',
    'authority',v_auth,
    'workflowRole',v_workflow_role,
    'workflow','FINANCE_OFFICER_TO_FINANCE_MANAGER_TO_COUNTRY_DIRECTOR',
    'companyId',v_company,
    'batches',coalesce(v_batches,'[]'::jsonb),
    'activeBatch',coalesce(v_active,'null'::jsonb),
    'notifications',coalesce(v_notifications,'[]'::jsonb),
    'personnelDirectory',coalesce(v_personnel,'[]'::jsonb),
    'personnelClassification','ALL_APPROVED_COMPANY_ACCOUNTS_EXCEPT_DEVELOPER',
    'canUpload',v_can_upload,
    'canFinanceReview',v_can_finance,
    'canCountryApprove',v_can_country
  );
end;
$$;

create or replace function public.assurance_regent_browser_budget_import_notification_read(p_token text,p_notification_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor jsonb;
  v_actor_id text;
  v_role text;
  v_company text;
  v_row public.assurance_regent_budget_import_notifications;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  v_actor_id:=coalesce(v_actor->>'id','');
  v_role:=coalesce(v_actor->>'role','Employee');
  v_company:=coalesce(v_actor->>'companyId','');
  select * into v_row from public.assurance_regent_budget_import_notifications where id=p_notification_id for update;
  if not found then raise exception 'Budget notification was not found.'; end if;
  if v_row.recipient_id<>v_actor_id then raise exception 'This budget notification is assigned to another user.'; end if;
  if v_role<>'Developer' and v_row.company_id<>v_company then raise exception 'This budget notification belongs to another company.'; end if;
  update public.assurance_regent_budget_import_notifications set read_at=coalesce(read_at,now()),read_by=case when read_by='' then v_actor_id else read_by end where id=p_notification_id;
  return true;
end;
$$;

revoke all on function public.assurance_regent_browser_budget_import_notification_read(text,bigint) from public, anon, authenticated;
grant execute on function public.assurance_regent_browser_budget_import_notification_read(text,bigint) to anon, authenticated;
grant execute on function public.assurance_regent_browser_budget_import_finalize(text,uuid) to anon, authenticated;
grant execute on function public.assurance_regent_browser_budget_import_decide(text,uuid,text,text) to anon, authenticated;
grant execute on function public.assurance_regent_browser_budget_import_bundle(text,text) to anon, authenticated;

-- Backfill stage notifications so work already in flight is immediately visible after deployment.
select public.assurance_regent_browser_budget_import_notify_stage88(id,'FINANCE')
from public.assurance_regent_budget_import_batches
where status='PENDING_FINANCE_REVIEW';

select public.assurance_regent_browser_budget_import_notify_stage88(id,'COUNTRY')
from public.assurance_regent_budget_import_batches
where status='PENDING_COUNTRY_DIRECTOR';
