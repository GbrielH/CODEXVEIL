-- Triangle Agency usa um módulo próprio. O texto do livro permanece no pacote privado gerado a
-- partir do exemplar do usuário; o banco registra apenas o sistema e as fichas em JSON.
insert into public.rpg_systems (id, name, short_name)
values ('triangle-agency', 'Triangle Agency', 'TA')
on conflict (id) do nothing;

-- Entradas próprias do livro: ARC, habilidades, requisições e documentos bloqueados.
alter table public.book_entries drop constraint book_entries_kind_check;
alter table public.book_entries add constraint book_entries_kind_check check (kind in (
  'section', 'class', 'subclass', 'species', 'background', 'feat', 'spell', 'spell_list', 'monster', 'magic_item',
  'deity', 'equipment', 'class_option', 'table',
  'characteristic', 'assimilation', 'artifact', 'event',
  'arc_anomaly', 'arc_reality', 'arc_competency', 'anomalous_ability', 'requisition', 'locked_document'
));

-- O ARC, as habilidades e as requisições são conteúdo dos jogadores. Documentos com Bloqueio
-- Lúdico continuam exclusivos do dono e dos mestres até serem tratados pelas regras da mesa.
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
                  'arc_anomaly', 'arc_reality', 'arc_competency', 'anomalous_ability', 'requisition'
                )
                or (p_kind = 'section' and p.category in ('core', 'player', 'setting'))
              )
          )
        )
      )
  );
$$;

