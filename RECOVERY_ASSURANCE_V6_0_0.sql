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
