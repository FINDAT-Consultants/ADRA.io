-- Assurance Regent v6.3.37 — personal AI preferences, Company Hub and guarded company purge.
-- Final-state migration matching production Supabase. Uses browser-client-state as the live company/account source.

create table if not exists public.assurance_regent_ai_preferences (
  user_id text primary key,
  writing_style text not null default 'professional',
  temperature numeric(3,2) not null default 0.70 check (temperature between 0 and 2),
  response_length text not null default 'balanced' check (response_length in ('concise','balanced','detailed')),
  verbosity text not null default 'medium' check (verbosity in ('low','medium','high')),
  jivan_voice text not null default 'marin',
  zari_voice text not null default 'coral',
  voice_speed numeric(3,2) not null default 1.00 check (voice_speed between 0.75 and 1.35),
  emoji_level text not null default 'light' check (emoji_level in ('off','light','expressive')),
  updated_at timestamptz not null default now()
);
alter table public.assurance_regent_ai_preferences enable row level security;
revoke all on public.assurance_regent_ai_preferences from anon, authenticated;

create or replace function public.assurance_regent_browser_ai_preferences_get(p_token text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare a jsonb; r record;
begin
  a:=public.assurance_regent_browser_actor_from_token(p_token);
  select * into r from public.assurance_regent_ai_preferences where user_id=a->>'id';
  return jsonb_build_object('writingStyle',coalesce(r.writing_style,'professional'),'temperature',coalesce(r.temperature,0.70),'responseLength',coalesce(r.response_length,'balanced'),'verbosity',coalesce(r.verbosity,'medium'),'jivanVoice',coalesce(r.jivan_voice,'marin'),'zariVoice',coalesce(r.zari_voice,'coral'),'voiceSpeed',coalesce(r.voice_speed,1.00),'emojiLevel',coalesce(r.emoji_level,'light'));
end $$;

create or replace function public.assurance_regent_browser_ai_preferences_set(p_token text,p_writing_style text default 'professional',p_temperature numeric default 0.70,p_response_length text default 'balanced',p_verbosity text default 'medium',p_jivan_voice text default 'marin',p_zari_voice text default 'coral',p_voice_speed numeric default 1.00,p_emoji_level text default 'light')
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare a jsonb; uid text; style text; length_mode text; verb text; jvoice text; zvoice text; emoji text;
begin
  a:=public.assurance_regent_browser_actor_from_token(p_token);uid:=a->>'id';style:=lower(trim(coalesce(p_writing_style,'professional')));if style not in ('professional','concise','friendly','analytical','executive') then style:='professional';end if;length_mode:=lower(trim(coalesce(p_response_length,'balanced')));if length_mode not in ('concise','balanced','detailed') then length_mode:='balanced';end if;verb:=lower(trim(coalesce(p_verbosity,'medium')));if verb not in ('low','medium','high') then verb:='medium';end if;jvoice:=lower(trim(coalesce(p_jivan_voice,'marin')));if jvoice not in ('alloy','ash','ballad','coral','echo','fable','onyx','nova','sage','shimmer','verse','marin','cedar') then jvoice:='marin';end if;zvoice:=lower(trim(coalesce(p_zari_voice,'coral')));if zvoice not in ('alloy','ash','ballad','coral','echo','fable','onyx','nova','sage','shimmer','verse','marin','cedar') then zvoice:='coral';end if;emoji:=lower(trim(coalesce(p_emoji_level,'light')));if emoji not in ('off','light','expressive') then emoji:='light';end if;
  insert into public.assurance_regent_ai_preferences(user_id,writing_style,temperature,response_length,verbosity,jivan_voice,zari_voice,voice_speed,emoji_level,updated_at) values(uid,style,greatest(0,least(2,coalesce(p_temperature,0.70))),length_mode,verb,jvoice,zvoice,greatest(0.75,least(1.35,coalesce(p_voice_speed,1.00))),emoji,now()) on conflict(user_id) do update set writing_style=excluded.writing_style,temperature=excluded.temperature,response_length=excluded.response_length,verbosity=excluded.verbosity,jivan_voice=excluded.jivan_voice,zari_voice=excluded.zari_voice,voice_speed=excluded.voice_speed,emoji_level=excluded.emoji_level,updated_at=now();
  return public.assurance_regent_browser_ai_preferences_get(p_token);
end $$;

create or replace function public.assurance_regent_browser_message_clear_all_ai(p_token text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare a jsonb; uid text; affected int:=0;
begin
  a:=public.assurance_regent_browser_actor_from_token(p_token);uid:=a->>'id';
  with ai_threads as (select distinct thread_id from public.mts_messages where (sender_id=uid or recipient_id=uid) and (upper(kind) in ('AI_ADVISORY','AI_REPLY','AI_USER') or coalesce(metadata->>'source','') in ('AI_OPERATIONAL_ADVISORY','AI_INBOX_THREAD'))), upd as (update public.mts_messages m set hidden_for_sender=case when m.sender_id=uid then true else m.hidden_for_sender end,hidden_for_recipient=case when m.recipient_id=uid then true else m.hidden_for_recipient end where m.thread_id in (select thread_id from ai_threads) and (m.sender_id=uid or m.recipient_id=uid) returning 1) select count(*) into affected from upd;
  return jsonb_build_object('ok',true,'cleared',affected);
end $$;

create table if not exists public.assurance_regent_department_messages (
  id uuid primary key default gen_random_uuid(),company_id text not null,department text not null,sender_id text not null,sender_name text not null default '',content text not null,attachment_file_id uuid null,attachment_name text not null default '',created_at timestamptz not null default now()
);
create index if not exists assurance_regent_department_messages_channel_idx on public.assurance_regent_department_messages(company_id,department,created_at desc);
alter table public.assurance_regent_department_messages enable row level security;
revoke all on public.assurance_regent_department_messages from anon,authenticated;

create or replace function public.assurance_regent_browser_company_directory(p_token text,p_company_id text default '')
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare a jsonb; cid text; st jsonb; rows jsonb;
begin
  a:=public.assurance_regent_browser_actor_from_token(p_token);cid:=case when a->>'role'='Developer' then coalesce(nullif(trim(p_company_id),''),a->>'companyId') else a->>'companyId' end;if coalesce(cid,'')='' then return jsonb_build_object('companyId','', 'people','[]'::jsonb);end if;select state_value into st from public.assurance_regent_state where state_key='browser-client-state';
  select coalesce(jsonb_agg(person order by lower(person->>'department'),lower(person->>'name')),'[]'::jsonb) into rows from (select jsonb_build_object('id',acct->>'id','name',coalesce(nullif(acct->>'name',''),acct->>'id'),'email',coalesce(acct->>'email',''),'position',coalesce(acct->>'position',''),'department',coalesce(nullif(acct->>'department',''),nullif(emp->>'department',''),case when coalesce(acct->>'position','') ~* 'human resource|\bhr\b|people' then 'Human Resources' when coalesce(acct->>'position','') ~* 'finance|account|payroll|bookkeep' then 'Finance & Accounting' when coalesce(acct->>'position','') ~* 'project|program|programme' then 'Programs & Projects' when coalesce(acct->>'position','') ~* 'country director|chief executive|\bceo\b|managing director' then 'Executive' else 'General' end),'supervisor',coalesce(acct->>'supervisor',emp->>'supervisor',''),'supervisoryRole',coalesce(acct->>'supervisoryRole',''),'role',coalesce(acct->>'role','Employee'),'profilePhoto',coalesce(acct->>'profilePhoto',emp->>'profilePhoto',''),'team',coalesce(nullif(emp->>'team',''),'General'),'phone',coalesce(emp->>'phone',''),'location',coalesce(emp->>'location',''),'employmentStatus',coalesce(emp->>'employmentStatus',''),'companyId',cid) person from jsonb_array_elements(coalesce(st#>'{auth,accounts}','[]'::jsonb)) acct left join lateral (select e.value emp from jsonb_array_elements(coalesce(st#>'{live,employees}','[]'::jsonb)) e(value) where coalesce(e.value->>'employeeId',e.value->>'id','')=acct->>'id' and coalesce(e.value->>'companyId',cid)=cid limit 1) ee on true where acct->>'companyId'=cid and coalesce((acct->>'active')::boolean,true)=true and coalesce(acct->>'approvalStatus','APPROVED')='APPROVED' and coalesce((acct->>'hiddenFromDirectory')::boolean,false)=false) q;
  return jsonb_build_object('companyId',cid,'people',rows);
end $$;

create or replace function public.assurance_regent_browser_department_message_bundle(p_token text,p_department text,p_limit int default 120)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare a jsonb; cid text; dep text;
begin a:=public.assurance_regent_browser_actor_from_token(p_token);cid:=a->>'companyId';dep:=left(trim(coalesce(p_department,'')),160);if coalesce(cid,'')='' then raise exception 'This account is not connected to a company.';end if;if dep='' then raise exception 'Select a department channel.';end if;return jsonb_build_object('companyId',cid,'department',dep,'messages',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at) from (select id,company_id as "companyId",department,sender_id as "senderId",sender_name as "senderName",content,attachment_file_id as "attachmentFileId",attachment_name as "attachmentName",created_at as "createdAt" from public.assurance_regent_department_messages where company_id=cid and department=dep order by created_at desc limit greatest(1,least(coalesce(p_limit,120),250))) t),'[]'::jsonb));end $$;

create or replace function public.assurance_regent_browser_department_message_send(p_token text,p_department text,p_content text,p_attachment_file_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare a jsonb; cid text; dep text; msg text; fid uuid; fname text:=''; mid uuid;
begin a:=public.assurance_regent_browser_actor_from_token(p_token);cid:=a->>'companyId';dep:=left(trim(coalesce(p_department,'')),160);msg:=left(trim(coalesce(p_content,'')),6000);if coalesce(cid,'')='' then raise exception 'This account is not connected to a company.';end if;if dep='' then raise exception 'Select a department channel.';end if;if msg='' then raise exception 'Write a message first.';end if;if p_attachment_file_id is not null then select id,original_name into fid,fname from public.assurance_regent_files where id=p_attachment_file_id and company_id=cid and status='STORED' limit 1;if fid is null then raise exception 'The attachment is not available to this company.';end if;end if;insert into public.assurance_regent_department_messages(company_id,department,sender_id,sender_name,content,attachment_file_id,attachment_name) values(cid,dep,a->>'id',coalesce(a->>'name',a->>'id'),msg,fid,coalesce(fname,'')) returning id into mid;return jsonb_build_object('ok',true,'id',mid,'department',dep);end $$;

create or replace function public.assurance_regent_json_purge_company(v jsonb,cid text,uids text[])
returns jsonb language plpgsql immutable as $$
declare k text;val jsonb;child jsonb;outv jsonb;scalar text;
begin if v is null then return null;end if;if jsonb_typeof(v)='object' then if coalesce(v->>'companyId',v->>'company_id','')=cid then return null;end if;foreach k in array array['id','userId','user_id','employeeId','employee_id','senderId','sender_id','recipientId','recipient_id','actorId','actor_id'] loop scalar:=v->>k;if scalar is not null and scalar=any(uids) then return null;end if;end loop;outv:='{}'::jsonb;for k,val in select key,value from jsonb_each(v) loop if k=any(uids) then continue;end if;child:=public.assurance_regent_json_purge_company(val,cid,uids);if child is not null then outv:=outv||jsonb_build_object(k,child);end if;end loop;return outv;elsif jsonb_typeof(v)='array' then select coalesce(jsonb_agg(x),'[]'::jsonb) into outv from (select public.assurance_regent_json_purge_company(value,cid,uids) x from jsonb_array_elements(v)) s where x is not null;return outv;end if;return v;end $$;

create or replace function public.assurance_regent_browser_admin_company_purge_preview(p_token text,p_company_id text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare a jsonb;cid text:=trim(coalesce(p_company_id,''));st jsonb;co jsonb;users int:=0;files int:=0;rows_count bigint:=0;r record;n bigint;code text;name text;is_system boolean:=false;
begin a:=public.assurance_regent_browser_actor_from_token(p_token);if a->>'role'<>'Developer' then raise exception 'Developer permission is required.';end if;select state_value into st from public.assurance_regent_state where state_key='browser-client-state';select value into co from jsonb_array_elements(coalesce(st#>'{auth,companies}','[]'::jsonb)) x(value) where value->>'id'=cid limit 1;if co is null then select to_jsonb(c) into co from public.app_companies c where c.id=cid limit 1;end if;if co is null then raise exception 'Company not found.';end if;code:=coalesce(nullif(co->>'code',''),cid);name:=coalesce(nullif(co->>'name',''),code);is_system:=coalesce((co->>'system')::boolean,false) or cid='COMPANY-DEFAULT';if is_system then raise exception 'System companies cannot be purged through Company Controls.';end if;select count(*) into users from jsonb_array_elements(coalesce(st#>'{auth,accounts}','[]'::jsonb)) x(value) where value->>'companyId'=cid;select count(*) into files from public.assurance_regent_files where company_id=cid and status='STORED' and deleted_at is null;for r in select table_name from information_schema.columns where table_schema='public' and column_name='company_id' group by table_name loop begin execute format('select count(*) from public.%I where company_id=$1',r.table_name) into n using cid;rows_count:=rows_count+coalesce(n,0);exception when others then null;end;end loop;return jsonb_build_object('ok',true,'companyId',cid,'companyName',name,'companyCode',code,'accounts',users,'storedFiles',files,'companyScopedRows',rows_count,'confirmation','DELETE '||code);end $$;

create or replace function public.assurance_regent_browser_admin_company_purge_commit(p_token text,p_company_id text,p_confirmation text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare a jsonb;cid text:=trim(coalesce(p_company_id,''));st jsonb;co jsonb;code text;name text;expected text;is_system boolean:=false;uids text[];pids uuid[];bids uuid[];r record;deleted_users int:=0;
begin a:=public.assurance_regent_browser_actor_from_token(p_token);if a->>'role'<>'Developer' then raise exception 'Developer permission is required.';end if;select state_value into st from public.assurance_regent_state where state_key='browser-client-state' for update;select value into co from jsonb_array_elements(coalesce(st#>'{auth,companies}','[]'::jsonb)) x(value) where value->>'id'=cid limit 1;if co is null then select to_jsonb(c) into co from public.app_companies c where c.id=cid limit 1;end if;if co is null then raise exception 'Company not found.';end if;code:=coalesce(nullif(co->>'code',''),cid);name:=coalesce(nullif(co->>'name',''),code);is_system:=coalesce((co->>'system')::boolean,false) or cid='COMPANY-DEFAULT';if is_system then raise exception 'System companies cannot be purged.';end if;expected:='DELETE '||code;if trim(coalesce(p_confirmation,''))<>expected then raise exception 'Type % exactly to permanently delete this company.',expected;end if;select coalesce(array_agg(distinct uid),array[]::text[]) into uids from (select value->>'id' uid from jsonb_array_elements(coalesce(st#>'{auth,accounts}','[]'::jsonb)) x(value) where value->>'companyId'=cid union select id from public.app_users where company_id=cid) q where coalesce(uid,'')<>'';select coalesce(array_agg(id),array[]::uuid[]) into pids from public.assurance_regent_recovery_passports where company_id=cid;select coalesce(array_agg(id),array[]::uuid[]) into bids from public.assurance_regent_recovery_journal_batches where company_id=cid;delete from public.assurance_regent_recovery_journal_lines where batch_id=any(bids);delete from public.assurance_regent_recovery_approvals where passport_id=any(pids);delete from public.assurance_regent_recovery_passport_keys where passport_id=any(pids);delete from public.assurance_regent_recovery_journal_batches where company_id=cid;delete from public.assurance_regent_recovery_passports where company_id=cid;delete from public.assurance_regent_recruitment_applications where company_id=cid;for r in select distinct table_name from information_schema.columns where table_schema='public' and column_name='company_id' and table_name not in ('app_users','app_companies','assurance_regent_recovery_journal_batches','assurance_regent_recovery_passports','assurance_regent_recruitment_applications') loop begin execute format('delete from public.%I where company_id=$1',r.table_name) using cid;exception when others then null;end;end loop;if cardinality(uids)>0 then delete from public.app_auth_sessions where user_id=any(uids);delete from public.assurance_regent_auth_sessions where user_id=any(uids);delete from public.assurance_regent_voice_access_audit where user_id=any(uids);delete from public.assurance_regent_agent_messages where user_id=any(uids);delete from public.assurance_regent_agent_tasks where user_id=any(uids);delete from public.assurance_regent_ai_preferences where user_id=any(uids);delete from public.assurance_regent_jivan_communication_log where actor_id=any(uids);delete from public.assurance_regent_recovery_approvals where actor_id=any(uids);delete from public.assurance_regent_browser_credentials where user_id=any(uids);delete from public.workbook_payroll where employee_id=any(uids);delete from public.workbook_time_entries where employee_id=any(uids);delete from public.workbook_employees where employee_id=any(uids);delete from public.workbook_projects where eligible_employee_id=any(uids);end if;update public.assurance_regent_state set state_value=public.assurance_regent_json_purge_company(state_value,cid,uids),updated_at=now() where state_key in ('browser-client-state','control-center');delete from public.app_users where company_id=cid;get diagnostics deleted_users=row_count;delete from public.app_companies where id=cid;return jsonb_build_object('ok',true,'companyId',cid,'companyName',name,'deletedAccounts',greatest(deleted_users,cardinality(uids)),'purged',true);end $$;

revoke all on function public.assurance_regent_browser_ai_preferences_get(text) from public;
revoke all on function public.assurance_regent_browser_ai_preferences_set(text,text,numeric,text,text,text,text,numeric,text) from public;
revoke all on function public.assurance_regent_browser_message_clear_all_ai(text) from public;
revoke all on function public.assurance_regent_browser_company_directory(text,text) from public;
revoke all on function public.assurance_regent_browser_department_message_bundle(text,text,int) from public;
revoke all on function public.assurance_regent_browser_department_message_send(text,text,text,uuid) from public;
revoke all on function public.assurance_regent_browser_admin_company_purge_preview(text,text) from public;
revoke all on function public.assurance_regent_browser_admin_company_purge_commit(text,text,text) from public;
grant execute on function public.assurance_regent_browser_ai_preferences_get(text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_ai_preferences_set(text,text,numeric,text,text,text,text,numeric,text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_message_clear_all_ai(text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_company_directory(text,text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_department_message_bundle(text,text,int) to anon,authenticated;
grant execute on function public.assurance_regent_browser_department_message_send(text,text,text,uuid) to anon,authenticated;
grant execute on function public.assurance_regent_browser_admin_company_purge_preview(text,text) to anon,authenticated;
grant execute on function public.assurance_regent_browser_admin_company_purge_commit(text,text,text) to anon,authenticated;
