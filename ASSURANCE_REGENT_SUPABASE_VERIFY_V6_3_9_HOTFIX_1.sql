-- Assurance Regent v6.3.9 HOTFIX 1 verification
-- Non-mutating except for no-op reads.

select public.assurance_regent_browser_health() as browser_health;
select public.assurance_regent_browser_voice_access_health() as voice_access_health;

select jsonb_build_object(
  'credentials', to_regclass('public.assurance_regent_browser_credentials') is not null,
  'state', to_regclass('public.assurance_regent_state') is not null,
  'sessions', to_regclass('public.assurance_regent_auth_sessions') is not null,
  'agentMessages', to_regclass('public.assurance_regent_agent_messages') is not null,
  'leavePolicies', to_regclass('public.assurance_regent_leave_policies') is not null,
  'backgroundTasks', to_regclass('public.assurance_regent_agent_tasks') is not null,
  'recoveryPassports', to_regclass('public.assurance_regent_recovery_passports') is not null,
  'systemIncidents', to_regclass('public.assurance_regent_system_incidents') is not null,
  'rateLimitBuckets', to_regclass('public.assurance_regent_rate_limit_buckets') is not null,
  'jivanStudioVersions', to_regclass('public.assurance_regent_jivan_studio_versions') is not null,
  'voiceProfiles', to_regclass('public.assurance_regent_voice_profiles') is not null,
  'voiceChallenges', to_regclass('public.assurance_regent_voice_challenges') is not null,
  'voiceAudit', to_regclass('public.assurance_regent_voice_access_audit') is not null,
  'voiceBucket', exists(select 1 from storage.buckets where id='assurance-regent-voiceprints')
) as required_objects;

select jsonb_build_object(
  'signInGateReady',
    coalesce((public.assurance_regent_browser_health()->>'ok')::boolean,false)
    and coalesce((public.assurance_regent_browser_health()->>'developerReady')::boolean,false)
    and coalesce((public.assurance_regent_browser_health()->>'stateReady')::boolean,false)
    and coalesce((public.assurance_regent_browser_health()->>'governanceReady')::boolean,false)
    and coalesce((public.assurance_regent_browser_health()->>'scalabilityReady')::boolean,false)
    and coalesce((public.assurance_regent_browser_health()->>'studioReady')::boolean,false),
  'schemaVersion', public.assurance_regent_browser_health()->>'schemaVersion'
) as frontend_gate;
