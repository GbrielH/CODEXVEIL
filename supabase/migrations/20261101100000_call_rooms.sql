-- Call de voz e vídeo (Fase 1, 2026-11-01): salas do LiveKit dentro do Codexveil.
--   * Uma sala tem link (`slug`) e código curto legível (ex.: RUNA-4821), modo de acesso (aberta,
--     só convidados ou sala de espera) e, opcionalmente, campanha e sessão (para saber quem é
--     quem: o mestre e o personagem de cada jogador).
--   * O token do LiveKit é gerado no servidor (`/api/call/token`), que confere `call_participants`.
--   * Entrar, aprovar e convidar passam por funções; as tabelas só se leem com RLS.

create table public.call_rooms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]{10}$'),
  code text not null unique check (code ~ '^[A-Z]{4}-[0-9]{4}$'),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 80),
  campaign_id uuid references public.campaigns (id) on delete set null,
  session_id uuid references public.sessions (id) on delete set null,
  access_mode text not null default 'open' check (access_mode in ('open', 'invite', 'lobby')),
  status text not null default 'active' check (status in ('active', 'ended')),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

comment on table public.call_rooms is 'Salas de call (LiveKit), com link, código e campanha/sessão opcionais.';
create index call_rooms_owner_idx on public.call_rooms (owner_id, created_at desc);
create index call_rooms_campaign_idx on public.call_rooms (campaign_id) where campaign_id is not null;

