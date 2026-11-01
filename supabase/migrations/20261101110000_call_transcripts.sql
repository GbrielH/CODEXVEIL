-- Transcrição da call (Fase 2, 2026-11-01). Grátis: cada participante transcreve a própria voz no
-- aparelho (reconhecimento de fala do navegador/celular) e grava só os trechos finais aqui.
--   * A atribuição não depende de identificar a voz: o trecho é de quem o gravou. Jogador → o
--     personagem dele na campanha; mestre → "Mestre" (sempre; os NPCs são deduzidos depois).
--   * LGPD: só grava com a sala em "Gravar transcrição" (ligado pelo dono); todos veem o aviso e
--     cada um pode pausar a própria transcrição (no aparelho).

alter table public.call_rooms add column transcription_enabled boolean not null default false;
grant update (transcription_enabled) on table public.call_rooms to authenticated;

create table public.transcript_segments (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.call_rooms (id) on delete cascade,
  session_id uuid references public.sessions (id) on delete set null,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  speaker_type text not null check (speaker_type in ('player', 'master')),
  character_id uuid references public.characters (id) on delete set null,
  speaker_label text not null check (char_length(speaker_label) between 1 and 80),
  text text not null check (char_length(btrim(text)) between 1 and 4000),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  created_at timestamptz not null default now()
);

comment on table public.transcript_segments is
  'Falas transcritas da call (só trechos finais), atribuídas ao personagem de quem falou ou ao Mestre.';
create index transcript_segments_room_idx on public.transcript_segments (room_id, started_at);
create index transcript_segments_session_idx on public.transcript_segments (session_id, started_at)
  where session_id is not null;

-- Papel, personagem e rótulo vêm da participação na sala (o cliente não escolhe quem é).
create function private.fill_transcript_segment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.call_rooms%rowtype;
  v_part public.call_participants%rowtype;
  v_name text;
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
  new.user_id := (select auth.uid());
  new.session_id := v_room.session_id;
  new.speaker_type := v_part.role;
  new.character_id := case when v_part.role = 'master' then null else v_part.character_id end;
  if v_part.role = 'master' then
    v_name := 'Mestre';
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
create trigger transcript_segments_fill before insert on public.transcript_segments
  for each row execute function private.fill_transcript_segment();

-- Quem pode corrigir: o dono da sala ou o mestre da campanha.
create function private.can_edit_transcript(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.call_rooms r
    where r.id = p_room_id
      and (r.owner_id = (select auth.uid()) or (r.campaign_id is not null and private.is_campaign_gm(r.campaign_id)))
  );
$$;
revoke all on function private.can_edit_transcript(uuid) from public;
grant execute on function private.can_edit_transcript(uuid) to authenticated;

alter table public.transcript_segments enable row level security;

create policy "Transcrição: quem esteve na sala e o mestre leem"
  on public.transcript_segments for select to authenticated
  using (private.can_see_call_room(room_id) or private.can_edit_transcript(room_id));
create policy "Transcrição: cada um grava a própria fala"
  on public.transcript_segments for insert to authenticated
  with check (true);
create policy "Transcrição: o mestre corrige"
  on public.transcript_segments for update to authenticated
  using (private.can_edit_transcript(room_id))
  with check (private.can_edit_transcript(room_id));
create policy "Transcrição: o mestre apaga"
  on public.transcript_segments for delete to authenticated
  using (private.can_edit_transcript(room_id));

revoke all on table public.transcript_segments from anon, authenticated;
grant select, delete on table public.transcript_segments to authenticated;
grant insert (room_id, text, started_at, ended_at) on table public.transcript_segments to authenticated;
grant update (text) on table public.transcript_segments to authenticated;
grant all on table public.transcript_segments to service_role;

alter publication supabase_realtime add table public.transcript_segments;
alter publication supabase_realtime add table public.call_rooms;
