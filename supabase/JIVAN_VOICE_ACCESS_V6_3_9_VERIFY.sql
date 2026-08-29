select public.assurance_regent_browser_voice_access_health();
select user_id,sample_count,active,enrolled_at,last_verified_at,failed_attempts from public.assurance_regent_voice_profiles order by updated_at desc;
select event_type,user_id,success,score,created_at from public.assurance_regent_voice_access_audit order by id desc limit 20;
