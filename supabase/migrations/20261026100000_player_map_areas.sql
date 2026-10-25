-- =============================================================================
-- Áreas de magia dos jogadores no mapa ativo, vistas por todos.
--   * Jogadores não editam `session_maps`; estas funções só acrescentam (ou tiram) áreas
--     marcadas com o autor (`by`), no mapa ativo de uma campanha ativa da qual participam.
--   * Cada jogador tem no máximo 10 áreas por mapa; o mestre continua apagando qualquer uma.
-- =============================================================================

create function public.add_my_map_area(p_map_id uuid, p_area jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_map public.session_maps;
  v_uid uuid := (select auth.uid());
  v_kind text := p_area ->> 'kind';
  v_area jsonb;
begin
  select * into v_map from public.session_maps where id = p_map_id;
  if not found or not private.is_campaign_member(v_map.campaign_id) then
    raise exception 'Mapa não encontrado.' using errcode = 'P0002';
  end if;
  if not v_map.is_active then
    raise exception 'Este mapa não está ativo.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.campaigns ca where ca.id = v_map.campaign_id and ca.status = 'active'
  ) then
    raise exception 'A campanha está arquivada.' using errcode = '42501';
  end if;

  -- Só a forma conhecida, com números dentro do mapa (nada de campos extras vindos do cliente).
  if v_kind not in ('circle', 'cone', 'line')
    or jsonb_typeof(p_area -> 'x') <> 'number'
    or jsonb_typeof(p_area -> 'y') <> 'number'
    or jsonb_typeof(p_area -> 'meters') <> 'number'
    or (v_kind <> 'circle' and jsonb_typeof(p_area -> 'angle') is distinct from 'number')
    or (p_area ->> 'x')::numeric not between 0 and v_map.cols
    or (p_area ->> 'y')::numeric not between 0 and v_map.rows
    or (p_area ->> 'meters')::numeric not between 0 and 150 then
    raise exception 'Área inválida.' using errcode = '22023';
  end if;
  v_area := jsonb_build_object(
    'kind', v_kind,
    'x', (p_area ->> 'x')::numeric,
    'y', (p_area ->> 'y')::numeric,
    'meters', (p_area ->> 'meters')::numeric,
    'by', v_uid
  ) || case when v_kind = 'circle' then '{}'::jsonb
            else jsonb_build_object('angle', (p_area ->> 'angle')::numeric) end;

  if (
    select count(*) from jsonb_array_elements(v_map.areas) as entry(value)
    where entry.value ->> 'by' = v_uid::text
  ) >= 10 then
    raise exception 'Limite de 10 áreas suas neste mapa. Limpe as antigas primeiro.' using errcode = '22023';
  end if;

  update public.session_maps set areas = areas || jsonb_build_array(v_area) where id = p_map_id;
end;
$$;

create function public.clear_my_map_areas(p_map_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_map public.session_maps;
  v_uid text := (select auth.uid())::text;
begin
  select * into v_map from public.session_maps where id = p_map_id;
  if not found or not private.is_campaign_member(v_map.campaign_id) then
    raise exception 'Mapa não encontrado.' using errcode = 'P0002';
  end if;
  update public.session_maps
  set areas = coalesce(
    (select jsonb_agg(entry.value) from jsonb_array_elements(v_map.areas) as entry(value)
     where entry.value ->> 'by' is distinct from v_uid),
    '[]'::jsonb
  )
  where id = p_map_id;
end;
$$;

revoke all on function public.add_my_map_area(uuid, jsonb) from public;
grant execute on function public.add_my_map_area(uuid, jsonb) to authenticated;
revoke all on function public.clear_my_map_areas(uuid) from public;
grant execute on function public.clear_my_map_areas(uuid) to authenticated;
