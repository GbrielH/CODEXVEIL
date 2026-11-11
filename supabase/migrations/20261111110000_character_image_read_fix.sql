-- =============================================================================
-- Retratos e tokens com fichas ocultas: correção da leitura no Storage (2026-11-11)
--
-- As políticas "Retratos: participantes da campanha do personagem leem" (2026-10-31) e "Retratos
-- de NPC" (2026-11-11) consultavam `public.characters` com as permissões de quem lê. Com as fichas
-- do grupo ocultas (e com as fichas de NPC, sempre privadas do mestre), o RLS esconde a linha do
-- personagem, o `exists` dava falso e a imagem nunca era liberada: o grupo e o mapa mostravam só
-- as iniciais. A checagem agora roda numa função `security definer`, que lê apenas o necessário.
-- =============================================================================

create function private.can_read_character_image(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.characters c
    where c.id = private.try_uuid(split_part(p_name, '/', 2))
      and (
        -- Personagem do grupo: participantes veem o token sempre e o retrato se o dono compartilhar.
        (
          c.campaign_id is not null
          and private.is_campaign_member(c.campaign_id)
          and (c.share_portrait or p_name is distinct from c.portrait_path)
        )
        -- NPC do mestre: token ou retrato, enquanto estiver visível num mapa ativo da campanha.
        or (
          c.npc_campaign_id is not null
          and p_name in (c.token_path, c.portrait_path)
          and private.is_campaign_member(c.npc_campaign_id)
          and private.npc_on_visible_map(c.id, c.npc_campaign_id)
        )
      )
  );
$$;

revoke all on function private.can_read_character_image(text) from public;
grant execute on function private.can_read_character_image(text) to authenticated, service_role;

drop policy "Retratos: participantes da campanha do personagem leem" on storage.objects;
drop policy "Retratos de NPC: participantes leem enquanto o NPC está no mapa" on storage.objects;

create policy "Retratos e tokens: participantes da campanha leem"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'campaign-media'
    and split_part(name, '/', 1) = 'characters'
    and private.can_read_character_image(name)
  );
