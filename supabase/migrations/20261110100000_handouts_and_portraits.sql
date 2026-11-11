-- =============================================================================
-- Revelações e retrato do grupo (2026-11-10)
--
-- * `campaign_handouts`: o mestre entrega informações e imagens aos jogadores fora do roteiro
--   da sessão (cartas, mapas achados, retratos de NPCs, pistas). Pode preparar antes e revelar
--   na hora, para todos ou só para alguns personagens. Jogadores só leem o que foi revelado
--   para eles; a imagem segue a mesma regra.
-- * `characters.share_portrait`: o jogador decide se o retrato aparece para o grupo quando o
--   mestre oculta as fichas (ligado por padrão). Sem retrato, o grupo vê o token do mapa.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Retrato do personagem para o grupo
-- -----------------------------------------------------------------------------
alter table public.characters add column share_portrait boolean not null default true;
comment on column public.characters.share_portrait is
  'O retrato aparece para os participantes da campanha mesmo com as fichas ocultas.';

grant update (share_portrait) on table public.characters to authenticated;

create or replace function public.list_party_faces(p_campaign_id uuid)
returns table (id uuid, name text, owner_id uuid, owner_name text, portrait_path text, dice_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.name,
    c.owner_id,
    p.display_name,
    case when c.share_portrait then coalesce(c.portrait_path, c.token_path) else c.token_path end,
    c.dice_id
  from public.characters c
  left join public.profiles p on p.id = c.owner_id
  where c.campaign_id = p_campaign_id
    and private.is_campaign_member(p_campaign_id)
  order by c.name;
$$;

-- O token continua visível (ele aparece no mapa); o retrato só se o dono compartilhar.
drop policy "Retratos: participantes da campanha do personagem leem" on storage.objects;
create policy "Retratos: participantes da campanha do personagem leem"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'campaign-media'
    and split_part(name, '/', 1) = 'characters'
    and exists (
      select 1 from public.characters c
      where c.id = private.try_uuid(split_part(name, '/', 2))
        and c.campaign_id is not null
        and private.is_campaign_member(c.campaign_id)
        and (c.share_portrait or name is distinct from c.portrait_path)
    )
  );

-- -----------------------------------------------------------------------------
-- Revelações do mestre
-- -----------------------------------------------------------------------------
create table public.campaign_handouts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  title text not null check (char_length(title) between 1 and 120 and private.is_single_line(title)),
  body text not null default '' check (char_length(body) <= 20000 and private.is_clean_text(body)),
  image_path text check (image_path is null or char_length(image_path) <= 300),
  -- `all`: todos os participantes; `characters`: só os donos dos personagens em `character_ids`.
  audience text not null default 'all' check (audience in ('all', 'characters')),
  character_ids uuid[] not null default '{}' check (cardinality(character_ids) <= 50),
  is_revealed boolean not null default false,
  revealed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (audience = 'all' or cardinality(character_ids) > 0)
);

comment on table public.campaign_handouts is
  'Informações e imagens que o mestre revela aos jogadores fora do roteiro da sessão.';

create index campaign_handouts_campaign_idx on public.campaign_handouts (campaign_id, revealed_at desc nulls last, created_at desc);

create trigger campaign_handouts_set_updated_at
  before update on public.campaign_handouts
  for each row execute function private.set_updated_at();

-- Marca a hora da revelação (e limpa quando o mestre volta a esconder).
create function private.campaign_handouts_reveal_time()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_revealed and (tg_op = 'INSERT' or not old.is_revealed) then
    new.revealed_at := now();
  elsif not new.is_revealed then
    new.revealed_at := null;
  end if;
  return new;
end;
$$;

create trigger campaign_handouts_reveal_time
  before insert or update on public.campaign_handouts
  for each row execute function private.campaign_handouts_reveal_time();

