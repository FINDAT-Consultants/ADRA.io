ASSURANCE REGENT v6.3.9 HOTFIX 1
================================

WHY THE SIGN-IN WARNING APPEARED
The previous consolidated v6.3.9 SQL accidentally omitted migrations v5.8, v5.9,
v5.10, v6.0, v6.1 and v6.2. Its last browser_health definition therefore
reported schemaVersion 5.4.0 and omitted scalabilityReady/studioReady. The
frontend requires those flags and correctly blocked sign-in.

IF YOU ALREADY RAN THE PREVIOUS v6.3.9 FULL SQL
1. Open Supabase > SQL Editor.
2. Run ASSURANCE_REGENT_SUPABASE_REPAIR_V6_3_9_HOTFIX_1.sql in full.
3. Run ASSURANCE_REGENT_SUPABASE_VERIFY_V6_3_9_HOTFIX_1.sql.
4. Confirm frontend_gate.signInGateReady = true and schemaVersion = 6.3.9.
5. Refresh the application. If the page was already open, use Ctrl+F5.

FOR A BRAND-NEW SUPABASE PROJECT
Run ASSURANCE_REGENT_SUPABASE_SETUP_V6_3_9_HOTFIX_1.sql instead, then run the
verification SQL.

Do not run both the repair script and the fresh-install setup on the same fresh
project. The repair script is intended for an existing v5.4+/affected v6.3.9 database.
