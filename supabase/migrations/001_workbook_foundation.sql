-- ADRA Recovery Passport — workbook foundation storage
-- No end-user authentication is enabled in this prototype. These tables are intended
-- for server-side access with a Supabase secret/service-role credential. RLS is enabled
-- with no anonymous policies so browser clients cannot read the financial foundation directly.

create extension if not exists pgcrypto;

create table if not exists public.workbook_employees (
  employee_id text primary key,
  employee_name text not null,
  position text,
  supervisor text,
  hours_per_day numeric(8,2),
  start_date date,
  end_date date,
  active text,
  source_sheet text not null default 'Employees'
);

create table if not exists public.workbook_projects (
  project_code text primary key,
  project_name text,
  donor text,
  start_date date,
  end_date date,
  status text,
  admin_allowed text,
  personnel_budget_ugx numeric(18,2),
  eligible_employee_id text,
  source_sheet text not null default 'Projects'
);

create table if not exists public.workbook_payroll (
  month date not null,
  employee_id text not null,
  basic_salary_ugx numeric(18,2) not null default 0,
  benefits numeric(18,2) not null default 0,
  statutory_cost numeric(18,2) not null default 0,
  exclusions numeric(18,2) not null default 0,
  allocable_cost numeric(18,2) generated always as (basic_salary_ugx + benefits + statutory_cost - exclusions) stored,
  source text,
  configuration_status text,
  notes text,
  primary key(month, employee_id)
);

create table if not exists public.workbook_calendar (
  work_date date primary key,
  month date not null,
  day_name text,
  day_type text,
  standard_hours numeric(8,2) not null default 0,
  holiday_source text
);

create table if not exists public.workbook_time_entries (
  entry_id text primary key,
  work_date date not null,
  month date not null,
  employee_id text not null,
  employee_name text,
  project_code text not null,
  activity_evidence text,
  hours numeric(8,2) not null,
  time_type text,
  status text,
  ai_suggested_project text,
  ai_confidence numeric(8,6),
  employee_decision text,
  source_daily_total numeric(8,2),
  source_daily_check text,
  source_project_eligibility text,
  source_ai_coding_check text,
  source_entry_assurance text
);
create index if not exists workbook_time_entries_month_idx on public.workbook_time_entries(month);
create index if not exists workbook_time_entries_project_idx on public.workbook_time_entries(project_code, month);

create table if not exists public.workbook_source_checks (
  month date primary key,
  check_name text,
  source_target numeric(12,4),
  severity text,
  where_to_fix text
);

create table if not exists public.workbook_sources (
  id bigint generated always as identity primary key,
  item text,
  value text,
  units text,
  period_as_of text,
  source_type text,
  source_name text,
  reference text,
  owner text,
  status text,
  notes text
);

create table if not exists public.workbook_formula_catalog (
  id bigint generated always as identity primary key,
  sheet_name text not null,
  field_name text not null,
  excel_formula text not null,
  application_logic text not null
);

create table if not exists public.agent_learning_mappings (
  id uuid primary key default gen_random_uuid(),
  activity_key text not null,
  activity_example text not null,
  project_code text not null,
  accepted_count integer not null default 1,
  confirmed_by text not null default 'human',
  note text,
  created_at timestamptz not null default now(),
  last_confirmed_at timestamptz not null default now(),
  unique(activity_key, project_code)
);

create table if not exists public.workbook_engine_metadata (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- The current prototype does not expose Supabase directly to browser users.
-- The server can access these tables with a secret/service-role credential.
alter table public.workbook_employees enable row level security;
alter table public.workbook_projects enable row level security;
alter table public.workbook_payroll enable row level security;
alter table public.workbook_calendar enable row level security;
alter table public.workbook_time_entries enable row level security;
alter table public.workbook_source_checks enable row level security;
alter table public.workbook_sources enable row level security;
alter table public.workbook_formula_catalog enable row level security;
alter table public.agent_learning_mappings enable row level security;
alter table public.workbook_engine_metadata enable row level security;
