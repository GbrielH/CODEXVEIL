-- =============================================================================
-- Codexveil — 14 · Livros importados pelo usuário
--
-- O Codexveil só traz o SRD. Quem tem outros livros pode importar o conteúdo deles para a
-- própria conta (página "Meus livros"), a partir de um pacote JSON gerado do próprio exemplar:
-- espécies, subclasses, talentos, magias, monstros, itens mágicos e o texto dos capítulos.
--
-- Acesso: só o dono escreve. Leem o dono e os participantes das campanhas do dono em que o livro
-- foi liberado (campaigns.character_rules->'sourcebooks' contém o book_key): os mestres leem tudo;
-- os jogadores, só o conteúdo de personagem e o texto dos livros de jogador e de cenário. O livro
-- só aparece para a mesa depois de importado por completo (is_ready).
-- =============================================================================

create table public.book_packs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  system_id text not null default 'dnd5e' references public.rpg_systems (id),
  book_key text not null
    check (char_length(book_key) between 1 and 80 and book_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 120 and private.is_single_line(name)),
  category text not null check (category in ('core', 'player', 'monsters', 'gm', 'setting', 'adventure')),
  edition text not null default '2014' check (edition in ('2014', '2024')),
  origin text not null default '' check (char_length(origin) <= 300 and private.is_single_line(origin)),
  -- Quantidade de entradas por tipo, para a lista de livros (preenchida pelo cliente ao terminar).
  entry_counts jsonb not null default '{}'::jsonb
    check (jsonb_typeof(entry_counts) = 'object' and pg_column_size(entry_counts) <= 2048),
  is_ready boolean not null default false,
  -- Contadores mantidos pelos gatilhos de book_entries (os clientes não escrevem).
  entry_total integer not null default 0,
  content_bytes bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, system_id, book_key)
);

comment on table public.book_packs is
  'Livros importados pelo usuário (conteúdo do próprio exemplar). Leitura: dono e participantes das campanhas dele que liberaram o livro.';

create trigger book_packs_set_updated_at
  before update on public.book_packs
  for each row execute function private.set_updated_at();

create table public.book_entries (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.book_packs (id) on delete cascade,
  kind text not null check (kind in (
    'section', 'class', 'subclass', 'species', 'background', 'feat', 'spell', 'spell_list', 'monster', 'magic_item'
  )),
  key text not null check (char_length(key) between 1 and 80 and key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 200 and private.is_single_line(name)),
  -- Conteúdo validado pelo módulo do sistema (`parseBookPack`).
  data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 131072),
  sort_order integer not null default 0 check (sort_order between 0 and 1000000),
  unique (pack_id, kind, key)
);

create index book_entries_pack_kind_idx on public.book_entries (pack_id, kind, sort_order);

-- -----------------------------------------------------------------------------
-- Limites (protegem o espaço do banco)
-- -----------------------------------------------------------------------------
create function private.book_packs_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('codexveil:book_packs:' || new.owner_id::text, 0));
  if (select count(*) from public.book_packs p where p.owner_id = new.owner_id) >= 40 then
    perform private.raise_limit_reached('maxBookPacks');
  end if;
  return new;
end;
$$;

revoke all on function private.book_packs_before_insert() from public;

create trigger book_packs_before_insert
  before insert on public.book_packs
  for each row execute function private.book_packs_before_insert();

-- Cada livro tem até 6.000 entradas e 25 MB; cada conta, até 60 MB em livros. Os contadores do
-- livro evitam contar as entradas a cada inserção (a importação envia milhares de uma vez).
create function private.book_entries_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_size bigint := pg_column_size(new.data) + octet_length(new.name);
  v_delta bigint := v_size;
  v_pack public.book_packs%rowtype;
begin
  if tg_op = 'UPDATE' then
    v_delta := v_size - (pg_column_size(old.data) + octet_length(old.name));
  end if;
  update public.book_packs p
     set content_bytes = p.content_bytes + v_delta,
         entry_total = p.entry_total + (case when tg_op = 'INSERT' then 1 else 0 end)
   where p.id = new.pack_id
  returning p.* into v_pack;
  if v_pack.entry_total > 6000 then
    perform private.raise_limit_reached('maxBookEntries');
  end if;
  if v_pack.content_bytes > 25 * 1024 * 1024 then
    perform private.raise_limit_reached('maxBookBytes');
  end if;
  if v_delta > 0 and (
    select coalesce(sum(p.content_bytes), 0) from public.book_packs p where p.owner_id = v_pack.owner_id
  ) > 60 * 1024 * 1024 then
    perform private.raise_limit_reached('maxBookStorage');
  end if;
  return new;
