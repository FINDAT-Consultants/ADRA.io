-- Assurance Regent v6.3.53 — Department Hub pagination support and event reminder calendar.
-- Adds company-isolated event/reminder persistence plus a larger Project News read bundle.

create table if not exists public.assurance_regent_department_events (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  department text not null default 'Company Lounge',
  title text not null,
  description text not null default '',
  location text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz,
  created_by text not null,
  creator_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  constraint assurance_regent_department_events_time_chk check (ends_at is null or ends_at > starts_at)
);

create index if not exists assurance_regent_department_events_company_start_idx
  on public.assurance_regent_department_events(company_id,starts_at);
create index if not exists assurance_regent_department_events_company_department_start_idx
  on public.assurance_regent_department_events(company_id,department,starts_at);

create table if not exists public.assurance_regent_department_event_reminders (
  event_id uuid not null references public.assurance_regent_department_events(id) on delete cascade,
  company_id text not null,
  user_id text not null,
  remind_minutes_before integer not null default 1440,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(event_id,user_id),
  constraint assurance_regent_department_event_reminder_minutes_chk check (remind_minutes_before between 0 and 43200)
);

create index if not exists assurance_regent_department_event_reminders_user_idx
  on public.assurance_regent_department_event_reminders(company_id,user_id);

alter table public.assurance_regent_department_events enable row level security;
alter table public.assurance_regent_department_event_reminders enable row level security;
revoke all on table public.assurance_regent_department_events from public,anon,authenticated;
revoke all on table public.assurance_regent_department_event_reminders from public,anon,authenticated;

create or replace function public.assurance_regent_browser_department_project_news(
  p_token text,
  p_company_id text default '',
  p_limit integer default 90
) returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  a jsonb; cid text; uid text; lim int; st jsonb:='{}'::jsonb; rows jsonb;
begin
  a:=public.assurance_regent_browser_actor_from_token(p_token);
  cid:=case when a->>'role'='Developer'
    then coalesce(nullif(trim(coalesce(p_company_id,'')),''),nullif(a->>'companyId',''))
    else nullif(a->>'companyId','') end;
  uid:=coalesce(a->>'id','');
  lim:=greatest(3,least(coalesce(p_limit,90),120));
  if coalesce(cid,'')='' then return '[]'::jsonb; end if;
  select coalesce(state_value,'{}'::jsonb) into st from public.assurance_regent_state where state_key='browser-client-state';

  select coalesce(jsonb_agg(x.row_json order by x.created_at desc),'[]'::jsonb) into rows
  from (
    select m.created_at,
      jsonb_build_object(
        'id',m.id,'companyId',m.company_id,'department','Project News',
        'senderId',m.sender_id,'senderName',m.sender_name,'content',m.content,
        'postKind','PROJECT_NEWS','attachments',coalesce(m.attachments,'[]'::jsonb),
        'createdAt',m.created_at,'updatedAt',m.updated_at,
        'reactionSummary',coalesce((select jsonb_agg(jsonb_build_object('emoji',r2.emoji,'count',r2.cnt) order by r2.cnt desc,r2.emoji) from (select r.emoji,count(*)::int cnt from public.assurance_regent_department_reactions r where r.message_id=m.id group by r.emoji) r2),'[]'::jsonb),
        'reactionPeople',public.assurance_regent_department_reaction_people_internal(m.id,st),
        'myReaction',coalesce((select r.emoji from public.assurance_regent_department_reactions r where r.message_id=m.id and r.user_id=uid limit 1),''),
        'replyCount',(select count(*)::int from public.assurance_regent_department_messages q where q.parent_id=m.id)
      ) row_json
    from public.assurance_regent_department_messages m
    where m.company_id=cid and m.parent_id is null and m.post_kind='PROJECT_NEWS'
    order by m.created_at desc
    limit lim
  ) x;
  return rows;
end $function$;

