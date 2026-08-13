select jsonb_build_object(
  'schemaVersion','5.8.0',
  'leaveRequestsTable',to_regclass('public.assurance_regent_leave_requests') is not null,
  'workStatusTable',to_regclass('public.assurance_regent_work_status') is not null,
  'leavePolicyTable',to_regclass('public.assurance_regent_leave_policies') is not null,
  'leaveBundleRpc',to_regprocedure('public.assurance_regent_browser_leave_bundle(text)') is not null,
  'leaveApplyRpc',to_regprocedure('public.assurance_regent_browser_leave_apply(text,text,text,date,date,numeric,text,text,boolean)') is not null,
  'leaveDecideRpc',to_regprocedure('public.assurance_regent_browser_leave_decide(text,uuid,text,text)') is not null,
  'workStatusRpc',to_regprocedure('public.assurance_regent_browser_work_status_set(text,text,text,text,date)') is not null,
  'ready',
    to_regclass('public.assurance_regent_leave_requests') is not null and
    to_regclass('public.assurance_regent_work_status') is not null and
    to_regprocedure('public.assurance_regent_browser_leave_bundle(text)') is not null
) as assurance_regent_leave_work_status_health;
