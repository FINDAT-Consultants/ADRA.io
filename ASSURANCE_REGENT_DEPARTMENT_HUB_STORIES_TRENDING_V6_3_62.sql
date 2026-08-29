-- Assurance Regent v6.3.62
-- Department Hub status presentation, viewership and trending analytics.

create table if not exists public.assurance_regent_department_social_views (
  company_id text not null,
  message_id uuid not null references public.assurance_regent_department_messages(id) on delete cascade,
  user_id text not null,
  first_viewed_at timestamptz not null default now(),
  last_viewed_at timestamptz not null default now(),
  view_count integer not null default 1 check (view_count > 0),
  primary key (company_id, message_id, user_id)
);
create index if not exists assurance_regent_department_social_views_message_idx
  on public.assurance_regent_department_social_views(company_id, message_id, last_viewed_at desc);
alter table public.assurance_regent_department_social_views enable row level security;
revoke all on table public.assurance_regent_department_social_views from anon, authenticated;

create table if not exists public.assurance_regent_department_status_presentation (
  message_id uuid primary key references public.assurance_regent_department_messages(id) on delete cascade,
  company_id text not null,
  effect text not null default 'fade',
  slide_seconds smallint not null default 5 check (slide_seconds between 2 and 12),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assurance_regent_department_status_presentation_effect_chk
    check (effect in ('fade','slide','zoom','kenburns','none'))
);
create index if not exists assurance_regent_department_status_presentation_company_idx
  on public.assurance_regent_department_status_presentation(company_id, updated_at desc);
alter table public.assurance_regent_department_status_presentation enable row level security;
revoke all on table public.assurance_regent_department_status_presentation from anon, authenticated;

create or replace function public.assurance_regent_browser_department_status_presentation_get(
  p_token text,
  p_message_id uuid,
  p_company_id text default ''
) returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  a jsonb; cid text; row_company text; kind text; fx text; secs smallint;
begin
  a:=public.assurance_regent_browser_actor_from_token(p_token);
  cid:=case when a->>'role'='Developer'
    then coalesce(nullif(trim(coalesce(p_company_id,'')),''),nullif(a->>'companyId',''))
    else nullif(a->>'companyId','') end;
  if coalesce(cid,'')='' then raise exception 'Select a company before viewing its Department Hub.'; end if;
  select company_id,post_kind into row_company,kind
  from public.assurance_regent_department_messages
  where id=p_message_id limit 1;
  if row_company is null or row_company<>cid or kind<>'STATUS' then
    raise exception 'This status is unavailable.';
  end if;
  select effect,slide_seconds into fx,secs
  from public.assurance_regent_department_status_presentation
  where message_id=p_message_id and company_id=cid;
  return jsonb_build_object('messageId',p_message_id,'effect',coalesce(fx,'fade'),'slideSeconds',coalesce(secs,5));
end $function$;

create or replace function public.assurance_regent_browser_department_status_presentation_set(
  p_token text,
  p_message_id uuid,
  p_effect text default 'fade',
  p_slide_seconds integer default 5,
  p_company_id text default ''
) returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  a jsonb; cid text; uid text; row_sender text; row_company text; kind text;
  fx text:=lower(trim(coalesce(p_effect,'fade'))); secs smallint:=greatest(2,least(coalesce(p_slide_seconds,5),12))::smallint;
begin
  a:=public.assurance_regent_browser_actor_from_token(p_token);
  cid:=case when a->>'role'='Developer'
    then coalesce(nullif(trim(coalesce(p_company_id,'')),''),nullif(a->>'companyId',''))
    else nullif(a->>'companyId','') end;
  uid:=coalesce(a->>'id','');
  if fx not in ('fade','slide','zoom','kenburns','none') then fx:='fade'; end if;
  select company_id,sender_id,post_kind into row_company,row_sender,kind
  from public.assurance_regent_department_messages
  where id=p_message_id limit 1;
  if row_company is null or row_company<>cid or kind<>'STATUS' then raise exception 'This status is unavailable.'; end if;
  if row_sender<>uid and a->>'role'<>'Developer' then raise exception 'Only the status owner can change its presentation.'; end if;
  insert into public.assurance_regent_department_status_presentation(message_id,company_id,effect,slide_seconds,updated_at)
  values(p_message_id,cid,fx,secs,now())
  on conflict(message_id) do update set company_id=excluded.company_id,effect=excluded.effect,slide_seconds=excluded.slide_seconds,updated_at=now();
  return jsonb_build_object('ok',true,'messageId',p_message_id,'effect',fx,'slideSeconds',secs);
end $function$;

create or replace function public.assurance_regent_browser_department_social_view(
  p_token text,
  p_message_id uuid,
  p_company_id text default ''
) returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  a jsonb; cid text; uid text; row_company text; owner_id text; kind text;
  unique_views integer:=0; impressions bigint:=0;
