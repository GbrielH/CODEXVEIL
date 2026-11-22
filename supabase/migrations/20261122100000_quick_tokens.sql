-- =============================================================================
-- Token rápido (2026-11-22)
--
-- Mestre e jogadores colocam um token avulso (marcador) no mapa ativo, com nome e imagem, de
-- forma prática. O do jogador fica marcado com o dono (`owner_id`): só ele (e o mestre) move,
-- troca a imagem e tira. Limite de 6 tokens rápidos por jogador em cada mapa.
-- A imagem do jogador vai para campaigns/{id}/maps/quick-{uid}-*.{ext}.
-- =============================================================================

alter table public.map_tokens
  add column owner_id uuid references auth.users (id) on delete set null;

create index map_tokens_owner_idx on public.map_tokens (owner_id) where owner_id is not null;

-- Jogador: cria um token rápido no centro do mapa ativo.
create function public.add_my_quick_token(p_map_id uuid, p_label text, p_size text default 'medium')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_map public.session_maps;
  v_label text := btrim(coalesce(p_label, ''));
  v_side integer;
  v_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Entre na sua conta.' using errcode = '42501';
  end if;
  select * into v_map from public.session_maps where id = p_map_id;
  if not found or not private.is_campaign_member(v_map.campaign_id) then
    raise exception 'Mapa não encontrado.' using errcode = 'P0002';
  end if;
  if not v_map.is_active then
    raise exception 'Este mapa não está ativo.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.campaigns ca where ca.id = v_map.campaign_id and ca.status = 'active') then
    raise exception 'A campanha está arquivada.' using errcode = '42501';
  end if;
  if char_length(v_label) < 1 or char_length(v_label) > 80 then
    raise exception 'Dê um nome de 1 a 80 letras ao token.' using errcode = '22023';
  end if;
  if p_size not in ('tiny', 'small', 'medium', 'large') then
    raise exception 'Tamanho inválido.' using errcode = '22023';
  end if;
  if (select count(*) from public.map_tokens t where t.map_id = p_map_id and t.owner_id = (select auth.uid())) >= 6 then
    raise exception 'Você já tem 6 tokens neste mapa. Tire algum antes.' using errcode = '23514';
  end if;
  v_side := case p_size when 'large' then 2 else 1 end;
  insert into public.map_tokens (map_id, campaign_id, kind, label, x, y, size, is_hidden, owner_id)
  values (p_map_id, v_map.campaign_id, 'marker', v_label,
          greatest(0, (v_map.cols - v_side) / 2), greatest(0, (v_map.rows - v_side) / 2),
          p_size, false, (select auth.uid()))
  returning id into v_id;
  return v_id;
end;
$$;

-- Jogador: troca (ou tira) a imagem do próprio token rápido.
create function public.set_my_quick_token_image(p_token_id uuid, p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token public.map_tokens;
begin
  select * into v_token from public.map_tokens where id = p_token_id;
  if not found or v_token.owner_id is distinct from (select auth.uid()) then
    raise exception 'Você só altera os seus tokens.' using errcode = '42501';
  end if;
  if p_path is not null and (
    char_length(p_path) > 300
    or p_path not like 'campaigns/' || v_token.campaign_id || '/maps/quick-' || (select auth.uid()) || '-%'
  ) then
    raise exception 'Imagem inválida.' using errcode = '22023';
  end if;
  update public.map_tokens set image_path = p_path where id = p_token_id;
end;
$$;

-- Jogador: tira o próprio token rápido (devolve o caminho da imagem para apagar o arquivo).
create function public.remove_my_quick_token(p_token_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token public.map_tokens;
begin
  select * into v_token from public.map_tokens where id = p_token_id;
  if not found or v_token.owner_id is distinct from (select auth.uid()) then
    raise exception 'Você só tira os seus tokens.' using errcode = '42501';
  end if;
  delete from public.map_tokens where id = p_token_id;
  return v_token.image_path;
end;
$$;

revoke all on function public.add_my_quick_token(uuid, text, text) from public, anon;
revoke all on function public.set_my_quick_token_image(uuid, text) from public, anon;
revoke all on function public.remove_my_quick_token(uuid) from public, anon;
grant execute on function public.add_my_quick_token(uuid, text, text) to authenticated;
grant execute on function public.set_my_quick_token_image(uuid, text) to authenticated;
grant execute on function public.remove_my_quick_token(uuid) to authenticated;

-- Mover: além do token do próprio personagem, o jogador move os próprios tokens rápidos.
create or replace function public.move_my_token(p_token_id uuid, p_x integer, p_y integer)
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
  if not (
    v_token.owner_id = (select auth.uid())
    or (v_token.kind = 'character' and exists (
      select 1 from public.characters c where c.id = v_token.character_id and c.owner_id = (select auth.uid())
    ))
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

-- Envio da imagem pelo jogador: só na própria "pasta" quick-{uid}- do mapa da campanha ativa.
create policy "Tokens rápidos: participante envia a própria imagem"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'campaign-media'
    and split_part(name, '/', 1) = 'campaigns'
    and split_part(name, '/', 3) = 'maps'
    and split_part(name, '/', 4) like 'quick-' || (select auth.uid()) || '-%'
    and private.is_campaign_member(private.try_uuid(split_part(name, '/', 2)))
    and exists (
      select 1 from public.campaigns ca
      where ca.id = private.try_uuid(split_part(name, '/', 2)) and ca.status = 'active'
    )
  );

-- =============================================================================
-- Imagem dos tokens de criatura para os jogadores
--
-- O token de criatura usa a imagem da ficha da criatura, e o jogador não lê criaturas só do
-- mestre: os tokens apareciam só com as iniciais. Como nos NPCs, esta função entrega apenas o
-- caminho da imagem (sem abrir a ficha) enquanto a criatura estiver visível num mapa ativo.
-- =============================================================================

create function private.creature_on_visible_map(p_creature_id uuid, p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.map_tokens t
    join public.session_maps m on m.id = t.map_id
    where t.creature_id = p_creature_id
      and t.campaign_id = p_campaign_id
      and m.is_active
      and not t.is_hidden
  );
$$;

revoke all on function private.creature_on_visible_map(uuid, uuid) from public;
grant execute on function private.creature_on_visible_map(uuid, uuid) to authenticated, service_role;

create function public.list_creature_token_images(p_creature_ids uuid[])
returns table (id uuid, image_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.image_path
  from public.creatures c
  where c.id = any (p_creature_ids)
    and c.campaign_id is not null
    and private.is_campaign_member(c.campaign_id)
    and (
      private.is_campaign_gm(c.campaign_id)
      or c.visibility = 'members'
      or private.creature_on_visible_map(c.id, c.campaign_id)
    );
$$;

revoke all on function public.list_creature_token_images(uuid[]) from public, anon;
grant execute on function public.list_creature_token_images(uuid[]) to authenticated, service_role;

create policy "Imagens de criatura: participantes leem enquanto ela está no mapa"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'campaign-media'
    and split_part(name, '/', 1) = 'campaigns'
    and split_part(name, '/', 3) = 'creatures'
    and exists (
      select 1 from public.creatures c
      where c.campaign_id = private.try_uuid(split_part(name, '/', 2))
        and c.image_path = name
        and private.is_campaign_member(c.campaign_id)
        and private.creature_on_visible_map(c.id, c.campaign_id)
    )
  );
