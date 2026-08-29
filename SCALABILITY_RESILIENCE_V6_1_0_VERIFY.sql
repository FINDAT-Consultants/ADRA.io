-- Assurance Regent v6.1.0 verification
with checks as (
  select jsonb_build_object(
    'schemaVersion','6.1.0',
    'ready',
      to_regclass('public.assurance_regent_system_incidents') is not null
      and to_regclass('public.assurance_regent_rate_limit_buckets') is not null
      and to_regprocedure('public.assurance_regent_browser_scalability_health(text,text)') is not null
      and to_regprocedure('public.assurance_regent_browser_system_recover(text,text,text)') is not null
      and to_regprocedure('public.assurance_regent_browser_rate_limit_take(text,text,integer,integer)') is not null,
    'incidentRegister',to_regclass('public.assurance_regent_system_incidents') is not null,
    'trafficManagement',to_regclass('public.assurance_regent_rate_limit_buckets') is not null,
    'healthRpc',to_regprocedure('public.assurance_regent_browser_scalability_health(text,text)') is not null,
    'safeRecoveryRpc',to_regprocedure('public.assurance_regent_browser_system_recover(text,text,text)') is not null,
    'rateLimitRpc',to_regprocedure('public.assurance_regent_browser_rate_limit_take(text,text,integer,integer)') is not null,
    'agentTaskQueueIndex',to_regclass('public.ar_agent_tasks_queue_idx') is not null,
    'sessionExpiryIndex',to_regclass('public.ar_auth_sessions_expiry_idx') is not null,
    'leaveTrafficIndex',to_regclass('public.ar_leave_company_status_created_idx') is not null,
    'recoveryApprovalIndex',to_regclass('public.ar_recovery_approvals_passport_stage_created_idx') is not null
  ) result
)
select result from checks;
