-- Assurance Regent v6.3.85 follow-up — make active imported budgets/rates/rules apply across the reporting month
-- and cover the self-reference used when an older budget version is superseded.

create index if not exists ar_budget_import_superseded_by_idx
on public.assurance_regent_budget_import_batches(superseded_by)
where superseded_by is not null;

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
  v_month_start date; v_month_end date;
begin
  v_month_start:=case when p_month is null then null else date_trunc('month',p_month)::date end;
  v_month_end:=case when p_month is null then null else (date_trunc('month',p_month)+interval '1 month - 1 day')::date end;
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token); v_auth:=public.assurance_regent_browser_functional_authority(v_actor); v_company:=public.assurance_regent_browser_recovery_company(v_actor,p_company_id);
  if not public.assurance_regent_browser_recovery_can_read_finance(v_actor) then raise exception 'Finance, Auditor, Administrator, CEO or Developer authority is required for Recovery Assurance.'; end if;
  if v_auth='DEVELOPER' and v_company='' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into v_rules from public.assurance_regent_recovery_donor_rules x where p_month is null or x.effective_from is null or x.effective_from<=v_month_end;
    select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into v_evidence from public.assurance_regent_recovery_evidence_links x where p_month is null or x.reporting_month=p_month;
    select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into v_passports from public.assurance_regent_recovery_passports x where p_month is null or x.reporting_month=p_month;
    v_import_rules:='[]'::jsonb; v_active_budgets:='[]'::jsonb; v_active_rates:='[]'::jsonb; v_active_batch:='null'::jsonb;
  else
    select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into v_rules from public.assurance_regent_recovery_donor_rules x where x.company_id=v_company and (p_month is null or x.effective_from is null or x.effective_from<=v_month_end);
    select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into v_evidence from public.assurance_regent_recovery_evidence_links x where x.company_id=v_company and (p_month is null or x.reporting_month=p_month);
    select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into v_passports from public.assurance_regent_recovery_passports x where x.company_id=v_company and (p_month is null or x.reporting_month=p_month);
    select to_jsonb(b) into v_active_batch from public.assurance_regent_budget_import_batches b where b.company_id=v_company and b.status='ACTIVE' order by b.activated_at desc limit 1;
    select coalesce(jsonb_agg(to_jsonb(p) order by p.project_code),'[]'::jsonb) into v_active_budgets
      from public.assurance_regent_budget_import_projects p join public.assurance_regent_budget_import_batches b on b.id=p.batch_id
      where b.company_id=v_company and b.status='ACTIVE' and (p_month is null or ((coalesce(p.effective_from,b.effective_from) is null or coalesce(p.effective_from,b.effective_from)<=v_month_end) and (coalesce(p.effective_to,b.effective_to) is null or coalesce(p.effective_to,b.effective_to)>=v_month_start)));
    select coalesce(jsonb_agg(to_jsonb(r) order by r.employee_id,r.project_code),'[]'::jsonb) into v_active_rates
      from public.assurance_regent_budget_import_rates r join public.assurance_regent_budget_import_batches b on b.id=r.batch_id
      where b.company_id=v_company and b.status='ACTIVE' and (p_month is null or ((coalesce(r.effective_from,b.effective_from) is null or coalesce(r.effective_from,b.effective_from)<=v_month_end) and (coalesce(r.effective_to,b.effective_to) is null or coalesce(r.effective_to,b.effective_to)>=v_month_start)));
    select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('active',true,'created_at',b.activated_at) order by r.created_at),'[]'::jsonb) into v_import_rules
      from public.assurance_regent_budget_import_rules r join public.assurance_regent_budget_import_batches b on b.id=r.batch_id
      where b.company_id=v_company and b.status='ACTIVE' and (p_month is null or ((coalesce(r.effective_from,b.effective_from) is null or coalesce(r.effective_from,b.effective_from)<=v_month_end) and (coalesce(r.effective_to,b.effective_to) is null or coalesce(r.effective_to,b.effective_to)>=v_month_start)));
  end if;
  select coalesce(jsonb_agg(to_jsonb(k) order by k.created_at),'[]'::jsonb) into v_keys from public.assurance_regent_recovery_passport_keys k where k.passport_id in (select (p->>'id')::uuid from jsonb_array_elements(v_passports) p);
  select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc),'[]'::jsonb) into v_approvals from public.assurance_regent_recovery_approvals a where a.passport_id in (select (p->>'id')::uuid from jsonb_array_elements(v_passports) p);
  select coalesce(jsonb_agg(to_jsonb(j) order by j.created_at desc),'[]'::jsonb) into v_journals from public.assurance_regent_recovery_journal_batches j where (v_auth='DEVELOPER' and v_company='') or j.company_id=v_company;
  select coalesce(jsonb_agg(to_jsonb(l) order by l.line_no),'[]'::jsonb) into v_lines from public.assurance_regent_recovery_journal_lines l where l.batch_id in (select (j->>'id')::uuid from jsonb_array_elements(v_journals) j);
  select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc),'[]'::jsonb) into v_audit from (select * from public.assurance_regent_recovery_audit_events e where ((v_auth='DEVELOPER' and v_company='') or e.company_id=v_company) order by e.created_at desc limit 250) a;
  return jsonb_build_object('schemaVersion','6.3.85','authority',v_auth,'companyId',v_company,'rules',coalesce(v_rules,'[]'::jsonb)||coalesce(v_import_rules,'[]'::jsonb),'evidence',coalesce(v_evidence,'[]'::jsonb),'passports',coalesce(v_passports,'[]'::jsonb),'keys',coalesce(v_keys,'[]'::jsonb),'approvals',coalesce(v_approvals,'[]'::jsonb),'journals',coalesce(v_journals,'[]'::jsonb),'journalLines',coalesce(v_lines,'[]'::jsonb),'audit',coalesce(v_audit,'[]'::jsonb),'activeBudgetBatch',coalesce(v_active_batch,'null'::jsonb),'activeBudgets',coalesce(v_active_budgets,'[]'::jsonb),'activeRates',coalesce(v_active_rates,'[]'::jsonb));
end;
$$;
