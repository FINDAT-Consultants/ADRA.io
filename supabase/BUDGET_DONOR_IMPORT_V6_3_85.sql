-- Assurance Regent v6.3.85 — controlled Budget & Donor Excel batch imports
-- Finance uploads and stages; Finance Manager reviews; Country Director/CEO activates.

create table if not exists public.assurance_regent_budget_import_batches (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  version_no integer not null,
  version_label text not null default '',
  status text not null default 'DRAFT' check (status in ('DRAFT','VALIDATION_FAILED','PENDING_FINANCE_REVIEW','PENDING_COUNTRY_DIRECTOR','ACTIVE','RETURNED','REJECTED','SUPERSEDED')),
  file_id text not null default '',
  file_name text not null default '',
  currency text not null default 'USD',
  effective_from date,
  effective_to date,
  metadata jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  validation_errors jsonb not null default '[]'::jsonb,
  content_hash text not null default '',
  uploaded_by text not null,
  uploaded_by_name text not null default '',
  uploaded_authority text not null default '',
  uploaded_at timestamptz not null default now(),
  finalized_at timestamptz,
  finance_reviewed_by text,
  finance_reviewed_by_name text not null default '',
  finance_reviewed_at timestamptz,
  country_approved_by text,
  country_approved_by_name text not null default '',
  country_approved_at timestamptz,
  activated_at timestamptz,
  decision_note text not null default '',
  superseded_by uuid references public.assurance_regent_budget_import_batches(id) on delete set null,
  constraint ar_budget_import_version_uniq unique(company_id,version_no),
  constraint ar_budget_import_effective_dates check (effective_to is null or effective_from is null or effective_to>=effective_from),
  constraint ar_budget_import_currency check (currency ~ '^[A-Z]{3}$')
);

create table if not exists public.assurance_regent_budget_import_projects (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.assurance_regent_budget_import_batches(id) on delete cascade,
  project_code text not null,
  project_name text not null default '',
  donor text not null default '',
  currency text not null,
  personnel_budget numeric not null,
  effective_from date,
  effective_to date,
  source_row integer,
  created_at timestamptz not null default now(),
  constraint ar_budget_project_code_nonempty check (length(trim(project_code))>0),
  constraint ar_budget_project_currency check (currency ~ '^[A-Z]{3}$'),
  constraint ar_budget_project_amount check (personnel_budget>=0),
  constraint ar_budget_project_dates check (effective_to is null or effective_from is null or effective_to>=effective_from),
  constraint ar_budget_project_batch_code_uniq unique(batch_id,project_code)
);

create table if not exists public.assurance_regent_budget_import_rates (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.assurance_regent_budget_import_batches(id) on delete cascade,
  employee_id text not null,
  project_code text not null default '',
  hourly_rate numeric not null,
  currency text not null,
  effective_from date,
  effective_to date,
  source_row integer,
  created_at timestamptz not null default now(),
  constraint ar_budget_rate_employee_nonempty check (length(trim(employee_id))>0),
  constraint ar_budget_rate_currency check (currency ~ '^[A-Z]{3}$'),
  constraint ar_budget_rate_positive check (hourly_rate>0),
  constraint ar_budget_rate_dates check (effective_to is null or effective_from is null or effective_to>=effective_from),
  constraint ar_budget_rate_scope_uniq unique(batch_id,employee_id,project_code,effective_from)
);

create table if not exists public.assurance_regent_budget_import_rules (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.assurance_regent_budget_import_batches(id) on delete cascade,
  donor text not null default '',
  project_code text not null default '',
  rule_key text not null,
  numeric_value numeric,
  text_value text not null default '',
  effective_from date,
  effective_to date,
  source_row integer,
  created_at timestamptz not null default now(),
  constraint ar_budget_rule_key check (rule_key in ('EVIDENCE_REQUIRED','MAX_HOURLY_COST','MAX_PERSONNEL_CHARGE','CURRENCY','ALLOW_ADMIN','CUSTOM')),
  constraint ar_budget_rule_dates check (effective_to is null or effective_from is null or effective_to>=effective_from)
);