end;
$$;

create function private.book_entries_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Ao apagar o livro inteiro (cascata), a linha do livro já não existe e nada muda.
  update public.book_packs p
     set content_bytes = greatest(0, p.content_bytes - (pg_column_size(old.data) + octet_length(old.name))),
         entry_total = greatest(0, p.entry_total - 1)
   where p.id = old.pack_id;
  return old;
end;
$$;

revoke all on function private.book_entries_before_write() from public;
revoke all on function private.book_entries_after_delete() from public;

create trigger book_entries_before_write
  before insert or update of data, name on public.book_entries
  for each row execute function private.book_entries_before_write();

create trigger book_entries_after_delete
  after delete on public.book_entries
  for each row execute function private.book_entries_after_delete();

-- -----------------------------------------------------------------------------
-- Autorização
-- -----------------------------------------------------------------------------

-- Dono do livro.
create function private.owns_book_pack(p_pack_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.book_packs p
    where p.id = p_pack_id and p.owner_id = (select auth.uid())
  );
$$;

-- Participante de uma campanha do dono em que o livro (pronto) foi liberado.
create function private.can_read_book_pack(p_owner_id uuid, p_book_key text, p_is_ready boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_owner_id = (select auth.uid())
    or (
      p_is_ready
      and exists (
        select 1
        from public.campaigns c
        join public.campaign_members m on m.campaign_id = c.id and m.user_id = (select auth.uid())
        where c.owner_id = p_owner_id
          and c.character_rules -> 'sourcebooks' ? p_book_key
      )
    );
$$;

-- Conteúdo: o dono e os mestres das campanhas que liberaram o livro leem tudo. Os jogadores leem
-- o que serve para criar e evoluir personagens e o texto dos livros de jogador e de cenário;
-- monstros, itens mágicos e o texto de aventuras e livros do mestre ficam só com os mestres
-- (como o Bestiário do SRD), para não estragar surpresas.
create function private.can_read_book_entry(p_pack_id uuid, p_kind text)
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
                or p_kind in ('class', 'subclass', 'species', 'background', 'feat', 'spell', 'spell_list')
                or (p_kind = 'section' and p.category in ('core', 'player', 'setting'))
              )
          )
        )
      )
  );
$$;

revoke all on function private.owns_book_pack(uuid) from public;
revoke all on function private.can_read_book_pack(uuid, text, boolean) from public;
revoke all on function private.can_read_book_entry(uuid, text) from public;
grant execute on function private.owns_book_pack(uuid) to authenticated, service_role;
grant execute on function private.can_read_book_pack(uuid, text, boolean) to authenticated, service_role;
grant execute on function private.can_read_book_entry(uuid, text) to authenticated, service_role;

alter table public.book_packs enable row level security;
alter table public.book_entries enable row level security;

create policy "Donos e mesas com o livro liberado veem o livro"
  on public.book_packs for select to authenticated
  using (private.can_read_book_pack(owner_id, book_key, is_ready));
create policy "Donos importam livros"
  on public.book_packs for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "Donos alteram livros"
  on public.book_packs for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "Donos removem livros"
  on public.book_packs for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy "Quem vê o livro vê o conteúdo"
  on public.book_entries for select to authenticated
  using (private.can_read_book_entry(pack_id, kind));
create policy "Donos importam o conteúdo"
  on public.book_entries for insert to authenticated
  with check (private.owns_book_pack(pack_id));
create policy "Donos alteram o conteúdo"
  on public.book_entries for update to authenticated
  using (private.owns_book_pack(pack_id))
  with check (private.owns_book_pack(pack_id));
create policy "Donos removem o conteúdo"
  on public.book_entries for delete to authenticated
  using (private.owns_book_pack(pack_id));

revoke all on table public.book_packs from anon, authenticated;
grant select, delete on table public.book_packs to authenticated;
grant insert (system_id, book_key, name, category, edition, origin, entry_counts, is_ready)
  on table public.book_packs to authenticated;
grant update (name, category, edition, origin, entry_counts, is_ready)
  on table public.book_packs to authenticated;
grant all on table public.book_packs to service_role;

revoke all on table public.book_entries from anon, authenticated;
grant select, delete on table public.book_entries to authenticated;
grant insert (pack_id, kind, key, name, data, sort_order) on table public.book_entries to authenticated;
grant update (name, data, sort_order) on table public.book_entries to authenticated;
grant all on table public.book_entries to service_role;
