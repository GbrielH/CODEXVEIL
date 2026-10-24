-- Novos tipos de entrada dos livros (2026-10-25):
--   'class_option' — características opcionais de classe (Caldeirão de Tasha); os jogadores leem,
--                    como o resto do conteúdo de personagem.
--   'table'        — tabelas roláveis do livro (tesouro do Tormenta20); só os mestres leem.
alter table public.book_entries drop constraint book_entries_kind_check;
alter table public.book_entries add constraint book_entries_kind_check check (kind in (
  'section', 'class', 'subclass', 'species', 'background', 'feat', 'spell', 'spell_list', 'monster', 'magic_item',
  'deity', 'equipment', 'class_option', 'table'
));

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
                or p_kind in ('class', 'subclass', 'species', 'background', 'feat', 'spell', 'spell_list', 'deity', 'equipment', 'class_option')
                or (p_kind = 'section' and p.category in ('core', 'player', 'setting'))
              )
          )
        )
      )
  );
$$;
