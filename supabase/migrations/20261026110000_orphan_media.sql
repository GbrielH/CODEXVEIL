-- =============================================================================
-- Limpeza de arquivos órfãos do bucket `campaign-media`.
--   * `list_orphan_media` devolve os arquivos que nenhuma linha do banco usa mais: imagens de
--     blocos removidos, criaturas, personagens, anotações, sessões e mapas excluídos, capas
--     trocadas e o que sobrou de contas excluídas.
--   * Só arquivos com mais de `p_min_age_hours` horas: um envio recém-feito ainda não foi
--     gravado na linha dele e não pode ser apagado.
--   * Somente a chave secreta (service_role) executa. Quem apaga é a Edge Function
--     `cleanup-orphans`, pela API do Storage (apagar a linha de storage.objects não apaga o
--     arquivo).
-- Os lugares que guardam caminhos são os mesmos das regras de leitura do Storage
-- (`private.can_read_campaign_media`): ao criar um novo, acrescente-o aqui.
-- =============================================================================

create function public.list_orphan_media(p_min_age_hours integer default 24, p_limit integer default 1000)
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
  )
  select o.name
  from storage.objects o
  where o.bucket_id = 'campaign-media'
    and o.created_at < now() - make_interval(hours => greatest(p_min_age_hours, 1))
    and not exists (select 1 from referenced r where r.path = o.name)
  order by o.created_at
  limit least(greatest(p_limit, 1), 1000);
$$;

revoke all on function public.list_orphan_media(integer, integer) from public, anon, authenticated;
grant execute on function public.list_orphan_media(integer, integer) to service_role;
