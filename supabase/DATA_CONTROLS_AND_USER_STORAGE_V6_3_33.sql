-- Assurance Regent v6.3.33 — Developer Data Controls + per-user Storage

create table if not exists public.assurance_regent_data_controls_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id text not null,
  action text not null,
  table_name text not null,
  record_key jsonb not null default '{}'::jsonb,
  change_set jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.assurance_regent_data_controls_audit enable row level security;
revoke all on table public.assurance_regent_data_controls_audit from anon, authenticated;

create or replace function public.assurance_regent_data_controls_policy(p_table text)
returns jsonb language sql immutable as $$
select case trim(coalesce(p_table,''))
  when 'app_companies' then jsonb_build_object('pipeline','Identity & Access','label','Companies','writable',true,'editable',jsonb_build_array('name','code','active','hidden'))
  when 'app_users' then jsonb_build_object('pipeline','Identity & Access','label','Users','writable',false,'editable','[]'::jsonb,'redact',jsonb_build_array('password_hash'))
  when 'app_documents' then jsonb_build_object('pipeline','System & Content','label','Documents','writable',true,'editable',jsonb_build_array('row_data'))
  when 'app_live_records' then jsonb_build_object('pipeline','System & Content','label','Live records','writable',true,'editable',jsonb_build_array('data'))
  when 'app_reviews' then jsonb_build_object('pipeline','System & Content','label','Reviews','writable',true,'editable',jsonb_build_array('row_data'))
  when 'app_settings' then jsonb_build_object('pipeline','System & Content','label','Application settings','writable',true,'editable',jsonb_build_array('settings'))
  when 'app_state_documents' then jsonb_build_object('pipeline','System & Content','label','State documents','writable',false,'editable','[]'::jsonb)
  when 'assurance_regent_files' then jsonb_build_object('pipeline','System & Content','label','Stored files','writable',false,'editable','[]'::jsonb)
  when 'assurance_regent_leave_policies' then jsonb_build_object('pipeline','Workforce','label','Leave policies','writable',true,'editable',jsonb_build_array('annual_accrual_days_per_month','annual_use_window_months','annual_full_pay','maternity_weeks','maternity_multiple_birth_extra_weeks','paternity_days','compassionate_days','family_responsibility_days','family_care_days','sick_short_full_days','sick_short_half_days','sick_long_full_months','sick_long_half_months','require_medical_certificate','policy_note'))
  when 'assurance_regent_leave_requests' then jsonb_build_object('pipeline','Workforce','label','Leave requests','writable',false,'editable','[]'::jsonb)
  when 'assurance_regent_work_status' then jsonb_build_object('pipeline','Workforce','label','Work status','writable',true,'editable',jsonb_build_array('employee_name','status','note','effective_date','until_date'))
  when 'assurance_regent_work_status_history' then jsonb_build_object('pipeline','Workforce','label','Work status history','writable',false,'editable','[]'::jsonb)
  when 'mts_work_sessions' then jsonb_build_object('pipeline','Workforce','label','Work sessions','writable',false,'editable','[]'::jsonb)
  when 'workbook_employees' then jsonb_build_object('pipeline','Workforce','label','Workbook employees','writable',true,'editable',jsonb_build_array('employee_name','position','supervisor','hours_per_day','start_date','end_date','active','source_sheet'))
  when 'workbook_time_entries' then jsonb_build_object('pipeline','Workforce','label','Time entries','writable',true,'editable',jsonb_build_array('work_date','month','employee_id','employee_name','project_code','activity_evidence','hours','time_type','status','employee_decision'))
  when 'workbook_projects' then jsonb_build_object('pipeline','Projects & Finance','label','Projects','writable',true,'editable',jsonb_build_array('project_name','donor','start_date','end_date','status','admin_allowed','personnel_budget_ugx','eligible_employee_id','source_sheet'))
  when 'workbook_payroll' then jsonb_build_object('pipeline','Projects & Finance','label','Payroll','writable',true,'editable',jsonb_build_array('basic_salary_ugx','benefits','statutory_cost','exclusions','allocable_cost','source','configuration_status','notes'))
  when 'workbook_calendar' then jsonb_build_object('pipeline','Projects & Finance','label','Calendar','writable',true,'editable',jsonb_build_array('month','day_name','day_type','standard_hours','holiday_source'))
  when 'workbook_sources' then jsonb_build_object('pipeline','Projects & Finance','label','Sources','writable',true,'editable',jsonb_build_array('item','value','units','period_as_of','source_type','source_name','reference','owner','status','notes'))
  when 'workbook_source_checks' then jsonb_build_object('pipeline','Projects & Finance','label','Source checks','writable',false,'editable','[]'::jsonb)
  when 'workbook_formula_catalog' then jsonb_build_object('pipeline','Projects & Finance','label','Formula catalog','writable',false,'editable','[]'::jsonb)
  when 'assurance_regent_recruitment_applications' then jsonb_build_object('pipeline','Recruitment','label','Applications','writable',false,'editable','[]'::jsonb)
  when 'assurance_regent_recruitment_interviews' then jsonb_build_object('pipeline','Recruitment','label','Interviews','writable',false,'editable','[]'::jsonb)
  when 'assurance_regent_recruitment_notifications' then jsonb_build_object('pipeline','Recruitment','label','Recruitment notifications','writable',false,'editable','[]'::jsonb)
  when 'assurance_regent_recruitment_outreach' then jsonb_build_object('pipeline','Recruitment','label','Recruitment outreach','writable',false,'editable','[]'::jsonb)
  when 'assurance_regent_recovery_passports' then jsonb_build_object('pipeline','Recovery & Assurance','label','Recovery passports','writable',false,'editable','[]'::jsonb)
  when 'assurance_regent_recovery_approvals' then jsonb_build_object('pipeline','Recovery & Assurance','label','Recovery approvals','writable',false,'editable','[]'::jsonb)
  when 'assurance_regent_recovery_journal_batches' then jsonb_build_object('pipeline','Recovery & Assurance','label','Journal batches','writable',false,'editable','[]'::jsonb)
  when 'assurance_regent_recovery_journal_lines' then jsonb_build_object('pipeline','Recovery & Assurance','label','Journal lines','writable',false,'editable','[]'::jsonb)
  when 'assurance_regent_recovery_audit_events' then jsonb_build_object('pipeline','Recovery & Assurance','label','Recovery audit events','writable',false,'editable','[]'::jsonb)
  when 'mts_messages' then jsonb_build_object('pipeline','Communications & AI','label','Internal messages','writable',false,'editable','[]'::jsonb)
  when 'agent_action_log' then jsonb_build_object('pipeline','Communications & AI','label','Agent actions','writable',false,'editable','[]'::jsonb)
  when 'assurance_regent_agent_tasks' then jsonb_build_object('pipeline','Communications & AI','label','Agent tasks','writable',false,'editable','[]'::jsonb)
  when 'assurance_regent_agent_audit' then jsonb_build_object('pipeline','Communications & AI','label','Agent audit','writable',false,'editable','[]'::jsonb)
  when 'assurance_regent_system_incidents' then jsonb_build_object('pipeline','System & Content','label','System incidents','writable',false,'editable','[]'::jsonb)
  else null
