-- NPCs no mapa e elenco da sessão (2026-11-01).
--   * Fichas completas de NPC (characters.npc_campaign_id) podem virar token no mapa.
--   * `session_cast`: os NPCs/monstros que o mestre separou para a sessão, para não precisar
--     rolar a biblioteca inteira na hora de pôr tokens. Só mestres veem e alteram.

create or replace function private.map_tokens_check_character()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.character_id is not null and not exists (
    select 1 from public.characters c
    where c.id = new.character_id
      and (c.campaign_id = new.campaign_id or c.npc_campaign_id = new.campaign_id)
  ) then
    raise exception 'O personagem não participa desta campanha.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create table public.session_cast (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  creature_id uuid references public.creatures (id) on delete cascade,
  character_id uuid references public.characters (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint session_cast_one_ref check ((creature_id is null) <> (character_id is null))
);

create unique index session_cast_creature_idx on public.session_cast (session_id, creature_id)
  where creature_id is not null;
create unique index session_cast_character_idx on public.session_cast (session_id, character_id)
  where character_id is not null;

create function private.session_cast_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.sessions s where s.id = new.session_id and s.campaign_id = new.campaign_id
  ) then
    raise exception 'A sessão não é desta campanha.' using errcode = '23514';
  end if;
  if new.creature_id is not null and not exists (
    select 1 from public.creatures c where c.id = new.creature_id and c.campaign_id = new.campaign_id
  ) then
    raise exception 'O registro não é desta campanha.' using errcode = '23514';
  end if;
  if new.character_id is not null and not exists (
    select 1 from public.characters c
    where c.id = new.character_id and c.npc_campaign_id = new.campaign_id
  ) then
    raise exception 'A ficha não é um NPC desta campanha.' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.session_cast_check() from public;

create trigger session_cast_check
  before insert or update on public.session_cast
  for each row execute function private.session_cast_check();

alter table public.session_cast enable row level security;

create policy "Mestres gerenciam o elenco da sessão"
  on public.session_cast for all
  to authenticated
  using (private.is_campaign_gm(campaign_id))
  with check (private.is_campaign_gm(campaign_id));

revoke all on table public.session_cast from anon, authenticated;
grant select, insert, delete on table public.session_cast to authenticated;
