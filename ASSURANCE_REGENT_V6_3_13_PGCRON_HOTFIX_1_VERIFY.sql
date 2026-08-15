-- Assurance Regent v6.3.13 HOTFIX 1 verification

select public.assurance_regent_browser_health();

select
  to_regclass('public.assurance_regent_recruitment_applications') is not null as applications_ready,
  to_regclass('public.assurance_regent_recruitment_interviews') is not null as interviews_ready,
  to_regclass('public.assurance_regent_recruitment_notifications') is not null as notifications_ready,
  to_regclass('public.assurance_regent_recruitment_outreach') is not null as outreach_ready,
  exists(
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='assurance_regent_recruitment_applications'
      and column_name='experience_years'
  ) as experience_ready,
  exists(
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='assurance_regent_recruitment_applications'
      and column_name='attachments'
  ) as attachments_ready,
  exists(
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='assurance_regent_recruitment_applications'
      and column_name='ai_score'
  ) as ai_fit_ready,
  to_regprocedure('public.assurance_regent_recruitment_archive_expired_vacancies()') is not null as vacancy_expiry_ready,
  to_regclass('cron.job') is not null as pg_cron_job_table_ready,
  to_regprocedure('cron.schedule(text,text,text)') is not null as pg_cron_schedule_function_ready;

select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id='assurance-regent-recruitment-documents';

-- Exact schedule check, safely dynamic.
do $$
declare
  v_scheduled boolean := false;
begin
  if to_regclass('cron.job') is null then
    raise notice 'pg_cron is not enabled/complete. This is optional; request-time vacancy expiry remains active.';
    return;
  end if;

  begin
    execute 'select exists(select 1 from cron.job where jobname = $1)'
      into v_scheduled
      using 'assurance-regent-recruitment-expiry';

    if v_scheduled then
      raise notice 'PASS: Daily recruitment expiry job is scheduled.';
    else
      raise notice 'INFO: pg_cron exists but the recruitment expiry job is not scheduled.';
    end if;
  exception when others then
    raise notice 'INFO: pg_cron schedule could not be inspected: %', sqlerrm;
  end;
end $$;

-- Confirm expiry function can run now.
select public.assurance_regent_recruitment_archive_expired_vacancies()
  as expired_vacancies_archived_now;
