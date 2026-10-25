-- Imagem da sessão (pedido de 2026-10-25): o mestre põe uma capa em cada sessão, como a da
-- campanha. O arquivo fica em campaigns/{campanha}/sessions/{sessão}/{arquivo} (o mestre já pode
-- enviar ali); os jogadores veem a capa das sessões publicadas.

alter table public.sessions
  add column cover_path text check (cover_path is null or char_length(cover_path) <= 300);

comment on column public.sessions.cover_path is 'Capa da sessão no bucket campaign-media (campaigns/{campanha}/sessions/{sessão}/{arquivo}).';

grant update (cover_path) on table public.sessions to authenticated;

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
    -- Anotações seguem a visibilidade da anotação (o mestre não vê as "só do autor").
    if v_parts[3] = 'notes' then
      return private.can_read_campaign_note(private.try_uuid(v_parts[4]));
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
