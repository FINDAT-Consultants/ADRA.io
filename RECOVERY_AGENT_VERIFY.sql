-- Assurance Regent v4.7.0 Recovery Agent verification
select public.assurance_regent_browser_health() as health;
select to_regclass('public.assurance_regent_agent_messages') as agent_messages_table;
select routine_name
from information_schema.routines
where routine_schema='public'
  and routine_name in (
    'assurance_regent_browser_agent_context',
    'assurance_regent_browser_agent_thread',
    'assurance_regent_browser_agent_append',
    'assurance_regent_browser_agent_clear'
  )
order by routine_name;
