-- Assurance Regent v6.3.129 — Developer registered-country change authority
-- Apply to existing Supabase projects so a Developer can change/correct a company's registered country.
-- The change is audit-tracked in registrationHistory and mirrored to country/countryCode for compatibility.

create or replace function public.assurance_regent_browser_admin_company_registration(
  p_token text, p_company_id text, p_country text, p_country_code text default ''
) returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  v_actor jsonb; v_state jsonb; v_companies jsonb; v_company jsonb; v_idx int;
  v_history jsonb; v_old_country text; v_old_code text; v_new_country text:=trim(coalesce(p_country,'')); v_new_code text:=upper(trim(coalesce(p_country_code,'')));
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  if public.assurance_regent_browser_functional_authority(v_actor)<>'DEVELOPER' then raise exception 'Developer permission is required.'; end if;
  if v_new_country='' or v_new_code !~ '^[A-Z]{2}$' then raise exception 'A valid registered country is required.'; end if;

  select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state' for update;
  v_companies:=coalesce(v_state#>'{auth,companies}','[]'::jsonb);
  select value,ordinality-1 into v_company,v_idx
  from jsonb_array_elements(v_companies) with ordinality t(value,ordinality)
  where value->>'id'=trim(p_company_id) limit 1;
  if v_company is null then raise exception 'Company not found.'; end if;

  v_old_country:=coalesce(v_company->>'registeredCountry','');
  v_old_code:=upper(coalesce(v_company->>'registeredCountryCode',''));
  if lower(trim(v_old_country))<>lower(v_new_country) or v_old_code<>v_new_code then
    v_history:=coalesce(v_company->'registrationHistory','[]'::jsonb)||jsonb_build_array(jsonb_build_object(
      'changedAt',now(),'changedBy',v_actor->>'id','source','developer-country-editor-v6.3.129',
      'fromCountry',v_old_country,'fromCountryCode',v_old_code,
      'toCountry',v_new_country,'toCountryCode',v_new_code
    ));
    v_company:=v_company||jsonb_build_object('registrationHistory',v_history);
  end if;

  v_company:=v_company||jsonb_build_object(
    'registeredCountry',v_new_country,'registeredCountryCode',v_new_code,
    'country',v_new_country,'countryCode',v_new_code,
    'registrationUpdatedAt',now(),'registrationUpdatedBy',v_actor->>'id'
  );
  v_companies:=jsonb_set(v_companies,array[v_idx::text],v_company,false);
  v_state:=jsonb_set(v_state,'{auth,companies}',v_companies,true);
  update public.assurance_regent_state set state_value=v_state,updated_at=now() where state_key='browser-client-state';
  return v_company;
end $function$;

revoke all on function public.assurance_regent_browser_admin_company_registration(text,text,text,text) from public;
grant execute on function public.assurance_regent_browser_admin_company_registration(text,text,text,text) to anon, authenticated, service_role;


-- Ensure the Developer full-profile updater used by the UI is present and supports the same country correction.
create or replace function public.assurance_regent_browser_admin_company_profile_update_v111(
  p_token text,
  p_company_id text,
  p_name text,
  p_code text,
  p_email text default '',
  p_phone text default '',
  p_country text default '',
  p_country_code text default '',
  p_meet_url text default '',
  p_logo_file_id text default null
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
  v_email text:=lower(trim(coalesce(p_email,'')));
  v_phone text:=trim(coalesce(p_phone,''));
  v_country text:=trim(coalesce(p_country,''));
  v_country_code text:=upper(trim(coalesce(p_country_code,'')));
  v_meet_url text:=regexp_replace(trim(coalesce(p_meet_url,'')),'/+$','');
  v_logo_file_id text:=case when p_logo_file_id is null then null else trim(p_logo_file_id) end;
  v_history jsonb;
  v_registration_history jsonb;
  v_country_changed boolean:=false;
  v_before jsonb;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  if public.assurance_regent_browser_functional_authority(v_actor)<>'DEVELOPER' then raise exception 'Developer permission is required.'; end if;
  if trim(coalesce(p_company_id,''))='' then raise exception 'Company ID is required.'; end if;
  if v_name='' or length(v_name)>160 then raise exception 'Company name is required and must be 160 characters or fewer.'; end if;
  if v_code='' or v_code !~ '^[A-Z0-9][A-Z0-9_-]{1,23}$' then raise exception 'Company code must contain 2 to 24 letters, numbers, hyphens or underscores.'; end if;
  if length(v_email)>254 or (v_email<>'' and v_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') then raise exception 'Enter a valid company email address.'; end if;
  if length(v_phone)>40 then raise exception 'Company contact number must be 40 characters or fewer.'; end if;
  if v_country='' or v_country_code !~ '^[A-Z]{2}$' then raise exception 'A valid registered country is required.'; end if;
  if v_meet_url<>'' and v_meet_url !~* '^https://meet\.google\.com/[A-Za-z0-9_-]+(?:-[A-Za-z0-9_-]+)+$' then raise exception 'Enter a valid Google Meet interview room.'; end if;

  select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state' for update;
  v_companies:=coalesce(v_state#>'{auth,companies}','[]'::jsonb);
  select value,ordinality-1 into v_company,v_idx from jsonb_array_elements(v_companies) with ordinality t(value,ordinality) where value->>'id'=trim(p_company_id) limit 1;
  if v_company is null then raise exception 'Company not found.'; end if;

  if exists(select 1 from jsonb_array_elements(v_companies) x where x->>'id'<>trim(p_company_id) and upper(coalesce(x->>'code',''))=v_code) then raise exception 'That company code is already in use.'; end if;
  if v_meet_url<>'' and exists(select 1 from jsonb_array_elements(v_companies) x where x->>'id'<>trim(p_company_id) and lower(regexp_replace(coalesce(x->>'interviewMeetUrl',''),'/+$',''))=lower(v_meet_url)) then raise exception 'That Google Meet room is already assigned to another company.'; end if;

  v_country_changed:=upper(coalesce(v_company->>'registeredCountryCode',''))<>v_country_code or lower(coalesce(v_company->>'registeredCountry',''))<>lower(v_country);
  v_before:=jsonb_build_object(
    'name',v_company->>'name','code',v_company->>'code','registeredCountry',v_company->>'registeredCountry','registeredCountryCode',v_company->>'registeredCountryCode','interviewMeetUrl',v_company->>'interviewMeetUrl'
  );
  v_history:=coalesce(v_company->'masterDataHistory','[]'::jsonb)||jsonb_build_array(jsonb_build_object(
    'changedAt',now(),'changedBy',v_actor->>'id','source','developer-profile-editor-v6.3.111','before',v_before,
    'after',jsonb_build_object('name',v_name,'code',v_code,'registeredCountry',v_country,'registeredCountryCode',v_country_code,'interviewMeetUrl',v_meet_url),
    'contactChanged',lower(coalesce(v_company->>'contactEmail',v_company->>'email',''))<>v_email or coalesce(v_company->>'contactPhone',v_company->>'phone','')<>v_phone,
    'logoChanged',v_logo_file_id is not null
  ));
  if v_country_changed then
    v_registration_history:=coalesce(v_company->'registrationHistory','[]'::jsonb)||jsonb_build_array(jsonb_build_object(
      'changedAt',now(),'changedBy',v_actor->>'id','fromCountry',coalesce(v_company->>'registeredCountry',''),'fromCountryCode',coalesce(v_company->>'registeredCountryCode',''),'toCountry',v_country,'toCountryCode',v_country_code
    ));
    v_company:=v_company||jsonb_build_object('registrationHistory',v_registration_history,'registrationUpdatedAt',now(),'registrationUpdatedBy',v_actor->>'id');
  end if;

  v_company:=v_company||jsonb_build_object(
    'name',v_name,'code',v_code,'contactEmail',v_email,'email',v_email,'contactPhone',v_phone,'phone',v_phone,
    'registeredCountry',v_country,'registeredCountryCode',v_country_code,'interviewMeetUrl',v_meet_url,
    'masterDataHistory',v_history,'masterDataUpdatedAt',now(),'masterDataUpdatedBy',v_actor->>'id',
    'profileUpdatedAt',now(),'profileUpdatedBy',v_actor->>'id','profileUpdatedByAuthority','DEVELOPER'
  );
  if v_logo_file_id is not null then v_company:=v_company||jsonb_build_object('logoFileId',v_logo_file_id,'companyLogoFileId',v_logo_file_id); end if;

  v_companies:=jsonb_set(v_companies,array[v_idx::text],v_company,false);
  v_state:=jsonb_set(v_state,'{auth,companies}',v_companies,true);
  update public.assurance_regent_state set state_value=v_state,updated_at=now() where state_key='browser-client-state';
  return v_company;
end $function$;

revoke all on function public.assurance_regent_browser_admin_company_profile_update_v111(text,text,text,text,text,text,text,text,text,text) from public;
grant execute on function public.assurance_regent_browser_admin_company_profile_update_v111(text,text,text,text,text,text,text,text,text,text) to anon,authenticated,service_role;
