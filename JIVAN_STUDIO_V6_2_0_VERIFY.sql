-- Assurance Regent v6.2.0 verification
select jsonb_build_object(
  'schemaVersion','6.2.0',
  'ready',
    to_regclass('public.assurance_regent_jivan_studio_versions') is not null
    and to_regclass('public.assurance_regent_jivan_communication_log') is not null
    and to_regprocedure('public.assurance_regent_browser_jivan_studio_get(text)') is not null
    and to_regprocedure('public.assurance_regent_browser_jivan_studio_save(text,jsonb,text,boolean,text)') is not null
    and to_regprocedure('public.assurance_regent_browser_jivan_studio_runtime(text)') is not null
    and to_regprocedure('public.assurance_regent_browser_jivan_communication_log_append(text,text,text,text,text,text,text,text,jsonb)') is not null
    and to_regprocedure('public.assurance_regent_browser_health()') is not null
    and coalesce((public.assurance_regent_browser_health()->>'studioReady')::boolean,false)=true,
  'activeStudioVersion',(select max(version_no) from public.assurance_regent_jivan_studio_versions where status='ACTIVE'),
  'activePolicyCount',(select count(*) from public.assurance_regent_jivan_studio_versions where status='ACTIVE'),
  'communicationLogReady',to_regclass('public.assurance_regent_jivan_communication_log') is not null,
  'healthStudioReady',public.assurance_regent_browser_health()->'studioReady'
) as assurance_regent_v6_2_verification;
