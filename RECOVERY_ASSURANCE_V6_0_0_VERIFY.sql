-- Assurance Regent v6.0.0 — Recovery Assurance & Accounting verification
select jsonb_build_object(
  'schemaVersion','6.0.0',
  'ready',
    to_regclass('public.assurance_regent_recovery_passports') is not null
    and to_regclass('public.assurance_regent_recovery_passport_keys') is not null
    and to_regclass('public.assurance_regent_recovery_donor_rules') is not null
    and to_regclass('public.assurance_regent_recovery_evidence_links') is not null
    and to_regclass('public.assurance_regent_recovery_approvals') is not null
    and to_regclass('public.assurance_regent_recovery_journal_batches') is not null
    and to_regclass('public.assurance_regent_recovery_journal_lines') is not null
    and to_regclass('public.assurance_regent_recovery_audit_events') is not null,
  'immutablePassports', exists(select 1 from pg_trigger where tgname='assurance_regent_recovery_passport_immutable' and not tgisinternal),
  'immutableKeys', exists(select 1 from pg_trigger where tgname='assurance_regent_recovery_keys_immutable' and not tgisinternal),
  'immutableApprovals', exists(select 1 from pg_trigger where tgname='assurance_regent_recovery_approvals_immutable' and not tgisinternal),
  'immutableEvidence', exists(select 1 from pg_trigger where tgname='assurance_regent_recovery_evidence_immutable' and not tgisinternal),
  'donorRules', to_regprocedure('public.assurance_regent_browser_recovery_rule_create(text,text,text,text,text,numeric,text,date,date)') is not null,
  'recoveryBundle', to_regprocedure('public.assurance_regent_browser_recovery_bundle(text,date,text)') is not null,
  'supervisorExceptions', to_regprocedure('public.assurance_regent_browser_recovery_exception_bundle(text,date,text)') is not null,
  'evidenceBinding', to_regprocedure('public.assurance_regent_browser_recovery_evidence_link(text,text,date,text,text,text,text,text,text)') is not null,
  'immutableSnapshot', to_regprocedure('public.assurance_regent_browser_recovery_passport_snapshot(text,text,date,text,text,text,jsonb)') is not null,
  'humanAssurance', to_regprocedure('public.assurance_regent_browser_recovery_approve(text,uuid,text,text,text)') is not null,
  'journalWorkflow', to_regprocedure('public.assurance_regent_browser_recovery_journal_create(text,uuid,text,text,text)') is not null
    and to_regprocedure('public.assurance_regent_browser_recovery_journal_status(text,uuid,text)') is not null,
  'auditTrail', to_regprocedure('public.assurance_regent_browser_recovery_audit_append(text,text,text,text,text,text,text,jsonb)') is not null,
  'auditorAuthority', to_regprocedure('public.assurance_regent_browser_functional_authority(jsonb)') is not null
    and to_regprocedure('public.assurance_regent_browser_recovery_can_read_finance(jsonb)') is not null,
  'authorityAssignmentHardened', to_regprocedure('public.assurance_regent_browser_admin_update_user(text,text,text,text,text,text,text,text)') is not null,
  'jivanContextV6', to_regprocedure('public.assurance_regent_browser_agent_context(text)') is not null
) as assurance_regent_v6_verification;
