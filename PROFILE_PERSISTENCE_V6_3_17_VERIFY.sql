-- Assurance Regent v6.3.17 profile persistence verification
select
  to_regprocedure('public.assurance_regent_browser_update_profile(text,text,text,text)') is not null as profile_update_rpc_ready,
  exists(select 1 from public.assurance_regent_state where state_key='browser-client-state') as browser_state_ready,
  exists(select 1 from public.assurance_regent_browser_credentials where user_id='Dvp') as developer_credential_ready;
