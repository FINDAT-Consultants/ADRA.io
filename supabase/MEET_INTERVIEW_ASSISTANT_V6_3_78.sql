-- Assurance Regent v6.3.78 — Google Meet interview evidence + Jivan notes

create table if not exists public.assurance_regent_recruitment_interview_notes (
  interview_id text primary key,
  company_id text not null,
  application_id text not null,
  vacancy_id text not null default '',
  candidate_name text not null default '',
  conference_record text not null default '',
  transcript_name text not null default '',
  transcript_hash text not null default '',
  participant_count integer not null default 0,
  analysis jsonb not null default '{}'::jsonb,
  generated_by text not null default '',
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assurance_regent_recruitment_interview_notes_vacancy_idx
  on public.assurance_regent_recruitment_interview_notes(company_id, vacancy_id, updated_at desc);

alter table public.assurance_regent_recruitment_interview_notes enable row level security;
revoke all on table public.assurance_regent_recruitment_interview_notes from public, anon, authenticated;
grant select, insert, update, delete on table public.assurance_regent_recruitment_interview_notes to service_role;

create or replace function public.assurance_regent_google_meet_api_key()
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare v_key text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role is required.';
  end if;
  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name='assurance_regent_google_meet_api_key'
  order by updated_at desc nulls last, created_at desc
  limit 1;
  return coalesce(v_key,'');
end;
$$;
revoke all on function public.assurance_regent_google_meet_api_key() from public, anon, authenticated;
grant execute on function public.assurance_regent_google_meet_api_key() to service_role;

comment on table public.assurance_regent_recruitment_interview_notes is
  'Structured advisory interview notes generated from authorized Google Meet transcripts. Raw transcripts are not persisted.';