create index if not exists ar_budget_import_company_status_idx on public.assurance_regent_budget_import_batches(company_id,status,uploaded_at desc);
create index if not exists ar_budget_import_projects_scope_idx on public.assurance_regent_budget_import_projects(batch_id,project_code);
create index if not exists ar_budget_import_rates_scope_idx on public.assurance_regent_budget_import_rates(batch_id,employee_id,project_code);
create index if not exists ar_budget_import_rules_scope_idx on public.assurance_regent_budget_import_rules(batch_id,project_code,donor,rule_key);

alter table public.assurance_regent_budget_import_batches enable row level security;
alter table public.assurance_regent_budget_import_projects enable row level security;
alter table public.assurance_regent_budget_import_rates enable row level security;
alter table public.assurance_regent_budget_import_rules enable row level security;

revoke all on public.assurance_regent_budget_import_batches from anon, authenticated;
revoke all on public.assurance_regent_budget_import_projects from anon, authenticated;
revoke all on public.assurance_regent_budget_import_rates from anon, authenticated;
revoke all on public.assurance_regent_budget_import_rules from anon, authenticated;

create or replace function public.assurance_regent_browser_budget_import_can_upload(p_actor jsonb)
returns boolean
language sql
immutable
set search_path = public, extensions
as $$
  select public.assurance_regent_browser_functional_authority(p_actor) in ('DEVELOPER','CEO','ADMINISTRATOR','FINANCE_MANAGER')
    or lower(concat_ws(' ',coalesce(p_actor->>'position',''),coalesce(p_actor->>'department',''))) ~ '(finance|accountant|accounting|grants accountant|project accountant)';
$$;

create or replace function public.assurance_regent_browser_budget_import_can_finance_review(p_actor jsonb)
returns boolean
language sql
immutable
set search_path = public, extensions
as $$
  select public.assurance_regent_browser_functional_authority(p_actor) in ('DEVELOPER','FINANCE_MANAGER');
$$;

create or replace function public.assurance_regent_browser_budget_import_can_country_approve(p_actor jsonb)
returns boolean
language sql
immutable
set search_path = public, extensions
as $$
  select public.assurance_regent_browser_functional_authority(p_actor) in ('DEVELOPER','CEO')
    or lower(concat_ws(' ',coalesce(p_actor->>'position',''),coalesce(p_actor->>'supervisoryRole',''))) ~ '(country director|country representative)';
$$;

