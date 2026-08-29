select jsonb_build_object(
  'schemaVersion','5.10.0',
  'ready',
    to_regprocedure('public.assurance_regent_browser_functional_authority(jsonb)') is not null
    and to_regprocedure('public.assurance_regent_browser_admin_company_registration(text,text,text,text)') is not null
    and to_regprocedure('public.assurance_regent_browser_leave_bundle(text)') is not null
    and to_regprocedure('public.assurance_regent_browser_leave_decide(text,uuid,text,text)') is not null
    and to_regprocedure('public.assurance_regent_browser_agent_context(text)') is not null,
  'leaveNewestFirst', true,
  'departmentalAuthority', true,
  'countryAwareLeavePolicy', true
) as assurance_regent_v5_10_status;
