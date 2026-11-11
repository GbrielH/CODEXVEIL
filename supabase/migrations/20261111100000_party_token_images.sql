-- =============================================================================
-- Imagens dos tokens com fichas ocultas (2026-11-11)
--
-- O mapa buscava a imagem do token lendo `characters`, e com as fichas do grupo ocultas o RLS
-- esconde a linha dos outros personagens (e as fichas de NPC são privadas do mestre): os tokens
-- apareciam só com as iniciais. Esta função entrega apenas o caminho da imagem, sem abrir a ficha:
--   * personagens do grupo: o token; sem ele, o retrato, se o dono compartilhar;
--   * NPCs (fichas do mestre com `npc_campaign_id`): token ou retrato, só enquanto o NPC estiver
--     visível num mapa ativo da campanha.
-- =============================================================================

create function private.npc_on_visible_map(p_character_id uuid, p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.map_tokens t
    join public.session_maps m on m.id = t.map_id
    where t.character_id = p_character_id
      and t.campaign_id = p_campaign_id
      and m.is_active
      and not t.is_hidden
  );
$$;

revoke all on function private.npc_on_visible_map(uuid, uuid) from public;
grant execute on function private.npc_on_visible_map(uuid, uuid) to authenticated, service_role;

create function public.list_character_token_images(p_character_ids uuid[])
returns table (id uuid, image_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    case
      when c.npc_campaign_id is not null then coalesce(c.token_path, c.portrait_path)
      else coalesce(c.token_path, case when c.share_portrait or c.owner_id = (select auth.uid()) then c.portrait_path end)
    end
  from public.characters c
  where c.id = any (p_character_ids)
    and (
      c.owner_id = (select auth.uid())
      or (c.campaign_id is not null and private.is_campaign_member(c.campaign_id))
      or (
        c.npc_campaign_id is not null
        and private.is_campaign_member(c.npc_campaign_id)
        and (private.is_campaign_gm(c.npc_campaign_id) or private.npc_on_visible_map(c.id, c.npc_campaign_id))
      )
    );
$$;

revoke all on function public.list_character_token_images(uuid[]) from public, anon;
grant execute on function public.list_character_token_images(uuid[]) to authenticated, service_role;

-- A imagem do NPC (token ou retrato) fica legível para os jogadores enquanto ele aparece no mapa.
create policy "Retratos de NPC: participantes leem enquanto o NPC está no mapa"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'campaign-media'
    and split_part(name, '/', 1) = 'characters'
    and exists (
      select 1 from public.characters c
      where c.id = private.try_uuid(split_part(name, '/', 2))
        and c.npc_campaign_id is not null
        and name in (c.token_path, c.portrait_path)
        and private.is_campaign_member(c.npc_campaign_id)
        and private.npc_on_visible_map(c.id, c.npc_campaign_id)
    )
  );
