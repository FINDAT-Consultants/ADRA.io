-- Assurance Regent v5.4.0 — Developer account governance, approvals and company access control
-- Run this AFTER the existing Assurance Regent direct-Supabase setup.
-- Existing active accounts remain approved. New self-registrations wait for Developer approval.

create extension if not exists pgcrypto;

alter table public.assurance_regent_browser_credentials
  add column if not exists approval_status text not null default 'APPROVED',
  add column if not exists approved_by text not null default '',
  add column if not exists approved_at timestamptz,
  add column if not exists status_reason text not null default '';

update public.assurance_regent_browser_credentials
set approval_status = case when active then 'APPROVED' else coalesce(nullif(approval_status,''),'SUSPENDED') end,
    approved_at = case when active then coalesce(approved_at, now()) else approved_at end
where approval_status is null or approval_status not in ('PENDING','APPROVED','REJECTED','SUSPENDED') or (active and approval_status<>'APPROVED');

alter table public.assurance_regent_browser_credentials drop constraint if exists assurance_regent_browser_credentials_approval_status_check;
alter table public.assurance_regent_browser_credentials
  add constraint assurance_regent_browser_credentials_approval_status_check
  check (approval_status in ('PENDING','APPROVED','REJECTED','SUSPENDED'));

-- Normalize existing application JSON so old installations receive the new fields safely.
do $$
declare
  v_state jsonb;
  v_accounts jsonb;
  v_companies jsonb;