end;
$$;

create or replace function public.assurance_regent_browser_data_controls_catalog(p_token text)
returns jsonb language plpgsql security definer set search_path to 'public','extensions' as $$
declare v_actor jsonb; v_name text; v_policy jsonb; v_count bigint; v_pk jsonb; v_columns jsonb; v_tables jsonb:='[]'::jsonb; v_pipelines jsonb;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  if coalesce(v_actor->>'role','')<>'Developer' then raise exception 'Developer permission is required.'; end if;
  for v_name in select table_name from information_schema.tables where table_schema='public' and public.assurance_regent_data_controls_policy(table_name) is not null order by table_name loop
    v_policy:=public.assurance_regent_data_controls_policy(v_name);
    execute format('select count(*) from public.%I',v_name) into v_count;
    select coalesce(jsonb_agg(kcu.column_name order by kcu.ordinal_position),'[]'::jsonb) into v_pk
    from information_schema.table_constraints tc join information_schema.key_column_usage kcu on kcu.constraint_name=tc.constraint_name and kcu.table_schema=tc.table_schema and kcu.table_name=tc.table_name
    where tc.table_schema='public' and tc.table_name=v_name and tc.constraint_type='PRIMARY KEY';
    select coalesce(jsonb_agg(c.column_name order by c.ordinal_position),'[]'::jsonb) into v_columns from information_schema.columns c
    where c.table_schema='public' and c.table_name=v_name and not (coalesce(v_policy->'redact','[]'::jsonb) ? c.column_name);
    v_tables:=v_tables||jsonb_build_array(v_policy||jsonb_build_object('table',v_name,'rows',v_count,'primary_key',v_pk,'columns',v_columns));
  end loop;
  select jsonb_agg(jsonb_build_object('name',p.pipeline,'tables',p.cnt) order by p.ord) into v_pipelines from (
    select x.pipeline,count(*) cnt,min(x.ord) ord from (values ('Identity & Access',1),('Workforce',2),('Projects & Finance',3),('Recruitment',4),('Recovery & Assurance',5),('Communications & AI',6),('System & Content',7)) x(pipeline,ord)
    join jsonb_array_elements(v_tables) t on t->>'pipeline'=x.pipeline group by x.pipeline
  ) p;
  return jsonb_build_object('ok',true,'pipeline_count',coalesce(jsonb_array_length(v_pipelines),0),'table_count',jsonb_array_length(v_tables),'pipelines',coalesce(v_pipelines,'[]'::jsonb),'tables',v_tables);
