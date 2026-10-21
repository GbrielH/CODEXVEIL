-- 2026-10-21, pedidos do responsável:
--   * Blocos da sessão: `revealable` marca o que o mestre pretende liberar na mesa. Só esses
--     aparecem na lista "Lore da sessão"; o resto é roteiro só dele. Blocos que já existiam
--     continuam liberáveis (nada some); os novos nascem como roteiro.
--   * Mapa com várias imagens (camadas), cada uma com posição e largura (em quadrados):
--     `images` = [{"path", "x", "y", "width"}]. A imagem antiga vira a primeira camada.

alter table public.session_blocks add column revealable boolean not null default false;
update public.session_blocks set revealable = true where type not in ('gm_note', 'divider');
grant update (revealable) on table public.session_blocks to authenticated;

alter table public.session_maps
  add column images jsonb not null default '[]'::jsonb
    check (jsonb_typeof(images) = 'array' and pg_column_size(images) <= 65536);

update public.session_maps
  set images = jsonb_build_array(jsonb_build_object(
    'path', image_path, 'x', image_offset_x, 'y', image_offset_y, 'width', cols * image_scale))
  where image_path is not null;

grant update (images) on table public.session_maps to authenticated;

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
