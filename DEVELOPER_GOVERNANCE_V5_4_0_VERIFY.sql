-- Assurance Regent v5.4.0 verification
-- Run after DEVELOPER_GOVERNANCE_V5_4_0.sql.

select public.assurance_regent_browser_health() as assurance_regent_health;

select user_id, username, email, active, approval_status, approved_by, approved_at, status_reason, updated_at
from public.assurance_regent_browser_credentials
order by lower(username);

select
  jsonb_array_length(coalesce(state_value#>'{auth,accounts}','[]'::jsonb)) as account_count,
  jsonb_array_length(coalesce(state_value#>'{auth,companies}','[]'::jsonb)) as company_count,
  updated_at
from public.assurance_regent_state
where state_key='browser-client-state';

select to_regclass('public.assurance_regent_agent_messages') as recovery_agent_messages_table;

-- Expected minimum result:
-- health.ok = true
-- health.schemaVersion = 5.4.0
-- health.developerReady = true
-- health.stateReady = true
-- health.governanceReady = true
-- Dvp is APPROVED and active.
