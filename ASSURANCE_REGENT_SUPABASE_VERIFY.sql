-- Assurance Regent v4.7.0 quick verification
-- Run AFTER ASSURANCE_REGENT_SUPABASE_SETUP.sql or the v4.7.0 Recovery Agent update.

select public.assurance_regent_browser_health() as assurance_regent_health;

select state_key, updated_at
from public.assurance_regent_state
where state_key = 'browser-client-state';

select user_id, username, email, active, updated_at
from public.assurance_regent_browser_credentials
order by lower(username);

select to_regclass('public.assurance_regent_agent_messages') as recovery_agent_messages_table;

-- Expected minimum result:
-- health.ok = true
-- health.schemaVersion = 4.7.0
-- health.developerReady = true
-- health.stateReady = true
-- health.recoveryAgentReady = true
-- a Dvp row is present and active in browser_credentials
