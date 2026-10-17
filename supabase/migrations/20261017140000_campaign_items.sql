-- =============================================================================
-- Codexveil — 10 · Itens da campanha
--
-- Biblioteca de itens do mestre: itens criados por ele (fora do livro) e itens mágicos
-- copiados do SRD 5.2.1. Jogadores só veem os itens que o mestre revela. Entregar um item a
-- um personagem copia os dados para o inventário (character_items), que segue as regras da
-- ficha; o item da biblioteca continua disponível para outros personagens.
-- =============================================================================

create table public.campaign_items (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120 and private.is_single_line(name)),
  category public.item_category not null default 'gear',
  rarity text not null default '' check (char_length(rarity) <= 60 and private.is_single_line(rarity)),
  requires_attunement boolean not null default false,
  weight numeric(10, 2) check (weight is null or weight between 0 and 100000),
  value text not null default '' check (char_length(value) <= 60 and private.is_single_line(value)),
  description text not null default ''
    check (char_length(description) <= 8000 and private.is_clean_text(description)),
  -- Nome original no SRD quando o item veio do livro; nulo quando o mestre o criou.
  srd_name text check (srd_name is null or (char_length(srd_name) <= 120 and private.is_single_line(srd_name))),
  data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 16384),
  visibility public.content_visibility not null default 'gm'
    check (visibility in ('members', 'gm')),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.campaign_items is
  'Itens da biblioteca do mestre (criados por ele ou copiados do SRD). Jogadores veem só os revelados.';

create index campaign_items_campaign_idx on public.campaign_items (campaign_id, name);

create trigger campaign_items_set_updated_at
  before update on public.campaign_items
  for each row execute function private.set_updated_at();

-- Limite por campanha: protege o espaço do banco (veja docs/ARMAZENAMENTO.md).
create function private.campaign_items_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('codexveil:campaign_items:' || new.campaign_id::text, 0));
  if (select count(*) from public.campaign_items i where i.campaign_id = new.campaign_id) >= 500 then
    perform private.raise_limit_reached('maxItemsPerCampaign');
  end if;
  return new;
end;
$$;

create trigger campaign_items_before_insert
  before insert on public.campaign_items
  for each row execute function private.campaign_items_before_insert();

revoke all on function private.campaign_items_before_insert() from public;

alter table public.campaign_items enable row level security;

create policy "Mestres veem os itens; jogadores, os revelados"
  on public.campaign_items for select to authenticated
  using (
    private.is_campaign_gm(campaign_id)
    or (visibility = 'members' and private.is_campaign_member(campaign_id))
  );
create policy "Mestres criam itens"
  on public.campaign_items for insert to authenticated
  with check (private.can_manage_campaign(campaign_id));
create policy "Mestres alteram itens"
  on public.campaign_items for update to authenticated
  using (private.can_manage_campaign(campaign_id))
  with check (private.can_manage_campaign(campaign_id));
create policy "Mestres removem itens"
  on public.campaign_items for delete to authenticated
  using (private.can_manage_campaign(campaign_id));

revoke all on table public.campaign_items from anon, authenticated;
grant select, delete on table public.campaign_items to authenticated;
grant insert (campaign_id, name, category, rarity, requires_attunement, weight, value, description,
  srd_name, data, visibility)
  on table public.campaign_items to authenticated;
grant update (name, category, rarity, requires_attunement, weight, value, description, data, visibility)
  on table public.campaign_items to authenticated;
grant all on table public.campaign_items to service_role;
