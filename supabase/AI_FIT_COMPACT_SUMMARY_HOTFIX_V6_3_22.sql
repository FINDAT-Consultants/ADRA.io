-- Assurance Regent v6.3.22 — Compact AI Fit Summary Hotfix
-- Purpose:
--   1. Keep recruitment AI summaries to a few words.
--   2. Prevent any AI provider/fallback from storing long narratives in the AI FIT table cell.
--   3. Normalize existing reviewed applications immediately.
-- Human Resources remains responsible for every employment decision.

create or replace function public.assurance_regent_recruitment_compact_fit_summary()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.ai_score is not null and new.ai_assessed_at is not null then
    new.ai_summary := case
      when new.ai_score >= 80 then 'Strong job fit'
      when new.ai_score >= 60 then 'Good job fit'
      when new.ai_score >= 40 then 'Moderate job fit'
      else 'Limited job fit'
    end;
  end if;
  return new;
end
$function$;

drop trigger if exists zz_assurance_regent_recruitment_compact_fit_summary_trg
on public.assurance_regent_recruitment_applications;

create trigger zz_assurance_regent_recruitment_compact_fit_summary_trg
before insert or update of ai_score, ai_summary, ai_assessed_at
on public.assurance_regent_recruitment_applications
for each row
execute function public.assurance_regent_recruitment_compact_fit_summary();

update public.assurance_regent_recruitment_applications
set ai_summary = case
  when ai_score >= 80 then 'Strong job fit'
  when ai_score >= 60 then 'Good job fit'
  when ai_score >= 40 then 'Moderate job fit'
  else 'Limited job fit'
end
where ai_score is not null
  and ai_assessed_at is not null
  and ai_summary is distinct from case
    when ai_score >= 80 then 'Strong job fit'
    when ai_score >= 60 then 'Good job fit'
    when ai_score >= 40 then 'Moderate job fit'
    else 'Limited job fit'
  end;
