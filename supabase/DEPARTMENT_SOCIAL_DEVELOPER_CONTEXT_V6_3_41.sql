-- Assurance Regent v6.3.41 — Department Hub Developer company context.
-- Keeps ordinary users restricted to their own company while allowing the permanent
-- Developer identity to operate on the company currently open in Company view.

drop function if exists public.assurance_regent_browser_department_social_bundle(text,text,integer);
drop function if exists public.assurance_regent_browser_department_social_post(text,text,text,text,uuid[],uuid);
drop function if exists public.assurance_regent_browser_department_social_react(text,uuid,text);

create function public.assurance_regent_browser_department_social_bundle(p_token text,p_department text,p_limit integer default 80,p_company_id text default '')
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare
  a jsonb; cid text; uid text; dep text; lim int; posts jsonb; replies jsonb; statuses jsonb;
begin
  a:=public.assurance_regent_browser_actor_from_token(p_token);
  cid:=case when a->>'role'='Developer' then coalesce(nullif(trim(coalesce(p_company_id,'')),''),nullif(a->>'companyId','')) else nullif(a->>'companyId','') end;
  uid:=coalesce(a->>'id',''); dep:=left(trim(coalesce(p_department,'')),160); lim:=greatest(10,least(coalesce(p_limit,80),120));
  if coalesce(cid,'')='' then raise exception 'Select a company before opening its Department Hub.'; end if;
  if dep='' then raise exception 'Select a department channel.'; end if;

  select coalesce(jsonb_agg(x.row_json order by x.created_at desc),'[]'::jsonb) into posts from (
    select m.created_at,jsonb_build_object('id',m.id,'companyId',m.company_id,'department',m.department,'senderId',m.sender_id,'senderName',m.sender_name,'content',m.content,'postKind',m.post_kind,'parentId',m.parent_id,'attachments',coalesce(m.attachments,'[]'::jsonb),'createdAt',m.created_at,'updatedAt',m.updated_at,'reactionSummary',coalesce((select jsonb_agg(jsonb_build_object('emoji',r2.emoji,'count',r2.cnt) order by r2.cnt desc,r2.emoji) from (select r.emoji,count(*)::int cnt from public.assurance_regent_department_reactions r where r.message_id=m.id group by r.emoji) r2),'[]'::jsonb),'myReaction',coalesce((select r.emoji from public.assurance_regent_department_reactions r where r.message_id=m.id and r.user_id=uid limit 1),''),'replyCount',(select count(*)::int from public.assurance_regent_department_messages q where q.parent_id=m.id)) row_json
    from public.assurance_regent_department_messages m where m.company_id=cid and m.department=dep and m.parent_id is null and m.post_kind<>'STATUS' order by m.created_at desc limit lim
  ) x;

  select coalesce(jsonb_agg(x.row_json order by x.created_at),'[]'::jsonb) into replies from (
    select m.created_at,jsonb_build_object('id',m.id,'companyId',m.company_id,'department',m.department,'senderId',m.sender_id,'senderName',m.sender_name,'content',m.content,'postKind','REPLY','parentId',m.parent_id,'attachments',coalesce(m.attachments,'[]'::jsonb),'createdAt',m.created_at,'updatedAt',m.updated_at,'reactionSummary',coalesce((select jsonb_agg(jsonb_build_object('emoji',r2.emoji,'count',r2.cnt) order by r2.cnt desc,r2.emoji) from (select r.emoji,count(*)::int cnt from public.assurance_regent_department_reactions r where r.message_id=m.id group by r.emoji) r2),'[]'::jsonb),'myReaction',coalesce((select r.emoji from public.assurance_regent_department_reactions r where r.message_id=m.id and r.user_id=uid limit 1),'')) row_json
    from public.assurance_regent_department_messages m where m.company_id=cid and m.department=dep and m.parent_id is not null and exists(select 1 from public.assurance_regent_department_messages p where p.id=m.parent_id and p.company_id=cid and p.department=dep) order by m.created_at desc limit 300
  ) x;

  select coalesce(jsonb_agg(x.row_json order by x.created_at desc),'[]'::jsonb) into statuses from (
    select m.created_at,jsonb_build_object('id',m.id,'department',m.department,'senderId',m.sender_id,'senderName',m.sender_name,'content',m.content,'postKind','STATUS','attachments',coalesce(m.attachments,'[]'::jsonb),'createdAt',m.created_at,'expiresAt',m.status_expires_at,'reactionSummary',coalesce((select jsonb_agg(jsonb_build_object('emoji',r2.emoji,'count',r2.cnt) order by r2.cnt desc,r2.emoji) from (select r.emoji,count(*)::int cnt from public.assurance_regent_department_reactions r where r.message_id=m.id group by r.emoji) r2),'[]'::jsonb),'myReaction',coalesce((select r.emoji from public.assurance_regent_department_reactions r where r.message_id=m.id and r.user_id=uid limit 1),'')) row_json
    from public.assurance_regent_department_messages m where m.company_id=cid and m.parent_id is null and m.post_kind='STATUS' and coalesce(m.status_expires_at,m.created_at+interval '24 hours')>now() order by m.created_at desc limit 50
  ) x;
  return jsonb_build_object('companyId',cid,'department',dep,'posts',posts,'replies',replies,'statuses',statuses,'serverTime',now());