-- Quem lê a revelação: mestres sempre; jogadores só depois de revelada e se forem do público.
-- Recebe os campos da linha (e não o id) para valer também no RETURNING de inserções.
create function private.can_read_handout_row(
  p_campaign_id uuid,
  p_is_revealed boolean,
  p_audience text,
  p_character_ids uuid[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_campaign_gm(p_campaign_id)
    or (
      p_is_revealed
      and private.is_campaign_member(p_campaign_id)
      and (
        p_audience = 'all'
        or exists (
          select 1 from public.characters c
          where c.id = any (p_character_ids)
            and c.campaign_id = p_campaign_id
            and c.owner_id = (select auth.uid())
        )
      )
    );
$$;

create function private.can_read_handout(p_handout_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.campaign_handouts h
    where h.id = p_handout_id
      and private.can_read_handout_row(h.campaign_id, h.is_revealed, h.audience, h.character_ids)
  );
$$;

revoke all on function private.can_read_handout_row(uuid, boolean, text, uuid[]) from public;
grant execute on function private.can_read_handout_row(uuid, boolean, text, uuid[]) to authenticated, service_role;
revoke all on function private.can_read_handout(uuid) from public;
grant execute on function private.can_read_handout(uuid) to authenticated, service_role;

alter table public.campaign_handouts enable row level security;

create policy "Revelações: mestres e o público revelado leem"
  on public.campaign_handouts for select to authenticated
  using (private.can_read_handout_row(campaign_id, is_revealed, audience, character_ids));
create policy "Revelações: mestres criam"
  on public.campaign_handouts for insert to authenticated
  with check (private.can_manage_campaign(campaign_id));
create policy "Revelações: mestres alteram"
  on public.campaign_handouts for update to authenticated
  using (private.can_manage_campaign(campaign_id))
  with check (private.can_manage_campaign(campaign_id));
create policy "Revelações: mestres apagam"
  on public.campaign_handouts for delete to authenticated
  using (private.can_manage_campaign(campaign_id));

grant select, delete on table public.campaign_handouts to authenticated;
grant insert (campaign_id, title, body, image_path, audience, character_ids, is_revealed)
  on table public.campaign_handouts to authenticated;
grant update (title, body, image_path, audience, character_ids, is_revealed)
  on table public.campaign_handouts to authenticated;

alter publication supabase_realtime add table public.campaign_handouts;

-- -----------------------------------------------------------------------------
-- Imagens das revelações: campaigns/{campanha}/handouts/{revelação}/{arquivo}
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

  -- Taverna: campanha `tavern/<campanha>/<arquivo>`; direta `tavern/<remetente>/<amigo>/<arquivo>`.
  if v_parts[1] = 'tavern' then
    if v_len = 3 then
      return private.is_campaign_member(v_id);
    elsif v_len = 4 then
      return v_id = (select auth.uid()) and private.are_friends(private.try_uuid(v_parts[3]));
    end if;
    return false;
  end if;

  if v_parts[1] = 'characters' and v_len = 3 then
    return private.can_edit_character_sheet(v_id);
  elsif v_parts[1] = 'campaigns' then
    if v_len = 4 and v_parts[3] in ('cover', 'creatures', 'maps', 'boards') then
      return private.can_manage_campaign(v_id);
    elsif v_len = 5 and v_parts[3] = 'sessions' then
      return private.can_manage_campaign(v_id)
        and exists (
          select 1 from public.sessions s
          where s.id = private.try_uuid(v_parts[4]) and s.campaign_id = v_id
        );
    elsif v_len = 5 and v_parts[3] = 'notes' then
      return exists (
        select 1 from public.campaign_notes n
        where n.id = private.try_uuid(v_parts[4]) and n.campaign_id = v_id and n.author_id = (select auth.uid())
      );
    elsif v_len = 5 and v_parts[3] = 'handouts' then
      return private.can_manage_campaign(v_id)
        and exists (
          select 1 from public.campaign_handouts h
          where h.id = private.try_uuid(v_parts[4]) and h.campaign_id = v_id
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

  -- Taverna: quem pode ler a mensagem (das últimas 24 horas) pode ver a imagem.
  if v_parts[1] = 'tavern' then
    return exists (
      select 1 from public.tavern_messages m
      where m.image_path = p_name
        and m.created_at > now() - interval '24 hours'
        and (
          (m.campaign_id is not null and private.is_campaign_member(m.campaign_id))
          or (m.recipient_id is not null and (select auth.uid()) in (m.sender_id, m.recipient_id))
        )
    );
  end if;

  if v_parts[1] = 'characters' then
    return private.can_view_character(v_id);
  elsif v_parts[1] = 'campaigns' then
    -- Anotações seguem a visibilidade da anotação (o mestre não vê as "só do autor").
    if v_parts[3] = 'notes' then
      return private.can_read_campaign_note(private.try_uuid(v_parts[4]));
    end if;
    -- Revelações: só depois de reveladas e para o público escolhido.
    if v_parts[3] = 'handouts' then
      return exists (
        select 1 from public.campaign_handouts h
        where h.id = private.try_uuid(v_parts[4]) and h.campaign_id = v_id and h.image_path = p_name
      ) and private.can_read_handout(private.try_uuid(v_parts[4]));
    end if;
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
          select 1 from public.sessions s
          where s.campaign_id = v_id and s.is_published and s.cover_path = p_name
        ) or exists (
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
          where m.campaign_id = v_id and m.is_active
            and (m.image_path = p_name or m.images @> jsonb_build_array(jsonb_build_object('path', p_name)))
        ) or exists (
          select 1 from public.map_tokens t
          join public.session_maps m on m.id = t.map_id
          where t.campaign_id = v_id and m.is_active and not t.is_hidden and t.image_path = p_name
        );
      else
        return false;
    end case;
  end if;
  return false;
end;
$$;

-- Limpeza de arquivos órfãos: as imagens das revelações contam como referenciadas.
create or replace function public.list_orphan_media(p_min_age_hours integer default 24, p_limit integer default 1000)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  with referenced(path) as (
    select cover_path from public.campaigns where cover_path is not null
    union select portrait_path from public.characters where portrait_path is not null
    union select token_path from public.characters where token_path is not null
    union select image_path from public.creatures where image_path is not null
    union select cover_path from public.sessions where cover_path is not null
    union select data ->> 'path' from public.session_blocks where type = 'image' and data ->> 'path' <> ''
    union select image_path from public.session_maps where image_path is not null
    union select layer.value ->> 'path'
      from public.session_maps m, jsonb_array_elements(m.images) as layer(value)
    union select image_path from public.map_tokens where image_path is not null
    union select image_path from public.campaign_notes where image_path is not null
    union select image_path from public.tavern_messages where image_path is not null
    union select item.value ->> 'path'
      from public.campaign_boards b, jsonb_array_elements(b.items) as item(value)
      where item.value ->> 'type' = 'image'
    union select preferences -> 'dice' ->> 'image' from public.profiles
      where preferences -> 'dice' ->> 'image' is not null
    union select image_path from public.user_dice where image_path is not null
    union select image_path from public.session_highlights where image_path is not null
    union select image_path from public.campaign_handouts where image_path is not null
  )
  select o.name
  from storage.objects o
  where o.bucket_id = 'campaign-media'
    and o.created_at < now() - make_interval(hours => greatest(p_min_age_hours, 1))
    and not exists (select 1 from referenced r where r.path = o.name)
  order by o.created_at
  limit least(greatest(p_limit, 1), 1000);
$$;
