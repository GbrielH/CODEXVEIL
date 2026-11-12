-- =============================================================================
-- Ordem Paranormal RPG 2 (playtests Alpha e Beta) — 2026-11-12
--
-- O sistema tem módulo próprio (`packages/rpg-systems/src/ordem2`); o banco registra o sistema,
-- os tipos de entrada do pacote e as imagens do livro (mapas, criaturas, ferramentas).
--
-- Imagens do livro: bucket privado `book-assets`, caminho `{sistema}/{livro}/{hash}`. O nome é
-- o hash do conteúdo, calculado e conferido no navegador na importação: só se insere (ninguém
-- sobrescreve) e quem importa o mesmo livro reaproveita as mesmas imagens. Leem o dono de um
-- exemplar do livro e os mestres das campanhas desse dono que usam o livro. Os jogadores não
-- leem o bucket: ao usar uma missão, o mestre copia as imagens para a mídia da campanha, que
-- segue as regras de sempre (mapas, criaturas e revelações).
-- =============================================================================

insert into public.rpg_systems (id, name, short_name)
values ('ordem2', 'Ordem Paranormal RPG 2 (playtest)', 'OP2')
on conflict (id) do nothing;

alter table public.book_entries drop constraint book_entries_kind_check;
alter table public.book_entries add constraint book_entries_kind_check check (kind in (
  'section', 'class', 'subclass', 'species', 'background', 'feat', 'spell', 'spell_list', 'monster', 'magic_item',
  'deity', 'equipment', 'class_option', 'table',
  'characteristic', 'assimilation', 'artifact', 'event',
  'arc_anomaly', 'arc_reality', 'arc_competency', 'anomalous_ability', 'requisition', 'locked_document',
  'tool', 'mission', 'scene', 'point_of_interest', 'creature', 'map', 'handout'
));

-- Jogadores leem as ferramentas da Ordo Realitas; missões, cenas, pontos de interesse,
-- criaturas, mapas e imagens ficam com o dono e os mestres (como monstros e documentos).
create or replace function private.can_read_book_entry(p_pack_id uuid, p_kind text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.book_packs p
    where (p.id = p_pack_id or p.content_pack_id = p_pack_id)
      and (
        p.owner_id = (select auth.uid())
        or (
          p.is_ready
          and exists (
            select 1
            from public.campaigns c
            join public.campaign_members m on m.campaign_id = c.id and m.user_id = (select auth.uid())
            where c.owner_id = p.owner_id
              and c.character_rules -> 'sourcebooks' ? p.book_key
              and (
                m.role = 'gm'
                or p_kind in (
                  'class', 'subclass', 'species', 'background', 'feat', 'spell', 'spell_list',
                  'deity', 'equipment', 'class_option', 'characteristic', 'assimilation', 'artifact',
                  'arc_anomaly', 'arc_reality', 'arc_competency', 'anomalous_ability', 'requisition',
                  'tool'
                )
                or (p_kind = 'section' and p.category in ('core', 'player', 'setting'))
              )
          )
        )
      )
  );
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-assets', 'book-assets', false, 10485760, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- `{sistema}/{livro}/{hash}`: hash de 32 a 64 caracteres hexadecimais e a extensão no fim.
create function private.book_asset_parts(p_name text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case
    when p_name ~ '^[a-z0-9-]{1,40}/[a-z0-9]+(-[a-z0-9]+)*/[0-9a-f]{32,64}-(png|jpg|webp)$'
      then string_to_array(p_name, '/')
    else null
  end;
$$;

create function private.can_write_book_asset(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select exists (
      select 1 from public.book_packs p
      where p.owner_id = (select auth.uid())
        and p.system_id = parts[1]
        and p.book_key = parts[2]
    )
    from (select private.book_asset_parts(p_name) as parts) x
    where parts is not null
  ), false);
$$;

create function private.can_read_book_asset(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select exists (
      select 1 from public.book_packs p
      where p.system_id = parts[1]
        and p.book_key = parts[2]
        and (
          p.owner_id = (select auth.uid())
          or (
            p.is_ready
            and exists (
              select 1
              from public.campaigns c
              join public.campaign_members m
                on m.campaign_id = c.id and m.user_id = (select auth.uid()) and m.role = 'gm'
              where c.owner_id = p.owner_id
                and c.character_rules -> 'sourcebooks' ? p.book_key
            )
          )
        )
    )
    from (select private.book_asset_parts(p_name) as parts) x
    where parts is not null
  ), false);
$$;

revoke all on function private.book_asset_parts(text) from public;
revoke all on function private.can_write_book_asset(text) from public;
revoke all on function private.can_read_book_asset(text) from public;
grant execute on function private.can_write_book_asset(text) to authenticated;
grant execute on function private.can_read_book_asset(text) to authenticated;

create policy "Imagens de livro: donos do livro enviam"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'book-assets' and private.can_write_book_asset(name));

create policy "Imagens de livro: donos e mestres leem"
  on storage.objects for select to authenticated
  using (bucket_id = 'book-assets' and private.can_read_book_asset(name));
