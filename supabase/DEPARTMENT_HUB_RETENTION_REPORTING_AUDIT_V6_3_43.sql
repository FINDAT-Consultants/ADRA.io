-- Assurance Regent v6.3.43
-- 30-day Department Hub thread retention.
-- A social thread = root post/status + replies/comments + reactions + attachments.
-- Database rows are retired after 30 days from the root post. Physical Storage objects
-- are queued for deletion by the department-hub-retention Edge Function.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create table if not exists public.assurance_regent_department_social_retention_queue (
  file_id uuid primary key,
  company_id text not null default '',
  bucket_id text not null default 'assurance-regent-files',
  storage_path text not null,
  original_name text not null default '',
  root_message_id uuid,
  queued_at timestamptz not null default now(),
  attempts integer not null default 0,
  status text not null default 'PENDING' check (status in ('PENDING','RETRY','DELETED')),
  deleted_at timestamptz,
  last_error text not null default ''
);

create index if not exists idx_ar_department_retention_queue_pending
  on public.assurance_regent_department_social_retention_queue(status, queued_at);

create table if not exists public.assurance_regent_department_social_retention_runs (
  id bigint generated always as identity primary key,
  run_at timestamptz not null default now(),
  cutoff_at timestamptz not null,
  root_threads_deleted integer not null default 0,
  files_queued integer not null default 0,
  source text not null default 'SWEEP'
);

alter table public.assurance_regent_department_social_retention_queue enable row level security;
alter table public.assurance_regent_department_social_retention_runs enable row level security;
revoke all on public.assurance_regent_department_social_retention_queue from anon, authenticated;
revoke all on public.assurance_regent_department_social_retention_runs from anon, authenticated;

create or replace function public.assurance_regent_department_social_retention_sweep()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_cutoff timestamptz := now() - interval '30 days';
  v_roots uuid[] := '{}'::uuid[];
  v_root_count integer := 0;
  v_file_count integer := 0;
begin
  select coalesce(array_agg(m.id), '{}'::uuid[])
    into v_roots
  from public.assurance_regent_department_messages m
  where m.parent_id is null
    and m.created_at < v_cutoff;

  v_root_count := coalesce(cardinality(v_roots), 0);

  if v_root_count > 0 then
    insert into public.assurance_regent_department_social_retention_queue(
      file_id, company_id, bucket_id, storage_path, original_name, root_message_id, queued_at, status
    )
    select distinct
      f.id,
      f.company_id,
      coalesce(nullif(f.bucket_id,''),'assurance-regent-files'),
      f.storage_path,
      coalesce(f.original_name,''),
      coalesce(m.parent_id,m.id),
      now(),
      'PENDING'
    from public.assurance_regent_department_messages m
    cross join lateral jsonb_array_elements(coalesce(m.attachments,'[]'::jsonb)) a(value)
    join public.assurance_regent_files f
      on f.id::text = nullif(a.value->>'fileId','')
    where (m.id = any(v_roots) or m.parent_id = any(v_roots))
      and f.storage_path is not null
      and f.storage_path <> ''
      and coalesce(f.status,'') <> 'DELETED'
    on conflict (file_id) do update set
      company_id=excluded.company_id,
      bucket_id=excluded.bucket_id,
      storage_path=excluded.storage_path,
      original_name=excluded.original_name,
      root_message_id=excluded.root_message_id,
      queued_at=excluded.queued_at,
      status=case when public.assurance_regent_department_social_retention_queue.status='DELETED' then 'DELETED' else 'PENDING' end,
      last_error='';

    get diagnostics v_file_count = row_count;

    update public.assurance_regent_files f
       set status='DELETED',
           deleted_at=coalesce(f.deleted_at,now()),
           updated_at=now(),
           metadata=coalesce(f.metadata,'{}'::jsonb) || jsonb_build_object(
             'retention_policy','department-hub-30-days',
             'retention_queued_at',now(),
             'deletion_source','department-hub-retention'
           )
     where f.id in (
       select q.file_id
       from public.assurance_regent_department_social_retention_queue q
       where q.root_message_id = any(v_roots)
         and q.status <> 'DELETED'
     );

    delete from public.assurance_regent_department_messages
     where id = any(v_roots)
       and parent_id is null;
  end if;

  insert into public.assurance_regent_department_social_retention_runs(
    cutoff_at, root_threads_deleted, files_queued, source
  ) values (v_cutoff,v_root_count,v_file_count,'PG_CRON_SWEEP');

  return jsonb_build_object(
    'ok',true,
    'cutoff_at',v_cutoff,
    'root_threads_deleted',v_root_count,
    'files_queued',v_file_count
  );
end $$;

revoke all on function public.assurance_regent_department_social_retention_sweep() from public, anon, authenticated;
grant execute on function public.assurance_regent_department_social_retention_sweep() to service_role;

create or replace function public.assurance_regent_department_social_retention_authorized(p_secret text)
returns boolean
language sql
security definer
set search_path = public, vault
as $$
  select exists(
    select 1
    from vault.decrypted_secrets
    where name='department_hub_retention_key'
      and decrypted_secret=coalesce(p_secret,'')
      and coalesce(p_secret,'')<>''
  );
$$;
revoke all on function public.assurance_regent_department_social_retention_authorized(text) from public, anon, authenticated;
grant execute on function public.assurance_regent_department_social_retention_authorized(text) to service_role;

-- Store scheduler configuration in Vault only when it is not already present.
do $$
begin
  if not exists(select 1 from vault.decrypted_secrets where name='assurance_regent_project_url') then
    perform vault.create_secret('https://fubqwljypdiojpbdunjc.supabase.co','assurance_regent_project_url','Assurance Regent Supabase project URL for scheduled retention');
  end if;
  if not exists(select 1 from vault.decrypted_secrets where name='assurance_regent_publishable_key') then
    perform vault.create_secret('sb_publishable_bCscsMezuyabUbEA3gaXfw_awPFhqRq','assurance_regent_publishable_key','Assurance Regent publishable key for scheduled Edge Function invocation');
  end if;
  if not exists(select 1 from vault.decrypted_secrets where name='department_hub_retention_key') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'department_hub_retention_key','Private Department Hub retention scheduler key');
  end if;
end $$;

-- Replace the daily job deterministically if this migration is reapplied in another environment.
do $$
declare v_job bigint;
begin
  for v_job in select jobid from cron.job where jobname='assurance-regent-department-hub-30-day-retention' loop
    perform cron.unschedule(v_job);
  end loop;
end $$;

select cron.schedule(
  'assurance-regent-department-hub-30-day-retention',
  '15 2 * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='assurance_regent_project_url') || '/functions/v1/department-hub-retention',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey',(select decrypted_secret from vault.decrypted_secrets where name='assurance_regent_publishable_key'),
      'x-retention-key',(select decrypted_secret from vault.decrypted_secrets where name='department_hub_retention_key')
    ),
    body := jsonb_build_object('source','pg_cron','requested_at',now()),
    timeout_milliseconds := 120000
  );
  $cron$
);
