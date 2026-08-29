-- Assurance Regent v6.3.12 recruitment portal verification
DO $$
BEGIN
  IF to_regclass('public.assurance_regent_recruitment_applications') IS NULL THEN RAISE EXCEPTION 'Missing recruitment applications table'; END IF;
  IF to_regclass('public.assurance_regent_recruitment_notifications') IS NULL THEN RAISE EXCEPTION 'Missing recruitment notifications table'; END IF;
  IF to_regclass('public.assurance_regent_recruitment_interviews') IS NULL THEN RAISE EXCEPTION 'Missing recruitment interviews table'; END IF;
  IF to_regprocedure('public.assurance_regent_browser_recruitment_bundle(text)') IS NULL THEN RAISE EXCEPTION 'Missing HR recruitment bundle RPC'; END IF;
  IF to_regprocedure('public.assurance_regent_browser_recruitment_interview_schedule(text,uuid,timestamp with time zone,text,text)') IS NULL THEN RAISE EXCEPTION 'Missing interview scheduling RPC'; END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='assurance-regent-recruitment-documents' AND public=false) THEN RAISE EXCEPTION 'Private recruitment documents bucket is missing'; END IF;
END $$;

select public.assurance_regent_browser_health() as assurance_regent_health;
select id,name,public,file_size_limit,allowed_mime_types from storage.buckets where id='assurance-regent-recruitment-documents';
select table_name from information_schema.tables where table_schema='public' and table_name in ('assurance_regent_recruitment_applications','assurance_regent_recruitment_notifications','assurance_regent_recruitment_interviews') order by table_name;