end;
$$;

create or replace function public.assurance_regent_browser_data_controls_rows(p_token text,p_table text,p_limit integer default 40,p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path to 'public','extensions' as $$
declare v_actor jsonb; v_policy jsonb; v_table text:=trim(coalesce(p_table,'')); v_limit int:=greatest(1,least(coalesce(p_limit,40),100)); v_offset int:=greatest(0,coalesce(p_offset,0)); v_total bigint; v_rows jsonb; v_pk jsonb; v_columns jsonb; v_redact text[]:=array[]::text[]; v_redact_expr text:=''; v_order text:=''; v_col text;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);
  if coalesce(v_actor->>'role','')<>'Developer' then raise exception 'Developer permission is required.'; end if;
  v_policy:=public.assurance_regent_data_controls_policy(v_table); if v_policy is null then raise exception 'This table is not available in Developer Data Controls.'; end if;
  select coalesce(array_agg(value),array[]::text[]) into v_redact from jsonb_array_elements_text(coalesce(v_policy->'redact','[]'::jsonb));
  foreach v_col in array v_redact loop v_redact_expr:=v_redact_expr||format(' - %L',v_col); end loop;
  select coalesce(jsonb_agg(kcu.column_name order by kcu.ordinal_position),'[]'::jsonb),coalesce(string_agg(format('%I',kcu.column_name),', ' order by kcu.ordinal_position),'') into v_pk,v_order
  from information_schema.table_constraints tc join information_schema.key_column_usage kcu on kcu.constraint_name=tc.constraint_name and kcu.table_schema=tc.table_schema and kcu.table_name=tc.table_name
  where tc.table_schema='public' and tc.table_name=v_table and tc.constraint_type='PRIMARY KEY';
  select coalesce(jsonb_agg(c.column_name order by c.ordinal_position),'[]'::jsonb) into v_columns from information_schema.columns c where c.table_schema='public' and c.table_name=v_table and not (coalesce(v_policy->'redact','[]'::jsonb) ? c.column_name);
  execute format('select count(*) from public.%I',v_table) into v_total;
  execute format('select coalesce(jsonb_agg(to_jsonb(q)%s),''[]''::jsonb) from (select * from public.%I %s limit %s offset %s) q',v_redact_expr,v_table,case when v_order<>'' then 'order by '||v_order else '' end,v_limit,v_offset) into v_rows;
  return jsonb_build_object('ok',true,'table',v_table,'label',v_policy->>'label','pipeline',v_policy->>'pipeline','writable',coalesce((v_policy->>'writable')::boolean,false),'editable_columns',coalesce(v_policy->'editable','[]'::jsonb),'primary_key',v_pk,'columns',v_columns,'total',v_total,'limit',v_limit,'offset',v_offset,'rows',coalesce(v_rows,'[]'::jsonb));
end;
$$;

