select public.assurance_regent_browser_health() as assurance_regent_health;
select id,name,public,file_size_limit,allowed_mime_types
from storage.buckets where id='assurance-regent-files';
select count(*) as file_metadata_rows from public.assurance_regent_files;
