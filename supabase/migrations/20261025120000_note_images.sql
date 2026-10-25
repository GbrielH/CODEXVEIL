-- Imagem nas anotações (pedido de 2026-10-25): uma imagem por anotação, no bucket campaign-media,
-- em campaigns/{campanha}/notes/{anotação}/{arquivo}. Só o autor envia; quem lê a anotação vê a
-- imagem (inclusive a regra "só o autor", que vale também para o mestre).

alter table public.campaign_notes
  add column image_path text check (image_path is null or char_length(image_path) <= 300);

comment on column public.campaign_notes.image_path is 'Imagem da anotação no bucket campaign-media (campaigns/{campanha}/notes/{anotação}/{arquivo}).';

grant update (image_path) on table public.campaign_notes to authenticated;

-- Quem pode ler a anotação (mesma regra da policy de leitura de campaign_notes).
create function private.can_read_campaign_note(p_note_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.campaign_notes n
    where n.id = p_note_id
      and (
        n.author_id = (select auth.uid())
        or (n.visibility = 'members' and private.is_campaign_member(n.campaign_id))
        or (n.visibility = 'gm' and private.is_campaign_gm(n.campaign_id))
      )
  );
$$;

revoke all on function private.can_read_campaign_note(uuid) from public;
grant execute on function private.can_read_campaign_note(uuid) to authenticated, service_role;

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
    elsif v_len = 5 and v_parts[3] = 'notes' then
      return exists (
        select 1 from public.campaign_notes n
        where n.id = private.try_uuid(v_parts[4]) and n.campaign_id = v_id and n.author_id = (select auth.uid())
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
