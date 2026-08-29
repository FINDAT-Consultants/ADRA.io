-- Assurance Regent v6.3.13 HOTFIX 1
-- Safe pg_cron handling for recruitment vacancy expiry.
-- Run this in Supabase SQL Editor on an existing v6.3.13 database.

begin;

-- Archive anything already expired right now.
select public.assurance_regent_recruitment_archive_expired_vacancies();

commit;

-- Install/refresh the daily job only when the complete pg_cron extension is available.
do $$
declare
  v_jobid bigint;
begin
  if to_regclass('cron.job') is null
     or to_regprocedure('cron.schedule(text,text,text)') is null then
    raise notice 'pg_cron is not fully enabled. No error: public/HR recruitment requests still enforce vacancy deadlines.';
    raise notice 'If you want an independent daily background sweep, enable the pg_cron extension in Supabase, then rerun this file.';
    return;
  end if;

  begin
    execute 'select jobid from cron.job where jobname = $1 order by jobid desc limit 1'
      into v_jobid
      using 'assurance-regent-recruitment-expiry';

    if v_jobid is not null then
      execute 'select cron.unschedule($1)' using v_jobid;
    end if;
  exception when others then
    raise notice 'Existing expiry schedule could not be removed: %', sqlerrm;
  end;

  begin
    execute 'select cron.schedule($1,$2,$3)'
      using
        'assurance-regent-recruitment-expiry',
        '17 0 * * *',
        'select public.assurance_regent_recruitment_archive_expired_vacancies();';
    raise notice 'Daily recruitment expiry job scheduled for 00:17 UTC.';
  exception when others then
    raise notice 'Could not create pg_cron schedule: %', sqlerrm;
  end;
end $$;
