create or replace function public.assurance_regent_browser_admin_company_master_update(
  p_token text,
  p_company_id text,
  p_name text,
  p_code text,
  p_country text,
  p_country_code text,
  p_operating_currency text default 'USD',
  p_billing_currency text default 'USD',
  p_monthly_amount numeric default 0,
  p_payment_account text default '',
  p_billing_message text default '',
  p_meet_url text default '',
  p_enabled boolean default true
) returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  v_actor jsonb;
  v_state jsonb;
  v_companies jsonb;
  v_company jsonb;
  v_idx int;
  v_name text:=trim(coalesce(p_name,''));
  v_code text:=upper(trim(coalesce(p_code,'')));
  v_country text:=trim(coalesce(p_country,''));
  v_country_code text:=upper(trim(coalesce(p_country_code,'')));
  v_operating_currency text:=upper(trim(coalesce(p_operating_currency,'')));
  v_billing_currency text:=upper(trim(coalesce(p_billing_currency,'')));
  v_meet_url text:=trim(coalesce(p_meet_url,''));
  v_history jsonb;
  v_before jsonb;
  v_country_changed boolean:=false;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  if public.assurance_regent_browser_functional_authority(v_actor)<>'DEVELOPER' then raise exception 'Developer permission is required.'; end if;
  if v_name='' then raise exception 'Company name is required.'; end if;
  if v_code='' or v_code !~ '^[A-Z0-9][A-Z0-9_-]{1,23}$' then raise exception 'Company code must contain 2 to 24 letters, numbers, hyphens or underscores.'; end if;
  if v_country='' or v_country_code !~ '^[A-Z]{2}$' then raise exception 'A valid registered country is required.'; end if;
  if v_operating_currency !~ '^[A-Z]{3,8}$' or v_billing_currency !~ '^[A-Z]{3,8}$' then raise exception 'Currency codes must contain 3 to 8 letters.'; end if;
  if coalesce(p_monthly_amount,0)<0 then raise exception 'Monthly amount cannot be negative.'; end if;
  if v_meet_url='' or v_meet_url !~* '^https://meet\.google\.com/[A-Za-z0-9_-]+(?:-[A-Za-z0-9_-]+)+/?$' then raise exception 'Enter a valid Google Meet interview room.'; end if;

  select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state' for update;
  v_companies:=coalesce(v_state#>'{auth,companies}','[]'::jsonb);
  select value,ordinality-1 into v_company,v_idx from jsonb_array_elements(v_companies) with ordinality t(value,ordinality) where value->>'id'=p_company_id limit 1;
  if v_company is null then raise exception 'Company not found.'; end if;

  if exists(select 1 from jsonb_array_elements(v_companies) x where x->>'id'<>p_company_id and upper(coalesce(x->>'code',''))=v_code) then raise exception 'That company code is already in use.'; end if;
  if exists(select 1 from jsonb_array_elements(v_companies) x where x->>'id'<>p_company_id and lower(regexp_replace(coalesce(x->>'interviewMeetUrl',''),'/+$',''))=lower(regexp_replace(v_meet_url,'/+$',''))) then raise exception 'That Google Meet room is already assigned to another company.'; end if;

  v_before:=jsonb_build_object(
    'name',v_company->>'name','code',v_company->>'code','registeredCountry',v_company->>'registeredCountry','registeredCountryCode',v_company->>'registeredCountryCode',
    'operatingCurrency',coalesce(v_company->>'operatingCurrency',v_company->>'currency'),'billingCurrency',v_company->>'billingCurrency','monthlyAmount',v_company->'monthlyAmount',
    'systemEnabled',v_company->'systemEnabled','interviewMeetUrl',v_company->>'interviewMeetUrl'
  );
  v_country_changed:=lower(coalesce(v_company->>'registeredCountryCode',''))<>lower(v_country_code) or lower(coalesce(v_company->>'registeredCountry',''))<>lower(v_country);
  v_history:=coalesce(v_company->'masterDataHistory','[]'::jsonb);
  v_history:=v_history||jsonb_build_array(jsonb_build_object(
    'changedAt',now(),'changedBy',v_actor->>'id','before',v_before,
    'after',jsonb_build_object('name',v_name,'code',v_code,'registeredCountry',v_country,'registeredCountryCode',v_country_code,'operatingCurrency',v_operating_currency,'billingCurrency',v_billing_currency,'monthlyAmount',coalesce(p_monthly_amount,0),'systemEnabled',coalesce(p_enabled,true),'interviewMeetUrl',regexp_replace(v_meet_url,'/+$','')),
    'billingDetailsChanged',coalesce(v_company->>'paymentAccount','')<>trim(coalesce(p_payment_account,'')) or coalesce(v_company->>'billingMessage','')<>trim(coalesce(p_billing_message,''))
  ));

  v_company:=v_company||jsonb_build_object(
    'name',v_name,'code',v_code,'registeredCountry',v_country,'registeredCountryCode',v_country_code,
    'operatingCurrency',v_operating_currency,'currency',v_operating_currency,'billingCurrency',v_billing_currency,
    'monthlyAmount',coalesce(p_monthly_amount,0),'paymentAccount',trim(coalesce(p_payment_account,'')),'billingMessage',trim(coalesce(p_billing_message,'')),
    'interviewMeetUrl',regexp_replace(v_meet_url,'/+$',''),'systemEnabled',coalesce(p_enabled,true),'active',coalesce(p_enabled,true),
    'masterDataHistory',v_history,'masterDataUpdatedAt',now(),'masterDataUpdatedBy',v_actor->>'id'
  );
  if v_country_changed then v_company:=v_company||jsonb_build_object('registrationUpdatedAt',now(),'registrationUpdatedBy',v_actor->>'id'); end if;

  v_companies:=jsonb_set(v_companies,array[v_idx::text],v_company,false);
  v_state:=jsonb_set(v_state,'{auth,companies}',v_companies,true);
  update public.assurance_regent_state set state_value=v_state,updated_at=now() where state_key='browser-client-state';
  return v_company;
end $function$;

revoke all on function public.assurance_regent_browser_admin_company_master_update(text,text,text,text,text,text,text,text,numeric,text,text,text,boolean) from public;
grant execute on function public.assurance_regent_browser_admin_company_master_update(text,text,text,text,text,text,text,text,numeric,text,text,text,boolean) to anon, authenticated, service_role;

create or replace function public.assurance_regent_browser_admin_company_registration(p_token text, p_company_id text, p_country text, p_country_code text default '')
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare v_actor jsonb; v_state jsonb; v_companies jsonb; v_company jsonb; v_idx int; v_history jsonb; v_old_country text; v_old_code text;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  if public.assurance_regent_browser_functional_authority(v_actor)<>'DEVELOPER' then raise exception 'Developer permission is required.'; end if;
  if trim(coalesce(p_country,''))='' or upper(trim(coalesce(p_country_code,''))) !~ '^[A-Z]{2}$' then raise exception 'Registered country is required.'; end if;
  select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state' for update;
  v_companies:=coalesce(v_state#>'{auth,companies}','[]'::jsonb);
  select value,ordinality-1 into v_company,v_idx from jsonb_array_elements(v_companies) with ordinality t(value,ordinality) where value->>'id'=p_company_id limit 1;
  if v_company is null then raise exception 'Company not found.'; end if;
  v_old_country:=coalesce(v_company->>'registeredCountry','');v_old_code:=coalesce(v_company->>'registeredCountryCode','');
  if lower(trim(v_old_country))<>lower(trim(p_country)) or upper(trim(v_old_code))<>upper(trim(p_country_code)) then
    v_history:=coalesce(v_company->'registrationHistory','[]'::jsonb)||jsonb_build_array(jsonb_build_object('changedAt',now(),'changedBy',v_actor->>'id','fromCountry',v_old_country,'fromCountryCode',v_old_code,'toCountry',trim(p_country),'toCountryCode',upper(trim(p_country_code))));
    v_company:=v_company||jsonb_build_object('registrationHistory',v_history);
  end if;
  v_company:=v_company||jsonb_build_object('registeredCountry',trim(p_country),'registeredCountryCode',upper(trim(p_country_code)),'registrationUpdatedAt',now(),'registrationUpdatedBy',v_actor->>'id');
  v_companies:=jsonb_set(v_companies,array[v_idx::text],v_company,false);v_state:=jsonb_set(v_state,'{auth,companies}',v_companies,true);
  update public.assurance_regent_state set state_value=v_state,updated_at=now() where state_key='browser-client-state';
  return v_company;
end $function$;

revoke all on function public.assurance_regent_browser_admin_company_registration(text,text,text,text) from public;
grant execute on function public.assurance_regent_browser_admin_company_registration(text,text,text,text) to anon, authenticated, service_role;
