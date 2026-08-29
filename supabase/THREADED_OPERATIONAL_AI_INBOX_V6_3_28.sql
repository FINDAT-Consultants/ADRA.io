-- Assurance Regent v6.3.28 — threaded internal Inbox + operational AI advisory isolation.
-- Human direct messages collect into stable one-to-one threads.
-- AI Inbox content is limited to operational advisories and replies inside those advisory threads.
-- Ordinary Jivan chat/proactive chat is deliberately excluded from the Inbox.

alter table public.mts_messages
  add column if not exists thread_id text not null default '',
  add column if not exists thread_title text not null default '',
  add column if not exists topic text not null default '',
  add column if not exists advisory_key text not null default '',
  add column if not exists hidden_for_sender boolean not null default false,
  add column if not exists hidden_for_recipient boolean not null default false;

update public.mts_messages
set thread_id = case
  when coalesce(thread_id,'') <> '' then thread_id
  when coalesce(sender_id,'') <> '' and coalesce(recipient_id,'') <> '' and upper(coalesce(sender_id,'')) <> 'JIVAN' and upper(coalesce(recipient_id,'')) <> 'JIVAN'
    then 'DM-' || md5(coalesce(company_id,'') || '|' || least(sender_id,recipient_id) || '|' || greatest(sender_id,recipient_id))
  else 'LEGACY-' || id
end
where coalesce(thread_id,'') = '';

-- Remove previously mirrored ordinary/proactive Jivan chat from every recipient Inbox.
update public.mts_messages
set hidden_for_recipient = true
where upper(coalesce(sender_id,'')) = 'JIVAN'
  and coalesce(metadata->>'source','') not in ('AI_OPERATIONAL_ADVISORY','AI_INBOX_THREAD');

create index if not exists mts_messages_thread_idx on public.mts_messages(thread_id,created_at);
create index if not exists mts_messages_visible_recipient_idx on public.mts_messages(recipient_id,hidden_for_recipient,read,created_at desc);
create index if not exists mts_messages_visible_sender_idx on public.mts_messages(sender_id,hidden_for_sender,created_at desc);
create unique index if not exists mts_messages_advisory_key_uq
  on public.mts_messages(recipient_id,advisory_key)
  where advisory_key <> '' and kind = 'AI_ADVISORY';

-- The legacy browser helper could mirror ordinary Jivan chat into the Inbox. It is intentionally removed.
drop function if exists public.assurance_regent_browser_message_ai_self(text,text,text,jsonb);

drop function if exists public.assurance_regent_browser_message_send(text,text,text,uuid);

