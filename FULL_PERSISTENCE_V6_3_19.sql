-- Assurance Regent v6.3.19 — full Supabase persistence/storage hardening
-- Additive migration. Internal authenticated uploads are stored in a private
-- Supabase Storage bucket with metadata in public.assurance_regent_files.

create table if not exists public.assurance_regent_files (
  id uuid primary key default gen_random_uuid(),
  company_id text not null default '',
  actor_id text not null default '',
  category text not null default 'general',
  entity_type text not null default '',
  entity_id text not null default '',
  original_name text not null,
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null default 0 check (size_bytes >= 0 and size_bytes <= 52428800),
  bucket_id text not null default 'assurance-regent-files',
  storage_path text not null unique,
  status text not null default 'PENDING' check (status in ('PENDING','STORED','DELETED','FAILED')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  stored_at timestamptz,
  deleted_at timestamptz
);

create index if not exists assurance_regent_files_company_idx
  on public.assurance_regent_files(company_id, created_at desc);
create index if not exists assurance_regent_files_actor_idx
  on public.assurance_regent_files(actor_id, created_at desc);
create index if not exists assurance_regent_files_entity_idx
  on public.assurance_regent_files(entity_type, entity_id, created_at desc);
create index if not exists assurance_regent_files_status_idx
  on public.assurance_regent_files(status, updated_at desc);

alter table public.assurance_regent_files enable row level security;
revoke all on table public.assurance_regent_files from anon, authenticated;

-- The existing internal bucket is private. Keep formats unrestricted and use a
-- 50 MB per-object safety limit. Access is brokered by the governed Edge function.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('assurance-regent-files','assurance-regent-files',false,52428800,null)
on conflict (id) do update set
  name=excluded.name,
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=null;

-- Keep browser health aligned with the deployed schema and expose file-storage readiness.
create or replace function public.assurance_regent_browser_health()
returns jsonb
language sql
security definer
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'ok', true,
    'schemaVersion', '6.3.19',
    'developerReady', exists(select 1 from public.assurance_regent_browser_credentials where user_id='Dvp' and active=true and approval_status='APPROVED'),
    'stateReady', exists(select 1 from public.assurance_regent_state where state_key='browser-client-state'),
    'governanceReady', exists(select 1 from information_schema.columns where table_schema='public' and table_name='assurance_regent_browser_credentials' and column_name='approval_status'),
    'recoveryReady', to_regclass('public.assurance_regent_recovery_passports') is not null,
    'scalabilityReady', to_regclass('public.assurance_regent_system_incidents') is not null,
    'trafficManagementReady', to_regclass('public.assurance_regent_rate_limit_buckets') is not null,
    'studioReady', exists(select 1 from public.assurance_regent_jivan_studio_versions where status='ACTIVE'),
    'voiceReady', to_regclass('public.assurance_regent_voice_profiles') is not null and to_regclass('public.assurance_regent_voice_challenges') is not null and to_regprocedure('public.assurance_regent_browser_voice_access_health()') is not null,
    'recruitmentReady', to_regclass('public.assurance_regent_recruitment_applications') is not null and to_regclass('public.assurance_regent_recruitment_interviews') is not null and to_regclass('public.assurance_regent_recruitment_outreach') is not null,
    'recruitmentAiReady', exists(select 1 from information_schema.columns where table_schema='public' and table_name='assurance_regent_recruitment_applications' and column_name='ai_score'),
    'fileStorageReady', to_regclass('public.assurance_regent_files') is not null and exists(select 1 from storage.buckets where id='assurance-regent-files' and public=false),
    'updatedAt', coalesce((select updated_at from public.assurance_regent_state where state_key='browser-client-state'), now())
  );
$function$;

grant execute on function public.assurance_regent_browser_health() to anon, authenticated;

comment on table public.assurance_regent_files is
  'Governed metadata registry for Assurance Regent internal Supabase Storage objects. Binary bytes live in the private assurance-regent-files bucket.';
