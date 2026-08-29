-- Assurance Regent v6.3.39 — Developer + company CEO administrator elevation.
-- Developers can elevate eligible users system-wide. Executive Administrators can elevate
-- eligible Employee accounts only within their own company. Every elevation is audited.

create or replace function public.assurance_regent_browser_developer_make_admin(p_token text, p_user_id text)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_actor jsonb;
  v_state jsonb;
  v_accounts jsonb;
  v_target jsonb;
  v_idx int;
  v_company text;
  v_actor_company text;
  v_status text;
  v_active text;
  v_previous_role text;
  v_actor_role text;
  v_actor_auth text;
  v_actor_text text;
  v_is_developer boolean:=false;
  v_is_company_ceo boolean:=false;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  v_actor_role:=coalesce(v_actor->>'role','Employee');
  v_actor_auth:=public.assurance_regent_browser_functional_authority(v_actor);
  v_actor_text:=lower(concat_ws(' ',coalesce(v_actor->>'supervisoryRole',''),coalesce(v_actor->>'position',''),coalesce(v_actor->>'department','')));
  v_actor_company:=trim(coalesce(v_actor->>'companyId',''));
  v_is_developer:=(v_actor_role='Developer');
  v_is_company_ceo:=(v_actor_role='Administrator' and (v_actor_auth='CEO' or v_actor_text ~ '(^|[^a-z])(chief executive officer|ceo|country director|managing director|country partner)([^a-z]|$)'));

  if not v_is_developer and not v_is_company_ceo then
    raise exception 'Developer or company CEO permission is required.';
  end if;
  if trim(coalesce(p_user_id,''))='' then raise exception 'Select a user first.'; end if;

  select state_value into v_state
  from public.assurance_regent_state
  where state_key='browser-client-state'
  for update;

  v_accounts:=coalesce(v_state#>'{auth,accounts}','[]'::jsonb);
  select value, ordinality-1 into v_target,v_idx
  from jsonb_array_elements(v_accounts) with ordinality as t(value,ordinality)
  where value->>'id'=trim(p_user_id)
  limit 1;

  if v_target is null then raise exception 'User not found.'; end if;
  if lower(coalesce(v_target->>'id',''))='dvp' or coalesce(v_target->>'role','')='Developer' then
    raise exception 'Developer accounts cannot be converted to Administrator.';
  end if;

  v_status:=upper(coalesce(nullif(v_target->>'approvalStatus',''),'APPROVED'));
  v_active:=lower(coalesce(nullif(v_target->>'active',''),'true'));
  if v_status<>'APPROVED' or v_active in ('false','0','no','off') then
    raise exception 'Only active approved users can be made Administrator.';
  end if;

  v_company:=trim(coalesce(v_target->>'companyId',''));
  if v_company='' then raise exception 'The selected user is not assigned to a company.'; end if;
  if not exists(select 1 from jsonb_array_elements(coalesce(v_state#>'{auth,companies}','[]'::jsonb)) c where c->>'id'=v_company) then
    raise exception 'The selected user is not assigned to a valid company.';
  end if;
  if v_is_company_ceo and v_company<>v_actor_company then
    raise exception 'A company CEO may only make users Administrator inside their own company.';
  end if;

  v_previous_role:=coalesce(v_target->>'role','Employee');
  if v_previous_role='Administrator' then
    return jsonb_build_object('ok',true,'id',v_target->>'id','name',coalesce(v_target->>'name',v_target->>'id'),'role','Administrator','companyId',v_company,'alreadyAdministrator',true,'grantedBy',case when v_is_developer then 'Developer' else 'Company CEO' end);
  end if;
  if v_previous_role<>'Employee' then raise exception 'Only Employee accounts can be promoted to Administrator.'; end if;

  v_target:=v_target || jsonb_build_object('role','Administrator','companyId',v_company,'hiddenFromDirectory',false,'updatedAt',now(),'updatedBy',v_actor->>'id');
  v_accounts:=jsonb_set(v_accounts,array[v_idx::text],v_target,false);
  v_state:=jsonb_set(v_state,'{auth,accounts}',v_accounts,true);
  update public.assurance_regent_state set state_value=v_state,updated_at=now() where state_key='browser-client-state';

  insert into public.assurance_regent_data_controls_audit(actor_id,action,table_name,record_key,change_set)
  values(v_actor->>'id','MAKE_ADMINISTRATOR','browser-client-state',jsonb_build_object('user_id',v_target->>'id'),jsonb_build_object('previous_role',v_previous_role,'new_role','Administrator','company_id',v_company,'grant_scope',case when v_is_developer then 'SYSTEM' else 'OWN_COMPANY' end));

  return jsonb_build_object('ok',true,'id',v_target->>'id','name',coalesce(v_target->>'name',v_target->>'id'),'role','Administrator','companyId',v_company,'alreadyAdministrator',false,'grantedBy',case when v_is_developer then 'Developer' else 'Company CEO' end);
end $$;

revoke all on function public.assurance_regent_browser_developer_make_admin(text,text) from public;
grant execute on function public.assurance_regent_browser_developer_make_admin(text,text) to anon,authenticated;
