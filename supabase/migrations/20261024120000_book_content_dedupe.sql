-- =============================================================================
-- Livros importados: uma cópia por conteúdo (2026-10-24)
--
-- Cada pessoa continua importando o próprio exemplar (a importação completa é a prova de que tem
-- o livro). Ao terminar, o banco calcula a impressão digital do conteúdo; se outro livro pronto
-- já tem exatamente o mesmo conteúdo, as entradas recém-enviadas são apagadas e o livro passa a
-- apontar para o conteúdo existente (content_pack_id). Assim cada livro ocupa espaço uma vez só.
--
-- Se o dono do conteúdo apagar o livro dele, o conteúdo passa para um dos livros que apontavam
-- para ele (não some para os outros).
-- =============================================================================

alter table public.book_packs
  add column content_hash text,
  add column content_pack_id uuid references public.book_packs (id) on delete set null;

comment on column public.book_packs.content_hash is 'Impressão digital (md5) do conteúdo, calculada pelo banco ao terminar a importação.';
comment on column public.book_packs.content_pack_id is 'Livro que guarda o conteúdo idêntico a este (null = o conteúdo está neste livro).';

create index book_packs_content_idx on public.book_packs (system_id, book_key, content_hash)
  where content_pack_id is null;
create index book_packs_content_pack_idx on public.book_packs (content_pack_id)
  where content_pack_id is not null;

-- Impressão digital do conteúdo de um livro (ordem fixa; o jsonb é normalizado).
create function private.book_content_hash(p_pack_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select md5(coalesce(string_agg(e.kind || ':' || e.key || ':' || e.name || ':' || e.data::text, '|' order by e.kind, e.key), ''))
  from public.book_entries e
  where e.pack_id = p_pack_id;
$$;

revoke all on function private.book_content_hash(uuid) from public;

-- Liga o livro a um conteúdo idêntico já existente (apaga a cópia). Devolve se ligou.
create function private.link_duplicate_book_content(p_pack_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pack public.book_packs%rowtype;
  v_hash text;
  v_source uuid;
begin
  select * into v_pack from public.book_packs where id = p_pack_id for update;
  if v_pack.id is null or v_pack.content_pack_id is not null then
    return false;
  end if;
  v_hash := private.book_content_hash(p_pack_id);
  update public.book_packs set content_hash = v_hash where id = p_pack_id;
  select p.id into v_source
    from public.book_packs p
    where p.id <> p_pack_id
      and p.system_id = v_pack.system_id
      and p.book_key = v_pack.book_key
      and p.content_hash = v_hash
      and p.content_pack_id is null
      and p.is_ready
    order by p.created_at
    limit 1;
  if v_source is null then
    return false;
  end if;
  delete from public.book_entries where pack_id = p_pack_id;
  -- Quem apontava para este livro passa a apontar para a fonte.
  update public.book_packs set content_pack_id = v_source where content_pack_id = p_pack_id;
  update public.book_packs
     set content_pack_id = v_source, entry_total = 0, content_bytes = 0
   where id = p_pack_id;
  return true;
end;
$$;

revoke all on function private.link_duplicate_book_content(uuid) from public;

-- Termina a importação: liga a um conteúdo igual (se houver) e marca o livro como pronto.
create function public.finish_book_import(p_pack_id uuid, p_entry_counts jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.book_packs p where p.id = p_pack_id and p.owner_id = (select auth.uid())) then
    raise exception 'Livro não encontrado.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_entry_counts) is distinct from 'object' or pg_column_size(p_entry_counts) > 2048 then
    raise exception 'Contagem inválida.' using errcode = '22023';
  end if;
  update public.book_packs set entry_counts = p_entry_counts where id = p_pack_id;
  perform private.link_duplicate_book_content(p_pack_id);
  update public.book_packs set is_ready = true where id = p_pack_id;
end;
$$;

revoke all on function public.finish_book_import(uuid, jsonb) from public, anon;
grant execute on function public.finish_book_import(uuid, jsonb) to authenticated;

-- Ao apagar um livro que guarda conteúdo de outros, o conteúdo passa para um deles.
create function private.book_packs_before_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_heir uuid;
begin
  if old.content_pack_id is not null then
    return old;
  end if;
  select p.id into v_heir
    from public.book_packs p
    where p.content_pack_id = old.id
    order by p.created_at
    limit 1;
  if v_heir is null then
    return old;
  end if;
  update public.book_entries set pack_id = v_heir where pack_id = old.id;
  update public.book_packs
     set content_pack_id = null,
         content_hash = old.content_hash,
         entry_total = old.entry_total,
         content_bytes = old.content_bytes
   where id = v_heir;
  update public.book_packs set content_pack_id = v_heir where content_pack_id = old.id and id <> v_heir;
  return old;
end;
$$;

revoke all on function private.book_packs_before_delete() from public;

create trigger book_packs_before_delete
  before delete on public.book_packs
  for each row execute function private.book_packs_before_delete();

-- Leitura do conteúdo: vale também para quem lê um livro que aponta para este conteúdo.
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
                or p_kind in ('class', 'subclass', 'species', 'background', 'feat', 'spell', 'spell_list', 'deity', 'equipment')
                or (p_kind = 'section' and p.category in ('core', 'player', 'setting'))
              )
          )
        )
      )
  );
$$;

-- Deduplica o que já está no banco: o livro mais antigo de cada conteúdo fica com as entradas.
do $$
declare
  v_pack record;
begin
  for v_pack in select id from public.book_packs where is_ready and content_pack_id is null order by created_at loop
    perform private.link_duplicate_book_content(v_pack.id);
  end loop;
end;
$$;
