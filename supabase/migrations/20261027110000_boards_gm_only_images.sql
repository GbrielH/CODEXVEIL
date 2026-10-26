-- =============================================================================
-- Quadros livres (2026-10-27, ajuste): são ferramenta só do mestre.
--   * Jogadores não leem quadros (o grupo continua vendo o que o mestre libera na Biblioteca,
--     nas Sessões e nos Roteiros, na ordem em que é liberado). Sai a coluna `visible`.
--   * Imagens nos quadros: arquivos em `campaigns/<campanha>/boards/<arquivo>`, enviados por
--     quem gerencia a campanha (a leitura de mídia já é livre para o mestre).
--   * A limpeza de arquivos órfãos passa a considerar as imagens dos quadros.
-- =============================================================================

drop policy "Quadros: mestres veem todos; jogadores, os visíveis" on public.campaign_boards;
create policy "Quadros: só mestres veem"
  on public.campaign_boards for select to authenticated
  using (private.is_campaign_gm(campaign_id));

alter table public.campaign_boards drop column visible;
comment on table public.campaign_boards is 'Quadros livres do mestre (blocos arrastáveis); só mestres leem e alteram.';

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