begin
  a:=public.assurance_regent_browser_actor_from_token(p_token);
  cid:=case when a->>'role'='Developer'
    then coalesce(nullif(trim(coalesce(p_company_id,'')),''),nullif(a->>'companyId',''))
    else nullif(a->>'companyId','') end;
  uid:=coalesce(a->>'id','');
  if coalesce(cid,'')='' then raise exception 'Select a company before viewing its Department Hub.'; end if;
  select company_id,sender_id,post_kind into row_company,owner_id,kind
  from public.assurance_regent_department_messages
  where id=p_message_id and parent_id is null limit 1;
  if row_company is null or row_company<>cid then raise exception 'This Department Hub item is unavailable.'; end if;
  if kind not in ('POST','PROJECT_NEWS','STATUS') then raise exception 'This Department Hub item cannot be viewed.'; end if;
  if uid<>owner_id then
    insert into public.assurance_regent_department_social_views(company_id,message_id,user_id,first_viewed_at,last_viewed_at,view_count)
    values(cid,p_message_id,uid,now(),now(),1)
    on conflict(company_id,message_id,user_id) do update
      set last_viewed_at=now(), view_count=least(public.assurance_regent_department_social_views.view_count+1,1000000);
  end if;
  select count(*)::int,coalesce(sum(view_count),0)::bigint into unique_views,impressions
  from public.assurance_regent_department_social_views where company_id=cid and message_id=p_message_id;
  return jsonb_build_object('ok',true,'messageId',p_message_id,'viewCount',unique_views,'impressions',impressions);
end $function$;

create or replace function public.assurance_regent_browser_department_social_trending(
  p_token text,
  p_company_id text default '',
  p_limit integer default 5
) returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  a jsonb; cid text; lim integer:=greatest(1,least(coalesce(p_limit,5),10)); result jsonb;
begin
  a:=public.assurance_regent_browser_actor_from_token(p_token);
  cid:=case when a->>'role'='Developer'
    then coalesce(nullif(trim(coalesce(p_company_id,'')),''),nullif(a->>'companyId',''))
    else nullif(a->>'companyId','') end;
  if coalesce(cid,'')='' then raise exception 'Select a company before viewing its Department Hub.'; end if;

  with recursive candidates as (
    select m.id,m.company_id,m.department,m.sender_id,m.sender_name,m.content,m.post_kind,m.created_at
    from public.assurance_regent_department_messages m
    where m.company_id=cid and m.parent_id is null and m.post_kind in ('POST','PROJECT_NEWS')
      and m.created_at>=now()-interval '30 days'
  ), thread(root_id,id,sender_id) as (
    select c.id,c.id,c.sender_id from candidates c
    union all
    select t.root_id,r.id,r.sender_id
    from thread t
    join public.assurance_regent_department_messages r on r.parent_id=t.id and r.company_id=cid
  ), metrics as (
    select c.*,
      coalesce((select count(*) from public.assurance_regent_department_reactions r where r.message_id=c.id),0)::int as post_reactions,
      coalesce((select count(*) from thread t join public.assurance_regent_department_reactions r on r.message_id=t.id where t.root_id=c.id and t.id<>c.id),0)::int as comment_reactions,
      coalesce((select count(*) from thread t where t.root_id=c.id and t.id<>c.id),0)::int as comments,
      coalesce((select count(distinct t.sender_id) from thread t where t.root_id=c.id and t.id<>c.id and coalesce(t.sender_id,'')<>''),0)::int as contributors,
      coalesce((select count(*) from public.assurance_regent_department_social_views v where v.company_id=cid and v.message_id=c.id),0)::int as viewers,
      coalesce((select sum(v.view_count) from public.assurance_regent_department_social_views v where v.company_id=cid and v.message_id=c.id),0)::bigint as impressions,
      greatest(0,extract(epoch from (now()-c.created_at))/3600.0) as age_hours
    from candidates c
  ), ranked as (
    select m.*,
      round(((m.viewers*0.8 + m.impressions*0.2 + m.post_reactions*2.2 + m.comment_reactions*1.1 + m.comments*2.5 + m.contributors*1.4)
        * (1.0/(1.0+m.age_hours/72.0)))::numeric,1)::double precision as trend_score
    from metrics m
  ), top_rows as (
    select * from ranked
    order by trend_score desc, created_at desc
    limit lim
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'companyId',company_id,'department',department,'senderId',sender_id,'senderName',sender_name,
    'content',content,'postKind',post_kind,'createdAt',created_at,'trendScore',trend_score,
    'viewCount',viewers,'impressions',impressions,'reactions',post_reactions+comment_reactions,
    'postReactions',post_reactions,'commentReactions',comment_reactions,'comments',comments,'contributors',contributors,
    'trendLabel',case when trend_score>=30 then 'Hot' when trend_score>=15 then 'Rising' when trend_score>=6 then 'Active' when trend_score>0 then 'Building' else 'New' end
  ) order by trend_score desc,created_at desc),'[]'::jsonb) into result from top_rows;
  return result;
end $function$;

grant execute on function public.assurance_regent_browser_department_status_presentation_get(text,uuid,text) to anon,authenticated,service_role;
grant execute on function public.assurance_regent_browser_department_status_presentation_set(text,uuid,text,integer,text) to anon,authenticated,service_role;
grant execute on function public.assurance_regent_browser_department_social_view(text,uuid,text) to anon,authenticated,service_role;
grant execute on function public.assurance_regent_browser_department_social_trending(text,text,integer) to anon,authenticated,service_role;
