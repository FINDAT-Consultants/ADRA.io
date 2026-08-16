-- Assurance Regent v6.3.27 — private internal inbox.
-- Applied to production Supabase project fubqwljypdiojpbdunjc on 2026-08-16.

alter table public.mts_messages
  add column if not exists sender_id text not null default '',
  add column if not exists recipient_id text not null default '',
  add column if not exists sender_name text not null default '',
  add column if not exists recipient_name text not null default '',
  add column if not exists kind text not null default 'USER',
  add column if not exists attachment_file_id uuid null,
  add column if not exists attachment_name text not null default '',
  add column if not exists attachment_type text not null default '',
  add column if not exists attachment_size bigint not null default 0,
  add column if not exists read_at timestamptz null,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists mts_messages_recipient_unread_idx on public.mts_messages(recipient_id, read, created_at desc);
create index if not exists mts_messages_sender_idx on public.mts_messages(sender_id, created_at desc);
create index if not exists mts_messages_company_idx on public.mts_messages(company_id, created_at desc);
revoke all on table public.mts_messages from anon, authenticated;

create or replace function public.assurance_regent_browser_message_bundle(p_token text)
returns jsonb language plpgsql security definer set search_path to 'public','extensions' as $function$
declare v_actor jsonb; v_state jsonb; v_actor_id text; v_role text; v_company text; v_messages jsonb; v_recipients jsonb; v_unread integer;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token); v_actor_id:=coalesce(v_actor->>'id',''); v_role:=coalesce(v_actor->>'role','Employee'); v_company:=coalesce(v_actor->>'companyId','');
  select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state';
  select coalesce(jsonb_agg(jsonb_build_object('id',a->>'id','name',coalesce(nullif(a->>'name',''),a->>'id'),'email',coalesce(a->>'email',''),'position',coalesce(a->>'position',''),'department',coalesce(a->>'department',''),'companyId',coalesce(a->>'companyId',''),'profilePhoto',coalesce(a->>'profilePhoto',''),'role',coalesce(a->>'role','Employee')) order by lower(coalesce(nullif(a->>'name',''),a->>'id'))),'[]'::jsonb) into v_recipients
  from jsonb_array_elements(coalesce(v_state#>'{auth,accounts}','[]'::jsonb)) a where coalesce(a->>'id','')<>v_actor_id and coalesce((a->>'active')::boolean,true)=true and upper(coalesce(a->>'approvalStatus','APPROVED'))='APPROVED' and coalesce((a->>'hiddenFromDirectory')::boolean,false)=false and (v_role='Developer' or coalesce(a->>'companyId','')=v_company);
  with accounts as (select x as account from jsonb_array_elements(coalesce(v_state#>'{auth,accounts}','[]'::jsonb)) x), visible as (
    select m.*,coalesce((select account->>'profilePhoto' from accounts where account->>'id'=m.sender_id limit 1),'') sender_photo,coalesce((select account->>'position' from accounts where account->>'id'=m.sender_id limit 1),'') sender_position
    from public.mts_messages m where (m.sender_id=v_actor_id or m.recipient_id=v_actor_id) and (v_role='Developer' or m.company_id=v_company) order by m.created_at desc limit 250)
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'companyId',company_id,'senderId',sender_id,'senderName',coalesce(nullif(sender_name,''),sender),'senderPhoto',sender_photo,'senderPosition',sender_position,'recipientId',recipient_id,'recipientName',coalesce(nullif(recipient_name,''),recipient),'content',content,'kind',kind,'read',read,'readAt',read_at,'createdAt',created_at,'attachmentFileId',attachment_file_id,'attachmentName',attachment_name,'attachmentType',attachment_type,'attachmentSize',attachment_size,'metadata',metadata,'direction',case when recipient_id=v_actor_id then 'IN' else 'OUT' end) order by created_at desc),'[]'::jsonb) into v_messages from visible;
  select count(*) into v_unread from public.mts_messages m where m.recipient_id=v_actor_id and m.read=false and (v_role='Developer' or m.company_id=v_company);
  return jsonb_build_object('messages',coalesce(v_messages,'[]'::jsonb),'recipients',coalesce(v_recipients,'[]'::jsonb),'unread',coalesce(v_unread,0),'generatedAt',now());
end $function$;

create or replace function public.assurance_regent_browser_message_send(p_token text,p_recipient_id text,p_content text,p_attachment_file_id uuid default null)
returns jsonb language plpgsql security definer set search_path to 'public','extensions' as $function$
declare v_actor jsonb; v_state jsonb; v_recipient jsonb; v_actor_id text; v_role text; v_actor_company text; v_company text; v_id text; v_attachment record;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token); v_actor_id:=coalesce(v_actor->>'id',''); v_role:=coalesce(v_actor->>'role','Employee'); v_actor_company:=coalesce(v_actor->>'companyId','');
  if trim(coalesce(p_recipient_id,''))='' then raise exception 'Select a recipient.'; end if; if length(trim(coalesce(p_content,'')))<1 then raise exception 'Write a message before sending.'; end if; if length(p_content)>6000 then raise exception 'Internal messages are limited to 6000 characters.'; end if;
  select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state';
  select a into v_recipient from jsonb_array_elements(coalesce(v_state#>'{auth,accounts}','[]'::jsonb)) a where a->>'id'=p_recipient_id and coalesce((a->>'active')::boolean,true)=true and upper(coalesce(a->>'approvalStatus','APPROVED'))='APPROVED' limit 1;
  if v_recipient is null then raise exception 'The selected recipient is not an active Assurance Regent user.'; end if; if v_role<>'Developer' and coalesce(v_recipient->>'companyId','')<>v_actor_company then raise exception 'Internal messages may only be sent inside your company.'; end if;
  v_company:=case when v_role='Developer' then coalesce(v_recipient->>'companyId',v_actor_company) else v_actor_company end;
  if p_attachment_file_id is not null then select id,company_id,original_name,mime_type,size_bytes,status into v_attachment from public.assurance_regent_files where id=p_attachment_file_id limit 1; if v_attachment.id is null or v_attachment.status<>'STORED' then raise exception 'The selected attachment is not available.'; end if; if v_role<>'Developer' and v_attachment.company_id<>v_company then raise exception 'The selected attachment belongs to another company.'; end if; end if;
  v_id:='MSG-'||replace(gen_random_uuid()::text,'-','');
  insert into public.mts_messages(id,company_id,recipient,sender,content,read,created_at,sender_id,recipient_id,sender_name,recipient_name,kind,attachment_file_id,attachment_name,attachment_type,attachment_size,metadata)
  values(v_id,v_company,coalesce(v_recipient->>'name',p_recipient_id),coalesce(v_actor->>'name',v_actor_id),trim(p_content),false,now(),v_actor_id,p_recipient_id,coalesce(v_actor->>'name',v_actor_id),coalesce(v_recipient->>'name',p_recipient_id),'USER',p_attachment_file_id,coalesce(v_attachment.original_name,''),coalesce(v_attachment.mime_type,''),coalesce(v_attachment.size_bytes,0),jsonb_build_object('channel','INTERNAL_INBOX'));
  return jsonb_build_object('ok',true,'id',v_id,'createdAt',now());
end $function$;

create or replace function public.assurance_regent_browser_message_mark_read(p_token text,p_message_id text)
returns jsonb language plpgsql security definer set search_path to 'public','extensions' as $function$
declare v_actor jsonb; v_actor_id text; v_count integer;
begin v_actor:=public.assurance_regent_browser_actor_from_token(p_token); v_actor_id:=coalesce(v_actor->>'id',''); update public.mts_messages set read=true,read_at=coalesce(read_at,now()) where id=p_message_id and recipient_id=v_actor_id; get diagnostics v_count=row_count; if v_count=0 then raise exception 'Message not found or not assigned to this account.'; end if; return jsonb_build_object('ok',true,'id',p_message_id,'readAt',now()); end $function$;

create or replace function public.assurance_regent_browser_message_ai_self(p_token text,p_content text,p_label text default 'Jivan',p_metadata jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path to 'public','extensions' as $function$
declare v_actor jsonb; v_actor_id text; v_company text; v_id text;
begin v_actor:=public.assurance_regent_browser_actor_from_token(p_token); v_actor_id:=coalesce(v_actor->>'id',''); v_company:=coalesce(v_actor->>'companyId',''); if length(trim(coalesce(p_content,'')))<1 then return jsonb_build_object('ok',false); end if; v_id:='MSG-'||replace(gen_random_uuid()::text,'-',''); insert into public.mts_messages(id,company_id,recipient,sender,content,read,created_at,sender_id,recipient_id,sender_name,recipient_name,kind,metadata) values(v_id,v_company,coalesce(v_actor->>'name',v_actor_id),coalesce(nullif(trim(p_label),''),'Jivan'),left(trim(p_content),6000),false,now(),'JIVAN',v_actor_id,coalesce(nullif(trim(p_label),''),'Jivan'),coalesce(v_actor->>'name',v_actor_id),'AI',coalesce(p_metadata,'{}'::jsonb)||jsonb_build_object('channel','INTERNAL_INBOX')); return jsonb_build_object('ok',true,'id',v_id,'createdAt',now()); end $function$;

grant execute on function public.assurance_regent_browser_message_bundle(text) to anon, authenticated;
grant execute on function public.assurance_regent_browser_message_send(text,text,text,uuid) to anon, authenticated;
grant execute on function public.assurance_regent_browser_message_mark_read(text,text) to anon, authenticated;
grant execute on function public.assurance_regent_browser_message_ai_self(text,text,text,jsonb) to anon, authenticated;
