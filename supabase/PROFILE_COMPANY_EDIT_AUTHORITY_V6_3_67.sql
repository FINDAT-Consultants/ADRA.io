-- Assurance Regent v6.3.67 — governed company/profile completion and correction
-- Owners may maintain their own contact profile; Administrators/CEO may maintain
-- company-scoped directory contacts; Developers may correct company profiles system-wide.

begin;

-- Replace the existing self-profile RPC with a backwards-compatible phone-aware signature.
drop function if exists public.assurance_regent_browser_update_profile(text,text,text,text);
create or replace function public.assurance_regent_browser_update_profile(
  p_token text,
  p_name text,
  p_email text default '',
  p_profile_photo text default '',
  p_phone text default ''
)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_actor jsonb;
  v_uid text;
  v_state jsonb;
  v_accounts jsonb;
  v_target jsonb;
  v_idx int;
  v_control jsonb;
  v_overrides jsonb;
  v_profile jsonb;
  v_employees jsonb;
  v_name text:=trim(coalesce(p_name,''));
  v_email text:=lower(trim(coalesce(p_email,'')));
  v_phone text:=trim(coalesce(p_phone,''));
  v_photo text:=trim(coalesce(p_profile_photo,''));
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  v_uid:=coalesce(v_actor->>'id','');

  if v_uid='' then raise exception 'No active Assurance Regent identity was found.'; end if;
  if v_name='' then raise exception 'Display name is required.'; end if;
  if length(v_name)>120 then raise exception 'Display name must be 120 characters or fewer.'; end if;
  if length(v_email)>254 then raise exception 'Email address is too long.'; end if;
  if v_email<>'' and v_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'Enter a valid email address.'; end if;
  if length(v_phone)>40 then raise exception 'Contact number must be 40 characters or fewer.'; end if;
  if v_photo<>'' and v_photo !~* '^data:image/(png|jpeg|jpg|webp|gif);base64,' then raise exception 'Profile picture must be a PNG, JPG, WEBP or GIF image.'; end if;
  if length(v_photo)>1000000 then raise exception 'Optimized profile picture is too large to save.'; end if;

  if v_email<>'' and exists(
    select 1 from public.assurance_regent_browser_credentials
    where lower(email)=v_email and lower(user_id)<>lower(v_uid)
  ) then raise exception 'That email address is already registered to another account.'; end if;

  select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state' for update;
  if v_state is null then raise exception 'Assurance Regent browser state is not initialized.'; end if;

  v_profile:=jsonb_build_object(
    'name',v_name,'email',v_email,'phone',v_phone,'contactPhone',v_phone,
    'profilePhoto',v_photo,'updatedAt',now(),'contactUpdatedBy',v_uid
  );

  v_control:=coalesce(v_state->'control','{}'::jsonb);
  v_overrides:=coalesce(v_control->'profileOverrides','{}'::jsonb);
  v_overrides:=jsonb_set(v_overrides,array[v_uid],coalesce(v_overrides->v_uid,'{}'::jsonb)||v_profile,true);
  v_control:=jsonb_set(v_control,'{profileOverrides}',v_overrides,true);
  v_state:=jsonb_set(v_state,'{control}',v_control,true);

  if lower(v_uid)<>'dvp' then
    v_accounts:=coalesce(v_state#>'{auth,accounts}','[]'::jsonb);
    select value,ordinality-1 into v_target,v_idx
    from jsonb_array_elements(v_accounts) with ordinality as t(value,ordinality)
    where lower(coalesce(value->>'id',''))=lower(v_uid) limit 1;
    if v_target is null or v_idx is null then raise exception 'This account is not present in Assurance Regent application state.'; end if;
    v_target:=v_target||v_profile;
    v_accounts:=jsonb_set(v_accounts,array[v_idx::text],v_target,false);
    v_state:=jsonb_set(v_state,'{auth,accounts}',v_accounts,true);

    -- Keep the live people directory aligned when the employee row uses the account identifier.
    select coalesce(jsonb_agg(
      case when lower(coalesce(x->>'employeeId',x->>'id',x->>'userId',''))=lower(v_uid)
        then x||jsonb_build_object('email',v_email,'phone',v_phone,'updatedAt',now()) else x end
    ),'[]'::jsonb) into v_employees
    from jsonb_array_elements(coalesce(v_state#>'{live,employees}','[]'::jsonb)) x;
    v_state:=jsonb_set(v_state,'{live,employees}',v_employees,true);
  end if;

  update public.assurance_regent_browser_credentials set email=v_email,updated_at=now() where user_id=v_uid;
  update public.assurance_regent_state set state_value=v_state,updated_at=now() where state_key='browser-client-state';
  update public.assurance_regent_auth_sessions set updated_at=now(),expires_at=now()+interval '12 hours'
  where token_hash=encode(digest(convert_to(p_token,'UTF8'),'sha256'),'hex');

  return v_profile||jsonb_build_object('id',v_uid);
end $$;

-- Extend the existing governed Access & Roles update with work email/contact number.
-- The existing 8-argument callers remain valid because the two contact parameters default to NULL.
drop function if exists public.assurance_regent_browser_admin_update_user(text,text,text,text,text,text,text,text);
create or replace function public.assurance_regent_browser_admin_update_user(
  p_token text,
  p_user_id text,
  p_role text,
  p_company_id text,
  p_position text,
  p_department text,
  p_supervisor text,
  p_supervisory_role text,
  p_email text default null,
  p_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_actor jsonb; v_state jsonb; v_accounts jsonb; v_target jsonb; v_idx int;
  v_auth text; v_target_auth text; v_company text:=trim(coalesce(p_company_id,''));
  v_requested_auth text:=lower(trim(coalesce(p_supervisory_role,'')));
  v_email text; v_phone text; v_control jsonb; v_overrides jsonb; v_override jsonb; v_employees jsonb;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  v_auth:=public.assurance_regent_browser_functional_authority(v_actor);
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
    if v_auth='ADMINISTRATOR' and v_target_auth in ('CEO','HR_MANAGER','FINANCE_MANAGER','PROJECT_MANAGER','PROGRAMS_MANAGER','AUDITOR') then raise exception 'Administrators cannot override CEO, Auditor or senior departmental authority. CEO or Developer approval is required.'; end if;
    if v_requested_auth like '%chief executive officer%' or v_requested_auth='ceo' then raise exception 'Only a Developer may assign CEO authority.'; end if;
    if v_auth='ADMINISTRATOR' and v_requested_auth in ('human resources manager','finance manager','project manager','programs manager','programs director','auditor / internal audit','auditor','internal audit','internal auditor') then raise exception 'Senior functional authority can only be assigned by the CEO or Developer.'; end if;
    v_company:=coalesce(v_actor->>'companyId','');
  else
    if lower(p_user_id)='dvp' and p_role<>'Developer' then raise exception 'The permanent Developer account must remain Developer.'; end if;
    if p_role='Developer' then v_company:=''; end if;
    if p_role<>'Developer' then
      if v_company='' then raise exception 'Select a company before assigning Administrator or Employee authority.'; end if;
      if not exists(select 1 from jsonb_array_elements(coalesce(v_state#>'{auth,companies}','[]'::jsonb)) c where c->>'id'=v_company) then raise exception 'Select a valid company.'; end if;
    end if;
  end if;

  v_email:=case when p_email is null then lower(trim(coalesce(v_target->>'email',''))) else lower(trim(p_email)) end;
  v_phone:=case when p_phone is null then trim(coalesce(v_target->>'phone',v_target->>'contactPhone','')) else trim(p_phone) end;
  if length(v_email)>254 then raise exception 'Email address is too long.'; end if;
  if v_email<>'' and v_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'Enter a valid email address.'; end if;
  if length(v_phone)>40 then raise exception 'Contact number must be 40 characters or fewer.'; end if;
  if p_email is not null and v_email<>'' and exists(
    select 1 from public.assurance_regent_browser_credentials where lower(email)=v_email and lower(user_id)<>lower(p_user_id)
  ) then raise exception 'That email address is already registered to another account.'; end if;

  v_target:=v_target||jsonb_build_object(
    'role',p_role,'companyId',v_company,'position',trim(coalesce(p_position,'')),'department',trim(coalesce(p_department,'')),
    'supervisor',trim(coalesce(p_supervisor,'')),'supervisoryRole',trim(coalesce(p_supervisory_role,'')),
    'email',v_email,'phone',v_phone,'contactPhone',v_phone,
    'hiddenFromDirectory',(p_role='Developer'),'updatedAt',now(),'updatedBy',v_actor->>'id'
  );
  v_accounts:=jsonb_set(v_accounts,array[v_idx::text],v_target,false);
  v_state:=jsonb_set(v_state,'{auth,accounts}',v_accounts,true);

  v_control:=coalesce(v_state->'control','{}'::jsonb);
  v_overrides:=coalesce(v_control->'profileOverrides','{}'::jsonb);
  v_override:=coalesce(v_overrides->p_user_id,'{}'::jsonb)||jsonb_build_object('email',v_email,'phone',v_phone,'contactPhone',v_phone,'updatedAt',now(),'contactUpdatedBy',v_actor->>'id');
  v_overrides:=jsonb_set(v_overrides,array[p_user_id],v_override,true);
  v_control:=jsonb_set(v_control,'{profileOverrides}',v_overrides,true);
  v_state:=jsonb_set(v_state,'{control}',v_control,true);

  select coalesce(jsonb_agg(
    case when lower(coalesce(x->>'employeeId',x->>'id',x->>'userId',''))=lower(p_user_id)
      then x||jsonb_build_object('email',v_email,'phone',v_phone,'updatedAt',now()) else x end
  ),'[]'::jsonb) into v_employees from jsonb_array_elements(coalesce(v_state#>'{live,employees}','[]'::jsonb)) x;
  v_state:=jsonb_set(v_state,'{live,employees}',v_employees,true);

  if p_email is not null then update public.assurance_regent_browser_credentials set email=v_email,updated_at=now() where lower(user_id)=lower(p_user_id); end if;
  update public.assurance_regent_state set state_value=v_state,updated_at=now() where state_key='browser-client-state';
  return v_target;
end $$;

-- Company identity/contact maintenance. Developer may update any company; CEO/Administrator
-- may update only their own company. Registration country, company code, service/billing and
-- interview-room controls are intentionally outside this RPC.
create or replace function public.assurance_regent_browser_company_profile_update(
  p_token text,
  p_company_id text,
  p_name text,
  p_email text default '',
  p_phone text default '',
  p_logo_file_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_actor jsonb; v_auth text; v_state jsonb; v_companies jsonb; v_company jsonb; v_idx int;
  v_company_id text:=trim(coalesce(p_company_id,''));
  v_name text:=trim(coalesce(p_name,'')); v_email text:=lower(trim(coalesce(p_email,''))); v_phone text:=trim(coalesce(p_phone,''));
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  v_auth:=public.assurance_regent_browser_functional_authority(v_actor);
  if v_auth not in ('DEVELOPER','CEO','ADMINISTRATOR') then raise exception 'Administrator, CEO or Developer permission is required to edit the company profile.'; end if;
  if v_auth<>'DEVELOPER' and coalesce(v_actor->>'companyId','')<>v_company_id then raise exception 'You may only edit your own company profile.'; end if;
  if v_name='' then raise exception 'Company name is required.'; end if;
  if length(v_name)>160 then raise exception 'Company name must be 160 characters or fewer.'; end if;
  if length(v_email)>254 then raise exception 'Company email address is too long.'; end if;
  if v_email<>'' and v_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'Enter a valid company email address.'; end if;
  if length(v_phone)>40 then raise exception 'Company contact number must be 40 characters or fewer.'; end if;

  select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state' for update;
  v_companies:=coalesce(v_state#>'{auth,companies}','[]'::jsonb);
  select value,ordinality-1 into v_company,v_idx from jsonb_array_elements(v_companies) with ordinality as t(value,ordinality) where value->>'id'=v_company_id limit 1;
  if v_company is null then raise exception 'Company not found.'; end if;

  v_company:=v_company||jsonb_build_object(
    'name',v_name,'contactEmail',v_email,'email',v_email,'contactPhone',v_phone,'phone',v_phone,
    'profileUpdatedAt',now(),'profileUpdatedBy',coalesce(v_actor->>'id',''),'profileUpdatedByAuthority',v_auth
  );
  if p_logo_file_id is not null then
    v_company:=v_company||jsonb_build_object('logoFileId',trim(p_logo_file_id),'companyLogoFileId',trim(p_logo_file_id));
  end if;
  v_companies:=jsonb_set(v_companies,array[v_idx::text],v_company,false);
  v_state:=jsonb_set(v_state,'{auth,companies}',v_companies,true);
  update public.assurance_regent_state set state_value=v_state,updated_at=now() where state_key='browser-client-state';
  return v_company;
end $$;

grant execute on function public.assurance_regent_browser_update_profile(text,text,text,text,text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_admin_update_user(text,text,text,text,text,text,text,text,text,text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_company_profile_update(text,text,text,text,text,text) to anon,authenticated;

commit;
