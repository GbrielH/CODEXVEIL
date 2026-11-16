-- =============================================================================
-- Transcrição na ordem certa (2026-11-15)
--
-- Problema: cada pessoa transcreve a própria voz no navegador e manda o horário da fala pelo
-- relógio do próprio computador. Relógios diferentes (segundos ou minutos de diferença) deixavam
-- as falas fora de ordem. Agora o banco usa o próprio relógio: a fala termina "agora" (quando o
-- trecho chega) e começa "agora menos a duração" que o navegador mediu (até 2 minutos).
-- =============================================================================

create or replace function private.fill_transcript_segment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.call_rooms%rowtype;
  v_part public.call_participants%rowtype;
  v_name text;
  v_span interval;
begin
  select * into v_room from public.call_rooms where id = new.room_id;
  if not found or v_room.status <> 'active' or not v_room.transcription_enabled then
    raise exception 'A transcrição desta sala está desligada.' using errcode = '42501';
  end if;
  select * into v_part from public.call_participants
  where room_id = new.room_id and user_id = (select auth.uid()) and status = 'approved';
  if not found then
    raise exception 'Você não está nesta call.' using errcode = '42501';
  end if;
  -- Relógio do servidor (o do navegador pode estar adiantado ou atrasado).
  v_span := least(greatest(new.ended_at - new.started_at, interval '0'), interval '2 minutes');
  new.ended_at := now();
  new.started_at := now() - v_span;
  new.user_id := (select auth.uid());
  new.session_id := v_room.session_id;
  new.speaker_type := v_part.role;
  new.character_id := case when v_part.role = 'master' then null else v_part.character_id end;
  if v_part.role = 'master' then
    v_name := coalesce(v_part.speaking_as, 'Mestre');
  else
    select c.name into v_name from public.characters c where c.id = v_part.character_id;
    if v_name is null then
      select p.display_name into v_name from public.profiles p where p.id = new.user_id;
    end if;
  end if;
  new.speaker_label := left(coalesce(v_name, 'Jogador'), 80);
  return new;
end;
$$;
revoke all on function private.fill_transcript_segment() from public;
