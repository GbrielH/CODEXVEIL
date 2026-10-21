-- Grade da sessão, passo 2 (docs/GRID.md): mapas da sessão, tokens, névoa de guerra e paredes
-- para a linha de visão. Cada quadrado = 1,5 m. O mestre monta tudo (site); o jogador vê o mapa
-- ativo e move só o token do próprio personagem (site e app), pela função `move_my_token`.

create table public.session_maps (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null,
  session_id uuid not null,
  name text not null check (char_length(trim(name)) between 1 and 80 and private.is_clean_text(name)),
  image_path text check (image_path is null or char_length(image_path) <= 300),
  -- Ajuste da imagem sob a grade: escala (zoom) e deslocamento, em quadrados.
  image_scale real not null default 1 check (image_scale between 0.05 and 20),
  image_offset_x real not null default 0 check (image_offset_x between -500 and 500),
  image_offset_y real not null default 0 check (image_offset_y between -500 and 500),
  cols integer not null default 30 check (cols between 4 and 200),
  rows integer not null default 20 check (rows between 4 and 200),
  show_grid boolean not null default true,
  -- Névoa de guerra: áreas reveladas ([[x, y, largura, altura], ...] em quadrados).
  fog_enabled boolean not null default false,
  fog_revealed jsonb not null default '[]'::jsonb
    check (jsonb_typeof(fog_revealed) = 'array' and pg_column_size(fog_revealed) <= 65536),
  -- Linha de visão opcional: paredes ([[x1, y1, x2, y2], ...] em quadrados).
  line_of_sight boolean not null default false,
  walls jsonb not null default '[]'::jsonb
    check (jsonb_typeof(walls) = 'array' and pg_column_size(walls) <= 65536),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_maps_id_campaign_key unique (id, campaign_id),
  constraint session_maps_session_fk
    foreign key (session_id, campaign_id) references public.sessions (id, campaign_id) on delete cascade
);

comment on table public.session_maps is
  'Mapas táticos das sessões (grade de quadrados de 1,5 m). Um mapa ativo por campanha.';

-- Um único mapa ativo por campanha: é o que os jogadores veem.
create unique index session_maps_one_active_idx on public.session_maps (campaign_id) where is_active;
create index session_maps_session_idx on public.session_maps (session_id, created_at);

