-- Assurance Regent v6.3.17 — Governed profile persistence hotfix
-- Run ONCE in Supabase SQL Editor on an existing Assurance Regent database.
-- Fixes profile display name, email and profile picture saves for Developer,
-- Administrator and Employee accounts without exposing direct table writes.

create extension if not exists pgcrypto;

create or replace function public.assurance_regent_browser_update_profile(
  p_token text,
  p_name text,
  p_email text default '',
  p_profile_photo text default ''
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
  v_name text:=trim(coalesce(p_name,''));
  v_email text:=lower(trim(coalesce(p_email,'')));
  v_photo text:=trim(coalesce(p_profile_photo,''));
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  v_uid:=coalesce(v_actor->>'id','');

  if v_uid='' then raise exception 'No active Assurance Regent identity was found.'; end if;
  if v_name='' then raise exception 'Display name is required.'; end if;
  if length(v_name)>120 then raise exception 'Display name must be 120 characters or fewer.'; end if;
  if length(v_email)>254 then raise exception 'Email address is too long.'; end if;
  if v_email<>'' and v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid email address.';
  end if;
  if v_photo<>'' and v_photo !~* '^data:image/(png|jpeg|jpg|webp|gif);base64,' then
    raise exception 'Profile picture must be a PNG, JPG, WEBP or GIF image.';
  end if;
  if length(v_photo)>1000000 then
    raise exception 'Optimized profile picture is too large to save.';
  end if;

  if v_email<>'' and exists(
    select 1 from public.assurance_regent_browser_credentials
    where lower(email)=v_email and lower(user_id)<>lower(v_uid)
  ) then
    raise exception 'That email address is already registered to another account.';
  end if;

  select state_value into v_state
  from public.assurance_regent_state
  where state_key='browser-client-state'
  for update;

  if v_state is null then raise exception 'Assurance Regent browser state is not initialized.'; end if;

  v_profile:=jsonb_build_object(
    'name',v_name,
    'email',v_email,
    'profilePhoto',v_photo,
    'updatedAt',now()
  );

  -- Keep a governed per-user profile override. This also gives the permanent
  -- Developer identity (Dvp), which is intentionally not stored in auth.accounts,
  -- a durable profile record.
  v_control:=coalesce(v_state->'control','{}'::jsonb);
  v_overrides:=coalesce(v_control->'profileOverrides','{}'::jsonb);
  v_overrides:=jsonb_set(v_overrides,array[v_uid],v_profile,true);
  v_control:=jsonb_set(v_control,'{profileOverrides}',v_overrides,true);
  v_state:=jsonb_set(v_state,'{control}',v_control,true);

  -- For normal application accounts, keep the main account directory in sync.
  if lower(v_uid)<>'dvp' then
    v_accounts:=coalesce(v_state#>'{auth,accounts}','[]'::jsonb);
    select value, ordinality-1 into v_target,v_idx
    from jsonb_array_elements(v_accounts) with ordinality as t(value,ordinality)
    where lower(coalesce(value->>'id',''))=lower(v_uid)
    limit 1;

    if v_target is null or v_idx is null then
      raise exception 'This account is not present in Assurance Regent application state.';
    end if;

    v_target:=v_target || v_profile;
    v_accounts:=jsonb_set(v_accounts,array[v_idx::text],v_target,false);
    v_state:=jsonb_set(v_state,'{auth,accounts}',v_accounts,true);
  end if;

  update public.assurance_regent_browser_credentials
  set email=v_email,updated_at=now()
  where user_id=v_uid;

  update public.assurance_regent_state
  set state_value=v_state,updated_at=now()
  where state_key='browser-client-state';

  update public.assurance_regent_auth_sessions
  set updated_at=now(),expires_at=now()+interval '12 hours'
  where token_hash=encode(digest(convert_to(p_token,'UTF8'),'sha256'),'hex');

  return v_profile || jsonb_build_object('id',v_uid);
end $$;

revoke all on function public.assurance_regent_browser_update_profile(text,text,text,text) from public;
grant execute on function public.assurance_regent_browser_update_profile(text,text,text,text) to anon,authenticated;

notify pgrst, 'reload schema';
