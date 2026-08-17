-- Assurance Regent v6.3.55 — Department Hub post ownership controls.
-- Adds governed owner-only post deletion and queues now-unreferenced attachments for Storage cleanup.

create or replace function public.assurance_regent_browser_department_social_delete(
  p_token text,
  p_message_id uuid,
  p_company_id text default ''
) returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  a jsonb;
  cid text;
  uid text;
  root_sender text;
  root_parent uuid;
  root_kind text;
  thread_ids uuid[]:='{}'::uuid[];
  queued_files integer:=0;
begin
  a:=public.assurance_regent_browser_actor_from_token(p_token);
  uid:=coalesce(a->>'id','');
  cid:=case when a->>'role'='Developer'
    then coalesce(nullif(trim(coalesce(p_company_id,'')),''),nullif(a->>'companyId',''))
    else nullif(a->>'companyId','') end;

  if coalesce(cid,'')='' then raise exception 'Select a company before deleting a Department Hub post.'; end if;
  if p_message_id is null then raise exception 'Select a post to delete.'; end if;

  select m.sender_id,m.parent_id,m.post_kind
  into root_sender,root_parent,root_kind
  from public.assurance_regent_department_messages m
  where m.id=p_message_id and m.company_id=cid
  limit 1;

  if root_sender is null then raise exception 'This post is unavailable.'; end if;
  if root_parent is not null then raise exception 'Use the comment controls to manage replies.'; end if;
  if root_sender<>uid then raise exception 'You can delete only posts you created.'; end if;
  if root_kind not in ('POST','PROJECT_NEWS') then raise exception 'This item is not managed from the post menu.'; end if;

  with recursive thread as (
    select m.id from public.assurance_regent_department_messages m where m.id=p_message_id and m.company_id=cid
    union all
    select child.id
    from public.assurance_regent_department_messages child
    join thread t on child.parent_id=t.id
    where child.company_id=cid
  )
  select coalesce(array_agg(id),'{}'::uuid[]) into thread_ids from thread;

  insert into public.assurance_regent_department_social_retention_queue(
    file_id,company_id,bucket_id,storage_path,original_name,root_message_id,queued_at,status
  )
  select distinct
    f.id,f.company_id,coalesce(nullif(f.bucket_id,''),'assurance-regent-files'),f.storage_path,
    coalesce(f.original_name,''),p_message_id,now(),'PENDING'
  from public.assurance_regent_department_messages m
  cross join lateral jsonb_array_elements(coalesce(m.attachments,'[]'::jsonb)) a(value)
  join public.assurance_regent_files f on f.id::text=nullif(a.value->>'fileId','')
  where m.id=any(thread_ids)
    and f.storage_path is not null and f.storage_path<>''
    and coalesce(f.status,'')<>'DELETED'
    and not exists (
      select 1
      from public.assurance_regent_department_messages other
      cross join lateral jsonb_array_elements(coalesce(other.attachments,'[]'::jsonb)) oa(value)
      where other.company_id=cid
        and not (other.id=any(thread_ids))
        and oa.value->>'fileId'=f.id::text
    )
  on conflict(file_id) do update set
    company_id=excluded.company_id,
    bucket_id=excluded.bucket_id,
    storage_path=excluded.storage_path,
    original_name=excluded.original_name,
    root_message_id=excluded.root_message_id,
    queued_at=excluded.queued_at,
    status=case when public.assurance_regent_department_social_retention_queue.status='DELETED' then 'DELETED' else 'PENDING' end,
    last_error='';
  get diagnostics queued_files=row_count;

  update public.assurance_regent_files f
  set status='DELETED',deleted_at=coalesce(f.deleted_at,now()),updated_at=now(),
      metadata=coalesce(f.metadata,'{}'::jsonb)||jsonb_build_object(
        'deletion_source','department-hub-owner-delete',
        'deletion_queued_at',now()
      )
  where f.id in (
    select q.file_id
    from public.assurance_regent_department_social_retention_queue q
    where q.root_message_id=p_message_id and q.status<>'DELETED'
  );

  delete from public.assurance_regent_department_messages
  where id=p_message_id and company_id=cid and sender_id=uid and parent_id is null;

  return jsonb_build_object(
    'ok',true,
    'messageId',p_message_id,
    'companyId',cid,
    'threadItemsDeleted',coalesce(cardinality(thread_ids),0),
    'filesQueued',queued_files
  );
end $function$;

revoke all on function public.assurance_regent_browser_department_social_delete(text,uuid,text) from public;
grant execute on function public.assurance_regent_browser_department_social_delete(text,uuid,text) to anon,authenticated,service_role;
