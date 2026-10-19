-- Tormenta20: registra o sistema e amplia os pacotes de livro para o conteúdo dele.
--
-- O módulo `tormenta20` de @codexveil/rpg-systems tem as regras; o conteúdo (raças, classes,
-- origens, poderes, magias, deuses, equipamento, itens mágicos e ameaças) vem do pacote que cada
-- usuário importa a partir do próprio exemplar, como nos livros de D&D.

insert into public.rpg_systems (id, name, short_name)
values ('tormenta20', 'Tormenta20 (Edição Jogo do Ano)', 'T20')
on conflict (id) do nothing;

-- Edição livre por sistema (D&D usa "2014"/"2024"; Tormenta20, "Jogo do Ano").
alter table public.book_packs drop constraint book_packs_edition_check;
alter table public.book_packs add constraint book_packs_edition_check
  check (char_length(edition) between 1 and 40 and private.is_single_line(edition));

-- Tipos novos de entrada: divindades e equipamento (armas, armaduras, itens e melhorias).
alter table public.book_entries drop constraint book_entries_kind_check;
alter table public.book_entries add constraint book_entries_kind_check check (kind in (
  'section', 'class', 'subclass', 'species', 'background', 'feat', 'spell', 'spell_list', 'monster', 'magic_item',
  'deity', 'equipment'
));

-- Jogadores também leem divindades e equipamento (escolhidos na criação e no inventário).
create or replace function private.can_read_book_entry(p_pack_id uuid, p_kind text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.book_packs p
    where p.id = p_pack_id
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
                or p_kind in ('class', 'subclass', 'species', 'background', 'feat', 'spell', 'spell_list', 'deity', 'equipment')
                or (p_kind = 'section' and p.category in ('core', 'player', 'setting'))
              )
          )
        )
      )
  );
$$;
