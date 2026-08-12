-- Assurance Regent v4.6.0 quick verification
-- Run AFTER ASSURANCE_REGENT_DIRECT_BROWSER_MODE.sql

select public.assurance_regent_browser_health() as assurance_regent_health;

select state_key, updated_at
from public.assurance_regent_state
where state_key = 'browser-client-state';

select user_id, username, email, active, updated_at
from public.assurance_regent_browser_credentials
order by lower(username);

-- Expected minimum result:
-- health.ok = true
-- health.schemaVersion = 4.6.0
-- health.developerReady = true
-- health.stateReady = true
-- a Dvp row is present and active in browser_credentials
