-- Assurance Regent v5.9.0 — Jivan background task verification
select jsonb_build_object(
  'schemaVersion','5.9.0',
  'ready',
    to_regclass('public.assurance_regent_agent_tasks') is not null
    and to_regprocedure('public.assurance_regent_browser_agent_task_create(text,text,text,text)') is not null
    and to_regprocedure('public.assurance_regent_browser_agent_task_list(text,integer)') is not null
    and to_regprocedure('public.assurance_regent_browser_agent_task_claim_next(text)') is not null
    and to_regprocedure('public.assurance_regent_browser_agent_task_finish(text,uuid,text,text,jsonb)') is not null
    and to_regprocedure('public.assurance_regent_browser_agent_task_cancel(text,uuid)') is not null,
  'taskTable',to_regclass('public.assurance_regent_agent_tasks')::text
) as jivan_background_task_health;
