-- =============================================================================
-- Codexveil — 05 · Armazenamento de imagens (Supabase Storage)
--
-- Buckets:
--   avatars         público   {user_id}/{arquivo}                      até 2 MB
--   campaign-media  privado   campaigns/{campaign_id}/cover/{arquivo}  até 5 MB
--                             campaigns/{campaign_id}/creatures/{arquivo}
--                             campaigns/{campaign_id}/sessions/{session_id}/{arquivo}
--                             characters/{character_id}/{arquivo}
--
-- Regra de leitura da mídia privada: você lê um arquivo se puder ler o registro que o
-- referencia (capa → participantes; imagem de NPC → registro revelado; imagem de roteiro
-- → bloco público de sessão publicada; retrato → quem vê o personagem). Mestres leem
-- toda a mídia da campanha. O acesso é feito por URLs assinadas de curta duração.
-- Apenas PNG, JPEG e WebP são aceitos (SVG pode conter scripts).
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp']),
  ('campaign-media', 'campaign-media', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create function private.is_valid_media_filename(p_filename text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_filename ~ '^[A-Za-z0-9_-]{1,80}\.(png|jpe?g|webp)$', false);
$$;

create function private.is_own_avatar_path(p_name text)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  v_parts text[] := string_to_array(p_name, '/');
begin
  return coalesce(array_length(v_parts, 1), 0) = 2
    and v_parts[1] = (select auth.uid())::text
    and private.is_valid_media_filename(v_parts[2]);
end;
$$;

create function private.can_write_campaign_media(p_name text)
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
    if v_len = 4 and v_parts[3] in ('cover', 'creatures') then
      return private.can_manage_campaign(v_id);
    elsif v_len = 5 and v_parts[3] = 'sessions' then
      return private.can_manage_campaign(v_id)
        and exists (
          select 1 from public.sessions s
          where s.id = private.try_uuid(v_parts[4]) and s.campaign_id = v_id
        );
    end if;
  end if;
  return false;
end;
$$;

create function private.can_read_campaign_media(p_name text)
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
      else
        return false;
    end case;
  end if;
  return false;
end;
$$;

revoke all on function private.is_valid_media_filename(text) from public;
revoke all on function private.is_own_avatar_path(text) from public;
revoke all on function private.can_write_campaign_media(text) from public;
revoke all on function private.can_read_campaign_media(text) from public;
grant execute on function private.is_valid_media_filename(text) to authenticated, service_role;
grant execute on function private.is_own_avatar_path(text) to authenticated, service_role;
grant execute on function private.can_write_campaign_media(text) to authenticated, service_role;
grant execute on function private.can_read_campaign_media(text) to authenticated, service_role;

-- Avatares (bucket público: a leitura do arquivo é feita pela URL pública).
create policy "Avatares: dono lista a própria pasta"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and private.is_own_avatar_path(name));

create policy "Avatares: envio somente na própria pasta"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and private.is_own_avatar_path(name));

create policy "Avatares: substituição somente na própria pasta"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and private.is_own_avatar_path(name))
  with check (bucket_id = 'avatars' and private.is_own_avatar_path(name));

create policy "Avatares: remoção somente na própria pasta"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and private.is_own_avatar_path(name));

-- Mídia de campanhas e personagens (bucket privado).
create policy "Mídia: leitura conforme acesso ao registro"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'campaign-media'
    and (owner_id = (select auth.uid())::text or private.can_read_campaign_media(name))
  );

create policy "Mídia: envio por quem pode editar o registro"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'campaign-media' and private.can_write_campaign_media(name));

create policy "Mídia: remoção pelo autor do envio ou por quem edita o registro"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'campaign-media'
    and (owner_id = (select auth.uid())::text or private.can_write_campaign_media(name))
  );
