-- Assurance Regent v6.3.13 full verification
select public.assurance_regent_browser_health();

select
  to_regclass('public.assurance_regent_recruitment_applications') is not null as applications_ready,
  to_regclass('public.assurance_regent_recruitment_interviews') is not null as interviews_ready,
  to_regclass('public.assurance_regent_recruitment_notifications') is not null as notifications_ready,
  to_regclass('public.assurance_regent_recruitment_outreach') is not null as outreach_ready,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='assurance_regent_recruitment_applications' and column_name='experience_years') as experience_ready,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='assurance_regent_recruitment_applications' and column_name='qualification') as qualification_ready,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='assurance_regent_recruitment_applications' and column_name='skills_summary') as skills_ready,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='assurance_regent_recruitment_applications' and column_name='attachments') as attachments_ready,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='assurance_regent_recruitment_applications' and column_name='ai_score') as ai_fit_ready,
  to_regprocedure('public.assurance_regent_recruitment_archive_expired_vacancies()') is not null as vacancy_expiry_ready;

select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id='assurance-regent-recruitment-documents';

-- pg_cron is optional. Use dynamic SQL so verification never fails when cron.job is absent.
do $$
declare
  v_scheduled boolean := false;
begin
  if to_regclass('cron.job') is null then
    raise notice 'pg_cron is not enabled/complete; deadline expiry is still enforced on public/HR requests.';
    return;
  end if;

  begin
    execute 'select exists(select 1 from cron.job where jobname = $1)'
      into v_scheduled
      using 'assurance-regent-recruitment-expiry';

    if v_scheduled then
      raise notice 'Daily recruitment expiry job is scheduled.';
    else
      raise notice 'pg_cron is available but no recruitment expiry job is scheduled; public/HR requests still enforce expiry.';
    end if;
  exception when others then
    raise notice 'Could not inspect pg_cron schedule: %. Public/HR requests still enforce expiry.', sqlerrm;
  end;
end $$;
