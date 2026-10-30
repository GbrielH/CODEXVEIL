-- Objetivos de Conflito (Assimilação RPG): contadores de Sucessos que o mestre cria na mesa.
--
-- Cada Objetivo (Principal, Secundário ou Ameaça a neutralizar) acumula Sucessos até o total
-- necessário. O mestre vê e edita todos; o grupo vê os marcados como visíveis, em tempo real.

create table public.conflict_objectives (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  kind text not null default 'principal' check (kind in ('principal', 'secundario', 'ameaca')),
  needed integer not null default 3 check (needed between 1 and 99),
  progress integer not null default 0 check (progress between 0 and 99),
  visible boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.conflict_objectives is
  'Objetivos do Conflito em andamento (Sucessos acumulados até o necessário); o grupo vê os visíveis.';

create index conflict_objectives_campaign_idx on public.conflict_objectives (campaign_id, sort_order, created_at);

create trigger conflict_objectives_set_updated_at
  before update on public.conflict_objectives
  for each row execute function private.set_updated_at();

alter table public.conflict_objectives enable row level security;

create policy "Objetivos: mestres veem todos; jogadores, os visíveis"
  on public.conflict_objectives for select to authenticated
  using (
    private.is_campaign_gm(campaign_id)
    or (visible and private.is_campaign_member(campaign_id))
  );
create policy "Objetivos: mestres criam"
  on public.conflict_objectives for insert to authenticated
  with check (private.can_manage_campaign(campaign_id));
create policy "Objetivos: mestres alteram"
  on public.conflict_objectives for update to authenticated
  using (private.can_manage_campaign(campaign_id))
  with check (private.can_manage_campaign(campaign_id));
create policy "Objetivos: mestres removem"
  on public.conflict_objectives for delete to authenticated
  using (private.can_manage_campaign(campaign_id));

revoke all on table public.conflict_objectives from anon, authenticated;
grant select, delete on table public.conflict_objectives to authenticated;
grant insert (campaign_id, name, kind, needed, progress, visible, sort_order) on table public.conflict_objectives to authenticated;
grant update (name, kind, needed, progress, visible, sort_order) on table public.conflict_objectives to authenticated;
grant all on table public.conflict_objectives to service_role;

alter publication supabase_realtime add table public.conflict_objectives;

-- Baralhos do Assimilador (cartas de Assimilação e de Eventos), compartilhados entre os aparelhos do
-- mestre. Só o mestre lê o monte (a ordem das cartas); o grupo vê apenas a carta mostrada, pela
-- função `campaign_shown_cards`.
create table public.card_decks (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  deck text not null check (deck in ('assimilation', 'event')),
  pile text[] not null default '{}' check (cardinality(pile) <= 52),
  drawn text[] not null default '{}' check (cardinality(drawn) <= 52),
  -- Carta mostrada ao grupo, com nome e texto (os jogadores não leem as cartas de Eventos no livro).
  shown jsonb check (shown is null or (jsonb_typeof(shown) = 'object' and pg_column_size(shown) <= 16384)),
  updated_at timestamptz not null default now(),
  primary key (campaign_id, deck)
);

comment on table public.card_decks is
  'Monte e cartas compradas dos baralhos do Assimilação RPG; a carta mostrada ao grupo fica em `shown`.';

create trigger card_decks_set_updated_at
  before update on public.card_decks
  for each row execute function private.set_updated_at();

alter table public.card_decks enable row level security;

create policy "Baralhos: só mestres"
  on public.card_decks for select to authenticated
  using (private.is_campaign_gm(campaign_id));
create policy "Baralhos: mestres criam"
  on public.card_decks for insert to authenticated
  with check (private.can_manage_campaign(campaign_id));
create policy "Baralhos: mestres alteram"
  on public.card_decks for update to authenticated
  using (private.can_manage_campaign(campaign_id))
  with check (private.can_manage_campaign(campaign_id));

revoke all on table public.card_decks from anon, authenticated;
grant select on table public.card_decks to authenticated;
grant insert (campaign_id, deck, pile, drawn, shown) on table public.card_decks to authenticated;
grant update (pile, drawn, shown) on table public.card_decks to authenticated;
grant all on table public.card_decks to service_role;

create function public.campaign_shown_cards(p_campaign_id uuid)
returns table (deck text, shown jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select d.deck, d.shown
  from public.card_decks d
  where d.campaign_id = p_campaign_id
    and d.shown is not null
    and private.is_campaign_member(p_campaign_id);
$$;

revoke all on function public.campaign_shown_cards(uuid) from public, anon;
grant execute on function public.campaign_shown_cards(uuid) to authenticated;

alter publication supabase_realtime add table public.card_decks;