create or replace function public.assurance_regent_browser_data_controls_update(p_token text,p_table text,p_key jsonb,p_patch jsonb)
returns jsonb language plpgsql security definer set search_path to 'public','extensions' as $$
declare v_actor jsonb; v_actor_id text; v_table text:=trim(coalesce(p_table,'')); v_policy jsonb; v_allowed text[]; v_pk text[]; v_col text; v_type text; v_json jsonb; v_text text; v_set text[]:=array[]::text[]; v_where text[]:=array[]::text[]; v_result jsonb; v_has_updated boolean:=false;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);v_actor_id:=v_actor->>'id';
  if coalesce(v_actor->>'role','')<>'Developer' then raise exception 'Developer permission is required.'; end if;
  v_policy:=public.assurance_regent_data_controls_policy(v_table); if v_policy is null or not coalesce((v_policy->>'writable')::boolean,false) then raise exception 'This table is read-only in Developer Data Controls.'; end if;
  if p_patch is null or jsonb_typeof(p_patch)<>'object' or p_patch='{}'::jsonb then raise exception 'No changes were supplied.'; end if;
  select coalesce(array_agg(value),array[]::text[]) into v_allowed from jsonb_array_elements_text(coalesce(v_policy->'editable','[]'::jsonb));
  select coalesce(array_agg(kcu.column_name order by kcu.ordinal_position),array[]::text[]) into v_pk from information_schema.table_constraints tc join information_schema.key_column_usage kcu on kcu.constraint_name=tc.constraint_name and kcu.table_schema=tc.table_schema and kcu.table_name=tc.table_name where tc.table_schema='public' and tc.table_name=v_table and tc.constraint_type='PRIMARY KEY';
  if coalesce(array_length(v_pk,1),0)=0 then raise exception 'This table has no supported primary key.'; end if;
  for v_col in select jsonb_object_keys(p_patch) loop
    if not (v_col=any(v_allowed)) then raise exception 'Column % is not editable in Developer Data Controls.',v_col; end if;
    select format_type(a.atttypid,a.atttypmod) into v_type from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=v_table and a.attname=v_col and a.attnum>0 and not a.attisdropped;
    if v_type is null or v_type !~ '^(text|character varying|boolean|smallint|integer|bigint|numeric|real|double precision|date|timestamp with time zone|timestamp without time zone|jsonb|uuid)' then raise exception 'Column type for % is not supported by the controlled editor.',v_col; end if;
    v_json:=p_patch->v_col; if jsonb_typeof(v_json)='null' then v_set:=array_append(v_set,format('%I = null',v_col)); else v_text:=v_json#>>'{}';if v_type='jsonb' then v_text:=v_json::text;end if;v_set:=array_append(v_set,format('%I = %L::%s',v_col,v_text,v_type));end if;
  end loop;
  foreach v_col in array v_pk loop
    if not (p_key ? v_col) then raise exception 'Primary key value % is required.',v_col; end if;
    select format_type(a.atttypid,a.atttypmod) into v_type from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=v_table and a.attname=v_col and a.attnum>0 and not a.attisdropped;
    v_json:=p_key->v_col;if jsonb_typeof(v_json)='null' then v_where:=array_append(v_where,format('%I is null',v_col));else v_text:=v_json#>>'{}';if v_type='jsonb' then v_text:=v_json::text;end if;v_where:=array_append(v_where,format('%I = %L::%s',v_col,v_text,v_type));end if;
  end loop;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name=v_table and column_name='updated_at') into v_has_updated;if v_has_updated then v_set:=array_append(v_set,'updated_at = now()');end if;
  execute format('update public.%I as t set %s where %s returning to_jsonb(t)',v_table,array_to_string(v_set,', '),array_to_string(v_where,' and ')) into v_result;if v_result is null then raise exception 'Record not found or no record was updated.';end if;
  insert into public.assurance_regent_data_controls_audit(actor_id,action,table_name,record_key,change_set) values(v_actor_id,'UPDATE',v_table,p_key,p_patch);
  return jsonb_build_object('ok',true,'table',v_table,'row',v_result);
end;
$$;

