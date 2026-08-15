ASSURANCE REGENT v6.3.13 HOTFIX 1 — pg_cron

Problem fixed:
The v6.3.13 full verification used a static SELECT against cron.job after checking
only whether the cron schema existed. A project can have a cron schema without
cron.job, causing PostgreSQL error 42P01.

Existing database:
1. Run ASSURANCE_REGENT_V6_3_13_PGCRON_HOTFIX_1.sql
2. Run ASSURANCE_REGENT_V6_3_13_PGCRON_HOTFIX_1_VERIFY.sql

pg_cron is optional.
- Without pg_cron: public and HR recruitment requests still archive/hide expired vacancies.
- With pg_cron: the system also runs the independent daily 00:17 UTC expiry sweep.

If you want the independent daily sweep and pg_cron is not installed, enable the
pg_cron extension in Supabase, then rerun the hotfix SQL.