create or replace function public.assurance_regent_browser_budget_import_begin(
  p_token text,
  p_company_id text default '',
  p_file_id text default '',
  p_file_name text default '',
  p_version_label text default '',
  p_currency text default 'USD',
  p_effective_from date default null,
  p_effective_to date default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor jsonb;
  v_company text;
  v_auth text;
  v_version integer;
  v_currency text:=upper(trim(coalesce(p_currency,'USD')));
  v_row public.assurance_regent_budget_import_batches;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  if not public.assurance_regent_browser_budget_import_can_upload(v_actor) then
    raise exception 'Finance or authorized administration authority is required to upload a budget batch.';
  end if;
  v_company:=public.assurance_regent_browser_recovery_company(v_actor,p_company_id);
  if v_company='' then raise exception 'Select a company before uploading a budget batch.'; end if;
  if v_currency !~ '^[A-Z]{3}$' then raise exception 'Budget currency must be a three-letter code.'; end if;
  if p_effective_from is not null and p_effective_to is not null and p_effective_to<p_effective_from then raise exception 'Budget effective-to date cannot be before effective-from date.'; end if;
  perform pg_advisory_xact_lock(hashtext('budget-import:'||v_company));
  select coalesce(max(version_no),0)+1 into v_version from public.assurance_regent_budget_import_batches where company_id=v_company;
  v_auth:=public.assurance_regent_browser_functional_authority(v_actor);
  insert into public.assurance_regent_budget_import_batches(company_id,version_no,version_label,file_id,file_name,currency,effective_from,effective_to,metadata,uploaded_by,uploaded_by_name,uploaded_authority)
  values(v_company,v_version,trim(coalesce(p_version_label,'')),trim(coalesce(p_file_id,'')),trim(coalesce(p_file_name,'')),v_currency,p_effective_from,p_effective_to,coalesce(p_metadata,'{}'::jsonb),coalesce(v_actor->>'id',''),coalesce(v_actor->>'name',v_actor->>'id',''),v_auth)
  returning * into v_row;
  perform public.assurance_regent_browser_recovery_audit_write(v_actor,v_company,'BUDGET_IMPORT','BUDGET_IMPORT',v_row.id::text,'BEGIN','DRAFT',jsonb_build_object('version',v_version,'fileName',p_file_name,'currency',v_currency));
  return to_jsonb(v_row);
end;
$$;

create or replace function public.assurance_regent_browser_budget_import_append(
  p_token text,
  p_batch_id uuid,
  p_row_type text,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor jsonb;
  v_auth text;
  v_batch public.assurance_regent_budget_import_batches;
  v_row jsonb;
  v_type text:=upper(trim(coalesce(p_row_type,'')));
  v_count integer:=0;
  v_from date;
  v_to date;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  select * into v_batch from public.assurance_regent_budget_import_batches where id=p_batch_id for update;
  if not found then raise exception 'Budget import batch was not found.'; end if;
  v_auth:=public.assurance_regent_browser_functional_authority(v_actor);
  if coalesce(v_actor->>'id','')<>v_batch.uploaded_by and v_auth<>'DEVELOPER' then raise exception 'Only the batch uploader can add staged rows.'; end if;
  if v_batch.status<>'DRAFT' then raise exception 'This batch is immutable after submission. Upload a new revision instead.'; end if;
  if jsonb_typeof(coalesce(p_rows,'[]'::jsonb))<>'array' then raise exception 'Batch rows must be a JSON array.'; end if;
  if jsonb_array_length(coalesce(p_rows,'[]'::jsonb))>250 then raise exception 'Upload batch chunks of 250 rows or fewer.'; end if;
  if v_type not in ('PROJECT','RATE','RULE') then raise exception 'Unknown budget import row type.'; end if;

  for v_row in select value from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb)) loop
    v_from:=nullif(trim(coalesce(v_row->>'effective_from','')),'')::date;
    v_to:=nullif(trim(coalesce(v_row->>'effective_to','')),'')::date;
    if v_to is not null and v_from is not null and v_to<v_from then raise exception 'Effective-to date cannot be before effective-from date at source row %.',coalesce(v_row->>'source_row','?'); end if;
    if v_type='PROJECT' then
      insert into public.assurance_regent_budget_import_projects(batch_id,project_code,project_name,donor,currency,personnel_budget,effective_from,effective_to,source_row)
      values(p_batch_id,upper(trim(coalesce(v_row->>'project_code',''))),trim(coalesce(v_row->>'project_name','')),trim(coalesce(v_row->>'donor','')),upper(trim(coalesce(nullif(v_row->>'currency',''),v_batch.currency))),coalesce(nullif(trim(coalesce(v_row->>'personnel_budget','')),'')::numeric,0),v_from,v_to,nullif(trim(coalesce(v_row->>'source_row','')),'')::integer);
    elsif v_type='RATE' then
      insert into public.assurance_regent_budget_import_rates(batch_id,employee_id,project_code,hourly_rate,currency,effective_from,effective_to,source_row)
      values(p_batch_id,trim(coalesce(v_row->>'employee_id','')),upper(trim(coalesce(v_row->>'project_code',''))),nullif(trim(coalesce(v_row->>'hourly_rate','')),'')::numeric,upper(trim(coalesce(nullif(v_row->>'currency',''),v_batch.currency))),v_from,v_to,nullif(trim(coalesce(v_row->>'source_row','')),'')::integer);
    else
      insert into public.assurance_regent_budget_import_rules(batch_id,donor,project_code,rule_key,numeric_value,text_value,effective_from,effective_to,source_row)
      values(p_batch_id,trim(coalesce(v_row->>'donor','')),upper(trim(coalesce(v_row->>'project_code',''))),upper(trim(coalesce(v_row->>'rule_key',''))),nullif(trim(coalesce(v_row->>'numeric_value','')),'')::numeric,trim(coalesce(v_row->>'text_value','')),v_from,v_to,nullif(trim(coalesce(v_row->>'source_row','')),'')::integer);
    end if;
    v_count:=v_count+1;
  end loop;
  return jsonb_build_object('batchId',p_batch_id,'rowType',v_type,'accepted',v_count);
