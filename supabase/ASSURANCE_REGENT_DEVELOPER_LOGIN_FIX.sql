-- Assurance Regent — permanent Developer login repair
-- Safe for an existing project. This preserves non-Developer users and other control-center state.
-- Run after ASSURANCE_REGENT_EXISTING_PROJECT_UPDATE.sql if Developer login was failing.


-- ---------------------------------------------------------------------------
-- Permanent Developer bootstrap account
-- ---------------------------------------------------------------------------
-- Keeps the Developer identity in Supabase as Dvp and replaces any older
-- Developer bootstrap record without deleting Administrator/Employee users.
-- The value stored below is a salted scrypt verifier, not a plaintext password.
do $$
declare
  dev jsonb := jsonb_build_object(
    'id','Dvp',
    'username','Dvp',
    'name','Developer',
    'email','',
    'position','System Developer',
    'companyId','',
    'role','Developer',
    'profilePhoto','',
    'passwordHash','8b403a864a040c65c95f6be9862db40d:ec726b8cac7fda21c6bf5ad94d7528b586850cabf6934f43f25e6d2cfcaeb7c2c23a2c85c60d8a13e49ac4d542104855ad7efb1a8cdc23184e9e8f19eca56bb6',
    'hiddenFromDirectory',true,
    'canReview',true,
    'canManageSettings',true,
    'active',true
  );
  current_state jsonb;
  retained_users jsonb;
begin
  select state_value
    into current_state
    from public.assurance_regent_state
   where state_key='control-center'
   for update;

  if current_state is null then
    current_state := '{}'::jsonb;
  end if;

  select coalesce(jsonb_agg(u), '[]'::jsonb)
    into retained_users
    from jsonb_array_elements(
      case when jsonb_typeof(current_state->'users')='array'
           then current_state->'users'
           else '[]'::jsonb end
    ) as u
   where lower(coalesce(u->>'id','')) <> 'dvp'
     and lower(coalesce(u->>'username','')) <> 'dvp'
     and coalesce(u->>'role','') <> 'Developer';

  current_state := jsonb_set(current_state, '{users}', retained_users || jsonb_build_array(dev), true);
  current_state := jsonb_set(current_state, '{version}', '2'::jsonb, true);

  insert into public.assurance_regent_state(state_key,state_value,updated_at)
  values ('control-center', current_state, now())
  on conflict (state_key) do update
    set state_value=excluded.state_value,
        updated_at=excluded.updated_at;
end $$;