create or replace function public.assurance_regent_browser_message_bundle(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  v_actor jsonb;
  v_state jsonb;
  v_actor_id text;
  v_role text;
  v_company text;
  v_messages jsonb;
  v_recipients jsonb;
  v_unread integer;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  v_actor_id:=coalesce(v_actor->>'id','');
  v_role:=coalesce(v_actor->>'role','Employee');
  v_company:=coalesce(v_actor->>'companyId','');
  select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state';

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',a->>'id',
    'name',coalesce(nullif(a->>'name',''),a->>'id'),
    'email',coalesce(a->>'email',''),
    'position',coalesce(a->>'position',''),
    'department',coalesce(a->>'department',''),
    'companyId',coalesce(a->>'companyId',''),
    'profilePhoto',coalesce(a->>'profilePhoto',''),
    'role',coalesce(a->>'role','Employee')
  ) order by lower(coalesce(nullif(a->>'name',''),a->>'id'))),'[]'::jsonb)
  into v_recipients
  from jsonb_array_elements(coalesce(v_state#>'{auth,accounts}','[]'::jsonb)) a
  where coalesce(a->>'id','')<>v_actor_id
    and coalesce((a->>'active')::boolean,true)=true
    and upper(coalesce(a->>'approvalStatus','APPROVED'))='APPROVED'
    and coalesce((a->>'hiddenFromDirectory')::boolean,false)=false
    and (v_role='Developer' or coalesce(a->>'companyId','')=v_company);

  with accounts as (
    select x as account from jsonb_array_elements(coalesce(v_state#>'{auth,accounts}','[]'::jsonb)) x
  ), visible as (
    select m.*,
      coalesce((select account->>'profilePhoto' from accounts where account->>'id'=m.sender_id limit 1),'') sender_photo,
      coalesce((select account->>'position' from accounts where account->>'id'=m.sender_id limit 1),'') sender_position,
      coalesce((select account->>'profilePhoto' from accounts where account->>'id'=m.recipient_id limit 1),'') recipient_photo,
      coalesce((select account->>'position' from accounts where account->>'id'=m.recipient_id limit 1),'') recipient_position
    from public.mts_messages m
    where (
      (m.sender_id=v_actor_id and m.hidden_for_sender=false)
      or (m.recipient_id=v_actor_id and m.hidden_for_recipient=false)
    )
      and (v_role='Developer' or m.company_id=v_company)
      and (
        (upper(coalesce(m.sender_id,''))<>'JIVAN' and upper(coalesce(m.recipient_id,''))<>'JIVAN' and upper(coalesce(m.kind,'')) not like 'AI%')
        or coalesce(m.metadata->>'source','') in ('AI_OPERATIONAL_ADVISORY','AI_INBOX_THREAD')
      )
    order by m.created_at desc
    limit 500
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,
    'companyId',company_id,
    'senderId',sender_id,
    'senderName',coalesce(nullif(sender_name,''),sender),
    'senderPhoto',sender_photo,
    'senderPosition',sender_position,
    'recipientId',recipient_id,
    'recipientName',coalesce(nullif(recipient_name,''),recipient),
    'recipientPhoto',recipient_photo,
    'recipientPosition',recipient_position,
    'content',content,
    'kind',kind,
    'read',read,
    'readAt',read_at,
    'createdAt',created_at,
    'attachmentFileId',attachment_file_id,
    'attachmentName',attachment_name,
    'attachmentType',attachment_type,
    'attachmentSize',attachment_size,
    'metadata',metadata,
    'threadId',thread_id,
    'threadTitle',thread_title,
    'topic',topic,
    'advisoryKey',advisory_key,
    'direction',case when recipient_id=v_actor_id then 'IN' else 'OUT' end
  ) order by created_at desc),'[]'::jsonb)
  into v_messages
  from visible;

  select count(*) into v_unread
  from public.mts_messages m
  where m.recipient_id=v_actor_id
    and m.read=false
    and m.hidden_for_recipient=false
    and (v_role='Developer' or m.company_id=v_company)
    and (
      (upper(coalesce(m.sender_id,''))<>'JIVAN' and upper(coalesce(m.kind,'')) not like 'AI%')
      or coalesce(m.metadata->>'source','') in ('AI_OPERATIONAL_ADVISORY','AI_INBOX_THREAD')
    );

  return jsonb_build_object(
    'messages',coalesce(v_messages,'[]'::jsonb),
    'recipients',coalesce(v_recipients,'[]'::jsonb),
    'unread',coalesce(v_unread,0),
    'generatedAt',now()
  );
end
$function$;

create or replace function public.assurance_regent_browser_message_send(
  p_token text,
  p_recipient_id text,
  p_content text,
  p_attachment_file_id uuid default null,
  p_thread_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  v_actor jsonb;
  v_state jsonb;
  v_recipient jsonb;
  v_actor_id text;
  v_role text;
  v_actor_company text;
  v_company text;
  v_id text;
  v_thread_id text;
  v_thread_count integer;
  v_attachment record;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  v_actor_id:=coalesce(v_actor->>'id','');
  v_role:=coalesce(v_actor->>'role','Employee');
  v_actor_company:=coalesce(v_actor->>'companyId','');

  if trim(coalesce(p_recipient_id,''))='' then raise exception 'Select a recipient.'; end if;
  if p_recipient_id=v_actor_id then raise exception 'Choose another internal user as the recipient.'; end if;
  if length(trim(coalesce(p_content,'')))<1 then raise exception 'Write a message before sending.'; end if;
  if length(p_content)>6000 then raise exception 'Internal messages are limited to 6000 characters.'; end if;

  select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state';
  select a into v_recipient
  from jsonb_array_elements(coalesce(v_state#>'{auth,accounts}','[]'::jsonb)) a
  where a->>'id'=p_recipient_id
    and coalesce((a->>'active')::boolean,true)=true
    and upper(coalesce(a->>'approvalStatus','APPROVED'))='APPROVED'
  limit 1;

  if v_recipient is null then raise exception 'The selected recipient is not an active Assurance Regent user.'; end if;
  if v_role<>'Developer' and coalesce(v_recipient->>'companyId','')<>v_actor_company then raise exception 'Internal messages may only be sent inside your company.'; end if;
  v_company:=case when v_role='Developer' then coalesce(nullif(v_recipient->>'companyId',''),v_actor_company) else v_actor_company end;

  if p_attachment_file_id is not null then
    select id,company_id,original_name,mime_type,size_bytes,status into v_attachment
    from public.assurance_regent_files where id=p_attachment_file_id limit 1;
    if v_attachment.id is null or v_attachment.status<>'STORED' then raise exception 'The selected attachment is not available.'; end if;
    if v_role<>'Developer' and v_attachment.company_id<>v_company then raise exception 'The selected attachment belongs to another company.'; end if;
  end if;

  if trim(coalesce(p_thread_id,''))<>'' then
    select count(*) into v_thread_count
    from public.mts_messages m
    where m.thread_id=p_thread_id
      and m.company_id=v_company
      and (
        (m.sender_id=v_actor_id and m.recipient_id=p_recipient_id)
        or (m.sender_id=p_recipient_id and m.recipient_id=v_actor_id)
      );
    if v_thread_count=0 then raise exception 'The selected conversation does not belong to these users.'; end if;
    v_thread_id:=p_thread_id;
  else
    v_thread_id:='DM-'||md5(v_company||'|'||least(v_actor_id,p_recipient_id)||'|'||greatest(v_actor_id,p_recipient_id));
  end if;

  v_id:='MSG-'||replace(gen_random_uuid()::text,'-','');
  insert into public.mts_messages(
    id,company_id,recipient,sender,content,read,created_at,
    sender_id,recipient_id,sender_name,recipient_name,kind,
    attachment_file_id,attachment_name,attachment_type,attachment_size,
    thread_id,thread_title,topic,advisory_key,hidden_for_sender,hidden_for_recipient,metadata
  ) values (
    v_id,v_company,coalesce(v_recipient->>'name',p_recipient_id),coalesce(v_actor->>'name',v_actor_id),trim(p_content),false,now(),
    v_actor_id,p_recipient_id,coalesce(v_actor->>'name',v_actor_id),coalesce(v_recipient->>'name',p_recipient_id),'USER',
    p_attachment_file_id,coalesce(v_attachment.original_name,''),coalesce(v_attachment.mime_type,''),coalesce(v_attachment.size_bytes,0),
    v_thread_id,'','DIRECT_MESSAGE','',false,false,
    jsonb_build_object('channel','INTERNAL_INBOX','source','HUMAN_INTERNAL_MESSAGE')
  );

  return jsonb_build_object('ok',true,'id',v_id,'threadId',v_thread_id,'createdAt',now());
end
$function$;

create or replace function public.assurance_regent_browser_message_thread(p_token text,p_thread_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  v_actor jsonb;
  v_state jsonb;
  v_actor_id text;
  v_role text;
  v_company text;
  v_messages jsonb;
  v_is_ai boolean:=false;
  v_title text:='';
  v_topic text:='';
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  v_actor_id:=coalesce(v_actor->>'id','');
  v_role:=coalesce(v_actor->>'role','Employee');
  v_company:=coalesce(v_actor->>'companyId','');
  if trim(coalesce(p_thread_id,''))='' then raise exception 'Conversation is required.'; end if;
  select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state';

  with accounts as (
    select x as account from jsonb_array_elements(coalesce(v_state#>'{auth,accounts}','[]'::jsonb)) x
  ), visible as (
    select m.*,
      coalesce((select account->>'profilePhoto' from accounts where account->>'id'=m.sender_id limit 1),'') sender_photo,
      coalesce((select account->>'position' from accounts where account->>'id'=m.sender_id limit 1),'') sender_position,
      coalesce((select account->>'profilePhoto' from accounts where account->>'id'=m.recipient_id limit 1),'') recipient_photo,
      coalesce((select account->>'position' from accounts where account->>'id'=m.recipient_id limit 1),'') recipient_position
    from public.mts_messages m
    where m.thread_id=p_thread_id
      and (
        (m.sender_id=v_actor_id and m.hidden_for_sender=false)
        or (m.recipient_id=v_actor_id and m.hidden_for_recipient=false)
      )
      and (v_role='Developer' or m.company_id=v_company)
      and (
        (upper(coalesce(m.sender_id,''))<>'JIVAN' and upper(coalesce(m.recipient_id,''))<>'JIVAN' and upper(coalesce(m.kind,'')) not like 'AI%')
        or coalesce(m.metadata->>'source','') in ('AI_OPERATIONAL_ADVISORY','AI_INBOX_THREAD')
      )
    order by m.created_at asc
    limit 500
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'companyId',company_id,
    'senderId',sender_id,'senderName',coalesce(nullif(sender_name,''),sender),'senderPhoto',sender_photo,'senderPosition',sender_position,
    'recipientId',recipient_id,'recipientName',coalesce(nullif(recipient_name,''),recipient),'recipientPhoto',recipient_photo,'recipientPosition',recipient_position,
    'content',content,'kind',kind,'read',read,'readAt',read_at,'createdAt',created_at,
    'attachmentFileId',attachment_file_id,'attachmentName',attachment_name,'attachmentType',attachment_type,'attachmentSize',attachment_size,
    'metadata',metadata,'threadId',thread_id,'threadTitle',thread_title,'topic',topic,'advisoryKey',advisory_key,
    'direction',case when recipient_id=v_actor_id then 'IN' else 'OUT' end
  ) order by created_at asc),'[]'::jsonb),
  coalesce(bool_or(upper(coalesce(kind,'')) like 'AI%' or upper(coalesce(sender_id,''))='JIVAN' or upper(coalesce(recipient_id,''))='JIVAN'),false),
  coalesce(max(nullif(thread_title,'')),''),
  coalesce(max(nullif(topic,'')),'')
  into v_messages,v_is_ai,v_title,v_topic
  from visible;

  if jsonb_array_length(coalesce(v_messages,'[]'::jsonb))=0 then raise exception 'Conversation not found or it has been cleared from this Inbox.'; end if;

  return jsonb_build_object('threadId',p_thread_id,'title',v_title,'topic',v_topic,'isAi',v_is_ai,'messages',v_messages);
end
$function$;

create or replace function public.assurance_regent_browser_message_thread_mark_read(p_token text,p_thread_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  v_actor jsonb;
  v_actor_id text;
  v_count integer;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  v_actor_id:=coalesce(v_actor->>'id','');
  update public.mts_messages
  set read=true,read_at=coalesce(read_at,now())
  where thread_id=p_thread_id and recipient_id=v_actor_id and hidden_for_recipient=false;
  get diagnostics v_count=row_count;
  return jsonb_build_object('ok',true,'threadId',p_thread_id,'updated',v_count,'readAt',now());
end
$function$;

create or replace function public.assurance_regent_browser_message_clear_thread(p_token text,p_thread_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  v_actor jsonb;
  v_actor_id text;
  v_count integer;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  v_actor_id:=coalesce(v_actor->>'id','');
  update public.mts_messages
  set hidden_for_sender=case when sender_id=v_actor_id then true else hidden_for_sender end,
      hidden_for_recipient=case when recipient_id=v_actor_id then true else hidden_for_recipient end
  where thread_id=p_thread_id and (sender_id=v_actor_id or recipient_id=v_actor_id);
  get diagnostics v_count=row_count;
  if v_count=0 then raise exception 'Conversation not found.'; end if;
  return jsonb_build_object('ok',true,'threadId',p_thread_id,'cleared',v_count);
end
$function$;

-- Keep the single-message mark-read RPC compatible with older clients.
create or replace function public.assurance_regent_browser_message_mark_read(p_token text,p_message_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  v_actor jsonb;
  v_actor_id text;
  v_count integer;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  v_actor_id:=coalesce(v_actor->>'id','');
  update public.mts_messages
  set read=true,read_at=coalesce(read_at,now())
  where id=p_message_id and recipient_id=v_actor_id and hidden_for_recipient=false;
  get diagnostics v_count=row_count;
  if v_count=0 then raise exception 'Message not found or not assigned to this account.'; end if;
  return jsonb_build_object('ok',true,'id',p_message_id,'readAt',now());
end
$function$;

revoke all on table public.mts_messages from anon, authenticated;
grant execute on function public.assurance_regent_browser_message_bundle(text) to anon, authenticated;
grant execute on function public.assurance_regent_browser_message_send(text,text,text,uuid,text) to anon, authenticated;
grant execute on function public.assurance_regent_browser_message_thread(text,text) to anon, authenticated;
grant execute on function public.assurance_regent_browser_message_thread_mark_read(text,text) to anon, authenticated;
grant execute on function public.assurance_regent_browser_message_clear_thread(text,text) to anon, authenticated;
grant execute on function public.assurance_regent_browser_message_mark_read(text,text) to anon, authenticated;