end;
$$;

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
  if v_projects=0 then v_errors:=v_errors||jsonb_build_array(jsonb_build_object('type','PROJECT_BUDGET_REQUIRED','message','At least one Project Budget row is required.')); end if;

  select count(*) into v_unknown_employees
  from public.assurance_regent_budget_import_rates r
  where r.batch_id=p_batch_id
    and not exists (
      select 1 from public.assurance_regent_state s, lateral jsonb_array_elements(coalesce(s.state_value->'live'->'employees','[]'::jsonb)) e
      where s.state_key='browser-client-state'
        and trim(coalesce(e->>'employeeId',''))=trim(r.employee_id)
        and (coalesce(e->>'companyId','')='' or e->>'companyId'=v_batch.company_id)
    );
  if v_unknown_employees>0 then v_errors:=v_errors||jsonb_build_array(jsonb_build_object('type','UNKNOWN_EMPLOYEES','count',v_unknown_employees,'message',format('%s personnel rate row(s) reference employee IDs not found in this company.',v_unknown_employees))); end if;

  select count(*) into v_unknown_projects
  from public.assurance_regent_budget_import_projects p
  where p.batch_id=p_batch_id
    and not exists (
      select 1 from public.assurance_regent_state s, lateral jsonb_array_elements(coalesce(s.state_value->'live'->'projects','[]'::jsonb)) j
      where s.state_key='browser-client-state'
        and upper(trim(coalesce(j->>'code',j->>'projectCode','')))=upper(trim(p.project_code))
        and (coalesce(j->>'companyId','')='' or j->>'companyId'=v_batch.company_id)
    );

  v_summary:=jsonb_build_object('projectCount',v_projects,'employeeRateCount',v_rates,'donorRuleCount',v_rules,'unknownProjectCount',v_unknown_projects,'currency',v_batch.currency,'totalPersonnelBudget',(select coalesce(sum(personnel_budget),0) from public.assurance_regent_budget_import_projects where batch_id=p_batch_id));
  select encode(digest(convert_to(coalesce((select string_agg(x,'|' order by x) from (
    select to_jsonb(p)::text x from public.assurance_regent_budget_import_projects p where p.batch_id=p_batch_id
    union all select to_jsonb(r)::text from public.assurance_regent_budget_import_rates r where r.batch_id=p_batch_id
    union all select to_jsonb(d)::text from public.assurance_regent_budget_import_rules d where d.batch_id=p_batch_id
  ) q),''),'UTF8'),'sha256'),'hex') into v_hash;

  update public.assurance_regent_budget_import_batches
  set summary=v_summary,validation_errors=v_errors,content_hash=v_hash,finalized_at=now(),status=case when jsonb_array_length(v_errors)>0 then 'VALIDATION_FAILED' else 'PENDING_FINANCE_REVIEW' end
  where id=p_batch_id returning * into v_batch;
  perform public.assurance_regent_browser_recovery_audit_write(v_actor,v_batch.company_id,'BUDGET_IMPORT','BUDGET_IMPORT',v_batch.id::text,'FINALIZE',v_batch.status,jsonb_build_object('summary',v_summary,'validationErrors',v_errors));
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
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  v_actor_id:=coalesce(v_actor->>'id',''); v_actor_name:=coalesce(v_actor->>'name',v_actor_id);
  select * into v_batch from public.assurance_regent_budget_import_batches where id=p_batch_id for update;
  if not found then raise exception 'Budget import batch was not found.'; end if;
  if public.assurance_regent_browser_functional_authority(v_actor)<>'DEVELOPER' and coalesce(v_actor->>'companyId','')<>v_batch.company_id then raise exception 'You cannot review another company''s budget batch.'; end if;

  if v_action='FINANCE_APPROVE' then
    if v_batch.status<>'PENDING_FINANCE_REVIEW' then raise exception 'This batch is not awaiting Finance review.'; end if;
    if not public.assurance_regent_browser_budget_import_can_finance_review(v_actor) then raise exception 'Finance Manager authority is required for financial review.'; end if;
    if v_actor_id=v_batch.uploaded_by then raise exception 'Maker-checker control: the uploader cannot approve their own batch.'; end if;
    update public.assurance_regent_budget_import_batches set status='PENDING_COUNTRY_DIRECTOR',finance_reviewed_by=v_actor_id,finance_reviewed_by_name=v_actor_name,finance_reviewed_at=now(),decision_note=trim(coalesce(p_note,'')) where id=p_batch_id returning * into v_batch;
  elsif v_action='RETURN' then
    if v_batch.status not in ('PENDING_FINANCE_REVIEW','PENDING_COUNTRY_DIRECTOR') then raise exception 'Only a pending batch can be returned.'; end if;
    if trim(coalesce(p_note,''))='' then raise exception 'A return note is required.'; end if;
    if v_batch.status='PENDING_FINANCE_REVIEW' and not public.assurance_regent_browser_budget_import_can_finance_review(v_actor) then raise exception 'Finance Manager authority is required.'; end if;
    if v_batch.status='PENDING_COUNTRY_DIRECTOR' and not public.assurance_regent_browser_budget_import_can_country_approve(v_actor) then raise exception 'Country Director authority is required.'; end if;
    update public.assurance_regent_budget_import_batches set status='RETURNED',decision_note=trim(p_note) where id=p_batch_id returning * into v_batch;
  elsif v_action='REJECT' then
    if v_batch.status not in ('PENDING_FINANCE_REVIEW','PENDING_COUNTRY_DIRECTOR') then raise exception 'Only a pending batch can be rejected.'; end if;
    if trim(coalesce(p_note,''))='' then raise exception 'A rejection note is required.'; end if;
    if v_batch.status='PENDING_FINANCE_REVIEW' and not public.assurance_regent_browser_budget_import_can_finance_review(v_actor) then raise exception 'Finance Manager authority is required.'; end if;
    if v_batch.status='PENDING_COUNTRY_DIRECTOR' and not public.assurance_regent_browser_budget_import_can_country_approve(v_actor) then raise exception 'Country Director authority is required.'; end if;
    update public.assurance_regent_budget_import_batches set status='REJECTED',decision_note=trim(p_note) where id=p_batch_id returning * into v_batch;
  elsif v_action='COUNTRY_APPROVE' then
    if v_batch.status<>'PENDING_COUNTRY_DIRECTOR' then raise exception 'This batch has not completed Finance review.'; end if;
    if not public.assurance_regent_browser_budget_import_can_country_approve(v_actor) then raise exception 'Country Director or CEO authority is required for final activation.'; end if;
    if v_actor_id in (v_batch.uploaded_by,coalesce(v_batch.finance_reviewed_by,'')) then raise exception 'Final approval must be independent of the uploader and Finance reviewer.'; end if;
    update public.assurance_regent_budget_import_batches set status='SUPERSEDED',superseded_by=p_batch_id where company_id=v_batch.company_id and status='ACTIVE' and id<>p_batch_id;
    update public.assurance_regent_budget_import_batches set status='ACTIVE',country_approved_by=v_actor_id,country_approved_by_name=v_actor_name,country_approved_at=now(),activated_at=now(),decision_note=trim(coalesce(p_note,'')) where id=p_batch_id returning * into v_batch;
  else
    raise exception 'Unknown budget review action.';
  end if;
  perform public.assurance_regent_browser_recovery_audit_write(v_actor,v_batch.company_id,'BUDGET_IMPORT','BUDGET_IMPORT',v_batch.id::text,v_action,v_batch.status,jsonb_build_object('note',p_note,'version',v_batch.version_no));
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
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  v_auth:=public.assurance_regent_browser_functional_authority(v_actor);
  if not (public.assurance_regent_browser_budget_import_can_upload(v_actor) or public.assurance_regent_browser_budget_import_can_country_approve(v_actor) or public.assurance_regent_browser_recovery_can_read_finance(v_actor)) then
    raise exception 'Finance, Country Director, Auditor, Administrator, CEO or Developer authority is required.';
  end if;
  v_company:=public.assurance_regent_browser_recovery_company(v_actor,p_company_id);
  if v_company='' then raise exception 'Select a company.'; end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.uploaded_at desc),'[]'::jsonb) into v_batches from (select * from public.assurance_regent_budget_import_batches where company_id=v_company order by uploaded_at desc limit 40) x;
  select to_jsonb(x) into v_active from (select * from public.assurance_regent_budget_import_batches where company_id=v_company and status='ACTIVE' order by activated_at desc limit 1) x;
  return jsonb_build_object('schemaVersion','6.3.85','authority',v_auth,'companyId',v_company,'batches',coalesce(v_batches,'[]'::jsonb),'activeBatch',coalesce(v_active,'null'::jsonb),'canUpload',public.assurance_regent_browser_budget_import_can_upload(v_actor),'canFinanceReview',public.assurance_regent_browser_budget_import_can_finance_review(v_actor),'canCountryApprove',public.assurance_regent_browser_budget_import_can_country_approve(v_actor));