begin
  select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state' for update;
  if v_state is not null then
    select coalesce(jsonb_agg(
      x || jsonb_build_object(
        'approvalStatus', coalesce(nullif(x->>'approvalStatus',''),'APPROVED'),
        'active', coalesce((x->>'active')::boolean,true)
      )
    ), '[]'::jsonb)
    into v_accounts
    from jsonb_array_elements(coalesce(v_state#>'{auth,accounts}','[]'::jsonb)) x;

    select coalesce(jsonb_agg(
      c || jsonb_build_object(
        'systemEnabled', coalesce((c->>'systemEnabled')::boolean,true),
        'monthlyAmount', coalesce((c->>'monthlyAmount')::numeric,0),
        'billingCurrency', coalesce(nullif(c->>'billingCurrency',''),'USD'),
        'paymentAccount', coalesce(c->>'paymentAccount',''),
        'billingMessage', coalesce(c->>'billingMessage','')
      )
    ), '[]'::jsonb)
    into v_companies
    from jsonb_array_elements(coalesce(v_state#>'{auth,companies}','[]'::jsonb)) c;

    v_state := jsonb_set(v_state,'{auth,accounts}',coalesce(v_accounts,'[]'::jsonb),true);
    v_state := jsonb_set(v_state,'{auth,companies}',coalesce(v_companies,'[]'::jsonb),true);
    update public.assurance_regent_state set state_value=v_state,updated_at=now() where state_key='browser-client-state';
  end if;
end $$;

-- Internal helper: validates the Assurance Regent session, user approval state and company service status.
create or replace function public.assurance_regent_browser_actor_from_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_uid text;
  v_state jsonb;
  v_user jsonb;
  v_company jsonb;
  v_cred record;
  v_amount text;
  v_currency text;
  v_payment text;
  v_message text;
begin
  select user_id into v_uid
  from public.assurance_regent_auth_sessions
  where token_hash=encode(digest(convert_to(coalesce(p_token,''),'UTF8'),'sha256'),'hex')
    and expires_at>now();

  if v_uid is null then raise exception 'Your Assurance Regent session has expired. Sign in again.'; end if;

  select * into v_cred from public.assurance_regent_browser_credentials where user_id=v_uid limit 1;
  if v_cred.user_id is null then raise exception 'This Assurance Regent account no longer exists.'; end if;
  if v_cred.approval_status='PENDING' then raise exception 'This account is awaiting Developer approval.'; end if;
  if v_cred.approval_status='REJECTED' then raise exception 'This account request was rejected by a Developer.'; end if;
  if v_cred.approval_status='SUSPENDED' or not v_cred.active then raise exception 'This account has been suspended by a Developer.'; end if;

  select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state';
  if v_uid='Dvp' then
    v_user:=jsonb_build_object('id','Dvp','username','Dvp','name','Developer','email','','position','System Developer','companyId','','role','Developer','hiddenFromDirectory',true,'active',true,'approvalStatus','APPROVED');
  else
    select value into v_user
    from jsonb_array_elements(coalesce(v_state#>'{auth,accounts}','[]'::jsonb)) as t(value)
    where value->>'id'=v_uid limit 1;
    if v_user is null then raise exception 'This account is not present in Assurance Regent application state.'; end if;
  end if;

  if coalesce(v_user->>'role','Employee')<>'Developer' then
    select value into v_company
    from jsonb_array_elements(coalesce(v_state#>'{auth,companies}','[]'::jsonb)) as t(value)
    where value->>'id'=coalesce(v_user->>'companyId','') limit 1;
    if v_company is null then raise exception 'This account is not connected to an active company directory.'; end if;
    if coalesce((v_company->>'systemEnabled')::boolean,true)=false then
      v_amount:=coalesce(v_company->>'monthlyAmount','0');
      v_currency:=coalesce(nullif(v_company->>'billingCurrency',''),'USD');
      v_payment:=trim(coalesce(v_company->>'paymentAccount',''));
      v_message:=trim(coalesce(v_company->>'billingMessage',''));
      raise exception '%', concat(
        'Company access is offline. Pay ',v_currency,' ',v_amount,
        ' and the system will be online again.',
        case when v_payment<>'' then ' Payment details: '||v_payment||'.' else '' end,
        case when v_message<>'' then ' '||v_message else '' end
      );
    end if;
  end if;

  return v_user;
end $$;

revoke all on function public.assurance_regent_browser_actor_from_token(text) from public,anon,authenticated;

create or replace function public.assurance_regent_browser_login(p_username text,p_password text,p_role text default '')
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare
  v_cred record; v_state jsonb; v_user jsonb; v_company jsonb; v_token text; v_requested text:=trim(coalesce(p_role,''));
  v_amount text; v_currency text; v_payment text; v_message text;
begin
  if trim(coalesce(p_username,''))='' or coalesce(p_password,'')='' then raise exception 'Username and password are required.'; end if;
  select * into v_cred from public.assurance_regent_browser_credentials
    where lower(username)=lower(trim(p_username)) or (email<>'' and lower(email)=lower(trim(p_username))) limit 1;
  if v_cred.user_id is null or crypt(p_password,v_cred.password_hash)<>v_cred.password_hash then raise exception 'Invalid username/email or password.'; end if;

  if v_cred.approval_status='PENDING' then raise exception 'Your account was created successfully and is awaiting Developer approval. You will be able to sign in after a Developer confirms it.'; end if;
  if v_cred.approval_status='REJECTED' then raise exception 'Your account request was rejected by a Developer. Contact your organization or Assurance Regent support.'; end if;
  if v_cred.approval_status='SUSPENDED' or not v_cred.active then raise exception 'This account has been suspended by a Developer.'; end if;

  select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state';
  if v_cred.user_id='Dvp' then
    v_user:=jsonb_build_object('id','Dvp','username','Dvp','name','Developer','email','','position','System Developer','companyId','','role','Developer','hiddenFromDirectory',true,'active',true,'approvalStatus','APPROVED');
  else
    select value into v_user from jsonb_array_elements(coalesce(v_state#>'{auth,accounts}','[]'::jsonb)) as t(value) where value->>'id'=v_cred.user_id limit 1;
    if v_user is null then raise exception 'This account is not present in Assurance Regent application state.'; end if;
    if coalesce(v_user->>'role','Employee')<> 'Developer' and v_requested<>'' and v_requested<>coalesce(v_user->>'role','Employee') then raise exception 'This account is registered as %.',coalesce(v_user->>'role','Employee'); end if;
    if coalesce(v_user->>'role','Employee')='Developer' and v_requested<>'' and v_requested<>'Developer' then raise exception 'This account is registered as Developer.'; end if;
  end if;

  if v_requested<>'' and v_requested<>coalesce(v_user->>'role','Employee') then raise exception 'This account is registered as %.',coalesce(v_user->>'role','Employee'); end if;

  if coalesce(v_user->>'role','Employee')<>'Developer' then
    select value into v_company from jsonb_array_elements(coalesce(v_state#>'{auth,companies}','[]'::jsonb)) as t(value) where value->>'id'=coalesce(v_user->>'companyId','') limit 1;
    if v_company is null then raise exception 'This account is not connected to an active company directory.'; end if;
    if coalesce((v_company->>'systemEnabled')::boolean,true)=false then
      v_amount:=coalesce(v_company->>'monthlyAmount','0'); v_currency:=coalesce(nullif(v_company->>'billingCurrency',''),'USD'); v_payment:=trim(coalesce(v_company->>'paymentAccount','')); v_message:=trim(coalesce(v_company->>'billingMessage',''));
      raise exception '%', concat('Company access is offline. Pay ',v_currency,' ',v_amount,' and the system will be online again.',case when v_payment<>'' then ' Payment details: '||v_payment||'.' else '' end,case when v_message<>'' then ' '||v_message else '' end);
    end if;
  end if;

  delete from public.assurance_regent_auth_sessions where expires_at<=now();
  v_token:=encode(gen_random_bytes(32),'hex');
  insert into public.assurance_regent_auth_sessions(token_hash,user_id,expires_at,created_at,updated_at)
    values(encode(digest(convert_to(v_token,'UTF8'),'sha256'),'hex'),v_cred.user_id,now()+interval '12 hours',now(),now());
  return jsonb_build_object('token',v_token,'userId',v_cred.user_id,'user',v_user);
end $$;

create or replace function public.assurance_regent_browser_register(p_user_id text,p_company_code text,p_name text,p_position text,p_email text,p_password text,p_role text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare
  v_state jsonb; v_accounts jsonb; v_companies jsonb; v_company jsonb; v_account jsonb; v_id text:=trim(coalesce(p_user_id,'')); v_role text:=trim(coalesce(p_role,''));
begin
  if v_id='' or trim(coalesce(p_company_code,''))='' or trim(coalesce(p_name,''))='' or trim(coalesce(p_position,''))='' then raise exception 'User ID, company code, name and position are required.'; end if;
  if length(coalesce(p_password,''))<8 then raise exception 'Password must contain at least 8 characters.'; end if;
  if v_role not in ('Administrator','Employee') then raise exception 'Choose Administrator or Employee registration.'; end if;

  select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state' for update;
  v_accounts:=coalesce(v_state#>'{auth,accounts}','[]'::jsonb); v_companies:=coalesce(v_state#>'{auth,companies}','[]'::jsonb);
  if exists(select 1 from jsonb_array_elements(v_accounts) x where lower(coalesce(x->>'id',''))=lower(v_id) or lower(coalesce(x->>'username',''))=lower(v_id)) then raise exception 'That username is already registered.'; end if;
  if exists(select 1 from public.assurance_regent_browser_credentials where lower(username)=lower(v_id)) then raise exception 'That username is already registered.'; end if;
  if trim(coalesce(p_email,''))<>'' and exists(select 1 from public.assurance_regent_browser_credentials where lower(email)=lower(trim(p_email))) then raise exception 'That email address is already registered.'; end if;

  select value into v_company from jsonb_array_elements(v_companies) as t(value) where lower(coalesce(value->>'code',''))=lower(trim(p_company_code)) limit 1;
  if v_company is null then raise exception 'A valid Developer-created company code is required.'; end if;
  if v_role='Administrator' and p_position !~* '(country director|chief executive officer|ceo|country partner|managing director)' then raise exception 'Administrator registration requires a leadership position.'; end if;

  v_account:=jsonb_build_object(
    'id',v_id,'username',v_id,'name',trim(p_name),'email',trim(coalesce(p_email,'')),'position',trim(p_position),
    'companyId',v_company->>'id','role',v_role,'profilePhoto','','hiddenFromDirectory',false,'active',false,
    'approvalStatus','PENDING','createdAt',now(),'requestedAt',now()
  );
  v_state:=jsonb_set(v_state,'{auth,accounts}',v_accounts||jsonb_build_array(v_account),true);
  update public.assurance_regent_state set state_value=v_state,updated_at=now() where state_key='browser-client-state';

  insert into public.assurance_regent_browser_credentials(user_id,username,email,password_hash,active,approval_status,approved_by,approved_at,status_reason,updated_at)
  values(v_id,v_id,trim(coalesce(p_email,'')),crypt(p_password,gen_salt('bf',12)),false,'PENDING','',null,'Awaiting Developer approval',now());

  return jsonb_build_object(
    'pendingApproval',true,
    'user',v_account,
    'message','Account created successfully. A Developer must approve this account before you can sign in.'
  );
end $$;

-- Developer-created accounts are treated as already confirmed by the creating Developer.
create or replace function public.assurance_regent_browser_admin_upsert_user(p_token text,p_user_id text,p_company_id text,p_name text,p_position text,p_email text,p_password text,p_role text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare
  v_actor jsonb; v_actor_id text; v_state jsonb; v_accounts jsonb; v_account jsonb; v_id text:=trim(coalesce(p_user_id,'')); v_idx int; v_company_id text:=trim(coalesce(p_company_id,''));
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token); v_actor_id:=v_actor->>'id';
  if coalesce(v_actor->>'role','')<>'Developer' then raise exception 'Developer permission is required.'; end if;
  if v_id='' or trim(coalesce(p_name,''))='' or trim(coalesce(p_position,''))='' or length(coalesce(p_password,''))<8 then raise exception 'Username, name, position and an 8-character password are required.'; end if;
  if p_role not in ('Developer','Administrator','Employee') then raise exception 'Choose Developer, Administrator or Employee.'; end if;
  if p_role<>'Developer' and v_company_id='' then raise exception 'Select a company for Administrator or Employee accounts.'; end if;

  select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state' for update;
  if p_role<>'Developer' and not exists(select 1 from jsonb_array_elements(coalesce(v_state#>'{auth,companies}','[]'::jsonb)) c where c->>'id'=v_company_id) then raise exception 'Select a valid Developer-created company.'; end if;
  if p_role='Developer' then v_company_id:=''; end if;

  v_account:=jsonb_build_object(
    'id',v_id,'username',v_id,'name',trim(p_name),'email',trim(coalesce(p_email,'')),'position',trim(p_position),
    'companyId',v_company_id,'role',p_role,'profilePhoto','','hiddenFromDirectory',(p_role='Developer'),'active',true,
    'approvalStatus','APPROVED','createdAt',now(),'createdBy',v_actor_id,'approvedAt',now(),'approvedBy',v_actor_id
  );
  v_accounts:=coalesce(v_state#>'{auth,accounts}','[]'::jsonb);
  select ordinality-1 into v_idx from jsonb_array_elements(v_accounts) with ordinality as t(value,ordinality) where lower(coalesce(value->>'id',''))=lower(v_id) limit 1;
  if v_idx is null then v_accounts:=v_accounts||jsonb_build_array(v_account); else v_account:=coalesce(v_accounts->v_idx,'{}'::jsonb)||v_account; v_accounts:=jsonb_set(v_accounts,array[v_idx::text],v_account,false); end if;
  v_state:=jsonb_set(v_state,'{auth,accounts}',v_accounts,true);
  update public.assurance_regent_state set state_value=v_state,updated_at=now() where state_key='browser-client-state';

  insert into public.assurance_regent_browser_credentials(user_id,username,email,password_hash,active,approval_status,approved_by,approved_at,status_reason,updated_at)
  values(v_id,v_id,trim(coalesce(p_email,'')),crypt(p_password,gen_salt('bf',12)),true,'APPROVED',v_actor_id,now(),'',now())
  on conflict(user_id) do update set username=excluded.username,email=excluded.email,password_hash=excluded.password_hash,active=true,approval_status='APPROVED',approved_by=v_actor_id,approved_at=now(),status_reason='',updated_at=now();
  return v_account;
end $$;

create or replace function public.assurance_regent_browser_admin_account_status(p_token text,p_user_id text,p_action text,p_reason text default '')
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare
  v_actor jsonb; v_actor_id text; v_state jsonb; v_accounts jsonb; v_target jsonb; v_idx int; v_action text:=upper(trim(coalesce(p_action,''))); v_active boolean; v_status text;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token); v_actor_id:=v_actor->>'id';
  if coalesce(v_actor->>'role','')<>'Developer' then raise exception 'Developer permission is required.'; end if;
  if lower(trim(coalesce(p_user_id,'')))='dvp' and v_action in ('REJECT','SUSPEND') then raise exception 'The permanent Developer account cannot be rejected or suspended.'; end if;
  if v_action not in ('APPROVE','REJECT','SUSPEND','ACTIVATE') then raise exception 'Unsupported account action.'; end if;

  select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state' for update;
  v_accounts:=coalesce(v_state#>'{auth,accounts}','[]'::jsonb);
  select value,ordinality-1 into v_target,v_idx from jsonb_array_elements(v_accounts) with ordinality as t(value,ordinality) where lower(coalesce(value->>'id',''))=lower(trim(p_user_id)) limit 1;
  if v_target is null then raise exception 'Account not found.'; end if;

  if v_action in ('APPROVE','ACTIVATE') then v_status:='APPROVED'; v_active:=true; else v_status:=case when v_action='REJECT' then 'REJECTED' else 'SUSPENDED' end; v_active:=false; end if;
  v_target:=v_target || jsonb_build_object('approvalStatus',v_status,'active',v_active,'statusReason',trim(coalesce(p_reason,'')),'statusUpdatedAt',now(),'statusUpdatedBy',v_actor_id);
  if v_status='APPROVED' then v_target:=v_target||jsonb_build_object('approvedAt',now(),'approvedBy',v_actor_id); end if;
  v_accounts:=jsonb_set(v_accounts,array[v_idx::text],v_target,false);
  v_state:=jsonb_set(v_state,'{auth,accounts}',v_accounts,true);
  update public.assurance_regent_state set state_value=v_state,updated_at=now() where state_key='browser-client-state';

  update public.assurance_regent_browser_credentials
  set active=v_active,approval_status=v_status,approved_by=case when v_status='APPROVED' then v_actor_id else approved_by end,
      approved_at=case when v_status='APPROVED' then now() else approved_at end,status_reason=trim(coalesce(p_reason,'')),updated_at=now()
  where lower(user_id)=lower(trim(p_user_id));
  if not found then raise exception 'Account credential not found.'; end if;
  if not v_active then delete from public.assurance_regent_auth_sessions where lower(user_id)=lower(trim(p_user_id)); end if;
  return v_target;
end $$;

create or replace function public.assurance_regent_browser_admin_set_password(p_token text,p_user_id text,p_new_password text)
returns boolean language plpgsql security definer set search_path=public,extensions as $$
declare v_actor jsonb;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  if coalesce(v_actor->>'role','')<>'Developer' then raise exception 'Developer permission is required.'; end if;
  if lower(trim(coalesce(p_user_id,'')))='dvp' and lower(coalesce(v_actor->>'id',''))<>'dvp' then raise exception 'Only the permanent Developer may change the permanent Developer password.'; end if;
  if length(coalesce(p_new_password,''))<8 then raise exception 'Password must contain at least 8 characters.'; end if;
  update public.assurance_regent_browser_credentials set password_hash=crypt(p_new_password,gen_salt('bf',12)),updated_at=now() where lower(user_id)=lower(trim(p_user_id));
  if not found then raise exception 'Account not found.'; end if;
  delete from public.assurance_regent_auth_sessions where lower(user_id)=lower(trim(p_user_id)) and lower(user_id)<>lower(coalesce(v_actor->>'id',''));
  return true;
end $$;

create or replace function public.assurance_regent_browser_admin_update_user(
  p_token text,p_user_id text,p_role text,p_company_id text,p_position text,p_department text,p_supervisor text,p_supervisory_role text
)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare
  v_actor jsonb; v_state jsonb; v_accounts jsonb; v_target jsonb; v_idx int; v_actor_role text; v_company text:=trim(coalesce(p_company_id,''));
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token); v_actor_role:=coalesce(v_actor->>'role','');
  if v_actor_role not in ('Developer','Administrator') then raise exception 'Administrator permission is required.'; end if;
  if p_role not in ('Developer','Administrator','Employee') then raise exception 'Invalid system role.'; end if;

  select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state' for update;
  v_accounts:=coalesce(v_state#>'{auth,accounts}','[]'::jsonb);
  select value,ordinality-1 into v_target,v_idx from jsonb_array_elements(v_accounts) with ordinality as t(value,ordinality) where value->>'id'=p_user_id limit 1;
  if v_target is null then raise exception 'User not found.'; end if;

  if v_actor_role='Administrator' then
    if coalesce(v_target->>'companyId','')<>coalesce(v_actor->>'companyId','') then raise exception 'Administrators may only manage users in their company.'; end if;
    if coalesce(v_target->>'role','')='Developer' or p_role='Developer' then raise exception 'Only Developers may assign or change Developer authority.'; end if;
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

create or replace function public.assurance_regent_browser_admin_delete_user(p_token text,p_user_id text)
returns boolean language plpgsql security definer set search_path=public,extensions as $$
declare v_actor jsonb; v_state jsonb; v_accounts jsonb;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  if coalesce(v_actor->>'role','')<>'Developer' then raise exception 'Developer permission is required.'; end if;
  if lower(trim(coalesce(p_user_id,'')))='dvp' then raise exception 'The permanent Developer account cannot be deleted.'; end if;
  if lower(trim(coalesce(p_user_id,'')))=lower(coalesce(v_actor->>'id','')) then raise exception 'You cannot delete the Developer account currently in use.'; end if;
  select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state' for update;
  select coalesce(jsonb_agg(x),'[]'::jsonb) into v_accounts from jsonb_array_elements(coalesce(v_state#>'{auth,accounts}','[]'::jsonb)) x where lower(coalesce(x->>'id',''))<>lower(trim(p_user_id));
  v_state:=jsonb_set(v_state,'{auth,accounts}',v_accounts,true);
  update public.assurance_regent_state set state_value=v_state,updated_at=now() where state_key='browser-client-state';
  delete from public.assurance_regent_browser_credentials where lower(user_id)=lower(trim(p_user_id));
  delete from public.assurance_regent_auth_sessions where lower(user_id)=lower(trim(p_user_id));
  return true;
end $$;

create or replace function public.assurance_regent_browser_admin_company_access(
  p_token text,p_company_id text,p_enabled boolean,p_monthly_amount numeric default 0,p_currency text default 'USD',p_payment_account text default '',p_billing_message text default ''
)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare
  v_actor jsonb; v_state jsonb; v_companies jsonb; v_company jsonb; v_idx int; v_member_ids text[];
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  if coalesce(v_actor->>'role','')<>'Developer' then raise exception 'Developer permission is required.'; end if;
  if p_monthly_amount<0 then raise exception 'Monthly amount cannot be negative.'; end if;

  select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state' for update;
  v_companies:=coalesce(v_state#>'{auth,companies}','[]'::jsonb);
  select value,ordinality-1 into v_company,v_idx from jsonb_array_elements(v_companies) with ordinality as t(value,ordinality) where value->>'id'=p_company_id limit 1;
  if v_company is null then raise exception 'Company not found.'; end if;

  v_company:=v_company || jsonb_build_object(
    'systemEnabled',coalesce(p_enabled,true),'active',coalesce(p_enabled,true),'monthlyAmount',coalesce(p_monthly_amount,0),
    'billingCurrency',upper(trim(coalesce(p_currency,'USD'))),'paymentAccount',trim(coalesce(p_payment_account,'')),
    'billingMessage',trim(coalesce(p_billing_message,'')),'serviceUpdatedAt',now(),'serviceUpdatedBy',v_actor->>'id'
  );
  v_companies:=jsonb_set(v_companies,array[v_idx::text],v_company,false);
  v_state:=jsonb_set(v_state,'{auth,companies}',v_companies,true);
  update public.assurance_regent_state set state_value=v_state,updated_at=now() where state_key='browser-client-state';

  -- Existing sessions remain present only so the next governed request can show the configured billing message.
  -- read/write/agent RPCs below all re-check company service status before doing work.
  return v_company;
end $$;

create or replace function public.assurance_regent_browser_read_state(p_token text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_actor jsonb; v_value jsonb;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  update public.assurance_regent_auth_sessions set updated_at=now(),expires_at=now()+interval '12 hours' where token_hash=encode(digest(convert_to(p_token,'UTF8'),'sha256'),'hex');
  select state_value into v_value from public.assurance_regent_state where state_key='browser-client-state';
  return coalesce(v_value,'{}'::jsonb);
end $$;

create or replace function public.assurance_regent_browser_write_state(p_token text,p_value jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_actor jsonb; v_role text; v_current jsonb; v_next jsonb:=p_value;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token); v_role:=coalesce(v_actor->>'role','Employee');
  if p_value is null or jsonb_typeof(p_value)<>'object' then raise exception 'Invalid Assurance Regent state.'; end if;
  select state_value into v_current from public.assurance_regent_state where state_key='browser-client-state' for update;
  -- Only Developers may replace authentication/company directory state. Administrators use scoped account RPCs.
  if v_role<>'Developer' then v_next:=jsonb_set(v_next,'{auth}',coalesce(v_current->'auth',jsonb_build_object('accounts','[]'::jsonb,'companies','[]'::jsonb)),true); end if;
  insert into public.assurance_regent_state(state_key,state_value,updated_at) values('browser-client-state',v_next,now()) on conflict(state_key) do update set state_value=excluded.state_value,updated_at=excluded.updated_at;
  update public.assurance_regent_auth_sessions set updated_at=now(),expires_at=now()+interval '12 hours' where token_hash=encode(digest(convert_to(p_token,'UTF8'),'sha256'),'hex');
  return v_next;
end $$;

create or replace function public.assurance_regent_browser_session_status(p_token text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_actor jsonb;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  return jsonb_build_object('ok',true,'userId',v_actor->>'id','role',v_actor->>'role','companyId',coalesce(v_actor->>'companyId',''));
end $$;

create or replace function public.assurance_regent_browser_agent_context(p_token text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_actor jsonb; v_state jsonb;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  update public.assurance_regent_auth_sessions set updated_at=now(),expires_at=now()+interval '12 hours' where token_hash=encode(digest(convert_to(p_token,'UTF8'),'sha256'),'hex');
  select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state';
  return jsonb_build_object('actor',v_actor,'state',coalesce(v_state,'{}'::jsonb),'schemaVersion','5.4.0');
end $$;

create or replace function public.assurance_regent_browser_agent_thread(p_token text,p_limit integer default 80)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_actor jsonb; v_uid text; v_rows jsonb; v_limit integer:=greatest(1,least(coalesce(p_limit,80),150));
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token); v_uid:=v_actor->>'id';
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at asc),'[]'::jsonb) into v_rows from (
    select id,role,content,source,metadata,created_at from public.assurance_regent_agent_messages where user_id=v_uid order by created_at desc limit v_limit
  ) x;
  return coalesce(v_rows,'[]'::jsonb);
end $$;

create or replace function public.assurance_regent_browser_agent_append(p_token text,p_role text,p_content text,p_source text default 'conversation',p_metadata jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_actor jsonb; v_uid text; v_row public.assurance_regent_agent_messages%rowtype;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token); v_uid:=v_actor->>'id';
  if p_role not in ('user','assistant') then raise exception 'Invalid Recovery Agent role.'; end if;
  if length(trim(coalesce(p_content,'')))=0 then raise exception 'Recovery Agent message cannot be empty.'; end if;
  if length(p_content)>20000 then raise exception 'Recovery Agent message is too long.'; end if;
  insert into public.assurance_regent_agent_messages(user_id,role,content,source,metadata)
  values(v_uid,p_role,trim(p_content),coalesce(nullif(trim(p_source),''),'conversation'),coalesce(p_metadata,'{}'::jsonb)) returning * into v_row;
  return to_jsonb(v_row);
end $$;

create or replace function public.assurance_regent_browser_agent_clear(p_token text)
returns integer language plpgsql security definer set search_path=public,extensions as $$
declare v_actor jsonb; v_uid text; v_count integer;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token); v_uid:=v_actor->>'id';
  delete from public.assurance_regent_agent_messages where user_id=v_uid; get diagnostics v_count = row_count; return v_count;
end $$;

create or replace function public.assurance_regent_browser_health()
returns jsonb language sql security definer set search_path=public as $$
  select jsonb_build_object(
    'ok', true,
    'schemaVersion', '5.4.0',
    'developerReady', exists(select 1 from public.assurance_regent_browser_credentials where user_id='Dvp' and active=true and approval_status='APPROVED'),
    'stateReady', exists(select 1 from public.assurance_regent_state where state_key='browser-client-state'),
    'governanceReady', exists(select 1 from information_schema.columns where table_schema='public' and table_name='assurance_regent_browser_credentials' and column_name='approval_status'),
    'updatedAt', coalesce((select updated_at from public.assurance_regent_state where state_key='browser-client-state'), now())
  );
$$;

-- Explicit function exposure. Internal helper stays private.
revoke all on function public.assurance_regent_browser_login(text,text,text) from public;
revoke all on function public.assurance_regent_browser_register(text,text,text,text,text,text,text) from public;
revoke all on function public.assurance_regent_browser_admin_upsert_user(text,text,text,text,text,text,text,text) from public;
revoke all on function public.assurance_regent_browser_admin_account_status(text,text,text,text) from public;
revoke all on function public.assurance_regent_browser_admin_set_password(text,text,text) from public;
revoke all on function public.assurance_regent_browser_admin_update_user(text,text,text,text,text,text,text,text) from public;
revoke all on function public.assurance_regent_browser_admin_delete_user(text,text) from public;
revoke all on function public.assurance_regent_browser_admin_company_access(text,text,boolean,numeric,text,text,text) from public;
revoke all on function public.assurance_regent_browser_read_state(text) from public;
revoke all on function public.assurance_regent_browser_write_state(text,jsonb) from public;
revoke all on function public.assurance_regent_browser_session_status(text) from public;
revoke all on function public.assurance_regent_browser_agent_context(text) from public;
revoke all on function public.assurance_regent_browser_agent_thread(text,integer) from public;
revoke all on function public.assurance_regent_browser_agent_append(text,text,text,text,jsonb) from public;
revoke all on function public.assurance_regent_browser_agent_clear(text) from public;
revoke all on function public.assurance_regent_browser_health() from public;

grant execute on function public.assurance_regent_browser_login(text,text,text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_register(text,text,text,text,text,text,text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_admin_upsert_user(text,text,text,text,text,text,text,text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_admin_account_status(text,text,text,text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_admin_set_password(text,text,text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_admin_update_user(text,text,text,text,text,text,text,text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_admin_delete_user(text,text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_admin_company_access(text,text,boolean,numeric,text,text,text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_read_state(text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_write_state(text,jsonb) to anon,authenticated;
grant execute on function public.assurance_regent_browser_session_status(text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_agent_context(text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_agent_thread(text,integer) to anon,authenticated;
grant execute on function public.assurance_regent_browser_agent_append(text,text,text,text,jsonb) to anon,authenticated;
grant execute on function public.assurance_regent_browser_agent_clear(text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_health() to anon,authenticated;

notify pgrst, 'reload schema';