create or replace function public.assurance_regent_browser_data_controls_accounts(p_token text)
returns jsonb language plpgsql security definer set search_path to 'public','extensions' as $$
declare v_actor jsonb;v_state jsonb;v_accounts jsonb;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);if coalesce(v_actor->>'role','')<>'Developer' then raise exception 'Developer permission is required.';end if;
  select state_value into v_state from public.assurance_regent_state where state_key='browser-client-state';
  select coalesce(jsonb_agg((x-'passwordHash'-'password_hash') order by lower(coalesce(x->>'name',x->>'id',''))),'[]'::jsonb) into v_accounts from jsonb_array_elements(coalesce(v_state#>'{auth,accounts}','[]'::jsonb)) x;
  return jsonb_build_object('ok',true,'accounts',v_accounts,'count',jsonb_array_length(v_accounts));
end;
$$;

create or replace function public.assurance_regent_browser_storage_summary(p_token text)
returns jsonb language plpgsql security definer set search_path to 'public','extensions' as $$
declare v_actor jsonb;v_actor_id text;v_total bigint:=0;v_count bigint:=0;v_categories jsonb;v_recent jsonb;v_quota bigint:=0;
begin
  v_actor:=public.assurance_regent_browser_actor_from_token(p_token);v_actor_id:=v_actor->>'id';
  select coalesce(sum(size_bytes),0),count(*) into v_total,v_count from public.assurance_regent_files where actor_id=v_actor_id and deleted_at is null and upper(coalesce(status,'STORED')) not in ('DELETED','REMOVED');
  select coalesce(jsonb_agg(jsonb_build_object('key',q.kind,'label',q.label,'bytes',q.bytes,'files',q.files,'percent',case when v_total>0 then round((q.bytes::numeric*100)/v_total,1) else 0 end) order by q.ord),'[]'::jsonb) into v_categories from (
    select kind,label,ord,sum(size_bytes)::bigint bytes,count(*)::bigint files from (
      select case when mime_type ilike 'image/%' then 'images' when mime_type ilike any(array['application/pdf%','application/msword%','application/vnd.openxmlformats-officedocument%','application/vnd.ms-excel%','application/vnd.ms-powerpoint%','text/%']) then 'documents' else 'other' end kind,
      case when mime_type ilike 'image/%' then 'Images' when mime_type ilike any(array['application/pdf%','application/msword%','application/vnd.openxmlformats-officedocument%','application/vnd.ms-excel%','application/vnd.ms-powerpoint%','text/%']) then 'Documents' else 'Other files' end label,
      case when mime_type ilike 'image/%' then 2 when mime_type ilike any(array['application/pdf%','application/msword%','application/vnd.openxmlformats-officedocument%','application/vnd.ms-excel%','application/vnd.ms-powerpoint%','text/%']) then 1 else 3 end ord,size_bytes
      from public.assurance_regent_files where actor_id=v_actor_id and deleted_at is null and upper(coalesce(status,'STORED')) not in ('DELETED','REMOVED')
    ) f group by kind,label,ord
  ) q;
  select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'name',r.original_name,'mime_type',r.mime_type,'size_bytes',r.size_bytes,'category',r.category,'created_at',r.created_at) order by r.created_at desc),'[]'::jsonb) into v_recent from (select id,original_name,mime_type,size_bytes,category,created_at from public.assurance_regent_files where actor_id=v_actor_id and deleted_at is null and upper(coalesce(status,'STORED')) not in ('DELETED','REMOVED') order by created_at desc limit 20) r;
  begin select greatest(0,coalesce((settings->>'userStorageQuotaBytes')::bigint,0)) into v_quota from public.app_settings where id='global';exception when others then v_quota:=0;end;
  return jsonb_build_object('ok',true,'actor_id',v_actor_id,'total_bytes',v_total,'file_count',v_count,'quota_bytes',coalesce(v_quota,0),'quota_percent',case when coalesce(v_quota,0)>0 then least(100,round((v_total::numeric*100)/v_quota,1)) else null end,'categories',coalesce(v_categories,'[]'::jsonb),'recent_files',coalesce(v_recent,'[]'::jsonb));
end;
$$;

revoke all on function public.assurance_regent_data_controls_policy(text) from public;
revoke all on function public.assurance_regent_browser_data_controls_catalog(text) from public;
revoke all on function public.assurance_regent_browser_data_controls_rows(text,text,integer,integer) from public;
revoke all on function public.assurance_regent_browser_data_controls_update(text,text,jsonb,jsonb) from public;
revoke all on function public.assurance_regent_browser_data_controls_accounts(text) from public;
revoke all on function public.assurance_regent_browser_storage_summary(text) from public;
grant execute on function public.assurance_regent_browser_data_controls_catalog(text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_data_controls_rows(text,text,integer,integer) to anon,authenticated;
grant execute on function public.assurance_regent_browser_data_controls_update(text,text,jsonb,jsonb) to anon,authenticated;
grant execute on function public.assurance_regent_browser_data_controls_accounts(text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_storage_summary(text) to anon,authenticated;
