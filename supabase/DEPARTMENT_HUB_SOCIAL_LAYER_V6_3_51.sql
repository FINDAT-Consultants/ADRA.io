-- Assurance Regent v6.3.51 — Department Hub social layer.
-- Adds reaction-profile visibility, role-gated Project News, story/status conversation data,
-- and Project News notifications while preserving company isolation and private storage.

alter table public.assurance_regent_department_messages
  drop constraint if exists assurance_regent_department_messages_post_kind_chk;
alter table public.assurance_regent_department_messages
  add constraint assurance_regent_department_messages_post_kind_chk
  check (post_kind = any (array['POST'::text,'STATUS'::text,'REPLY'::text,'PROJECT_NEWS'::text]));

create or replace function public.assurance_regent_department_reaction_people_internal(
  p_message_id uuid,
  p_state jsonb
) returns jsonb
language sql
stable
security definer
set search_path to 'public','extensions'
as $function$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'userId',q.user_id,
      'emoji',q.emoji,
      'name',case when lower(q.user_id)='dvp' then 'Developer' else coalesce(nullif(q.profile->>'name',''),q.user_id) end,
      'profilePhoto',coalesce(q.profile->>'profilePhoto',''),
      'position',case when lower(q.user_id)='dvp' then 'System Developer' else coalesce(nullif(q.profile->>'position',''),nullif(q.profile->>'supervisoryRole',''),nullif(q.profile->>'department',''),'Company member') end,
      'updatedAt',q.updated_at
    ) order by q.updated_at desc
  ),'[]'::jsonb)
  from (
    select r.user_id,r.emoji,r.updated_at,coalesce(u.value,'{}'::jsonb) profile
    from public.assurance_regent_department_reactions r
    left join lateral (
      select a.value
      from jsonb_array_elements(coalesce(p_state#>'{auth,accounts}','[]'::jsonb)) a(value)
      where lower(coalesce(a.value->>'id',''))=lower(r.user_id)
      limit 1
    ) u on true
    where r.message_id=p_message_id
    order by r.updated_at desc
    limit 36
  ) q;
$function$;

revoke all on function public.assurance_regent_department_reaction_people_internal(uuid,jsonb) from public,anon,authenticated;

create or replace function public.assurance_regent_browser_department_social_bundle(
  p_token text,
  p_department text,
  p_limit integer default 80,
  p_company_id text default ''
) returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  a jsonb; cid text; uid text; dep text; lim int;
  st jsonb:='{}'::jsonb;
  posts jsonb; replies jsonb; statuses jsonb; project_news jsonb; status_replies jsonb;
begin
  a:=public.assurance_regent_browser_actor_from_token(p_token);
  cid:=case when a->>'role'='Developer'
    then coalesce(nullif(trim(coalesce(p_company_id,'')),''),nullif(a->>'companyId',''))
    else nullif(a->>'companyId','') end;
  uid:=coalesce(a->>'id','');
  dep:=left(trim(coalesce(p_department,'')),160);
  lim:=greatest(10,least(coalesce(p_limit,80),120));
  if coalesce(cid,'')='' then raise exception 'Select a company before opening its Department Hub.'; end if;
  if dep='' then raise exception 'Select a department channel.'; end if;
  select coalesce(state_value,'{}'::jsonb) into st from public.assurance_regent_state where state_key='browser-client-state';

  select coalesce(jsonb_agg(x.row_json order by x.created_at desc),'[]'::jsonb) into posts
  from (
    select m.created_at,
      jsonb_build_object(
        'id',m.id,'companyId',m.company_id,'department',m.department,
        'senderId',m.sender_id,'senderName',m.sender_name,'content',m.content,
        'postKind',m.post_kind,'parentId',m.parent_id,
        'attachments',coalesce(m.attachments,'[]'::jsonb),
        'createdAt',m.created_at,'updatedAt',m.updated_at,
        'reactionSummary',coalesce((select jsonb_agg(jsonb_build_object('emoji',r2.emoji,'count',r2.cnt) order by r2.cnt desc,r2.emoji) from (select r.emoji,count(*)::int cnt from public.assurance_regent_department_reactions r where r.message_id=m.id group by r.emoji) r2),'[]'::jsonb),
        'reactionPeople',public.assurance_regent_department_reaction_people_internal(m.id,st),
        'myReaction',coalesce((select r.emoji from public.assurance_regent_department_reactions r where r.message_id=m.id and r.user_id=uid limit 1),''),
        'replyCount',(select count(*)::int from public.assurance_regent_department_messages q where q.parent_id=m.id)
      ) row_json
    from public.assurance_regent_department_messages m
    where m.company_id=cid and m.parent_id is null
      and (
        (m.department=dep and m.post_kind='POST')
        or (dep='Company Lounge' and m.post_kind='PROJECT_NEWS')
      )
    order by m.created_at desc
    limit lim
  ) x;

  select coalesce(jsonb_agg(x.row_json order by x.created_at desc),'[]'::jsonb) into replies
  from (
    select m.created_at,
      jsonb_build_object(
        'id',m.id,'companyId',m.company_id,'department',m.department,
        'senderId',m.sender_id,'senderName',m.sender_name,'content',m.content,
        'postKind','REPLY','parentId',m.parent_id,
        'attachments',coalesce(m.attachments,'[]'::jsonb),
        'createdAt',m.created_at,'updatedAt',m.updated_at,
        'reactionSummary',coalesce((select jsonb_agg(jsonb_build_object('emoji',r2.emoji,'count',r2.cnt) order by r2.cnt desc,r2.emoji) from (select r.emoji,count(*)::int cnt from public.assurance_regent_department_reactions r where r.message_id=m.id group by r.emoji) r2),'[]'::jsonb),
        'reactionPeople',public.assurance_regent_department_reaction_people_internal(m.id,st),
        'myReaction',coalesce((select r.emoji from public.assurance_regent_department_reactions r where r.message_id=m.id and r.user_id=uid limit 1),'')
      ) row_json
    from public.assurance_regent_department_messages m
    where m.company_id=cid and m.parent_id is not null
      and exists(
        select 1 from public.assurance_regent_department_messages p
        where p.id=m.parent_id and p.company_id=cid
          and (p.department=dep or dep='Company Lounge')
      )
    order by m.created_at desc
    limit 400
  ) x;

  select coalesce(jsonb_agg(x.row_json order by x.created_at desc),'[]'::jsonb) into statuses
  from (
    select m.created_at,
      jsonb_build_object(
        'id',m.id,'companyId',m.company_id,'department',m.department,
        'senderId',m.sender_id,'senderName',m.sender_name,'content',m.content,
        'postKind','STATUS','attachments',coalesce(m.attachments,'[]'::jsonb),
        'createdAt',m.created_at,'expiresAt',m.status_expires_at,
        'reactionSummary',coalesce((select jsonb_agg(jsonb_build_object('emoji',r2.emoji,'count',r2.cnt) order by r2.cnt desc,r2.emoji) from (select r.emoji,count(*)::int cnt from public.assurance_regent_department_reactions r where r.message_id=m.id group by r.emoji) r2),'[]'::jsonb),
        'reactionPeople',public.assurance_regent_department_reaction_people_internal(m.id,st),
        'myReaction',coalesce((select r.emoji from public.assurance_regent_department_reactions r where r.message_id=m.id and r.user_id=uid limit 1),'')
      ) row_json
    from public.assurance_regent_department_messages m
    where m.company_id=cid and m.parent_id is null and m.post_kind='STATUS'
      and coalesce(m.status_expires_at,m.created_at+interval '24 hours')>now()
    order by m.created_at desc
    limit 80
  ) x;

  select coalesce(jsonb_agg(x.row_json order by x.created_at desc),'[]'::jsonb) into project_news
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
    limit 12
  ) x;

  -- Company-wide reply pool lets the client build conversations for story/status roots
  -- without exposing anything outside the selected company.
  select coalesce(jsonb_agg(x.row_json order by x.created_at desc),'[]'::jsonb) into status_replies
  from (
    select m.created_at,
      jsonb_build_object(
        'id',m.id,'companyId',m.company_id,'department',m.department,
        'senderId',m.sender_id,'senderName',m.sender_name,'content',m.content,
        'postKind','REPLY','parentId',m.parent_id,
        'attachments',coalesce(m.attachments,'[]'::jsonb),
        'createdAt',m.created_at,'updatedAt',m.updated_at,
        'reactionSummary',coalesce((select jsonb_agg(jsonb_build_object('emoji',r2.emoji,'count',r2.cnt) order by r2.cnt desc,r2.emoji) from (select r.emoji,count(*)::int cnt from public.assurance_regent_department_reactions r where r.message_id=m.id group by r.emoji) r2),'[]'::jsonb),
        'reactionPeople',public.assurance_regent_department_reaction_people_internal(m.id,st),
        'myReaction',coalesce((select r.emoji from public.assurance_regent_department_reactions r where r.message_id=m.id and r.user_id=uid limit 1),'')
      ) row_json
    from public.assurance_regent_department_messages m
    where m.company_id=cid and m.parent_id is not null
    order by m.created_at desc
    limit 500
  ) x;

  return jsonb_build_object(
    'companyId',cid,'department',dep,
    'posts',posts,'replies',replies,'statuses',statuses,
    'projectNews',project_news,'statusReplies',status_replies,
    'serverTime',now()
  );
end $function$;

create or replace function public.assurance_regent_browser_department_social_post(
  p_token text,
  p_department text,
  p_content text default '',
  p_post_kind text default 'POST',
  p_attachment_file_ids uuid[] default '{}'::uuid[],
  p_parent_id uuid default null,
  p_company_id text default ''
) returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  a jsonb; cid text; dep text; msg text; kind text;
  ids uuid[]:=coalesce(p_attachment_file_ids,'{}'::uuid[]);
  att jsonb:='[]'::jsonb; att_count int:=0; mid uuid; parent_dep text;
  authority text;
begin
  a:=public.assurance_regent_browser_actor_from_token(p_token);
  cid:=case when a->>'role'='Developer'
    then coalesce(nullif(trim(coalesce(p_company_id,'')),''),nullif(a->>'companyId',''))
    else nullif(a->>'companyId','') end;
  dep:=left(trim(coalesce(p_department,'')),160);
  msg:=left(trim(coalesce(p_content,'')),6000);
  kind:=upper(trim(coalesce(p_post_kind,'POST')));
  authority:=lower(concat_ws(' ',coalesce(a->>'role',''),coalesce(a->>'position',''),coalesce(a->>'supervisoryRole',''),coalesce(a->>'supervisory_role','')));

  if coalesce(cid,'')='' then raise exception 'Select a company before posting in its Department Hub.'; end if;
  if dep='' then dep:='Company Lounge'; end if;
  if kind not in ('POST','STATUS','REPLY','PROJECT_NEWS') then kind:='POST'; end if;
  if cardinality(ids)>4 then raise exception 'A social post can contain up to four files.'; end if;
  if cardinality(ids)<>(select count(distinct x) from unnest(ids) x) then raise exception 'Duplicate attachment references are not allowed.'; end if;

  if p_parent_id is not null then
    select department into parent_dep
    from public.assurance_regent_department_messages
    where id=p_parent_id and company_id=cid limit 1;
    if parent_dep is null then raise exception 'The post you are replying to is unavailable.'; end if;
    dep:=parent_dep; kind:='REPLY';
  elsif kind='REPLY' then
    raise exception 'Select a post or comment to reply to.';
  elsif kind='PROJECT_NEWS' then
    if not (
      a->>'role'='Developer'
      or authority ~ '(administrator|country director|chief executive|\bceo\b|managing director|project manager|program director|programme director|communications officer|communication officer|communications manager|communication manager)'
    ) then
      raise exception 'Project News can be published by Project Managers, Program/Programme Directors, Communications Officers, Country Directors, Administrators or the Developer.';
    end if;
    dep:='Project News';
  elsif kind='STATUS' then
    dep:='Company Lounge';
  end if;

  if cardinality(ids)>0 then
    select count(*)::int,
      coalesce(jsonb_agg(jsonb_build_object('fileId',f.id,'name',f.original_name,'mimeType',f.mime_type,'sizeBytes',f.size_bytes) order by f.created_at),'[]'::jsonb)
    into att_count,att
    from public.assurance_regent_files f
    where f.id=any(ids) and f.company_id=cid and f.status='STORED' and f.deleted_at is null;
    if att_count<>cardinality(ids) then raise exception 'One or more attachments are unavailable to this company.'; end if;
  end if;

  if msg='' and cardinality(ids)=0 then raise exception 'Write something or attach media first.'; end if;

  insert into public.assurance_regent_department_messages(
    company_id,department,sender_id,sender_name,content,parent_id,post_kind,attachments,status_expires_at,updated_at
  ) values(
    cid,dep,a->>'id',coalesce(nullif(a->>'name',''),a->>'id'),msg,p_parent_id,kind,att,
    case when kind='STATUS' then now()+interval '24 hours' else null end,now()
  ) returning id into mid;

  return jsonb_build_object('ok',true,'id',mid,'department',dep,'postKind',kind,'attachmentCount',cardinality(ids),'companyId',cid);
end $function$;

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
  a jsonb; cid text; uid text; lim int; rows jsonb;
begin
  a:=public.assurance_regent_browser_actor_from_token(p_token);
  uid:=coalesce(a->>'id','');
  cid:=case when a->>'role'='Developer'
    then coalesce(nullif(trim(coalesce(p_company_id,'')),''),nullif(a->>'companyId',''))
    else nullif(a->>'companyId','') end;
  lim:=greatest(1,least(coalesce(p_limit,30),50));
  if coalesce(cid,'')='' then return '[]'::jsonb; end if;

  select coalesce(jsonb_agg(x.row_json order by x.created_at desc),'[]'::jsonb) into rows
  from (
    select m.created_at,
      jsonb_build_object(
        'id',m.id,'messageId',m.id,
        'postId',coalesce(m.parent_id,m.id),
        'companyId',m.company_id,
        'department',case when m.post_kind='PROJECT_NEWS' then 'Company Lounge' else m.department end,
        'senderId',m.sender_id,'senderName',m.sender_name,
        'postKind',m.post_kind,
        'content',left(coalesce(m.content,''),360),
        'attachmentCount',jsonb_array_length(coalesce(m.attachments,'[]'::jsonb)),
        'createdAt',m.created_at
      ) row_json
    from public.assurance_regent_department_messages m
    left join public.assurance_regent_department_social_reads r
      on r.message_id=m.id and r.user_id=uid
    where m.company_id=cid
      and m.post_kind in ('POST','REPLY','PROJECT_NEWS')
      and m.sender_id<>uid
      and r.message_id is null
    order by m.created_at desc
    limit lim
  ) x;
  return rows;
end $function$;

revoke all on function public.assurance_regent_browser_department_social_bundle(text,text,integer,text) from public;
revoke all on function public.assurance_regent_browser_department_social_post(text,text,text,text,uuid[],uuid,text) from public;
revoke all on function public.assurance_regent_browser_department_social_notifications(text,text,integer) from public;
grant execute on function public.assurance_regent_browser_department_social_bundle(text,text,integer,text) to anon,authenticated,service_role;
grant execute on function public.assurance_regent_browser_department_social_post(text,text,text,text,uuid[],uuid,text) to anon,authenticated,service_role;
grant execute on function public.assurance_regent_browser_department_social_notifications(text,text,integer) to anon,authenticated,service_role;
