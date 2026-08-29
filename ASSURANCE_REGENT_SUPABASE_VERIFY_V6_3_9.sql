-- Assurance Regent v6.3.9 complete verification
-- Non-mutating checks. Run after ASSURANCE_REGENT_SUPABASE_SETUP_V6_3_9.sql.

select public.assurance_regent_browser_health() as browser_health;
select public.assurance_regent_browser_voice_access_health() as voice_access_health;

select jsonb_build_object(
  'credentials', to_regclass('public.assurance_regent_browser_credentials') is not null,
  'state', to_regclass('public.assurance_regent_state') is not null,
  'sessions', to_regclass('public.assurance_regent_auth_sessions') is not null,
  'agentMessages', to_regclass('public.assurance_regent_agent_messages') is not null,
  'voiceProfiles', to_regclass('public.assurance_regent_voice_profiles') is not null,
  'voiceChallenges', to_regclass('public.assurance_regent_voice_challenges') is not null,
  'voiceAudit', to_regclass('public.assurance_regent_voice_access_audit') is not null,
  'voiceBucket', exists(select 1 from storage.buckets where id='assurance-regent-voiceprints')
) as required_objects;

select user_id, username, email, active, approval_status, approved_by, approved_at, status_reason, updated_at
from public.assurance_regent_browser_credentials
order by lower(username);

select
  jsonb_array_length(coalesce(state_value#>'{auth,accounts}','[]'::jsonb)) as account_count,
  jsonb_array_length(coalesce(state_value#>'{auth,companies}','[]'::jsonb)) as company_count,
  updated_at
from public.assurance_regent_state
where state_key='browser-client-state';

select user_id, sample_count, active, enrolled_at, last_verified_at, failed_attempts, updated_at
from public.assurance_regent_voice_profiles
order by updated_at desc;

select event_type, user_id, success, score, created_at
from public.assurance_regent_voice_access_audit
order by id desc
limit 20;
