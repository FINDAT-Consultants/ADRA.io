-- Assurance Regent v6.3.9 — Jivan voice-access enrollment and verification
-- Run in Supabase SQL Editor after the v6.3.8 database setup.
-- Voice biometrics are private security data. Tables and stored samples are never granted to browser roles.

create extension if not exists pgcrypto;

create table if not exists public.assurance_regent_voice_profiles (
  user_id text primary key references public.assurance_regent_browser_credentials(user_id) on delete cascade,
  template jsonb not null default '{}'::jsonb,
  sample_refs jsonb not null default '[]'::jsonb,
  sample_count integer not null default 0,
  phrase_version integer not null default 1,
  active boolean not null default true,
  enrolled_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_verified_at timestamptz,
  failed_attempts integer not null default 0
);

create table if not exists public.assurance_regent_voice_challenges (
  id uuid primary key default gen_random_uuid(),
  phrase text not null,
  requested_user text not null default '',
  ip_hash text not null default '',
  expires_at timestamptz not null,
  used_at timestamptz,
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists assurance_regent_voice_challenges_expiry_idx
  on public.assurance_regent_voice_challenges(expires_at desc);
create index if not exists assurance_regent_voice_challenges_ip_idx
  on public.assurance_regent_voice_challenges(ip_hash, created_at desc);

create table if not exists public.assurance_regent_voice_access_audit (
  id bigserial primary key,
  event_type text not null,
  user_id text not null default '',
  success boolean not null default false,
  score numeric,
  ip_hash text not null default '',
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists assurance_regent_voice_access_audit_ip_idx
  on public.assurance_regent_voice_access_audit(ip_hash, created_at desc);
create index if not exists assurance_regent_voice_access_audit_user_idx
  on public.assurance_regent_voice_access_audit(user_id, created_at desc);

alter table public.assurance_regent_voice_profiles enable row level security;
alter table public.assurance_regent_voice_challenges enable row level security;
alter table public.assurance_regent_voice_access_audit enable row level security;

revoke all on table public.assurance_regent_voice_profiles from public, anon, authenticated;
revoke all on table public.assurance_regent_voice_challenges from public, anon, authenticated;
revoke all on table public.assurance_regent_voice_access_audit from public, anon, authenticated;
revoke all on sequence public.assurance_regent_voice_access_audit_id_seq from public, anon, authenticated;

-- Private bucket for enrollment recordings. Supabase service-role Edge Functions bypass Storage RLS.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('assurance-regent-voiceprints','assurance-regent-voiceprints',false,2097152,array['audio/wav'])
on conflict(id) do update set public=false,file_size_limit=2097152,allowed_mime_types=array['audio/wav'];

-- Password proof for voice enrollment. Only the service-role Edge Function may call it.
create or replace function public.assurance_regent_browser_voice_enrollment_authorize(p_user_id text,p_password text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_cred record;
begin
  if trim(coalesce(p_user_id,''))='' or coalesce(p_password,'')='' then raise exception 'Username and password are required for voice enrollment.'; end if;
  select * into v_cred from public.assurance_regent_browser_credentials
  where lower(user_id)=lower(trim(p_user_id)) or lower(username)=lower(trim(p_user_id)) or (email<>'' and lower(email)=lower(trim(p_user_id))) limit 1;
  if v_cred.user_id is null or crypt(p_password,v_cred.password_hash)<>v_cred.password_hash then raise exception 'Voice enrollment authorization failed.'; end if;
  if coalesce(v_cred.approval_status,'APPROVED') in ('REJECTED','SUSPENDED') or not coalesce(v_cred.active,true) and coalesce(v_cred.approval_status,'APPROVED')<>'PENDING' then
    raise exception 'This account is not eligible for voice enrollment.';
  end if;
  return jsonb_build_object('ok',true,'user_id',v_cred.user_id,'approval_status',coalesce(v_cred.approval_status,'APPROVED'));
end $$;

revoke all on function public.assurance_regent_browser_voice_enrollment_authorize(text,text) from public,anon,authenticated;
grant execute on function public.assurance_regent_browser_voice_enrollment_authorize(text,text) to service_role;

-- Browser health extension. Existing setup remains valid; this is an additive readiness check.
create or replace function public.assurance_regent_browser_voice_access_health()
returns jsonb language sql security definer set search_path=public as $$
  select jsonb_build_object(
    'ok',true,
    'voiceProfilesReady',to_regclass('public.assurance_regent_voice_profiles') is not null,
    'voiceChallengesReady',to_regclass('public.assurance_regent_voice_challenges') is not null,
    'voiceAuditReady',to_regclass('public.assurance_regent_voice_access_audit') is not null,
    'voiceBucketReady',exists(select 1 from storage.buckets where id='assurance-regent-voiceprints')
  );
$$;
revoke all on function public.assurance_regent_browser_voice_access_health() from public;
grant execute on function public.assurance_regent_browser_voice_access_health() to anon,authenticated;

-- Remove expired one-time challenges opportunistically when the migration is run.
delete from public.assurance_regent_voice_challenges where expires_at < now() - interval '1 day';
