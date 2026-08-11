-- ===== 2026-08-11 normalized application persistence =====
-- These tables make users, companies, documents, reviews, and live records directly visible
-- in Supabase Table Editor. The Edge Function is the only writer; browser-local persistence is disabled.

create table if not exists public.app_users (
  id text primary key,
  username text not null,
  email text not null default '',
  name text not null,
  position text not null default '',
  department text not null default '',
  supervisor text not null default '',
  supervisory_role text not null default '',
  company_id text not null default '',
  role text not null,
  profile_photo text not null default '',
  password_hash text not null,
  hidden_from_directory boolean not null default false,
  active boolean not null default true,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists app_users_username_lower_uidx on public.app_users ((lower(username)));
create unique index if not exists app_users_email_lower_uidx on public.app_users ((lower(email))) where email <> '';
create index if not exists app_users_company_idx on public.app_users(company_id, role);

create table if not exists public.app_companies (
  id text primary key,
  name text not null,
  code text not null,
  active boolean not null default true,
  hidden boolean not null default false,
  system boolean not null default false,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists app_companies_code_lower_uidx on public.app_companies ((lower(code)));

create table if not exists public.app_settings (
  id text primary key,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_documents (
  id text primary key,
  row_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists app_documents_updated_idx on public.app_documents(updated_at desc);

create table if not exists public.app_reviews (
  id text primary key,
  row_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists app_reviews_updated_idx on public.app_reviews(updated_at desc);

create table if not exists public.app_live_records (
  record_type text not null,
  record_id text not null,
  company_id text not null default 'COMPANY-DEFAULT',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key(record_type, record_id, company_id)
);
create index if not exists app_live_records_type_idx on public.app_live_records(record_type, updated_at desc);
create index if not exists app_live_records_company_idx on public.app_live_records(company_id, record_type);

alter table public.app_users enable row level security;
alter table public.app_companies enable row level security;
alter table public.app_settings enable row level security;
alter table public.app_documents enable row level security;
alter table public.app_reviews enable row level security;
alter table public.app_live_records enable row level security;

-- Fixed Developer account requested for this deployment.
-- Password is stored only as a scrypt hash, never as plaintext in the database.
insert into public.app_users(id,username,email,name,position,company_id,role,password_hash,hidden_from_directory,active,created_by)
values ('DVP','DVP','','Developer','System Developer','','Developer','78940965ef0d57a04b48066a5dbb118d:ce5a3b62726cb2e91ec1456d0b9ef34ff546c9c4f747c856aca4fa02ea90663a35f2d74acf3496a8401f8c42bc38e28ab7799bb8943bc764e5018e990d773a1a',true,true,'SYSTEM')
on conflict (id) do update set username='DVP',name='Developer',position='System Developer',company_id='',role='Developer',password_hash=excluded.password_hash,hidden_from_directory=true,active=true,updated_at=now();

delete from public.app_users where lower(id)='dvp' and id <> 'DVP';

insert into public.app_companies(id,name,code,active,hidden,system,created_by)
values
 ('COMPANY-DEFAULT','System Workspace','DEFAULT',true,true,true,'DVP'),
 ('COMPANY-ASSURANCE-REGENT','Assurance Regent','ASSURANCE',true,false,false,'DVP')
on conflict (id) do update set name=excluded.name,code=excluded.code,active=excluded.active,hidden=excluded.hidden,system=excluded.system,updated_at=now();

insert into public.app_settings(id,settings)
values ('global','{"countryCode":"","country":"Not configured","currency":"USD","currencyName":"US Dollar","defaultHourlyRate":0,"employeeHourlyRates":{},"projectHourlyRates":{}}'::jsonb)
on conflict (id) do nothing;

comment on table public.app_users is 'Assurance Regent user accounts stored in Supabase; password_hash contains salted scrypt hashes only.';
comment on table public.app_live_records is 'Normalized mirror of live operational data written by the Assurance Regent Edge Function.';

-- Verification result shown at the bottom of Supabase SQL Editor after a successful run.
select id, username, email, name, role, company_id, active from public.app_users order by created_at;
select id, name, code, active, hidden from public.app_companies order by created_at;