create table public.map_tokens (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null,
  campaign_id uuid not null,
  kind text not null check (kind in ('character', 'creature', 'marker')),
  character_id uuid references public.characters (id) on delete cascade,
  creature_id uuid,
  label text not null default '' check (char_length(label) <= 80 and private.is_clean_text(label)),
  x integer not null default 0 check (x between 0 and 199),
  y integer not null default 0 check (y between 0 and 199),
  size text not null default 'medium' check (size in ('tiny', 'small', 'medium', 'large', 'huge', 'gargantuan')),
  is_hidden boolean not null default false,
  -- Alcance da visão (em quadrados) para a linha de visão; 0 = sem limite.
  vision_radius integer not null default 0 check (vision_radius between 0 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint map_tokens_map_fk
    foreign key (map_id, campaign_id) references public.session_maps (id, campaign_id) on delete cascade,
  constraint map_tokens_creature_fk
    foreign key (creature_id, campaign_id) references public.creatures (id, campaign_id) on delete cascade,
  constraint map_tokens_kind_ref check (
    (kind = 'character' and character_id is not null and creature_id is null)
    or (kind = 'creature' and creature_id is not null and character_id is null)
    or (kind = 'marker' and character_id is null and creature_id is null)
  )
);

comment on table public.map_tokens is
  'Tokens no mapa (personagens, criaturas e marcadores). Tokens ocultos só chegam ao mestre.';

create index map_tokens_map_idx on public.map_tokens (map_id);
create index map_tokens_character_idx on public.map_tokens (character_id) where character_id is not null;
-- Um token por personagem em cada mapa.
create unique index map_tokens_one_per_character_idx on public.map_tokens (map_id, character_id) where character_id is not null;

create trigger session_maps_set_updated_at
  before update on public.session_maps
  for each row execute function private.set_updated_at();
create trigger map_tokens_set_updated_at
  before update on public.map_tokens
  for each row execute function private.set_updated_at();

-- Mapa ativo só de sessão da própria campanha (o FK garante) e personagem do token na campanha.
create function private.map_tokens_check_character()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.character_id is not null and not exists (
    select 1 from public.characters c where c.id = new.character_id and c.campaign_id = new.campaign_id
  ) then
    raise exception 'O personagem não participa desta campanha.' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.map_tokens_check_character() from public;

create trigger map_tokens_check_character
  before insert or update of character_id, campaign_id on public.map_tokens
  for each row execute function private.map_tokens_check_character();

-- -----------------------------------------------------------------------------
-- Acesso
-- -----------------------------------------------------------------------------
alter table public.session_maps enable row level security;
alter table public.map_tokens enable row level security;

-- Mestre vê todos os mapas; jogadores, só o mapa ativo.
create policy "Mapas: mestre vê todos, jogadores o ativo"
  on public.session_maps for select to authenticated
  using (
    private.is_campaign_gm(campaign_id)
    or (is_active and private.is_campaign_member(campaign_id))
  );

create policy "Mapas: mestre cria"
  on public.session_maps for insert to authenticated
  with check (private.can_manage_campaign(campaign_id));

create policy "Mapas: mestre altera"
  on public.session_maps for update to authenticated
  using (private.can_manage_campaign(campaign_id))
  with check (private.can_manage_campaign(campaign_id));

create policy "Mapas: mestre apaga"
  on public.session_maps for delete to authenticated
  using (private.can_manage_campaign(campaign_id));

-- Tokens: o mestre vê todos; jogadores, os visíveis do mapa ativo.
create policy "Tokens: mestre vê todos, jogadores os visíveis do mapa ativo"
  on public.map_tokens for select to authenticated
  using (
    private.is_campaign_gm(campaign_id)
    or (
      not is_hidden
      and private.is_campaign_member(campaign_id)
      and exists (select 1 from public.session_maps m where m.id = map_id and m.is_active)
    )
  );

create policy "Tokens: mestre cria"
  on public.map_tokens for insert to authenticated
  with check (private.can_manage_campaign(campaign_id));

create policy "Tokens: mestre altera"
  on public.map_tokens for update to authenticated
  using (private.can_manage_campaign(campaign_id))
  with check (private.can_manage_campaign(campaign_id));

create policy "Tokens: mestre apaga"
  on public.map_tokens for delete to authenticated
  using (private.can_manage_campaign(campaign_id));

revoke all on table public.session_maps, public.map_tokens from anon, authenticated;
grant select, insert, delete on table public.session_maps to authenticated;
grant update (name, image_path, image_scale, image_offset_x, image_offset_y, cols, rows, show_grid,
  fog_enabled, fog_revealed, line_of_sight, walls, is_active)
  on table public.session_maps to authenticated;
grant select, insert, delete on table public.map_tokens to authenticated;
grant update (label, x, y, size, is_hidden, vision_radius) on table public.map_tokens to authenticated;
grant all on table public.session_maps, public.map_tokens to service_role;

-- Jogador move o token do próprio personagem (no mapa ativo, dentro da grade). Qualquer membro
-- passa por aqui; o mestre move tudo pelo update normal.
create function public.move_my_token(p_token_id uuid, p_x integer, p_y integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token public.map_tokens;
  v_map public.session_maps;
  v_side integer;
begin
  select * into v_token from public.map_tokens where id = p_token_id;
  if not found then
    raise exception 'Token não encontrado.' using errcode = 'P0002';
  end if;
  if v_token.kind <> 'character' or not exists (
    select 1 from public.characters c where c.id = v_token.character_id and c.owner_id = (select auth.uid())
  ) then
    raise exception 'Você só move o token do seu personagem.' using errcode = '42501';
  end if;
  select * into v_map from public.session_maps where id = v_token.map_id;
  if not v_map.is_active then
    raise exception 'Este mapa não está ativo.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.campaigns ca where ca.id = v_token.campaign_id and ca.status = 'active'
  ) then
    raise exception 'A campanha está arquivada.' using errcode = '42501';
  end if;
  v_side := case v_token.size when 'large' then 2 when 'huge' then 3 when 'gargantuan' then 4 else 1 end;
  if p_x < 0 or p_y < 0 or p_x + v_side > v_map.cols or p_y + v_side > v_map.rows then
    raise exception 'Fora do mapa.' using errcode = '22023';
  end if;
  update public.map_tokens set x = p_x, y = p_y where id = p_token_id;
end;
$$;

revoke all on function public.move_my_token(uuid, integer, integer) from public;
grant execute on function public.move_my_token(uuid, integer, integer) to authenticated;

-- Tempo real.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.session_maps, public.map_tokens;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Imagens dos mapas: campaigns/{campaign_id}/maps/{arquivo} no bucket campaign-media.
-- Escreve quem gerencia a campanha; lê o mestre ou, para jogadores, a imagem do mapa ativo.
-- -----------------------------------------------------------------------------
create or replace function private.can_write_campaign_media(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_parts text[] := string_to_array(p_name, '/');
  v_len integer := coalesce(array_length(v_parts, 1), 0);
  v_id uuid := private.try_uuid(v_parts[2]);
begin
  if v_id is null or v_len < 3 or not private.is_valid_media_filename(v_parts[v_len]) then
    return false;
  end if;

  if v_parts[1] = 'characters' and v_len = 3 then
    return private.can_edit_character_sheet(v_id);
  elsif v_parts[1] = 'campaigns' then
    if v_len = 4 and v_parts[3] in ('cover', 'creatures', 'maps') then
      return private.can_manage_campaign(v_id);
    elsif v_len = 5 and v_parts[3] = 'sessions' then
      return private.can_manage_campaign(v_id)
        and exists (
          select 1 from public.sessions s
          where s.id = private.try_uuid(v_parts[4]) and s.campaign_id = v_id
        );
    end if;
  end if;
  return false;
end;
$$;

create or replace function private.can_read_campaign_media(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_parts text[] := string_to_array(p_name, '/');
  v_id uuid := private.try_uuid(v_parts[2]);
begin
  if v_id is null then
    return false;
  end if;

  if v_parts[1] = 'characters' then
    return private.can_view_character(v_id);
  elsif v_parts[1] = 'campaigns' then
    if private.is_campaign_gm(v_id) then
      return true;
    end if;
    if not private.is_campaign_member(v_id) then
      return false;
    end if;
    case v_parts[3]
      when 'cover' then
        return true;
      when 'creatures' then
        return exists (
          select 1 from public.creatures c
          where c.campaign_id = v_id and c.image_path = p_name and c.visibility = 'members'
        );
      when 'sessions' then
        return exists (
          select 1
          from public.session_blocks b
          join public.sessions s on s.id = b.session_id
          where b.campaign_id = v_id
            and b.type = 'image'
            and b.visibility = 'members'
            and s.is_published
            and b.data ->> 'path' = p_name
        );
      when 'maps' then
        return exists (
          select 1 from public.session_maps m
          where m.campaign_id = v_id and m.is_active and m.image_path = p_name
        );
      else
        return false;
    end case;
  end if;
  return false;
end;
$$;
