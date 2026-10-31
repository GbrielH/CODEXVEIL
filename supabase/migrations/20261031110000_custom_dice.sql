-- =============================================================================
-- Dados próprios ("Meus dados", 2026-10-31): cada jogador desenha a face dos seus dados 3D.
--   * A imagem fica em `users/{usuário}/dice/{arquivo}` no bucket `campaign-media`; o perfil guarda
--     só o caminho (`preferences.dice.image`), porque as preferências têm limite de 4 KB.
--   * Só o dono envia, troca e apaga; quem divide campanha com ele lê (para ver os dados dele na
--     mesa). Políticas próprias, somadas às do bucket (não mexem nas regras das outras pastas).
--   * A limpeza de órfãos passa a contar essas imagens como em uso.
-- =============================================================================

create function private.dice_image_owner(p_name text)
returns uuid
language sql
stable
set search_path = ''
as $$
  select case
    when split_part(p_name, '/', 1) = 'users'
      and split_part(p_name, '/', 3) = 'dice'
      and split_part(p_name, '/', 5) = ''
      and private.is_valid_media_filename(split_part(p_name, '/', 4))
    then private.try_uuid(split_part(p_name, '/', 2))
  end;
$$;

revoke all on function private.dice_image_owner(text) from public;
grant execute on function private.dice_image_owner(text) to authenticated, service_role;

create policy "Dados próprios: o dono envia"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'campaign-media' and private.dice_image_owner(name) = (select auth.uid()));

create policy "Dados próprios: o dono troca"
  on storage.objects for update to authenticated
  using (bucket_id = 'campaign-media' and private.dice_image_owner(name) = (select auth.uid()))
  with check (bucket_id = 'campaign-media' and private.dice_image_owner(name) = (select auth.uid()));

create policy "Dados próprios: o dono apaga"
  on storage.objects for delete to authenticated
  using (bucket_id = 'campaign-media' and private.dice_image_owner(name) = (select auth.uid()));

create policy "Dados próprios: o dono e os colegas de campanha leem"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'campaign-media'
    and private.dice_image_owner(name) is not null
    and (
      private.dice_image_owner(name) = (select auth.uid())
      or private.shares_campaign_with(private.dice_image_owner(name))
    )
  );

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
    union select preferences -> 'dice' ->> 'image' from public.profiles
      where preferences -> 'dice' ->> 'image' is not null
  )
  select o.name
  from storage.objects o
  where o.bucket_id = 'campaign-media'
    and o.created_at < now() - make_interval(hours => greatest(p_min_age_hours, 1))
    and not exists (select 1 from referenced r where r.path = o.name)
  order by o.created_at
  limit least(greatest(p_limit, 1), 1000);
$$;
