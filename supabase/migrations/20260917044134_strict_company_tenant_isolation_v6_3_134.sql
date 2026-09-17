create or replace function public.assurance_regent_browser_scope_array(p_array jsonb, p_company_id text)
returns jsonb
language sql
immutable
as $$
  select coalesce(jsonb_agg(x.value order by x.ord),'[]'::jsonb)
  from jsonb_array_elements(case when jsonb_typeof(p_array)='array' then p_array else '[]'::jsonb end) with ordinality as x(value,ord)
  where jsonb_typeof(x.value)='object'
    and coalesce(nullif(trim(x.value->>'companyId'),''),nullif(trim(x.value->>'company_id'),''),'') = trim(coalesce(p_company_id,''));
$$;

create or replace function public.assurance_regent_browser_prepare_company_array(p_array jsonb, p_company_id text)
returns jsonb
language plpgsql
immutable
as $$
declare v_item jsonb; v_result jsonb:='[]'::jsonb; v_existing text; v_company text:=trim(coalesce(p_company_id,''));
begin
  if v_company='' then raise exception 'Company scope is required.'; end if;
  if jsonb_typeof(p_array)<>'array' then return '[]'::jsonb; end if;
  for v_item in select value from jsonb_array_elements(p_array) x(value) loop
    if jsonb_typeof(v_item)<>'object' then continue; end if;
    v_existing:=coalesce(nullif(trim(v_item->>'companyId'),''),nullif(trim(v_item->>'company_id'),''),'');
    if v_existing<>'' and v_existing<>v_company then
      raise exception 'Cross-company data write is not permitted.';
    end if;
    v_item:=jsonb_set(v_item,'{companyId}',to_jsonb(v_company),true)-'company_id';
    v_result:=v_result||jsonb_build_array(v_item);
  end loop;
  return v_result;
end;
$$;

create or replace function public.assurance_regent_browser_merge_company_array(p_current jsonb, p_incoming jsonb, p_company_id text)
returns jsonb
language plpgsql
immutable
as $$
declare v_other jsonb; v_ours jsonb;
begin
  select coalesce(jsonb_agg(x.value order by x.ord),'[]'::jsonb) into v_other
  from jsonb_array_elements(case when jsonb_typeof(p_current)='array' then p_current else '[]'::jsonb end) with ordinality x(value,ord)
  where jsonb_typeof(x.value)<>'object'
     or coalesce(nullif(trim(x.value->>'companyId'),''),nullif(trim(x.value->>'company_id'),''),'')<>trim(coalesce(p_company_id,''));
  v_ours:=public.assurance_regent_browser_prepare_company_array(p_incoming,p_company_id);
  return coalesce(v_other,'[]'::jsonb)||coalesce(v_ours,'[]'::jsonb);
end;
$$;