create table public.call_invites (
  room_id uuid not null references public.call_rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  invited_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table public.call_participants (
  room_id uuid not null references public.call_rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  character_id uuid references public.characters (id) on delete set null,
  role text not null default 'player' check (role in ('master', 'player')),
  status text not null default 'approved' check (status in ('waiting', 'approved', 'denied')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (room_id, user_id)
);

-- Quem participa (ou foi convidado, ou é o dono) da sala.
create function private.can_see_call_room(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.call_rooms r where r.id = p_room_id and r.owner_id = (select auth.uid()))
    or exists (select 1 from public.call_participants p where p.room_id = p_room_id and p.user_id = (select auth.uid()))
    or exists (select 1 from public.call_invites i where i.room_id = p_room_id and i.user_id = (select auth.uid()));
$$;
revoke all on function private.can_see_call_room(uuid) from public;
grant execute on function private.can_see_call_room(uuid) to authenticated;

alter table public.call_rooms enable row level security;
alter table public.call_invites enable row level security;
alter table public.call_participants enable row level security;

create policy "Call: quem participa vê a sala"
  on public.call_rooms for select to authenticated
  using (private.can_see_call_room(id));
create policy "Call: o dono altera a sala"
  on public.call_rooms for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Call: dono e convidado veem o convite"
  on public.call_invites for select to authenticated
  using (user_id = (select auth.uid()) or private.can_see_call_room(room_id));

create policy "Call: quem participa vê os participantes"
  on public.call_participants for select to authenticated
  using (private.can_see_call_room(room_id));

revoke all on table public.call_rooms, public.call_invites, public.call_participants from anon, authenticated;
grant select on table public.call_rooms, public.call_invites, public.call_participants to authenticated;
grant update (title, access_mode, status, ended_at, session_id) on table public.call_rooms to authenticated;
grant all on table public.call_rooms, public.call_invites, public.call_participants to service_role;

-- Cria a sala com link e código únicos. Com campanha, só quem participa dela.
create function public.create_call_room(
  p_title text default '',
  p_access_mode text default 'open',
  p_campaign_id uuid default null,
  p_session_id uuid default null
)
returns table (id uuid, slug text, code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_words text[] := array['RUNA','ELMO','TOCH','CRIP','DRAG','FADA','GRIM','LOBO','MAGO','ORCO','PENA','SELO','TOMO','VEUS','ARCO','BRUM'];
  v_slug text;
  v_code text;
  v_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Entre na sua conta.' using errcode = '42501';
  end if;
  if p_campaign_id is not null and not private.is_campaign_member(p_campaign_id) then
    raise exception 'Você não participa desta campanha.' using errcode = '42501';
  end if;
  if p_session_id is not null and not exists (
    select 1 from public.sessions s where s.id = p_session_id and s.campaign_id = p_campaign_id
  ) then
    raise exception 'A sessão não é desta campanha.' using errcode = '22023';
  end if;
  loop
    v_slug := lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    v_code := v_words[1 + floor(random() * array_length(v_words, 1))::int] || '-' || lpad(floor(random() * 10000)::int::text, 4, '0');
    exit when not exists (select 1 from public.call_rooms r where r.slug = v_slug or r.code = v_code);
  end loop;
  insert into public.call_rooms (slug, code, owner_id, title, campaign_id, session_id, access_mode)
  values (v_slug, v_code, (select auth.uid()), coalesce(btrim(p_title), ''), p_campaign_id, p_session_id,
          case when p_access_mode in ('open', 'invite', 'lobby') then p_access_mode else 'open' end)
  returning call_rooms.id into v_id;
  return query select v_id, v_slug, v_code;
end;
$$;

-- Resumo público de uma sala pelo link ou código (para a tela de entrar).
create function public.find_call_room(p_ref text)
returns table (id uuid, slug text, code text, title text, access_mode text, status text, owner_name text, campaign_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.slug, r.code, r.title, r.access_mode, r.status, p.display_name, c.name
  from public.call_rooms r
  join public.profiles p on p.id = r.owner_id
  left join public.campaigns c on c.id = r.campaign_id
  where (select auth.uid()) is not null
    and (r.slug = lower(btrim(p_ref)) or r.code = upper(btrim(p_ref)));
$$;

-- Entra na sala: decide o papel (mestre = dono ou mestre da campanha) e o personagem do jogador.
-- Aberta: entra. Só convidados: precisa de convite. Sala de espera: aguarda a aprovação do dono.
create function public.join_call_room(p_room_id uuid)
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
    set character_id = excluded.character_id, role = excluded.role,
        status = case when call_participants.status = 'denied' then 'denied' else excluded.status end,
        joined_at = now(), left_at = null
  returning call_participants.status into v_status;
  return v_status;
end;
$$;

-- O dono aprova ou recusa quem está na sala de espera.
create function public.decide_call_participant(p_room_id uuid, p_user_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.call_rooms r where r.id = p_room_id and r.owner_id = (select auth.uid())) then
    raise exception 'Só quem criou a sala aprova a entrada.' using errcode = '42501';
  end if;
  update public.call_participants
    set status = case when p_approve then 'approved' else 'denied' end
  where room_id = p_room_id and user_id = p_user_id;
end;
$$;

-- Convida um amigo (ou alguém da campanha) para a sala.
create function public.invite_to_call(p_room_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_see_call_room(p_room_id) then
    raise exception 'Você não está nesta sala.' using errcode = '42501';
  end if;
  insert into public.call_invites (room_id, user_id, invited_by)
  values (p_room_id, p_user_id, (select auth.uid()))
  on conflict do nothing;
end;
$$;

-- Saída da call (para a lista de quem está na sala).
create function public.leave_call_room(p_room_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.call_participants set left_at = now()
  where room_id = p_room_id and user_id = (select auth.uid());
$$;

revoke all on function public.create_call_room(text, text, uuid, uuid) from public, anon;
revoke all on function public.find_call_room(text) from public, anon;
revoke all on function public.join_call_room(uuid) from public, anon;
revoke all on function public.decide_call_participant(uuid, uuid, boolean) from public, anon;
revoke all on function public.invite_to_call(uuid, uuid) from public, anon;
revoke all on function public.leave_call_room(uuid) from public, anon;
grant execute on function public.create_call_room(text, text, uuid, uuid) to authenticated;
grant execute on function public.find_call_room(text) to authenticated;
grant execute on function public.join_call_room(uuid) to authenticated;
grant execute on function public.decide_call_participant(uuid, uuid, boolean) to authenticated;
grant execute on function public.invite_to_call(uuid, uuid) to authenticated;
grant execute on function public.leave_call_room(uuid) to authenticated;

-- Tempo real: convites (aviso) e sala de espera (o dono vê quem chegou).
alter publication supabase_realtime add table public.call_invites;
alter publication supabase_realtime add table public.call_participants;
