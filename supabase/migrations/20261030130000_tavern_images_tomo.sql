-- =============================================================================
-- Taverna, parte 2 (2026-10-30): imagens nas mensagens e respostas do Tomo ("@tomo").
--   * `image_path`: imagem no bucket `campaign-media`, pasta `tavern/` (campanha:
--     `tavern/<campanha>/<arquivo>`; direta: `tavern/<remetente>/<amigo>/<arquivo>`). Só quem lê
--     a mensagem vê a imagem; quando a mensagem some (24 h), a limpeza semanal apaga o arquivo.
--   * `from_tomo`: resposta do Tomo, gravada por `tavern_tomo_reply` em nome de quem chamou.
-- =============================================================================

alter table public.tavern_messages
  add column image_path text check (image_path is null or char_length(image_path) <= 300),
  add column from_tomo boolean not null default false;

alter table public.tavern_messages drop constraint tavern_messages_body_check;
alter table public.tavern_messages
  add constraint tavern_messages_body_check check (
    char_length(body) <= 4000
    and private.is_clean_text(body)
    and (char_length(btrim(body)) between 1 and 4000 or image_path is not null)
  );

grant insert (image_path) on table public.tavern_messages to authenticated;

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
  )
  select o.name
  from storage.objects o
  where o.bucket_id = 'campaign-media'
    and o.created_at < now() - make_interval(hours => greatest(p_min_age_hours, 1))
    and not exists (select 1 from referenced r where r.path = o.name)
  order by o.created_at
  limit least(greatest(p_limit, 1), 1000);
$$;

-- Resposta do Tomo na conversa: entra como mensagem do Tomo, a pedido de quem chamou.
create function public.tavern_tomo_reply(p_campaign_id uuid, p_recipient_id uuid, p_body text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if (p_campaign_id is null) = (p_recipient_id is null) then
    raise exception 'Conversa inválida.' using errcode = '22023';
  end if;
  if p_campaign_id is not null and not private.is_campaign_member(p_campaign_id) then
    raise exception 'Você não participa desta campanha.' using errcode = '42501';
  end if;
  if p_recipient_id is not null and not private.are_friends(p_recipient_id) then
    raise exception 'Só entre amigos.' using errcode = '42501';
  end if;
  insert into public.tavern_messages (campaign_id, recipient_id, sender_id, body, from_tomo)
  values (p_campaign_id, p_recipient_id, auth.uid(), left(btrim(p_body), 4000), true);
end;
$$;
revoke all on function public.tavern_tomo_reply(uuid, uuid, text) from public, anon;
grant execute on function public.tavern_tomo_reply(uuid, uuid, text) to authenticated;
