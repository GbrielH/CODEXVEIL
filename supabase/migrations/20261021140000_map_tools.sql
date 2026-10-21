-- Grade (2026-10-21): áreas de magia, névoa que se revela sozinha, desenhos e anotações.
--   * `areas`: áreas colocadas pelo mestre (círculo, cone, linha), vistas por todos.
--   * `fog_auto_reveal`: a névoa se abre onde os tokens dos jogadores enxergam (calculado na tela
--     do mestre, que grava em `fog_revealed`).
--   * `drawings`: desenhos livres e anotações visíveis a todos.
--   * `session_map_secrets`: desenhos e anotações só do mestre (armadilhas etc.), numa tabela
--     separada para o banco nunca enviá-los aos jogadores.

alter table public.session_maps
  add column fog_auto_reveal boolean not null default false,
  add column areas jsonb not null default '[]'::jsonb
    check (jsonb_typeof(areas) = 'array' and pg_column_size(areas) <= 65536),
  add column drawings jsonb not null default '[]'::jsonb
    check (jsonb_typeof(drawings) = 'array' and pg_column_size(drawings) <= 262144);

grant update (fog_auto_reveal, areas, drawings) on table public.session_maps to authenticated;

create table public.session_map_secrets (
  map_id uuid primary key,
  campaign_id uuid not null,
  drawings jsonb not null default '[]'::jsonb
    check (jsonb_typeof(drawings) = 'array' and pg_column_size(drawings) <= 262144),
  updated_at timestamptz not null default now(),
  constraint session_map_secrets_map_fk
    foreign key (map_id, campaign_id) references public.session_maps (id, campaign_id) on delete cascade
);

comment on table public.session_map_secrets is
  'Desenhos e anotações do mapa que só o mestre vê (armadilhas, segredos).';

create trigger session_map_secrets_set_updated_at
  before update on public.session_map_secrets
  for each row execute function private.set_updated_at();

alter table public.session_map_secrets enable row level security;

create policy "Segredos do mapa: só o mestre lê"
  on public.session_map_secrets for select to authenticated
  using (private.is_campaign_gm(campaign_id));
create policy "Segredos do mapa: mestre cria"
  on public.session_map_secrets for insert to authenticated
  with check (private.can_manage_campaign(campaign_id));
create policy "Segredos do mapa: mestre altera"
  on public.session_map_secrets for update to authenticated
  using (private.can_manage_campaign(campaign_id))
  with check (private.can_manage_campaign(campaign_id));
create policy "Segredos do mapa: mestre apaga"
  on public.session_map_secrets for delete to authenticated
  using (private.can_manage_campaign(campaign_id));

revoke all on table public.session_map_secrets from anon, authenticated;
grant select, insert, delete on table public.session_map_secrets to authenticated;
grant update (drawings) on table public.session_map_secrets to authenticated;
grant all on table public.session_map_secrets to service_role;
