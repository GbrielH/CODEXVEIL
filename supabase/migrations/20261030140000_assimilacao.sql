-- Assimilação RPG: registra o sistema e amplia os pacotes de livro para o conteúdo dele.
--
-- O módulo `assimilacao` de @codexveil/rpg-systems tem as regras (dados, ficha, Cabo de Guerra,
-- Saúde). O texto do livro (regras, cenário, Características, cartas de Assimilação e de Eventos,
-- Artefatos) vem do pacote que cada usuário importa a partir do próprio exemplar.

insert into public.rpg_systems (id, name, short_name)
values ('assimilacao', 'Assimilação RPG', 'ASRPG')
on conflict (id) do nothing;

alter table public.book_entries drop constraint book_entries_kind_check;
alter table public.book_entries add constraint book_entries_kind_check check (kind in (
  'section', 'class', 'subclass', 'species', 'background', 'feat', 'spell', 'spell_list', 'monster', 'magic_item',
  'deity', 'equipment', 'class_option', 'table',
  'characteristic', 'assimilation', 'artifact', 'event'
));

-- Jogadores também leem Características, cartas de Assimilação e Artefatos (usados na ficha).
-- As cartas de Eventos continuam só do mestre.
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
                or p_kind in ('class', 'subclass', 'species', 'background', 'feat', 'spell', 'spell_list', 'deity', 'equipment', 'class_option',
                              'characteristic', 'assimilation', 'artifact')
                or (p_kind = 'section' and p.category in ('core', 'player', 'setting'))
              )
          )
        )
      )
  );
$$;
