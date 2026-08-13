-- Assurance Regent v5.9.0 — Jivan delegated/background task queue
-- Run AFTER DEVELOPER_GOVERNANCE_V5_4_0.sql and LEAVE_WORK_STATUS_V5_8_0.sql.
-- Keeps delegated work role-scoped to the signed-in Assurance Regent user.

create extension if not exists pgcrypto;

create table if not exists public.assurance_regent_agent_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  user_role text not null,
  company_id text not null default '',
  title text not null default 'Jivan delegated task',
  instruction text not null,
  priority text not null default 'NORMAL' check (priority in ('LOW','NORMAL','HIGH')),
  status text not null default 'QUEUED' check (status in ('QUEUED','RUNNING','WAITING_USER','COMPLETED','FAILED','CANCELLED')),
  result_text text not null default '',
  result_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists assurance_regent_agent_tasks_user_status_idx
  on public.assurance_regent_agent_tasks(user_id,status,created_at desc);
create index if not exists assurance_regent_agent_tasks_company_idx
  on public.assurance_regent_agent_tasks(company_id,created_at desc);

alter table public.assurance_regent_agent_tasks enable row level security;
revoke all on public.assurance_regent_agent_tasks from public,anon,authenticated;

create or replace function public.assurance_regent_browser_agent_task_create(
  p_token text,
  p_title text,
  p_instruction text,
  p_priority text default 'NORMAL'
) returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_actor jsonb;
  v_priority text:=upper(trim(coalesce(p_priority,'NORMAL')));
  v_row public.assurance_regent_agent_tasks;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  if trim(coalesce(p_instruction,''))='' then raise exception 'A delegated task instruction is required.'; end if;
  if length(p_instruction)>12000 then raise exception 'The delegated task is too long.'; end if;
  if v_priority not in ('LOW','NORMAL','HIGH') then v_priority:='NORMAL'; end if;

  insert into public.assurance_regent_agent_tasks(
    user_id,user_role,company_id,title,instruction,priority,status
  ) values (
    coalesce(v_actor->>'id',''),
    coalesce(v_actor->>'role','Employee'),
    coalesce(v_actor->>'companyId',''),
    left(coalesce(nullif(trim(p_title),''),'Jivan delegated task'),180),
    left(trim(p_instruction),12000),
    v_priority,
    'QUEUED'
  ) returning * into v_row;
  return to_jsonb(v_row);
end $$;

create or replace function public.assurance_regent_browser_agent_task_list(
  p_token text,
  p_limit integer default 30
) returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_actor jsonb;
  v_uid text;
  v_limit integer:=greatest(1,least(coalesce(p_limit,30),100));
  v_rows jsonb;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  v_uid:=coalesce(v_actor->>'id','');
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb)
  into v_rows
  from (
    select id,user_id,user_role,company_id,title,instruction,priority,status,result_text,result_metadata,created_at,started_at,completed_at,updated_at
    from public.assurance_regent_agent_tasks
    where user_id=v_uid
    order by created_at desc
    limit v_limit
  ) x;
  return coalesce(v_rows,'[]'::jsonb);
end $$;

create or replace function public.assurance_regent_browser_agent_task_claim_next(p_token text)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_actor jsonb;
  v_uid text;
  v_id uuid;
  v_row public.assurance_regent_agent_tasks;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  v_uid:=coalesce(v_actor->>'id','');

  select id into v_id
  from public.assurance_regent_agent_tasks
  where user_id=v_uid
    and (status='QUEUED' or (status='RUNNING' and updated_at < now() - interval '10 minutes'))
  order by case when status='RUNNING' then 0 else 1 end, case priority when 'HIGH' then 0 when 'NORMAL' then 1 else 2 end, created_at asc
  for update skip locked
  limit 1;

  if v_id is null then return null; end if;
  update public.assurance_regent_agent_tasks
    set status='RUNNING',started_at=coalesce(started_at,now()),updated_at=now()
  where id=v_id and user_id=v_uid
    and (status='QUEUED' or (status='RUNNING' and updated_at < now() - interval '10 minutes'))
  returning * into v_row;
  if v_row.id is null then return null; end if;
  return to_jsonb(v_row);
end $$;

create or replace function public.assurance_regent_browser_agent_task_finish(
  p_token text,
  p_task_id uuid,
  p_status text,
  p_result_text text default '',
  p_result_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_actor jsonb;
  v_uid text;
  v_status text:=upper(trim(coalesce(p_status,'')));
  v_row public.assurance_regent_agent_tasks;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  v_uid:=coalesce(v_actor->>'id','');
  if v_status not in ('WAITING_USER','COMPLETED','FAILED','CANCELLED') then raise exception 'Unsupported task completion status.'; end if;

  update public.assurance_regent_agent_tasks
  set status=v_status,
      result_text=left(coalesce(p_result_text,''),24000),
      result_metadata=coalesce(p_result_metadata,'{}'::jsonb),
      completed_at=case when v_status in ('COMPLETED','FAILED','CANCELLED') then now() else completed_at end,
      updated_at=now()
  where id=p_task_id and user_id=v_uid and status in ('QUEUED','RUNNING','WAITING_USER')
  returning * into v_row;
  if v_row.id is null then raise exception 'The delegated task is unavailable or no longer active.'; end if;
  return to_jsonb(v_row);
end $$;

create or replace function public.assurance_regent_browser_agent_task_cancel(
  p_token text,
  p_task_id uuid
) returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_actor jsonb;
  v_uid text;
  v_row public.assurance_regent_agent_tasks;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  v_uid:=coalesce(v_actor->>'id','');
  update public.assurance_regent_agent_tasks
  set status='CANCELLED',completed_at=now(),updated_at=now()
  where id=p_task_id and user_id=v_uid and status in ('QUEUED','RUNNING','WAITING_USER')
  returning * into v_row;
  if v_row.id is null then raise exception 'The delegated task is unavailable or already finished.'; end if;
  return to_jsonb(v_row);
end $$;

revoke all on function public.assurance_regent_browser_agent_task_create(text,text,text,text) from public;
revoke all on function public.assurance_regent_browser_agent_task_list(text,integer) from public;
revoke all on function public.assurance_regent_browser_agent_task_claim_next(text) from public;
revoke all on function public.assurance_regent_browser_agent_task_finish(text,uuid,text,text,jsonb) from public;
revoke all on function public.assurance_regent_browser_agent_task_cancel(text,uuid) from public;

grant execute on function public.assurance_regent_browser_agent_task_create(text,text,text,text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_agent_task_list(text,integer) to anon,authenticated;
grant execute on function public.assurance_regent_browser_agent_task_claim_next(text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_agent_task_finish(text,uuid,text,text,jsonb) to anon,authenticated;
grant execute on function public.assurance_regent_browser_agent_task_cancel(text,uuid) to anon,authenticated;
