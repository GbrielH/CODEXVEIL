-- =============================================================================
-- Quadros livres da campanha (2026-10-27): um canvas estilo Miro para o mestre planejar
-- sessões com blocos arrastáveis (notas, textos, molduras e setas).
--   * Vários quadros por campanha; só o mestre cria, edita e remove.
--   * O mestre escolhe se o grupo vê o quadro (`visible`), somente leitura.
--   * O conteúdo fica num JSON (`items`), salvo inteiro pelo editor; `version` evita que
--     duas abas do mestre sobrescrevam uma à outra sem perceber.
-- =============================================================================

create table public.campaign_boards (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  items jsonb not null default '[]'::jsonb
    check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 500 and pg_column_size(items) <= 524288),
  visible boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.campaign_boards is
  'Quadros livres do mestre (blocos arrastáveis); o grupo vê só os marcados como visíveis.';

create index campaign_boards_campaign_idx on public.campaign_boards (campaign_id, created_at);

create trigger campaign_boards_set_updated_at
  before update on public.campaign_boards
  for each row execute function private.set_updated_at();

alter table public.campaign_boards enable row level security;

create policy "Quadros: mestres veem todos; jogadores, os visíveis"
  on public.campaign_boards for select to authenticated
  using (
    private.is_campaign_gm(campaign_id)
    or (visible and private.is_campaign_member(campaign_id))
  );
create policy "Quadros: mestres criam"
  on public.campaign_boards for insert to authenticated
  with check (private.can_manage_campaign(campaign_id));
create policy "Quadros: mestres alteram"
  on public.campaign_boards for update to authenticated
  using (private.can_manage_campaign(campaign_id))
  with check (private.can_manage_campaign(campaign_id));
create policy "Quadros: mestres removem"
  on public.campaign_boards for delete to authenticated
  using (private.can_manage_campaign(campaign_id));

revoke all on table public.campaign_boards from anon, authenticated;
grant select, delete on table public.campaign_boards to authenticated;
grant insert (campaign_id, title, items, visible) on table public.campaign_boards to authenticated;
grant update (title, items, visible, version) on table public.campaign_boards to authenticated;
grant all on table public.campaign_boards to service_role;
