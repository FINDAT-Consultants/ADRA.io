-- Assurance Regent v6.3.38 — Developer-only administrator elevation.
-- Keeps existing company/organizational metadata intact and records the privileged role change.

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
  v_status text;
  v_active text;
  v_previous_role text;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  if coalesce(v_actor->>'role','')<>'Developer' then
    raise exception 'Developer permission is required.';
  end if;
  if trim(coalesce(p_user_id,''))='' then
    raise exception 'Select a user first.';
  end if;

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

  v_previous_role:=coalesce(v_target->>'role','Employee');
  if v_previous_role='Administrator' then
    return jsonb_build_object('ok',true,'id',v_target->>'id','name',coalesce(v_target->>'name',v_target->>'id'),'role','Administrator','companyId',v_company,'alreadyAdministrator',true);
  end if;

  v_target:=v_target || jsonb_build_object(
    'role','Administrator',
    'companyId',v_company,
    'hiddenFromDirectory',false,
    'updatedAt',now(),
    'updatedBy',v_actor->>'id'
  );
  v_accounts:=jsonb_set(v_accounts,array[v_idx::text],v_target,false);
  v_state:=jsonb_set(v_state,'{auth,accounts}',v_accounts,true);
  update public.assurance_regent_state set state_value=v_state,updated_at=now() where state_key='browser-client-state';

  insert into public.assurance_regent_data_controls_audit(actor_id,action,table_name,record_key,change_set)
  values(v_actor->>'id','MAKE_ADMINISTRATOR','browser-client-state',jsonb_build_object('user_id',v_target->>'id'),jsonb_build_object('previous_role',v_previous_role,'new_role','Administrator','company_id',v_company));

  return jsonb_build_object('ok',true,'id',v_target->>'id','name',coalesce(v_target->>'name',v_target->>'id'),'role','Administrator','companyId',v_company,'alreadyAdministrator',false);
end $$;

revoke all on function public.assurance_regent_browser_developer_make_admin(text,text) from public;
grant execute on function public.assurance_regent_browser_developer_make_admin(text,text) to anon,authenticated;
