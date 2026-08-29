-- Assurance Regent v6.3.21 — AI Fit Review Capture Hotfix
-- Purpose:
--   1. Prevent the recruitment AI-fit action from leaving ai_score NULL.
--   2. Provide a job-related deterministic advisory fallback when an older
--      recruitment-public deployment writes model='deterministic-fallback'.
--   3. Use only documented job criteria and applicant-supplied qualifications,
--      skills, cover-letter text, experience and application completeness.
--   4. Never use protected/sensitive characteristics and never make the hiring decision.

create or replace function public.assurance_regent_recruitment_deterministic_fit(
  p_vacancy_id text,
  p_experience numeric,
  p_qualification text,
  p_skills text,
  p_cover text,
  p_resume_path text
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_vacancy jsonb;
  v_required_experience numeric := 0;
  v_job_text text := '';
  v_candidate_text text := '';
  v_job_terms integer := 0;
  v_matching_terms integer := 0;
  v_experience_score numeric := 0;
  v_keyword_score numeric := 0;
  v_completeness_score numeric := 0;
  v_score integer := 0;
  v_summary text := '';
begin
  select v
    into v_vacancy
  from public.assurance_regent_state s
  cross join lateral jsonb_array_elements(coalesce(s.state_value#>'{live,vacancies}','[]'::jsonb)) v
  where s.state_key='browser-client-state'
    and v->>'id'=coalesce(p_vacancy_id,'')
  limit 1;

  if v_vacancy is null then
    return jsonb_build_object(
      'score',0,
      'summary','Job-fit fallback could not locate the vacancy criteria. Human HR review is required.',
      'model','deterministic-job-fit-v2'
    );
  end if;

  begin
    v_required_experience := greatest(0,coalesce(nullif(v_vacancy->>'experienceYears','')::numeric,0));
  exception when others then
    v_required_experience := 0;
  end;

  v_job_text := concat_ws(' ',
    v_vacancy->>'title',
    v_vacancy->>'department',
    v_vacancy->>'publicRequirements',
    v_vacancy->>'publicSkills',
    v_vacancy->>'publicEducation',
    v_vacancy->>'publicResponsibilities'
  );
  v_candidate_text := concat_ws(' ',coalesce(p_qualification,''),coalesce(p_skills,''),coalesce(p_cover,''));

  with job_tokens as (
    select distinct token
    from regexp_split_to_table(lower(v_job_text),'[^a-z0-9]+') token
    where length(token)>=4
      and token not in (
        'with','that','this','from','have','will','your','their','they','them','into','upon','role','work','good','strong','excellent','high','level','related','required','support','basic','daily','monthly','years','year','officer','finance','financial'
      )
  ), candidate_tokens as (
    select distinct token
    from regexp_split_to_table(lower(v_candidate_text),'[^a-z0-9]+') token
    where length(token)>=4
  )
  select count(*)::integer,count(c.token)::integer
    into v_job_terms,v_matching_terms
  from job_tokens j
  left join candidate_tokens c on c.token=j.token;

  if v_required_experience<=0 then
    v_experience_score := 35;
  else
    v_experience_score := least(35,35*greatest(0,coalesce(p_experience,0))/v_required_experience);
  end if;

  if v_job_terms>0 then
    v_keyword_score := least(45,45*v_matching_terms::numeric/v_job_terms::numeric);
  end if;

  if length(trim(coalesce(p_qualification,'')))>0 then v_completeness_score:=v_completeness_score+5; end if;
  if length(trim(coalesce(p_skills,'')))>0 then v_completeness_score:=v_completeness_score+5; end if;
  if length(trim(coalesce(p_cover,'')))>0 then v_completeness_score:=v_completeness_score+5; end if;
  if length(trim(coalesce(p_resume_path,'')))>0 then v_completeness_score:=v_completeness_score+5; end if;

  v_score := greatest(0,least(100,round(v_experience_score+v_keyword_score+v_completeness_score)::integer));
  v_summary := format(
    'Deterministic job-fit fallback: %s/100 based only on documented experience, job-criteria keyword alignment, and application completeness. %s of %s relevant job terms were found in the supplied qualification, skills summary, or cover letter. Advisory only; Human Resources must review the CV and make every employment decision.',
    v_score,v_matching_terms,v_job_terms
  );

  return jsonb_build_object('score',v_score,'summary',v_summary,'model','deterministic-job-fit-v2');
end
$function$;

create or replace function public.assurance_regent_recruitment_capture_fit_score()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_fit jsonb;
begin
  if new.ai_score is null
     and coalesce(new.ai_model,'')='deterministic-fallback'
     and new.ai_assessed_at is not null then
    v_fit := public.assurance_regent_recruitment_deterministic_fit(
      new.vacancy_id,
      new.experience_years,
      new.qualification,
      new.skills_summary,
      new.cover_note,
      new.resume_path
    );
    new.ai_score := greatest(0,least(100,coalesce((v_fit->>'score')::numeric,0)));
    new.ai_summary := coalesce(nullif(v_fit->>'summary',''),new.ai_summary);
    new.ai_model := coalesce(nullif(v_fit->>'model',''),'deterministic-job-fit-v2');
  end if;
  return new;
end
$function$;

drop trigger if exists assurance_regent_recruitment_capture_fit_score_trg
on public.assurance_regent_recruitment_applications;

create trigger assurance_regent_recruitment_capture_fit_score_trg
before insert or update of ai_score,ai_model,ai_assessed_at,ai_summary
on public.assurance_regent_recruitment_applications
for each row
execute function public.assurance_regent_recruitment_capture_fit_score();
