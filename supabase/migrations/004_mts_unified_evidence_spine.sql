-- ADRA Recovery Passport + Master Time Schedule integration
-- The MTS work session is the operational evidence record. Completed sessions create DRAFT
-- Recovery Passport time entries; human approval remains separate.

create table if not exists public.mts_work_sessions (
  id text primary key,
  employee_id text not null,
  employee_name text not null,
  department text,
  project_code text not null,
  activity_description text not null,
  work_date date not null,
  clock_in_at timestamptz not null,
  clock_out_at timestamptz,
  duration_hours numeric(12,6) not null default 0,
  completion_percent numeric(6,2) not null default 0,
  on_time boolean not null default false,
  delay_comments text,
  clock_in_location text,
  clock_out_location text,
  clock_in_lat numeric(10,7),
  clock_in_lng numeric(10,7),
  clock_out_lat numeric(10,7),
  clock_out_lng numeric(10,7),
  document_name text,
  document_type text,
  document_size bigint not null default 0,
  document_data text,
  status text not null default 'active' check (status in ('active','completed')),
  locked boolean not null default false,
  recovery_entry_id text,
  recovery_bridge_status text not null default 'pending_clock_out',
  source text not null default 'live',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mts_work_sessions_work_date_idx on public.mts_work_sessions(work_date);
create index if not exists mts_work_sessions_project_idx on public.mts_work_sessions(project_code, work_date);
create index if not exists mts_work_sessions_employee_idx on public.mts_work_sessions(employee_id, work_date);
create index if not exists mts_work_sessions_status_idx on public.mts_work_sessions(status);

create table if not exists public.mts_messages (
  id text primary key,
  recipient text not null,
  sender text not null default 'Recovery Passport System',
  content text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists mts_messages_recipient_idx on public.mts_messages(recipient, created_at desc);

alter table public.mts_work_sessions enable row level security;
alter table public.mts_messages enable row level security;

-- This prototype uses server-side Supabase credentials and therefore does not expose these
-- tables directly to the browser. Add authenticated-user RLS policies when account creation is enabled.

comment on table public.mts_work_sessions is 'Operational work-evidence spine linking clock-in/out activity evidence to draft Recovery Passport time entries.';
comment on column public.mts_work_sessions.recovery_entry_id is 'Links a completed MTS session to the corresponding draft time entry in workbook_time_entries.';