create or replace function public.assurance_regent_browser_department_event_bundle(
  p_token text,
  p_company_id text default '',
  p_department text default 'Company Lounge',
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit integer default 180
) returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  a jsonb; cid text; uid text; dep text; lim int; from_at timestamptz; to_at timestamptz; rows jsonb;
begin
  a:=public.assurance_regent_browser_actor_from_token(p_token);
  cid:=case when a->>'role'='Developer'
    then coalesce(nullif(trim(coalesce(p_company_id,'')),''),nullif(a->>'companyId',''))
    else nullif(a->>'companyId','') end;
  uid:=coalesce(a->>'id','');
  dep:=left(trim(coalesce(p_department,'Company Lounge')),160);
  if dep='' then dep:='Company Lounge'; end if;
  lim:=greatest(20,least(coalesce(p_limit,180),300));
  from_at:=coalesce(p_from,now()-interval '60 days');
  to_at:=coalesce(p_to,now()+interval '400 days');
  if coalesce(cid,'')='' then raise exception 'Select a company before opening its Department Hub calendar.'; end if;
  if to_at<=from_at then raise exception 'Calendar end must be after calendar start.'; end if;

  select coalesce(jsonb_agg(x.row_json order by x.starts_at asc),'[]'::jsonb) into rows
  from (
    select e.starts_at,
      jsonb_build_object(
        'id',e.id,'companyId',e.company_id,'department',e.department,
        'title',e.title,'description',e.description,'location',e.location,
        'startsAt',e.starts_at,'endsAt',e.ends_at,
        'creatorId',e.created_by,'creatorName',e.creator_name,
        'createdAt',e.created_at,'updatedAt',e.updated_at,
        'myReminderMinutes',r.remind_minutes_before,
        'reminderDue',case when r.user_id is null then false
          when e.starts_at<=now() then false
          else e.starts_at-make_interval(mins=>r.remind_minutes_before)<=now() end
      ) row_json
    from public.assurance_regent_department_events e
    left join public.assurance_regent_department_event_reminders r
      on r.event_id=e.id and r.company_id=e.company_id and r.user_id=uid
    where e.company_id=cid and e.cancelled_at is null
      and e.starts_at>=from_at and e.starts_at<to_at
      and (dep='Company Lounge' or e.department='Company Lounge' or e.department=dep)
    order by e.starts_at asc
    limit lim
  ) x;

  return jsonb_build_object('companyId',cid,'department',dep,'events',rows,'serverTime',now());
end $function$;

create or replace function public.assurance_regent_browser_department_event_create(
  p_token text,
  p_company_id text default '',
  p_department text default 'Company Lounge',
  p_title text default '',
  p_description text default '',
  p_location text default '',
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_reminder_minutes integer default 1440
) returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  a jsonb; cid text; uid text; dep text; ttl text; descr text; loc text; eid uuid; reminder_minutes int;
begin
  a:=public.assurance_regent_browser_actor_from_token(p_token);
  cid:=case when a->>'role'='Developer'
    then coalesce(nullif(trim(coalesce(p_company_id,'')),''),nullif(a->>'companyId',''))
    else nullif(a->>'companyId','') end;
  uid:=coalesce(a->>'id','');
  dep:=left(trim(coalesce(p_department,'Company Lounge')),160);
  ttl:=left(trim(coalesce(p_title,'')),180);
  descr:=left(trim(coalesce(p_description,'')),3000);
  loc:=left(trim(coalesce(p_location,'')),240);
  if dep='' then dep:='Company Lounge'; end if;
  if coalesce(cid,'')='' then raise exception 'Select a company before posting an event.'; end if;
  if uid='' then raise exception 'Sign in before posting an event.'; end if;
  if ttl='' then raise exception 'Add an event title.'; end if;
  if p_starts_at is null then raise exception 'Choose an event start time.'; end if;
  if p_starts_at<now()-interval '5 minutes' then raise exception 'Event start time must be in the future.'; end if;
  if p_ends_at is not null and p_ends_at<=p_starts_at then raise exception 'Event end time must be after the start time.'; end if;

  insert into public.assurance_regent_department_events(
    company_id,department,title,description,location,starts_at,ends_at,created_by,creator_name,updated_at
  ) values(
    cid,dep,ttl,descr,loc,p_starts_at,p_ends_at,uid,coalesce(nullif(a->>'name',''),uid),now()
  ) returning id into eid;

  if coalesce(p_reminder_minutes,-1)>=0 then
    reminder_minutes:=greatest(0,least(p_reminder_minutes,43200));
    insert into public.assurance_regent_department_event_reminders(event_id,company_id,user_id,remind_minutes_before,updated_at)
    values(eid,cid,uid,reminder_minutes,now())
    on conflict(event_id,user_id) do update set remind_minutes_before=excluded.remind_minutes_before,company_id=excluded.company_id,updated_at=now();
  end if;

  return jsonb_build_object('ok',true,'id',eid,'companyId',cid,'department',dep,'title',ttl,'startsAt',p_starts_at,'reminderMinutes',case when coalesce(p_reminder_minutes,-1)>=0 then reminder_minutes else null end);
