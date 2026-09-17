create or replace function public.assurance_regent_browser_update_profile(p_token text, p_name text, p_email text default ''::text, p_profile_photo text default ''::text, p_phone text default ''::text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $$
declare
  v_actor jsonb; v_uid text; v_company text; v_state jsonb; v_accounts jsonb; v_target jsonb; v_idx int; v_control jsonb; v_overrides jsonb; v_profile jsonb; v_employees jsonb;
  v_name text:=trim(coalesce(p_name,'')); v_email text:=lower(trim(coalesce(p_email,''))); v_phone text:=trim(coalesce(p_phone,'')); v_photo text:=trim(coalesce(p_profile_photo,''));
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token); v_uid:=coalesce(v_actor->>'id',''); v_company:=trim(coalesce(v_actor->>'companyId',''));
  if v_uid='' then raise exception 'No active Assurance Regent identity was found.'; end if;
  if coalesce(v_actor->>'role','Employee')<>'Developer' and v_company='' then raise exception 'Your account is not assigned to a company.'; end if;
  if v_name='' then raise exception 'Display name is required.'; end if;
  if length(v_name)>120 then raise exception 'Display name must be 120 characters or fewer.'; end if;
  if length(v_email)>254 then raise exception 'Email address is too long.'; end if;
  if v_email<>'' and v_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'Enter a valid email address.'; end if;
  if length(v_phone)>40 then raise exception 'Contact number must be 40 characters or fewer.'; end if;
  if v_photo<>'' and v_photo !~* '^data:image/(png|jpeg|jpg|webp|gif);base64,' then raise exception 'Profile picture must be a PNG, JPG, WEBP or GIF image.'; end if;
  if length(v_photo)>1000000 then raise exception 'Optimized profile picture is too large to save.'; end if;
  if v_email<>'' and exists(select 1 from public.assurance_regent_browser_credentials where lower(email)=v_email and lower(user_id)<>lower(v_uid)) then raise exception 'That email address is already registered to another account.'; end if;

  select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state' for update;
  if v_state is null then raise exception 'Assurance Regent browser state is not initialized.'; end if;
  v_profile:=jsonb_build_object('name',v_name,'email',v_email,'phone',v_phone,'contactPhone',v_phone,'profilePhoto',v_photo,'updatedAt',now(),'contactUpdatedBy',v_uid);
  v_control:=coalesce(v_state->'control','{}'::jsonb); v_overrides:=coalesce(v_control->'profileOverrides','{}'::jsonb);
  v_overrides:=jsonb_set(v_overrides,array[v_uid],coalesce(v_overrides->v_uid,'{}'::jsonb)||v_profile,true); v_control:=jsonb_set(v_control,'{profileOverrides}',v_overrides,true); v_state:=jsonb_set(v_state,'{control}',v_control,true);

  if lower(v_uid)<>'dvp' then
    v_accounts:=coalesce(v_state#>'{auth,accounts}','[]'::jsonb);
    select value,ordinality-1 into v_target,v_idx from jsonb_array_elements(v_accounts) with ordinality t(value,ordinality)
    where lower(coalesce(value->>'id',''))=lower(v_uid) and value->>'companyId'=v_company limit 1;
    if v_target is null or v_idx is null then raise exception 'This account is not present in your company application state.'; end if;
    v_target:=v_target||v_profile; v_accounts:=jsonb_set(v_accounts,array[v_idx::text],v_target,false); v_state:=jsonb_set(v_state,'{auth,accounts}',v_accounts,true);
    select coalesce(jsonb_agg(case when lower(coalesce(x->>'employeeId',x->>'id',x->>'userId',''))=lower(v_uid) and coalesce(x->>'companyId',x->>'company_id','')=v_company then x||jsonb_build_object('email',v_email,'phone',v_phone,'updatedAt',now()) else x end),'[]'::jsonb)
      into v_employees from jsonb_array_elements(coalesce(v_state#>'{live,employees}','[]'::jsonb)) x;
    v_state:=jsonb_set(v_state,'{live,employees}',v_employees,true);
  end if;
  update public.assurance_regent_browser_credentials set email=v_email,updated_at=now() where user_id=v_uid;
  update public.assurance_regent_state set state_value=v_state,updated_at=now() where state_key='browser-client-state';
  update public.assurance_regent_auth_sessions set updated_at=now(),expires_at=now()+interval '12 hours' where token_hash=encode(digest(convert_to(p_token,'UTF8'),'sha256'),'hex');
  return v_profile||jsonb_build_object('id',v_uid);
end;
$$;

create or replace function public.assurance_regent_browser_update_extended_profile(p_token text, p_name text, p_email text default ''::text, p_profile_photo text default ''::text, p_phone text default ''::text, p_address text default ''::text, p_workplace text default ''::text, p_location text default ''::text, p_headquarters text default ''::text, p_bio text default ''::text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $$
declare
  base jsonb; a jsonb; uid text; cid text; st jsonb; accounts jsonb; employees jsonb; target jsonb; idx int; eidx int; extra jsonb; control jsonb; overrides jsonb; profile jsonb;
begin
  base:=public.assurance_regent_browser_update_profile(p_token,p_name,p_email,p_profile_photo,p_phone);
  a:=public.assurance_regent_browser_actor_from_token(p_token); uid:=a->>'id'; cid:=trim(coalesce(a->>'companyId',''));
  extra:=jsonb_build_object('phone',left(trim(coalesce(p_phone,'')),80),'address',left(trim(coalesce(p_address,'')),240),'workplace',left(trim(coalesce(p_workplace,'')),160),'location',left(trim(coalesce(p_location,'')),160),'headquarters',left(trim(coalesce(p_headquarters,'')),160),'bio',left(trim(coalesce(p_bio,'')),500),'updatedAt',now());
  select state_value into st from public.assurance_regent_state where state_key='browser-client-state' for update;
  control:=coalesce(st->'control','{}'::jsonb); overrides:=coalesce(control->'profileOverrides','{}'::jsonb); profile:=coalesce(overrides->uid,'{}'::jsonb)||base||extra;
  overrides:=jsonb_set(overrides,array[uid],profile,true); control:=jsonb_set(control,'{profileOverrides}',overrides,true); st:=jsonb_set(st,'{control}',control,true);
  if lower(uid)<>'dvp' then
    accounts:=coalesce(st#>'{auth,accounts}','[]'::jsonb);
    select value,ordinality-1 into target,idx from jsonb_array_elements(accounts) with ordinality t(value,ordinality) where lower(coalesce(value->>'id',''))=lower(uid) and value->>'companyId'=cid limit 1;
    if target is not null then target:=target||extra; accounts:=jsonb_set(accounts,array[idx::text],target,false); st:=jsonb_set(st,'{auth,accounts}',accounts,true); end if;
    employees:=coalesce(st#>'{live,employees}','[]'::jsonb);
    select ordinality-1 into eidx from jsonb_array_elements(employees) with ordinality t(value,ordinality)
    where lower(coalesce(value->>'employeeId',value->>'id',''))=lower(uid) and coalesce(value->>'companyId',value->>'company_id','')=cid limit 1;
    if eidx is not null then target:=employees->eidx||extra||jsonb_build_object('profilePhoto',coalesce(base->>'profilePhoto','')); employees:=jsonb_set(employees,array[eidx::text],target,false); st:=jsonb_set(st,'{live,employees}',employees,true); end if;
  end if;
  update public.assurance_regent_state set state_value=st,updated_at=now() where state_key='browser-client-state';
  return profile||jsonb_build_object('id',uid);
end;
$$;

create or replace function public.assurance_regent_browser_admin_update_user(p_token text, p_user_id text, p_role text, p_company_id text, p_position text, p_department text, p_supervisor text, p_supervisory_role text, p_email text default null::text, p_phone text default null::text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $$
declare
  v_actor jsonb; v_state jsonb; v_accounts jsonb; v_target jsonb; v_idx int; v_auth text; v_target_auth text; v_company text:=trim(coalesce(p_company_id,'')); v_old_company text; v_requested_auth text:=lower(trim(coalesce(p_supervisory_role,''))); v_email text; v_phone text; v_control jsonb; v_overrides jsonb; v_override jsonb; v_employees jsonb;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token); v_auth:=public.assurance_regent_browser_functional_authority(v_actor);
  if v_auth not in ('DEVELOPER','CEO','ADMINISTRATOR') then raise exception 'Administrator, CEO or Developer permission is required.'; end if;
  if p_role not in ('Developer','Administrator','Employee') then raise exception 'Invalid system role.'; end if;
  select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state' for update;
  v_accounts:=coalesce(v_state#>'{auth,accounts}','[]'::jsonb);
  select value,ordinality-1 into v_target,v_idx from jsonb_array_elements(v_accounts) with ordinality t(value,ordinality) where value->>'id'=p_user_id limit 1;
  if v_target is null then raise exception 'User not found.'; end if;
  v_old_company:=trim(coalesce(v_target->>'companyId','')); v_target_auth:=public.assurance_regent_browser_functional_authority(v_target);
  if v_auth<>'DEVELOPER' then
    if v_old_company<>coalesce(v_actor->>'companyId','') then raise exception 'You may only manage users in your company.'; end if;
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
  v_email:=case when p_email is null then lower(trim(coalesce(v_target->>'email',''))) else lower(trim(p_email)) end; v_phone:=case when p_phone is null then trim(coalesce(v_target->>'phone',v_target->>'contactPhone','')) else trim(p_phone) end;
  if length(v_email)>254 then raise exception 'Email address is too long.'; end if;
  if v_email<>'' and v_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'Enter a valid email address.'; end if;
  if length(v_phone)>40 then raise exception 'Contact number must be 40 characters or fewer.'; end if;
  if p_email is not null and v_email<>'' and exists(select 1 from public.assurance_regent_browser_credentials where lower(email)=v_email and lower(user_id)<>lower(p_user_id)) then raise exception 'That email address is already registered to another account.'; end if;
  v_target:=v_target||jsonb_build_object('role',p_role,'companyId',v_company,'position',trim(coalesce(p_position,'')),'department',trim(coalesce(p_department,'')),'supervisor',trim(coalesce(p_supervisor,'')),'supervisoryRole',trim(coalesce(p_supervisory_role,'')),'email',v_email,'phone',v_phone,'contactPhone',v_phone,'hiddenFromDirectory',(p_role='Developer'),'updatedAt',now(),'updatedBy',v_actor->>'id');
  v_accounts:=jsonb_set(v_accounts,array[v_idx::text],v_target,false); v_state:=jsonb_set(v_state,'{auth,accounts}',v_accounts,true);
  v_control:=coalesce(v_state->'control','{}'::jsonb); v_overrides:=coalesce(v_control->'profileOverrides','{}'::jsonb); v_override:=coalesce(v_overrides->p_user_id,'{}'::jsonb)||jsonb_build_object('email',v_email,'phone',v_phone,'contactPhone',v_phone,'updatedAt',now(),'contactUpdatedBy',v_actor->>'id'); v_overrides:=jsonb_set(v_overrides,array[p_user_id],v_override,true); v_control:=jsonb_set(v_control,'{profileOverrides}',v_overrides,true); v_state:=jsonb_set(v_state,'{control}',v_control,true);
  select coalesce(jsonb_agg(case when lower(coalesce(x->>'employeeId',x->>'id',x->>'userId',''))=lower(p_user_id) and coalesce(x->>'companyId',x->>'company_id','')=v_old_company then x||jsonb_build_object('companyId',v_company,'email',v_email,'phone',v_phone,'updatedAt',now()) else x end),'[]'::jsonb) into v_employees from jsonb_array_elements(coalesce(v_state#>'{live,employees}','[]'::jsonb)) x;
  v_state:=jsonb_set(v_state,'{live,employees}',v_employees,true);
  if p_email is not null then update public.assurance_regent_browser_credentials set email=v_email,updated_at=now() where lower(user_id)=lower(p_user_id); end if;
  update public.assurance_regent_state set state_value=v_state,updated_at=now() where state_key='browser-client-state';
  return v_target;
end;
$$;
