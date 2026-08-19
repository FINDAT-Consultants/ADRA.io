-- Assurance Regent v6.4.0 — one canonical Zari/Jivan voice for every user/device.
-- Production migration: global_zari_jivan_voice_v6_4_0

create or replace function public.assurance_regent_browser_ai_preferences_get(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare a jsonb; r record;
begin
  a:=public.assurance_regent_browser_actor_from_token(p_token);
  select * into r from public.assurance_regent_ai_preferences where user_id=a->>'id';
  return jsonb_build_object(
    'writingStyle',coalesce(r.writing_style,'professional'),
    'temperature',coalesce(r.temperature,0.70),
    'responseLength',coalesce(r.response_length,'balanced'),
    'verbosity',coalesce(r.verbosity,'medium'),
    'jivanVoice','coral',
    'zariVoice','coral',
    'voiceSpeed',1.00,
    'voiceLocked',true,
    'voiceProvider','OPENAI_SERVER_TTS',
    'emojiLevel',coalesce(r.emoji_level,'light')
  );
end $function$;

create or replace function public.assurance_regent_browser_ai_preferences_set(
  p_token text,
  p_writing_style text default 'professional'::text,
  p_temperature numeric default 0.70,
  p_response_length text default 'balanced'::text,
  p_verbosity text default 'medium'::text,
  p_jivan_voice text default 'coral'::text,
  p_zari_voice text default 'coral'::text,
  p_voice_speed numeric default 1.00,
  p_emoji_level text default 'light'::text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare a jsonb; uid text; style text; length_mode text; verb text; emoji text;
begin
  a:=public.assurance_regent_browser_actor_from_token(p_token); uid:=a->>'id';
  style:=lower(trim(coalesce(p_writing_style,'professional')));
  if style not in ('professional','concise','friendly','analytical','executive') then style:='professional'; end if;
  length_mode:=lower(trim(coalesce(p_response_length,'balanced'))); if length_mode not in ('concise','balanced','detailed') then length_mode:='balanced'; end if;
  verb:=lower(trim(coalesce(p_verbosity,'medium'))); if verb not in ('low','medium','high') then verb:='medium'; end if;
  emoji:=lower(trim(coalesce(p_emoji_level,'light'))); if emoji not in ('off','light','expressive') then emoji:='light'; end if;
  insert into public.assurance_regent_ai_preferences(user_id,writing_style,temperature,response_length,verbosity,jivan_voice,zari_voice,voice_speed,emoji_level,updated_at)
  values(uid,style,greatest(0,least(2,coalesce(p_temperature,0.70))),length_mode,verb,'coral','coral',1.00,emoji,now())
  on conflict(user_id) do update set writing_style=excluded.writing_style,temperature=excluded.temperature,response_length=excluded.response_length,verbosity=excluded.verbosity,jivan_voice='coral',zari_voice='coral',voice_speed=1.00,emoji_level=excluded.emoji_level,updated_at=now();
  return public.assurance_regent_browser_ai_preferences_get(p_token);
end $function$;

update public.assurance_regent_ai_preferences
set jivan_voice='coral',zari_voice='coral',voice_speed=1.00,updated_at=now()
where jivan_voice is distinct from 'coral' or zari_voice is distinct from 'coral' or voice_speed is distinct from 1.00;
