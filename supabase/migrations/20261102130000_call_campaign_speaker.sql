-- Call só dentro de campanha; o mestre escolhe "quem está falando".
--   * Sala nova sem campanha é recusada (as antigas continuam como estão).
--   * Ao reconectar, o personagem gravado na participação é mantido.
--   * `speaking_as`: rótulo opcional das falas do mestre (NPC 1, NPC 2, "Narração"…). Nulo = "Mestre".

create function private.require_call_campaign()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.campaign_id is null then
    raise exception 'Escolha a campanha da call.' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function private.require_call_campaign() from public;
create trigger call_rooms_require_campaign
  before insert on public.call_rooms
  for each row execute function private.require_call_campaign();

alter table public.call_participants
  add column speaking_as text check (speaking_as is null or char_length(btrim(speaking_as)) between 1 and 80);

create or replace function public.join_call_room(p_room_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.call_rooms%rowtype;
  v_user uuid := (select auth.uid());
  v_invited boolean;
  v_role text := 'player';
  v_character uuid;
  v_status text;
begin
  if v_user is null then
    raise exception 'Entre na sua conta.' using errcode = '42501';
  end if;
  select * into v_room from public.call_rooms where id = p_room_id;
  if not found then
    raise exception 'Sala não encontrada.' using errcode = 'P0002';
  end if;
  if v_room.status <> 'active' then
    raise exception 'Esta call já foi encerrada.' using errcode = '22023';
  end if;
  v_invited := exists (select 1 from public.call_invites i where i.room_id = p_room_id and i.user_id = v_user);
  if v_room.owner_id = v_user
     or (v_room.campaign_id is not null and exists (
       select 1 from public.campaign_members m
       where m.campaign_id = v_room.campaign_id and m.user_id = v_user and m.role = 'gm')) then
    v_role := 'master';
  end if;
  if v_room.campaign_id is not null then
    select c.id into v_character from public.characters c
    where c.campaign_id = v_room.campaign_id and c.owner_id = v_user
    order by c.updated_at desc limit 1;
  end if;
  -- Já aprovado antes: continua aprovado (reconexão).
  select p.status into v_status from public.call_participants p where p.room_id = p_room_id and p.user_id = v_user;
  if v_status is null or v_status = 'waiting' then
    if v_room.owner_id = v_user or v_invited or v_room.access_mode = 'open' then
      v_status := 'approved';
    elsif v_room.access_mode = 'invite' then
      raise exception 'Esta sala é só para convidados.' using errcode = '42501';
    else
      v_status := 'waiting';
    end if;
  end if;
  insert into public.call_participants (room_id, user_id, character_id, role, status, joined_at, left_at)
  values (p_room_id, v_user, v_character, v_role, v_status, now(), null)
  on conflict (room_id, user_id) do update
    set character_id = coalesce(call_participants.character_id, excluded.character_id), role = excluded.role,
        status = case when call_participants.status = 'denied' then 'denied' else excluded.status end,
        joined_at = now(), left_at = null
  returning call_participants.status into v_status;
  return v_status;
end;
$$;

-- O mestre diz quem está falando (nulo volta a "Mestre").
create function public.set_call_speaker(p_room_id uuid, p_label text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.call_participants
  set speaking_as = nullif(left(btrim(coalesce(p_label, '')), 80), '')
  where room_id = p_room_id and user_id = (select auth.uid()) and role = 'master' and status = 'approved';
  if not found then
    raise exception 'Só o mestre na call escolhe quem está falando.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.set_call_speaker(uuid, text) from public, anon;
grant execute on function public.set_call_speaker(uuid, text) to authenticated;

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
