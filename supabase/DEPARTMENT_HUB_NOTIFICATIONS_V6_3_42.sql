-- Assurance Regent v6.3.42
-- Department Hub unread social-activity notifications.
-- Private internal Messages remain isolated from Notifications.

create table if not exists public.assurance_regent_department_social_reads (
  user_id text not null,
  message_id uuid not null references public.assurance_regent_department_messages(id) on delete cascade,
  company_id text not null,
  read_at timestamptz not null default now(),
  primary key (user_id,message_id)
);

create index if not exists assurance_regent_department_social_reads_company_idx
  on public.assurance_regent_department_social_reads(company_id,user_id,read_at desc);

alter table public.assurance_regent_department_social_reads enable row level security;
revoke all on public.assurance_regent_department_social_reads from public, anon, authenticated;

create or replace function public.assurance_regent_browser_department_social_notifications(
  p_token text,
  p_company_id text default '',
  p_limit integer default 30
) returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  a jsonb;
  cid text;
  uid text;
  lim int;
  rows jsonb;
begin
  a:=public.assurance_regent_browser_actor_from_token(p_token);
  uid:=coalesce(a->>'id','');
  cid:=case when a->>'role'='Developer'
    then coalesce(nullif(trim(coalesce(p_company_id,'')),''),nullif(a->>'companyId',''))
    else nullif(a->>'companyId','') end;
  lim:=greatest(1,least(coalesce(p_limit,30),50));
  if coalesce(cid,'')='' then return '[]'::jsonb; end if;

  select coalesce(jsonb_agg(x.row_json order by x.created_at desc),'[]'::jsonb)
  into rows
  from (
    select m.created_at,
      jsonb_build_object(
        'id',m.id,
        'messageId',m.id,
        'postId',coalesce(m.parent_id,m.id),
        'companyId',m.company_id,
        'department',m.department,
        'senderId',m.sender_id,
        'senderName',m.sender_name,
        'postKind',m.post_kind,
        'content',left(coalesce(m.content,''),360),
        'attachmentCount',jsonb_array_length(coalesce(m.attachments,'[]'::jsonb)),
        'createdAt',m.created_at
      ) row_json
    from public.assurance_regent_department_messages m
    left join public.assurance_regent_department_social_reads r
      on r.message_id=m.id and r.user_id=uid
    where m.company_id=cid
      and m.post_kind in ('POST','REPLY')
      and m.sender_id<>uid
      and r.message_id is null
    order by m.created_at desc
    limit lim
  ) x;
  return rows;
end $function$;

create or replace function public.assurance_regent_browser_department_social_notification_read(
  p_token text,
  p_message_id uuid
) returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  a jsonb;
  uid text;
  cid text;
  msg_cid text;
begin
  a:=public.assurance_regent_browser_actor_from_token(p_token);
  uid:=coalesce(a->>'id','');
  cid:=nullif(a->>'companyId','');
  select company_id into msg_cid
  from public.assurance_regent_department_messages
  where id=p_message_id
  limit 1;
  if msg_cid is null then raise exception 'This Department Hub notification is no longer available.'; end if;
  if a->>'role'<>'Developer' and coalesce(cid,'')<>msg_cid then
    raise exception 'This Department Hub notification is outside your company.';
  end if;
  insert into public.assurance_regent_department_social_reads(user_id,message_id,company_id,read_at)
  values(uid,p_message_id,msg_cid,now())
  on conflict(user_id,message_id) do update set company_id=excluded.company_id,read_at=now();
  return jsonb_build_object('ok',true,'messageId',p_message_id,'companyId',msg_cid);
end $function$;

revoke all on function public.assurance_regent_browser_department_social_notifications(text,text,integer) from public;
revoke all on function public.assurance_regent_browser_department_social_notification_read(text,uuid) from public;
grant execute on function public.assurance_regent_browser_department_social_notifications(text,text,integer) to anon, authenticated, service_role;
grant execute on function public.assurance_regent_browser_department_social_notification_read(text,uuid) to anon, authenticated, service_role;
