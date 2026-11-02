-- Call (2026-11-02): "Mestre" é só quem é mestre da campanha da sala. Antes, quem abria a call
-- virava mestre mesmo sendo jogador (e via "Quem está falando").
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
  if (v_room.campaign_id is null and v_room.owner_id = v_user)
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


-- Corrige quem já entrou como mestre sem ser mestre da campanha.
update public.call_participants p
set role = 'player'
from public.call_rooms r
where r.id = p.room_id
  and p.role = 'master'
  and r.campaign_id is not null
  and not exists (
    select 1 from public.campaign_members m
    where m.campaign_id = r.campaign_id and m.user_id = p.user_id and m.role = 'gm'
  );