create or replace function public.assurance_regent_browser_scope_state(p_state jsonb, p_actor jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $$
declare
  v_out jsonb:=coalesce(p_state,'{}'::jsonb);
  v_company text:=trim(coalesce(p_actor->>'companyId',''));
  v_role text:=coalesce(p_actor->>'role','Employee');
  v_company_obj jsonb:='{}'::jsonb;
  v_accounts jsonb:='[]'::jsonb;
  v_companies jsonb:='[]'::jsonb;
  v_profiles jsonb:='{}'::jsonb;
  v_settings jsonb:='{}'::jsonb;
  v_path text;
begin
  if v_role='Developer' then return v_out; end if;
  if v_company='' then raise exception 'Your account is not assigned to a company.'; end if;

  select coalesce(jsonb_agg(a.value order by a.ord),'[]'::jsonb) into v_accounts
  from jsonb_array_elements(coalesce(v_out#>'{auth,accounts}','[]'::jsonb)) with ordinality a(value,ord)
  where a.value->>'companyId'=v_company;

  select coalesce(jsonb_agg(c.value order by c.ord),'[]'::jsonb) into v_companies
  from jsonb_array_elements(coalesce(v_out#>'{auth,companies}','[]'::jsonb)) with ordinality c(value,ord)
  where c.value->>'id'=v_company;
  v_company_obj:=coalesce(v_companies->0,'{}'::jsonb);

  v_out:=jsonb_set(v_out,'{auth,accounts}',v_accounts,true);
  v_out:=jsonb_set(v_out,'{auth,companies}',v_companies,true);

  select coalesce(jsonb_object_agg(e.key,e.value),'{}'::jsonb) into v_profiles
  from jsonb_each(coalesce(v_out#>'{control,profileOverrides}','{}'::jsonb)) e
  where exists(select 1 from jsonb_array_elements(v_accounts) a where a->>'id'=e.key);
  v_out:=jsonb_set(v_out,'{control,profileOverrides}',v_profiles,true);

  v_settings:=coalesce(v_out#>array['control','companySettings',v_company],'{}'::jsonb);
  if v_settings='{}'::jsonb then
    v_settings:=jsonb_build_object(
      'country',coalesce(v_company_obj->>'registeredCountry',''),
      'countryCode',coalesce(v_company_obj->>'registeredCountryCode',''),
      'currency',coalesce(nullif(v_company_obj->>'currency',''),nullif(v_company_obj->>'billingCurrency',''),''),
      'currencyName',coalesce(nullif(v_company_obj->>'currencyName',''),nullif(v_company_obj->>'billingCurrencyName',''),''),
      'defaultHourlyRate',50,
      'employeeHourlyRates','{}'::jsonb,
      'projectHourlyRates','{}'::jsonb
    );
  end if;
  v_out:=jsonb_set(v_out,'{control,settings}',v_settings,true);
  v_out:=jsonb_set(v_out,'{control,reviewResolutions}',coalesce(v_out#>array['control','companyReviewResolutions',v_company],'{}'::jsonb),true);
  v_out:=jsonb_set(v_out,'{control}',(v_out->'control')-'companySettings'-'companyReviewResolutions',true);

  foreach v_path in array array['documents','messages','notifications','reviews','tasks'] loop
    v_out:=jsonb_set(v_out,array['control',v_path],public.assurance_regent_browser_scope_array(v_out#>array['control',v_path],v_company),true);
  end loop;
  foreach v_path in array array['calendar','candidates','employees','onboarding','payroll','projects','sourceChecks','sources','timeEntries','vacancies'] loop
    v_out:=jsonb_set(v_out,array['live',v_path],public.assurance_regent_browser_scope_array(v_out#>array['live',v_path],v_company),true);
  end loop;
  foreach v_path in array array['messages','sessions'] loop
    v_out:=jsonb_set(v_out,array['mts',v_path],public.assurance_regent_browser_scope_array(v_out#>array['mts',v_path],v_company),true);
  end loop;
  v_out:=jsonb_set(v_out,'{mappings}',public.assurance_regent_browser_scope_array(v_out->'mappings',v_company),true);
  return v_out;
end;
$$;

update public.assurance_regent_state s
set state_value = jsonb_set(
  s.state_value,
  '{control,companySettings}',
  coalesce((
    select jsonb_object_agg(c.value->>'id',
      case
        when coalesce(s.state_value#>>'{control,settings,countryCode}','')<>''
         and coalesce(c.value->>'registeredCountryCode','')=s.state_value#>>'{control,settings,countryCode}'
        then coalesce(s.state_value#>'{control,settings}','{}'::jsonb)
        else jsonb_build_object(
          'country',coalesce(c.value->>'registeredCountry',''),
          'countryCode',coalesce(c.value->>'registeredCountryCode',''),
          'currency',coalesce(nullif(c.value->>'currency',''),nullif(c.value->>'billingCurrency',''),''),
          'currencyName',coalesce(nullif(c.value->>'currencyName',''),nullif(c.value->>'billingCurrencyName',''),''),
          'defaultHourlyRate',50,
          'employeeHourlyRates','{}'::jsonb,
          'projectHourlyRates','{}'::jsonb
        )
      end)
    from jsonb_array_elements(coalesce(s.state_value#>'{auth,companies}','[]'::jsonb)) c(value)
    where coalesce(c.value->>'id','')<>''
  ),'{}'::jsonb),true)
where s.state_key='browser-client-state';

update public.assurance_regent_state s
set state_value=jsonb_set(
  s.state_value,
  '{control,companyReviewResolutions}',
  jsonb_build_object(
    'COMP-607c0900-ea46-4972-8a87-13dbb76700e3',coalesce(s.state_value#>'{control,reviewResolutions}','{}'::jsonb)
  ),true)
where s.state_key='browser-client-state'
  and not (coalesce(s.state_value#>'{control,companyReviewResolutions}','{}'::jsonb) ? 'COMP-607c0900-ea46-4972-8a87-13dbb76700e3');

update public.assurance_regent_state s
set state_value=jsonb_set(s.state_value,'{live,employees}',(
  select coalesce(jsonb_agg(case when e.value->>'companyId'='COMPANY-DEFAULT' then jsonb_set(e.value,'{companyId}',to_jsonb('COMP-607c0900-ea46-4972-8a87-13dbb76700e3'::text),true) else e.value end order by e.ord),'[]'::jsonb)
  from jsonb_array_elements(coalesce(s.state_value#>'{live,employees}','[]'::jsonb)) with ordinality e(value,ord)
),true)
where s.state_key='browser-client-state';

create or replace function public.assurance_regent_browser_read_state(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $$
declare v_actor jsonb; v_value jsonb;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  update public.assurance_regent_auth_sessions set updated_at=now(),expires_at=now()+interval '12 hours' where token_hash=encode(digest(convert_to(p_token,'UTF8'),'sha256'),'hex');
  select state_value into v_value from public.assurance_regent_state where state_key='browser-client-state';
  v_value:=public.assurance_regent_browser_scope_state(coalesce(v_value,'{}'::jsonb),v_actor);
  if jsonb_typeof(v_value#>'{live,onboarding}')='array' then
    v_value:=jsonb_set(v_value,'{live,onboarding}',coalesce((select jsonb_agg(x.value) from jsonb_array_elements(v_value#>'{live,onboarding}') x(value) where lower(trim(coalesce(x.value->>'status','')))<> 'complete'),'[]'::jsonb),true);
  end if;
  return v_value;
end;
$$;

create or replace function public.assurance_regent_browser_employee_for_actor(p_actor jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $$
declare v_state jsonb; v_employee jsonb; v_id text:=lower(trim(coalesce(p_actor->>'id',''))); v_email text:=lower(trim(coalesce(p_actor->>'email',''))); v_name text:=lower(trim(coalesce(p_actor->>'name',''))); v_company text:=trim(coalesce(p_actor->>'companyId',''));
begin
  select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state';
  select value into v_employee from jsonb_array_elements(coalesce(v_state#>'{live,employees}','[]'::jsonb)) t(value)
  where coalesce(nullif(trim(value->>'companyId'),''),nullif(trim(value->>'company_id'),''),'')=v_company
    and ((v_id<>'' and lower(trim(coalesce(value->>'employeeId',value->>'employee_id','')))=v_id)
      or (v_email<>'' and lower(trim(coalesce(value->>'email','')))=v_email)
      or (v_name<>'' and lower(trim(coalesce(value->>'name',value->>'employee_name','')))=v_name))
  limit 1;
  return coalesce(v_employee,jsonb_build_object('employeeId',coalesce(p_actor->>'id',''),'name',coalesce(p_actor->>'name',''),'companyId',v_company));
end;
$$;

create or replace function public.assurance_regent_browser_agent_context(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $$
declare v_actor jsonb; v_state jsonb; v_leave jsonb; v_auth text; v_company text; v_recovery jsonb:='{}'::jsonb;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token); v_auth:=public.assurance_regent_browser_functional_authority(v_actor); v_company:=coalesce(v_actor->>'companyId','');
  update public.assurance_regent_auth_sessions set updated_at=now(),expires_at=now()+interval '12 hours' where token_hash=encode(digest(convert_to(p_token,'UTF8'),'sha256'),'hex');
  select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state';
  v_state:=public.assurance_regent_browser_scope_state(coalesce(v_state,'{}'::jsonb),v_actor);
  begin v_leave:=public.assurance_regent_browser_leave_bundle(p_token); exception when others then v_leave:='{}'::jsonb; end;
  if v_auth in ('DEVELOPER','CEO','ADMINISTRATOR','FINANCE_MANAGER','AUDITOR') then
    select jsonb_build_object('passportCount',count(*),'recoverableCount',count(*) filter(where final_status='RECOVERABLE'),'blockedCount',count(*) filter(where final_status='BLOCKED'),'amountAtRisk',coalesce(sum(amount_at_risk),0),'recoverableCost',coalesce(sum(recoverable_cost),0)) into v_recovery
    from public.assurance_regent_recovery_passports p where v_auth='DEVELOPER' or p.company_id=v_company;
  end if;
  return jsonb_build_object('actor',v_actor,'authority',v_auth,'state',coalesce(v_state,'{}'::jsonb)||jsonb_build_object('leaveModule',v_leave,'recoveryAssurance',coalesce(v_recovery,'{}'::jsonb)),'schemaVersion','6.3.134');
end;
$$;

create or replace function public.assurance_regent_browser_write_state(p_token text, p_value jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $$
declare
  v_actor jsonb; v_role text; v_company text; v_current jsonb; v_next jsonb; v_in jsonb:=p_value; v_path text; v_onboarding jsonb:='[]'::jsonb; v_item jsonb;
  v_company_settings jsonb; v_company_reviews jsonb; v_profile_all jsonb; v_profile_in jsonb; v_company_account_ids text[];
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token); v_role:=coalesce(v_actor->>'role','Employee'); v_company:=trim(coalesce(v_actor->>'companyId',''));
  if p_value is null or jsonb_typeof(p_value)<>'object' then raise exception 'Invalid Assurance Regent state.'; end if;
  select state_value into v_current from public.assurance_regent_state where state_key='browser-client-state' for update;
  v_current:=coalesce(v_current,'{}'::jsonb);

  if v_role='Developer' then
    v_next:=p_value;
  else
    if v_company='' then raise exception 'Your account is not assigned to a company.'; end if;
    v_next:=v_current;
    v_next:=jsonb_set(v_next,'{version}',coalesce(v_in->'version',v_current->'version','1'::jsonb),true);
    v_next:=jsonb_set(v_next,'{updatedAt}',to_jsonb(now()::text),true);

    foreach v_path in array array['documents','messages','notifications','reviews','tasks'] loop
      v_next:=jsonb_set(v_next,array['control',v_path],public.assurance_regent_browser_merge_company_array(v_current#>array['control',v_path],v_in#>array['control',v_path],v_company),true);
    end loop;
    foreach v_path in array array['calendar','candidates','employees','onboarding','payroll','projects','sourceChecks','sources','timeEntries','vacancies'] loop
      v_next:=jsonb_set(v_next,array['live',v_path],public.assurance_regent_browser_merge_company_array(v_current#>array['live',v_path],v_in#>array['live',v_path],v_company),true);
    end loop;
    foreach v_path in array array['messages','sessions'] loop
      v_next:=jsonb_set(v_next,array['mts',v_path],public.assurance_regent_browser_merge_company_array(v_current#>array['mts',v_path],v_in#>array['mts',v_path],v_company),true);
    end loop;
    v_next:=jsonb_set(v_next,'{mappings}',public.assurance_regent_browser_merge_company_array(v_current->'mappings',v_in->'mappings',v_company),true);

    v_company_settings:=coalesce(v_current#>'{control,companySettings}','{}'::jsonb);
    v_company_settings:=jsonb_set(v_company_settings,array[v_company],coalesce(v_in#>'{control,settings}','{}'::jsonb),true);
    v_next:=jsonb_set(v_next,'{control,companySettings}',v_company_settings,true);

    v_company_reviews:=coalesce(v_current#>'{control,companyReviewResolutions}','{}'::jsonb);
    v_company_reviews:=jsonb_set(v_company_reviews,array[v_company],coalesce(v_in#>'{control,reviewResolutions}','{}'::jsonb),true);
    v_next:=jsonb_set(v_next,'{control,companyReviewResolutions}',v_company_reviews,true);

    select coalesce(array_agg(a->>'id'),array[]::text[]) into v_company_account_ids from jsonb_array_elements(coalesce(v_current#>'{auth,accounts}','[]'::jsonb)) a where a->>'companyId'=v_company;
    v_profile_all:=coalesce(v_current#>'{control,profileOverrides}','{}'::jsonb);
    select coalesce(jsonb_object_agg(e.key,e.value),'{}'::jsonb) into v_profile_all from jsonb_each(v_profile_all) e where not (e.key=any(v_company_account_ids));
    select coalesce(jsonb_object_agg(e.key,e.value),'{}'::jsonb) into v_profile_in from jsonb_each(coalesce(v_in#>'{control,profileOverrides}','{}'::jsonb)) e where e.key=any(v_company_account_ids);
    v_next:=jsonb_set(v_next,'{control,profileOverrides}',coalesce(v_profile_all,'{}'::jsonb)||coalesce(v_profile_in,'{}'::jsonb),true);
  end if;

  if jsonb_typeof(v_next#>'{live,onboarding}')='array' then v_onboarding:=v_next#>'{live,onboarding}'; end if;
  for v_item in select value from jsonb_array_elements(v_onboarding) x(value) loop
    if lower(trim(coalesce(v_item->>'status','')))='complete' and coalesce(trim(v_item->>'id'),'')<>'' then
      insert into public.assurance_regent_onboarding_history(company_id,onboarding_id,candidate_id,employee_id,employee_name,status,payload)
      values(coalesce(nullif(trim(v_item->>'companyId'),''),v_company,''),trim(v_item->>'id'),coalesce(v_item->>'candidateId',''),coalesce(v_item->>'employeeId',''),coalesce(v_item->>'name',''),coalesce(v_item->>'status','Complete'),v_item)
      on conflict(company_id,onboarding_id) do update set candidate_id=excluded.candidate_id,employee_id=excluded.employee_id,employee_name=excluded.employee_name,status=excluded.status,payload=excluded.payload,last_archived_at=now();
    end if;
  end loop;
  if jsonb_typeof(v_next->'live')='object' then
    v_next:=jsonb_set(v_next,'{live,onboarding}',coalesce((select jsonb_agg(x.value) from jsonb_array_elements(v_onboarding) x(value) where lower(trim(coalesce(x.value->>'status','')))<> 'complete'),'[]'::jsonb),true);
  end if;

  insert into public.assurance_regent_state(state_key,state_value,updated_at) values('browser-client-state',v_next,now())
  on conflict(state_key) do update set state_value=excluded.state_value,updated_at=excluded.updated_at;
  update public.assurance_regent_auth_sessions set updated_at=now(),expires_at=now()+interval '12 hours' where token_hash=encode(digest(convert_to(p_token,'UTF8'),'sha256'),'hex');
  return public.assurance_regent_browser_scope_state(v_next,v_actor);
end;
$$;
