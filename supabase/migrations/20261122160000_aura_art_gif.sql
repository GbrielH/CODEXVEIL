-- =============================================================================
-- Imagem própria do crítico pode ser GIF (2026-11-22)
--
-- As imagens próprias das auras ganham pasta própria, `users/{conta}/auras/{arquivo}`, que aceita
-- PNG, JPG, WebP e GIF (GIF animado anima no crítico). Mesmas regras da pasta dos dados: só o dono
-- envia e apaga, quem divide campanha lê. O bucket passa a aceitar `image/gif`; as regras das outras
-- pastas continuam exigindo PNG, JPG ou WebP no nome do arquivo.
-- =============================================================================

update storage.buckets
  set allowed_mime_types = array[
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a'
  ]
  where id = 'campaign-media';

create function private.aura_art_owner(p_name text)
returns uuid
language sql
stable
set search_path = ''
as $$
  select case
    when split_part(p_name, '/', 1) = 'users'
      and split_part(p_name, '/', 3) = 'auras'
      and split_part(p_name, '/', 5) = ''
      and coalesce(split_part(p_name, '/', 4) ~ '^[A-Za-z0-9_-]{1,80}\.(png|jpe?g|webp|gif)$', false)
    then private.try_uuid(split_part(p_name, '/', 2))
  end;
$$;

revoke all on function private.aura_art_owner(text) from public;
grant execute on function private.aura_art_owner(text) to authenticated, service_role;

create policy "Imagens do crítico: o dono envia"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'campaign-media' and private.aura_art_owner(name) = (select auth.uid()));

create policy "Imagens do crítico: o dono apaga"
  on storage.objects for delete to authenticated
  using (bucket_id = 'campaign-media' and private.aura_art_owner(name) = (select auth.uid()));

create policy "Imagens do crítico: o dono e os colegas de campanha veem"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'campaign-media'
    and private.aura_art_owner(name) is not null
    and (
      private.aura_art_owner(name) = (select auth.uid())
      or private.shares_campaign_with(private.aura_art_owner(name))
    )
  );
