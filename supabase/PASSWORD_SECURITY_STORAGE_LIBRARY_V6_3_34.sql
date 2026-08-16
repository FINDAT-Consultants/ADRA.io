-- Assurance Regent v6.3.34 — secure password status + personal Storage library

create or replace function public.assurance_regent_browser_data_controls_accounts(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $$
declare
  v_actor jsonb;
  v_state jsonb;
  v_accounts jsonb;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  if coalesce(v_actor->>'role','')<>'Developer' then
    raise exception 'Developer permission is required.';
  end if;

  select state_value into v_state
  from public.assurance_regent_state
  where state_key='browser-client-state';

  select coalesce(
    jsonb_agg(
      (x - 'passwordHash' - 'password_hash') ||
      jsonb_build_object(
        'password_status', case when nullif(trim(coalesce(c.password_hash,'')),'') is null then 'NOT_SET' else 'SECURED' end,
        'password_updated_at', c.updated_at,
        'password_reset_available', (c.user_id is not null)
      )
      order by lower(coalesce(x->>'name',x->>'id',''))
    ),
    '[]'::jsonb
  ) into v_accounts
  from jsonb_array_elements(coalesce(v_state#>'{auth,accounts}','[]'::jsonb)) x
  left join public.assurance_regent_browser_credentials c
    on lower(c.user_id)=lower(coalesce(x->>'id',''));

  return jsonb_build_object('ok',true,'accounts',v_accounts,'count',jsonb_array_length(v_accounts));
end;
$$;

create or replace function public.assurance_regent_browser_storage_library(
  p_token text,
  p_kind text default 'all',
  p_search text default '',
  p_limit integer default 40,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $$
declare
  v_actor jsonb;
  v_actor_id text;
  v_kind text:=lower(trim(coalesce(p_kind,'all')));
  v_search text:=lower(trim(coalesce(p_search,'')));
  v_limit integer:=greatest(1,least(coalesce(p_limit,40),100));
  v_offset integer:=greatest(0,coalesce(p_offset,0));
  v_total bigint:=0;
  v_files jsonb:='[]'::jsonb;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  v_actor_id:=coalesce(v_actor->>'id','');
  if v_actor_id='' then raise exception 'Signed-in user is required.'; end if;
  if v_kind not in ('all','documents','images','other') then v_kind:='all'; end if;

  select count(*) into v_total
  from public.assurance_regent_files f
  where f.actor_id=v_actor_id
    and f.deleted_at is null
    and upper(coalesce(f.status,''))='STORED'
    and (
      v_kind='all' or
      v_kind=(case
        when f.mime_type ilike 'image/%' then 'images'
        when f.mime_type ilike any(array['application/pdf%','application/msword%','application/vnd.openxmlformats-officedocument%','application/vnd.ms-excel%','application/vnd.ms-powerpoint%','text/%']) then 'documents'
        else 'other'
      end)
    )
    and (
      v_search='' or
      lower(coalesce(f.original_name,'')) like '%'||v_search||'%' or
      lower(coalesce(f.mime_type,'')) like '%'||v_search||'%' or
      lower(coalesce(f.category,'')) like '%'||v_search||'%' or
      lower(coalesce(f.entity_type,'')) like '%'||v_search||'%'
    );

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'name',r.original_name,'mime_type',r.mime_type,'size_bytes',r.size_bytes,
    'category',r.category,'entity_type',r.entity_type,'entity_id',r.entity_id,
    'created_at',r.created_at,'stored_at',r.stored_at,'kind',r.kind
  ) order by r.created_at desc),'[]'::jsonb)
  into v_files
  from (
    select f.*,
      case
        when f.mime_type ilike 'image/%' then 'images'
        when f.mime_type ilike any(array['application/pdf%','application/msword%','application/vnd.openxmlformats-officedocument%','application/vnd.ms-excel%','application/vnd.ms-powerpoint%','text/%']) then 'documents'
        else 'other'
      end as kind
    from public.assurance_regent_files f
    where f.actor_id=v_actor_id
      and f.deleted_at is null
      and upper(coalesce(f.status,''))='STORED'
      and (
        v_kind='all' or
        v_kind=(case
          when f.mime_type ilike 'image/%' then 'images'
          when f.mime_type ilike any(array['application/pdf%','application/msword%','application/vnd.openxmlformats-officedocument%','application/vnd.ms-excel%','application/vnd.ms-powerpoint%','text/%']) then 'documents'
          else 'other'
        end)
      )
      and (
        v_search='' or
        lower(coalesce(f.original_name,'')) like '%'||v_search||'%' or
        lower(coalesce(f.mime_type,'')) like '%'||v_search||'%' or
        lower(coalesce(f.category,'')) like '%'||v_search||'%' or
        lower(coalesce(f.entity_type,'')) like '%'||v_search||'%'
      )
    order by f.created_at desc
    limit v_limit offset v_offset
  ) r;

  return jsonb_build_object(
    'ok',true,
    'actor_id',v_actor_id,
    'kind',v_kind,
    'search',v_search,
    'total',v_total,
    'limit',v_limit,
    'offset',v_offset,
    'files',v_files
  );
end;
$$;
