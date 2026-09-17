alter function public.assurance_regent_browser_scope_array(jsonb,text) set search_path to pg_catalog, public;
alter function public.assurance_regent_browser_prepare_company_array(jsonb,text) set search_path to pg_catalog, public;
alter function public.assurance_regent_browser_merge_company_array(jsonb,jsonb,text) set search_path to pg_catalog, public;

revoke execute on function public.assurance_regent_browser_scope_array(jsonb,text) from public, anon, authenticated;
revoke execute on function public.assurance_regent_browser_prepare_company_array(jsonb,text) from public, anon, authenticated;
revoke execute on function public.assurance_regent_browser_merge_company_array(jsonb,jsonb,text) from public, anon, authenticated;
revoke execute on function public.assurance_regent_browser_scope_state(jsonb,jsonb) from public, anon, authenticated;
revoke execute on function public.assurance_regent_browser_employee_for_actor(jsonb) from public, anon, authenticated;
revoke execute on function public.assurance_regent_browser_manager_scope_allows(jsonb,jsonb) from public, anon, authenticated;
revoke execute on function public.assurance_regent_browser_budget_personnel_directory(text) from public, anon, authenticated;
revoke execute on function public.assurance_regent_browser_budget_personnel_exists(text,text) from public, anon, authenticated;
revoke execute on function public.assurance_regent_browser_budget_import_close_stage88(uuid,text,text) from public, anon, authenticated;
revoke execute on function public.assurance_regent_browser_budget_import_notify_stage88(uuid,text) from public, anon, authenticated;
revoke execute on function public.assurance_regent_browser_budget_import_notify_user88(uuid,text,text,text,text) from public, anon, authenticated;
revoke execute on function public.assurance_regent_browser_recovery_audit_write(jsonb,text,text,text,text,text,text,jsonb) from public, anon, authenticated;

grant execute on function public.assurance_regent_browser_scope_array(jsonb,text) to service_role;
grant execute on function public.assurance_regent_browser_prepare_company_array(jsonb,text) to service_role;
grant execute on function public.assurance_regent_browser_merge_company_array(jsonb,jsonb,text) to service_role;
grant execute on function public.assurance_regent_browser_scope_state(jsonb,jsonb) to service_role;
grant execute on function public.assurance_regent_browser_employee_for_actor(jsonb) to service_role;
grant execute on function public.assurance_regent_browser_manager_scope_allows(jsonb,jsonb) to service_role;
grant execute on function public.assurance_regent_browser_budget_personnel_directory(text) to service_role;
grant execute on function public.assurance_regent_browser_budget_personnel_exists(text,text) to service_role;
grant execute on function public.assurance_regent_browser_budget_import_close_stage88(uuid,text,text) to service_role;
grant execute on function public.assurance_regent_browser_budget_import_notify_stage88(uuid,text) to service_role;
grant execute on function public.assurance_regent_browser_budget_import_notify_user88(uuid,text,text,text,text) to service_role;
grant execute on function public.assurance_regent_browser_recovery_audit_write(jsonb,text,text,text,text,text,text,jsonb) to service_role;
