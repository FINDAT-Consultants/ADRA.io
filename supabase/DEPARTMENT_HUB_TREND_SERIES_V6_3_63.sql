-- Assurance Regent v6.3.63 — compact Department Hub trend-chart series.
create or replace function public.assurance_regent_browser_department_social_trending(
  p_token text,
  p_company_id text default '',
  p_limit integer default 5
) returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $$
declare
  a jsonb;
  cid text;
  lim integer:=greatest(1,least(coalesce(p_limit,5),10));
  result jsonb;
begin
  a:=public.assurance_regent_browser_actor_from_token(p_token);
  cid:=case when a->>'role'='Developer'
    then coalesce(nullif(trim(coalesce(p_company_id,'')),''),nullif(a->>'companyId',''))
    else nullif(a->>'companyId','') end;
  if coalesce(cid,'')='' then raise exception 'Select a company before viewing its Department Hub.'; end if;

  with recursive candidates as (
    select m.id,m.company_id,m.department,m.sender_id,m.sender_name,m.content,m.post_kind,m.created_at
    from public.assurance_regent_department_messages m
    where m.company_id=cid
      and m.parent_id is null
      and m.post_kind in ('POST','PROJECT_NEWS')
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
      round(((m.viewers*0.8+m.impressions*0.2+m.post_reactions*2.2+m.comment_reactions*1.1+m.comments*2.5+m.contributors*1.4)*(1.0/(1.0+m.age_hours/72.0)))::numeric,1)::double precision as trend_score
    from metrics m
  ), top_rows as (
    select * from ranked order by trend_score desc,created_at desc limit lim
  ), series as (
    select tr.id,
      jsonb_agg(
        jsonb_build_object(
          'date',d.day::date,
          'value',round((dm.views*0.8+dm.reactions*2.0+dm.comments*2.5+dm.contributors*1.4)::numeric,1)::double precision,
          'views',dm.views,
          'reactions',dm.reactions,
          'comments',dm.comments,
          'contributors',dm.contributors
        ) order by d.day
      ) as trend_series
    from top_rows tr
    cross join lateral generate_series(date_trunc('day',now()-interval '13 days'),date_trunc('day',now()),interval '1 day') d(day)
    cross join lateral (
      select
        coalesce((select sum(v.view_count) from public.assurance_regent_department_social_views v where v.company_id=cid and v.message_id=tr.id and v.last_viewed_at>=d.day and v.last_viewed_at<d.day+interval '1 day'),0)::bigint as views,
        coalesce((select count(*) from public.assurance_regent_department_reactions r join thread t on t.id=r.message_id where t.root_id=tr.id and r.created_at>=d.day and r.created_at<d.day+interval '1 day'),0)::int as reactions,
        coalesce((select count(*) from thread t join public.assurance_regent_department_messages m on m.id=t.id where t.root_id=tr.id and t.id<>tr.id and m.created_at>=d.day and m.created_at<d.day+interval '1 day'),0)::int as comments,
        coalesce((select count(distinct t.sender_id) from thread t join public.assurance_regent_department_messages m on m.id=t.id where t.root_id=tr.id and t.id<>tr.id and coalesce(t.sender_id,'')<>'' and m.created_at>=d.day and m.created_at<d.day+interval '1 day'),0)::int as contributors
    ) dm
    group by tr.id
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',tr.id,
      'companyId',tr.company_id,
      'department',tr.department,
      'senderId',tr.sender_id,
      'senderName',tr.sender_name,
      'content',tr.content,
      'postKind',tr.post_kind,
      'createdAt',tr.created_at,
      'trendScore',tr.trend_score,
      'viewCount',tr.viewers,
      'impressions',tr.impressions,
      'reactions',tr.post_reactions+tr.comment_reactions,
      'postReactions',tr.post_reactions,
      'commentReactions',tr.comment_reactions,
      'comments',tr.comments,
      'contributors',tr.contributors,
      'trendSeries',coalesce(s.trend_series,'[]'::jsonb),
      'trendLabel',case when tr.trend_score>=30 then 'Hot' when tr.trend_score>=15 then 'Rising' when tr.trend_score>=6 then 'Active' when tr.trend_score>0 then 'Building' else 'New' end
    ) order by tr.trend_score desc,tr.created_at desc
  ),'[]'::jsonb)
  into result
  from top_rows tr
  left join series s on s.id=tr.id;

  return result;
end $$;
