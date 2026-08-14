-- Assurance Regent v6.3.13 recruitment verification
select public.assurance_regent_browser_health();
select
  to_regclass('public.assurance_regent_recruitment_applications') is not null as applications_ready,
  to_regclass('public.assurance_regent_recruitment_outreach') is not null as outreach_ready,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='assurance_regent_recruitment_applications' and column_name='attachments') as attachments_ready,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='assurance_regent_recruitment_applications' and column_name='ai_score') as ai_fit_ready,
  to_regprocedure('public.assurance_regent_recruitment_archive_expired_vacancies()') is not null as vacancy_expiry_ready;
select id,public,file_size_limit,allowed_mime_types from storage.buckets where id='assurance-regent-recruitment-documents';
