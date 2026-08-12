-- Assurance Regent v5.0.0 Recovery Agent verification
select public.assurance_regent_browser_health() as health;

select
  to_regclass('public.assurance_regent_agent_messages') is not null as conversation_table_ready,
  to_regclass('public.assurance_regent_agent_audit') is not null as audit_table_ready,
  to_regprocedure('public.assurance_regent_browser_agent_context(text)') is not null as context_rpc_ready,
  to_regprocedure('public.assurance_regent_browser_agent_audit_append(text,text,text,text,text,text,jsonb)') is not null as audit_write_rpc_ready,
  to_regprocedure('public.assurance_regent_browser_agent_audit_recent(text,integer)') is not null as audit_read_rpc_ready;