end;
$$;

create or replace function public.assurance_regent_browser_recovery_bundle(p_token text, p_month date default null, p_company_id text default '')
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor jsonb; v_auth text; v_company text;
  v_rules jsonb; v_import_rules jsonb; v_evidence jsonb; v_passports jsonb; v_keys jsonb; v_approvals jsonb; v_journals jsonb; v_lines jsonb; v_audit jsonb;
  v_active_batch jsonb; v_active_budgets jsonb; v_active_rates jsonb;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token); v_auth:=public.assurance_regent_browser_functional_authority(v_actor); v_company:=public.assurance_regent_browser_recovery_company(v_actor,p_company_id);
  if not public.assurance_regent_browser_recovery_can_read_finance(v_actor) then raise exception 'Finance, Auditor, Administrator, CEO or Developer authority is required for Recovery Assurance.'; end if;
  if v_auth='DEVELOPER' and v_company='' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into v_rules from public.assurance_regent_recovery_donor_rules x where p_month is null or x.effective_from is null or x.effective_from<=p_month;
    select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into v_evidence from public.assurance_regent_recovery_evidence_links x where p_month is null or x.reporting_month=p_month;
    select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into v_passports from public.assurance_regent_recovery_passports x where p_month is null or x.reporting_month=p_month;
    v_import_rules:='[]'::jsonb; v_active_budgets:='[]'::jsonb; v_active_rates:='[]'::jsonb; v_active_batch:='null'::jsonb;
  else
    select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into v_rules from public.assurance_regent_recovery_donor_rules x where x.company_id=v_company and (p_month is null or x.effective_from is null or x.effective_from<=p_month);
    select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into v_evidence from public.assurance_regent_recovery_evidence_links x where x.company_id=v_company and (p_month is null or x.reporting_month=p_month);
    select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into v_passports from public.assurance_regent_recovery_passports x where x.company_id=v_company and (p_month is null or x.reporting_month=p_month);
    select to_jsonb(b) into v_active_batch from public.assurance_regent_budget_import_batches b where b.company_id=v_company and b.status='ACTIVE' order by b.activated_at desc limit 1;
    select coalesce(jsonb_agg(to_jsonb(p) order by p.project_code),'[]'::jsonb) into v_active_budgets
      from public.assurance_regent_budget_import_projects p join public.assurance_regent_budget_import_batches b on b.id=p.batch_id
      where b.company_id=v_company and b.status='ACTIVE' and (p_month is null or (coalesce(p.effective_from,b.effective_from) is null or coalesce(p.effective_from,b.effective_from)<=p_month) and (coalesce(p.effective_to,b.effective_to) is null or coalesce(p.effective_to,b.effective_to)>=p_month));
    select coalesce(jsonb_agg(to_jsonb(r) order by r.employee_id,r.project_code),'[]'::jsonb) into v_active_rates
      from public.assurance_regent_budget_import_rates r join public.assurance_regent_budget_import_batches b on b.id=r.batch_id
      where b.company_id=v_company and b.status='ACTIVE' and (p_month is null or (coalesce(r.effective_from,b.effective_from) is null or coalesce(r.effective_from,b.effective_from)<=p_month) and (coalesce(r.effective_to,b.effective_to) is null or coalesce(r.effective_to,b.effective_to)>=p_month));
    select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('active',true,'created_at',b.activated_at) order by r.created_at),'[]'::jsonb) into v_import_rules
      from public.assurance_regent_budget_import_rules r join public.assurance_regent_budget_import_batches b on b.id=r.batch_id
      where b.company_id=v_company and b.status='ACTIVE' and (p_month is null or (coalesce(r.effective_from,b.effective_from) is null or coalesce(r.effective_from,b.effective_from)<=p_month) and (coalesce(r.effective_to,b.effective_to) is null or coalesce(r.effective_to,b.effective_to)>=p_month));
  end if;
  select coalesce(jsonb_agg(to_jsonb(k) order by k.created_at),'[]'::jsonb) into v_keys from public.assurance_regent_recovery_passport_keys k where k.passport_id in (select (p->>'id')::uuid from jsonb_array_elements(v_passports) p);
  select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc),'[]'::jsonb) into v_approvals from public.assurance_regent_recovery_approvals a where a.passport_id in (select (p->>'id')::uuid from jsonb_array_elements(v_passports) p);
  select coalesce(jsonb_agg(to_jsonb(j) order by j.created_at desc),'[]'::jsonb) into v_journals from public.assurance_regent_recovery_journal_batches j where (v_auth='DEVELOPER' and v_company='') or j.company_id=v_company;
  select coalesce(jsonb_agg(to_jsonb(l) order by l.line_no),'[]'::jsonb) into v_lines from public.assurance_regent_recovery_journal_lines l where l.batch_id in (select (j->>'id')::uuid from jsonb_array_elements(v_journals) j);
  select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc),'[]'::jsonb) into v_audit from (select * from public.assurance_regent_recovery_audit_events e where ((v_auth='DEVELOPER' and v_company='') or e.company_id=v_company) order by e.created_at desc limit 250) a;
  return jsonb_build_object('schemaVersion','6.3.85','authority',v_auth,'companyId',v_company,'rules',coalesce(v_rules,'[]'::jsonb)||coalesce(v_import_rules,'[]'::jsonb),'evidence',coalesce(v_evidence,'[]'::jsonb),'passports',coalesce(v_passports,'[]'::jsonb),'keys',coalesce(v_keys,'[]'::jsonb),'approvals',coalesce(v_approvals,'[]'::jsonb),'journals',coalesce(v_journals,'[]'::jsonb),'journalLines',coalesce(v_lines,'[]'::jsonb),'audit',coalesce(v_audit,'[]'::jsonb),'activeBudgetBatch',coalesce(v_active_batch,'null'::jsonb),'activeBudgets',coalesce(v_active_budgets,'[]'::jsonb),'activeRates',coalesce(v_active_rates,'[]'::jsonb));
end;
$$;

grant execute on function public.assurance_regent_browser_budget_import_begin(text,text,text,text,text,text,date,date,jsonb) to anon, authenticated;
grant execute on function public.assurance_regent_browser_budget_import_append(text,uuid,text,jsonb) to anon, authenticated;
grant execute on function public.assurance_regent_browser_budget_import_finalize(text,uuid) to anon, authenticated;
grant execute on function public.assurance_regent_browser_budget_import_decide(text,uuid,text,text) to anon, authenticated;
grant execute on function public.assurance_regent_browser_budget_import_bundle(text,text) to anon, authenticated;
