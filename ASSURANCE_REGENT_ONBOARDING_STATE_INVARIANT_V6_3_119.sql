-- Assurance Regent v6.3.119
-- Deep-rooted onboarding invariant: completed onboarding rows are audit history,
-- never active queue state. Browser state reads and writes both enforce it.

create table if not exists public.assurance_regent_onboarding_history (
  company_id text not null default '',
  onboarding_id text not null,
  candidate_id text not null default '',
  employee_id text not null default '',
  employee_name text not null default '',
  status text not null default 'Complete',
  payload jsonb not null default '{}'::jsonb,
  completed_at timestamptz not null default now(),
  first_archived_at timestamptz not null default now(),
  last_archived_at timestamptz not null default now(),
  primary key (company_id, onboarding_id)
);

alter table public.assurance_regent_onboarding_history enable row level security;
revoke all on table public.assurance_regent_onboarding_history from public, anon, authenticated;

create index if not exists assurance_regent_onboarding_history_candidate_idx
  on public.assurance_regent_onboarding_history (company_id, candidate_id);
create index if not exists assurance_regent_onboarding_history_employee_idx
  on public.assurance_regent_onboarding_history (company_id, employee_id);
create index if not exists assurance_regent_onboarding_history_completed_idx
  on public.assurance_regent_onboarding_history (completed_at desc);

with completed as (
  select
    coalesce(nullif(trim(x.value->>'companyId'),''),'') as company_id,
    trim(x.value->>'id') as onboarding_id,
    coalesce(x.value->>'candidateId','') as candidate_id,
    coalesce(x.value->>'employeeId','') as employee_id,
    coalesce(x.value->>'name','') as employee_name,
    coalesce(x.value->>'status','Complete') as status,
    x.value as payload
  from public.assurance_regent_state s
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(s.state_value#>'{live,onboarding}')='array'
      then s.state_value#>'{live,onboarding}' else '[]'::jsonb end
  ) as x(value)
  where s.state_key='browser-client-state'
    and lower(trim(coalesce(x.value->>'status','')))='complete'
    and coalesce(trim(x.value->>'id'),'')<>''
)
insert into public.assurance_regent_onboarding_history
  (company_id,onboarding_id,candidate_id,employee_id,employee_name,status,payload)
select company_id,onboarding_id,candidate_id,employee_id,employee_name,status,payload
from completed
on conflict (company_id,onboarding_id) do update
set candidate_id=excluded.candidate_id,
    employee_id=excluded.employee_id,
    employee_name=excluded.employee_name,
    status=excluded.status,
    payload=excluded.payload,
    last_archived_at=now();

update public.assurance_regent_state s
set state_value=jsonb_set(
      s.state_value,
      '{live,onboarding}',
      coalesce((
        select jsonb_agg(x.value)
        from jsonb_array_elements(
          case when jsonb_typeof(s.state_value#>'{live,onboarding}')='array'
            then s.state_value#>'{live,onboarding}' else '[]'::jsonb end
        ) as x(value)
        where lower(trim(coalesce(x.value->>'status',''))) <> 'complete'
      ),'[]'::jsonb),
      true
    ),
    updated_at=now()
where s.state_key='browser-client-state'
  and jsonb_typeof(s.state_value->'live')='object';

create or replace function public.assurance_regent_browser_write_state(p_token text, p_value jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_actor jsonb;
  v_role text;
  v_current jsonb;
  v_next jsonb := p_value;
  v_onboarding jsonb := '[]'::jsonb;
  v_item jsonb;
  v_company_id text;
begin
  v_actor := public.assurance_regent_browser_actor_from_token(p_token);
  v_role := coalesce(v_actor->>'role','Employee');

  if p_value is null or jsonb_typeof(p_value) <> 'object' then
    raise exception 'Invalid Assurance Regent state.';
  end if;

  select state_value into v_current
  from public.assurance_regent_state
  where state_key='browser-client-state'
  for update;

  if v_role <> 'Developer' then
    v_next := jsonb_set(
      v_next,
      '{auth}',
      coalesce(v_current->'auth',jsonb_build_object('accounts','[]'::jsonb,'companies','[]'::jsonb)),
      true
    );
  end if;

  if jsonb_typeof(v_next#>'{live,onboarding}')='array' then
    v_onboarding := v_next#>'{live,onboarding}';
  end if;

  for v_item in select value from jsonb_array_elements(v_onboarding) as x(value)
  loop
    if lower(trim(coalesce(v_item->>'status','')))='complete'
       and coalesce(trim(v_item->>'id'),'')<>'' then
      v_company_id := coalesce(
        nullif(trim(v_item->>'companyId'),''),
        nullif(trim(v_actor->>'companyId'),''),
        ''
      );

      insert into public.assurance_regent_onboarding_history
        (company_id,onboarding_id,candidate_id,employee_id,employee_name,status,payload)
      values (
        v_company_id,
        trim(v_item->>'id'),
        coalesce(v_item->>'candidateId',''),
        coalesce(v_item->>'employeeId',''),
        coalesce(v_item->>'name',''),
        coalesce(v_item->>'status','Complete'),
        v_item
      )
      on conflict (company_id,onboarding_id) do update
      set candidate_id=excluded.candidate_id,
          employee_id=excluded.employee_id,
          employee_name=excluded.employee_name,
          status=excluded.status,
          payload=excluded.payload,
          last_archived_at=now();
    end if;
  end loop;

  if jsonb_typeof(v_next->'live')='object' then
    v_next := jsonb_set(
      v_next,
      '{live,onboarding}',
      coalesce((
        select jsonb_agg(x.value)
        from jsonb_array_elements(v_onboarding) as x(value)
        where lower(trim(coalesce(x.value->>'status',''))) <> 'complete'
      ),'[]'::jsonb),
      true
    );
  end if;

  insert into public.assurance_regent_state(state_key,state_value,updated_at)
  values('browser-client-state',v_next,now())
  on conflict(state_key) do update
  set state_value=excluded.state_value,
      updated_at=excluded.updated_at;

  update public.assurance_regent_auth_sessions
  set updated_at=now(),expires_at=now()+interval '12 hours'
  where token_hash=encode(digest(convert_to(p_token,'UTF8'),'sha256'),'hex');

  return v_next;
end
$function$;

-- Defense in depth: stale/corrupt storage must never expose completed hires as active onboarding.
create or replace function public.assurance_regent_browser_read_state(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_actor jsonb;
  v_value jsonb;
begin
  v_actor := public.assurance_regent_browser_actor_from_token(p_token);

  update public.assurance_regent_auth_sessions
  set updated_at=now(),expires_at=now()+interval '12 hours'
  where token_hash=encode(digest(convert_to(p_token,'UTF8'),'sha256'),'hex');

  select state_value into v_value
  from public.assurance_regent_state
  where state_key='browser-client-state';

  v_value := coalesce(v_value,'{}'::jsonb);

  if jsonb_typeof(v_value->'live')='object'
     and jsonb_typeof(v_value#>'{live,onboarding}')='array' then
    v_value := jsonb_set(
      v_value,
      '{live,onboarding}',
      coalesce((
        select jsonb_agg(x.value)
        from jsonb_array_elements(v_value#>'{live,onboarding}') as x(value)
        where lower(trim(coalesce(x.value->>'status',''))) <> 'complete'
      ),'[]'::jsonb),
      true
    );
  end if;

  return v_value;
end
$function$;