end $$;

create function public.assurance_regent_browser_department_social_post(p_token text,p_department text,p_content text default '',p_post_kind text default 'POST',p_attachment_file_ids uuid[] default '{}'::uuid[],p_parent_id uuid default null,p_company_id text default '')
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare
  a jsonb; cid text; dep text; msg text; kind text; ids uuid[]:=coalesce(p_attachment_file_ids,'{}'::uuid[]); att jsonb:='[]'::jsonb; att_count int:=0; mid uuid; parent_dep text;
begin
  a:=public.assurance_regent_browser_actor_from_token(p_token);
  cid:=case when a->>'role'='Developer' then coalesce(nullif(trim(coalesce(p_company_id,'')),''),nullif(a->>'companyId','')) else nullif(a->>'companyId','') end;
  dep:=left(trim(coalesce(p_department,'')),160); msg:=left(trim(coalesce(p_content,'')),6000); kind:=upper(trim(coalesce(p_post_kind,'POST')));
  if coalesce(cid,'')='' then raise exception 'Select a company before posting in its Department Hub.'; end if;
  if dep='' then raise exception 'Select a department channel.'; end if;
  if kind not in ('POST','STATUS','REPLY') then kind:='POST'; end if;
  if cardinality(ids)>4 then raise exception 'A social post can contain up to four files.'; end if;
  if cardinality(ids)<>(select count(distinct x) from unnest(ids) x) then raise exception 'Duplicate attachment references are not allowed.'; end if;
  if p_parent_id is not null then select department into parent_dep from public.assurance_regent_department_messages where id=p_parent_id and company_id=cid limit 1; if parent_dep is null then raise exception 'The post you are replying to is unavailable.'; end if; dep:=parent_dep; kind:='REPLY'; elsif kind='REPLY' then raise exception 'Select a post to reply to.'; end if;
  if cardinality(ids)>0 then select count(*)::int,coalesce(jsonb_agg(jsonb_build_object('fileId',f.id,'name',f.original_name,'mimeType',f.mime_type,'sizeBytes',f.size_bytes) order by f.created_at),'[]'::jsonb) into att_count,att from public.assurance_regent_files f where f.id=any(ids) and f.company_id=cid and f.status='STORED' and f.deleted_at is null; if att_count<>cardinality(ids) then raise exception 'One or more attachments are unavailable to this company.'; end if; end if;
  if msg='' and cardinality(ids)=0 then raise exception 'Write something or attach media first.'; end if;
  insert into public.assurance_regent_department_messages(company_id,department,sender_id,sender_name,content,parent_id,post_kind,attachments,status_expires_at,updated_at) values(cid,dep,a->>'id',coalesce(nullif(a->>'name',''),a->>'id'),msg,p_parent_id,kind,att,case when kind='STATUS' then now()+interval '24 hours' else null end,now()) returning id into mid;
  return jsonb_build_object('ok',true,'id',mid,'department',dep,'postKind',kind,'attachmentCount',cardinality(ids),'companyId',cid);
end $$;

create function public.assurance_regent_browser_department_social_react(p_token text,p_message_id uuid,p_emoji text default '',p_company_id text default '')
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare
  a jsonb; cid text; uid text; em text:=left(trim(coalesce(p_emoji,'')),24); existing text; msg_cid text;
begin
  a:=public.assurance_regent_browser_actor_from_token(p_token); uid:=coalesce(a->>'id','');
  select company_id into msg_cid from public.assurance_regent_department_messages where id=p_message_id limit 1;
  cid:=case when a->>'role'='Developer' then coalesce(nullif(trim(coalesce(p_company_id,'')),''),msg_cid,nullif(a->>'companyId','')) else nullif(a->>'companyId','') end;
  if coalesce(cid,'')='' or msg_cid is null or msg_cid<>cid then raise exception 'This social post is unavailable.'; end if;
  select emoji into existing from public.assurance_regent_department_reactions where message_id=p_message_id and user_id=uid;
  if em='' or existing=em then delete from public.assurance_regent_department_reactions where message_id=p_message_id and user_id=uid; return jsonb_build_object('ok',true,'reaction',''); end if;
  insert into public.assurance_regent_department_reactions(message_id,company_id,user_id,emoji,updated_at) values(p_message_id,cid,uid,em,now()) on conflict(message_id,user_id) do update set emoji=excluded.emoji,company_id=excluded.company_id,updated_at=now();
  return jsonb_build_object('ok',true,'reaction',em);
end $$;

grant execute on function public.assurance_regent_browser_department_social_bundle(text,text,integer,text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_department_social_post(text,text,text,text,uuid[],uuid,text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_department_social_react(text,uuid,text,text) to anon,authenticated;
