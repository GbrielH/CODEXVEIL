-- Aba MASTER do Assimilação (2026-10-31): ferramentas do Assimilador por campanha, no padrão das
-- fichas oficiais — Partituras de Conflito (condicionantes, ativações, ameaças, objetivos) e
-- Refúgios (população e atributos). Só os mestres da campanha leem e escrevem.

create table public.assimilacao_master (
  campaign_id uuid primary key references public.campaigns (id) on delete cascade,
  conflicts jsonb not null default '[]'::jsonb
    check (jsonb_typeof(conflicts) = 'array' and jsonb_array_length(conflicts) <= 200 and pg_column_size(conflicts) <= 524288),
  refuges jsonb not null default '[]'::jsonb
    check (jsonb_typeof(refuges) = 'array' and jsonb_array_length(refuges) <= 100 and pg_column_size(refuges) <= 262144),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.assimilacao_master is
  'Aba MASTER do Assimilação: Partituras de Conflito e Refúgios do Assimilador (só mestres).';

create trigger assimilacao_master_set_updated_at
  before update on public.assimilacao_master
  for each row execute function private.set_updated_at();

alter table public.assimilacao_master enable row level security;

create policy "MASTER: mestres leem"
  on public.assimilacao_master for select to authenticated
  using (private.is_campaign_gm(campaign_id));
create policy "MASTER: mestres criam"
  on public.assimilacao_master for insert to authenticated
  with check (private.can_manage_campaign(campaign_id));
create policy "MASTER: mestres alteram"
  on public.assimilacao_master for update to authenticated
  using (private.can_manage_campaign(campaign_id))
  with check (private.can_manage_campaign(campaign_id));

revoke all on table public.assimilacao_master from anon, authenticated;
grant select on table public.assimilacao_master to authenticated;
grant insert (campaign_id, conflicts, refuges) on table public.assimilacao_master to authenticated;
grant update (conflicts, refuges) on table public.assimilacao_master to authenticated;
grant all on table public.assimilacao_master to service_role;