end $function$;

create or replace function public.assurance_regent_browser_department_event_set_reminder(
  p_token text,
  p_company_id text default '',
  p_event_id uuid default null,
  p_minutes_before integer default 1440,
  p_enabled boolean default true
) returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  a jsonb; cid text; uid text; event_company text; mins int;
begin
  a:=public.assurance_regent_browser_actor_from_token(p_token);
  cid:=case when a->>'role'='Developer'
    then coalesce(nullif(trim(coalesce(p_company_id,'')),''),nullif(a->>'companyId',''))
    else nullif(a->>'companyId','') end;
  uid:=coalesce(a->>'id','');
  if coalesce(cid,'')='' then raise exception 'Select a company before changing an event reminder.'; end if;
  if p_event_id is null then raise exception 'Select an event.'; end if;
  select company_id into event_company from public.assurance_regent_department_events where id=p_event_id and cancelled_at is null limit 1;
  if event_company is null or event_company<>cid then raise exception 'This event is unavailable to your company.'; end if;

  if not coalesce(p_enabled,true) then
    delete from public.assurance_regent_department_event_reminders where event_id=p_event_id and company_id=cid and user_id=uid;
    return jsonb_build_object('ok',true,'eventId',p_event_id,'enabled',false);
  end if;

  mins:=greatest(0,least(coalesce(p_minutes_before,1440),43200));
  insert into public.assurance_regent_department_event_reminders(event_id,company_id,user_id,remind_minutes_before,updated_at)
  values(p_event_id,cid,uid,mins,now())
  on conflict(event_id,user_id) do update set remind_minutes_before=excluded.remind_minutes_before,company_id=excluded.company_id,updated_at=now();
  return jsonb_build_object('ok',true,'eventId',p_event_id,'enabled',true,'minutesBefore',mins);
end $function$;

revoke all on function public.assurance_regent_browser_department_project_news(text,text,integer) from public;
revoke all on function public.assurance_regent_browser_department_event_bundle(text,text,text,timestamptz,timestamptz,integer) from public;
revoke all on function public.assurance_regent_browser_department_event_create(text,text,text,text,text,text,timestamptz,timestamptz,integer) from public;
revoke all on function public.assurance_regent_browser_department_event_set_reminder(text,text,uuid,integer,boolean) from public;
grant execute on function public.assurance_regent_browser_department_project_news(text,text,integer) to anon,authenticated;
grant execute on function public.assurance_regent_browser_department_event_bundle(text,text,text,timestamptz,timestamptz,integer) to anon,authenticated;
grant execute on function public.assurance_regent_browser_department_event_create(text,text,text,text,text,text,timestamptz,timestamptz,integer) to anon,authenticated;
grant execute on function public.assurance_regent_browser_department_event_set_reminder(text,text,uuid,integer,boolean) to anon,authenticated;
