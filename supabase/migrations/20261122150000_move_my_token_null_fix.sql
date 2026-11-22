-- =============================================================================
-- Correção: jogador movia o token do personagem de outro (2026-11-22)
--
-- Em `move_my_token`, `owner_id = auth.uid()` vira nulo quando o token não tem dono marcado (todos
-- os tokens de personagem); `not (nulo or falso)` continua nulo e a recusa não disparava. Agora a
-- comparação é tratada como falsa quando é nula.
-- =============================================================================

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
    coalesce(v_token.owner_id = (select auth.uid()), false)
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
