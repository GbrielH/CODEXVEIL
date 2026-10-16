-- =============================================================================
-- Codexveil — 03 · Personagens e fichas
--
-- Modelo:
--   characters            dados centrais + `sheet` (JSON validado pelo módulo do sistema)
--   character_resources   trilhas: vida, dados de vida, espaços de magia, usos...
--   character_conditions  condições ativas (uma linha por condição)
--   character_items       inventário
--   character_abilities   habilidades, talentos, magias e ataques (`data` por sistema)
--   character_events      histórico de evolução (imutável)
--   character_snapshots   cópias automáticas da ficha para recuperar perdas acidentais
--
-- Concorrência:
--   * A ficha usa controle otimista: `version` sobe a cada alteração e o cliente grava
--     com `... where version = <lida>`; zero linhas afetadas = conflito.
--   * Vida e recursos mudam por funções atômicas (adjust_character_resource), então
--     mestre e jogador podem alterá-los ao mesmo tempo sem perder atualizações.
--   * Alterações em tabelas filhas atualizam `characters.live_updated_at`, sinal usado
--     pelo Realtime para que painéis recarreguem o resumo (sem mudar `version`).
-- =============================================================================

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  campaign_id uuid references public.campaigns (id) on delete set null,
  system_id text not null references public.rpg_systems (id),
  name text not null check (char_length(name) between 1 and 80 and private.is_single_line(name)),
  portrait_path text,
  sheet jsonb not null default '{}'::jsonb
    check (jsonb_typeof(sheet) = 'object' and pg_column_size(sheet) <= 262144),
  version integer not null default 1,
  live_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint characters_portrait_path check (
    portrait_path is null
    or (char_length(portrait_path) <= 300 and portrait_path like 'characters/' || id::text || '/%')
  )
);

comment on column public.characters.sheet is
  'Ficha específica do sistema (ex.: D&D 5e). Só valores informados; derivados são calculados.';
comment on column public.characters.version is 'Controle otimista de concorrência da ficha.';
comment on column public.characters.live_updated_at is
  'Atualizado quando vida, recursos, condições ou itens mudam (sinal para Realtime).';

create index characters_owner_id_idx on public.characters (owner_id);
create index characters_campaign_id_idx on public.characters (campaign_id)
  where campaign_id is not null;

-- -----------------------------------------------------------------------------
-- Regras de acesso a personagens
-- -----------------------------------------------------------------------------
create function private.can_view_character_row(p_owner_id uuid, p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_owner_id = (select auth.uid())
    or (
      p_campaign_id is not null
      and exists (
        select 1
        from public.campaign_members m
        join public.campaigns c on c.id = m.campaign_id
        where m.campaign_id = p_campaign_id
          and m.user_id = (select auth.uid())
          and (m.role = 'gm' or c.party_sheets_visible)
      )
    );
$$;

-- Construção da ficha: dono (se a campanha permitir) ou mestre, em campanha ativa.
create function private.can_edit_character_sheet_row(p_owner_id uuid, p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_campaign_id is null then p_owner_id = (select auth.uid())
    else exists (
      select 1
      from public.campaign_members m
      join public.campaigns c on c.id = m.campaign_id
      where m.campaign_id = p_campaign_id
        and m.user_id = (select auth.uid())
        and c.status = 'active'
        and (m.role = 'gm' or (p_owner_id = (select auth.uid()) and c.players_can_edit_sheets))
    )
  end;
$$;

-- Estado de jogo (vida, recursos, condições, inventário): dono ou mestre, em campanha ativa.
create function private.can_edit_character_play_row(p_owner_id uuid, p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_campaign_id is null then p_owner_id = (select auth.uid())
    else exists (
      select 1
      from public.campaign_members m
      join public.campaigns c on c.id = m.campaign_id
      where m.campaign_id = p_campaign_id
        and m.user_id = (select auth.uid())
        and c.status = 'active'
        and (m.role = 'gm' or p_owner_id = (select auth.uid()))
    )
  end;
$$;

create function private.can_view_character(p_character_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select private.can_view_character_row(c.owner_id, c.campaign_id)
     from public.characters c where c.id = p_character_id),
    false
  );
$$;

create function private.can_edit_character_sheet(p_character_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select private.can_edit_character_sheet_row(c.owner_id, c.campaign_id)
     from public.characters c where c.id = p_character_id),
    false
  );
$$;

create function private.can_edit_character_play(p_character_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select private.can_edit_character_play_row(c.owner_id, c.campaign_id)
     from public.characters c where c.id = p_character_id),
    false
  );
$$;

revoke all on function private.can_view_character_row(uuid, uuid) from public;
revoke all on function private.can_edit_character_sheet_row(uuid, uuid) from public;
revoke all on function private.can_edit_character_play_row(uuid, uuid) from public;
revoke all on function private.can_view_character(uuid) from public;
revoke all on function private.can_edit_character_sheet(uuid) from public;
revoke all on function private.can_edit_character_play(uuid) from public;
grant execute on function private.can_view_character_row(uuid, uuid) to authenticated, service_role;
grant execute on function private.can_edit_character_sheet_row(uuid, uuid)
  to authenticated, service_role;
grant execute on function private.can_edit_character_play_row(uuid, uuid)
  to authenticated, service_role;
grant execute on function private.can_view_character(uuid) to authenticated, service_role;
grant execute on function private.can_edit_character_sheet(uuid) to authenticated, service_role;
grant execute on function private.can_edit_character_play(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Gatilhos de personagem: limites, vínculo com campanha e versão
-- -----------------------------------------------------------------------------
create function private.characters_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign public.campaigns;
  v_limit integer;
begin
  if tg_op = 'INSERT' then
    new.version := 1;
    new.created_at := now();
    new.updated_at := now();
    new.live_updated_at := now();

    v_limit := (private.plan_limits(new.owner_id)).max_owned_characters;
    if v_limit is not null then
      perform pg_advisory_xact_lock(
        hashtextextended('codexveil:characters:' || new.owner_id::text, 0)
      );
      if (select count(*) from public.characters c where c.owner_id = new.owner_id) >= v_limit then
        perform private.raise_limit_reached('maxOwnedCharacters');
      end if;
    end if;
  else
    if new.system_id is distinct from old.system_id or new.owner_id is distinct from old.owner_id then
      raise exception 'O sistema e o dono de um personagem não podem ser alterados.'
        using errcode = '42501';
    end if;
    if (new.name, new.portrait_path, new.sheet, new.campaign_id)
       is distinct from (old.name, old.portrait_path, old.sheet, old.campaign_id) then
      new.version := old.version + 1;
      new.updated_at := now();
    else
      new.version := old.version;
      new.updated_at := old.updated_at;
    end if;
  end if;

  if new.campaign_id is not null
     and (tg_op = 'INSERT' or new.campaign_id is distinct from old.campaign_id) then
    select * into v_campaign from public.campaigns c where c.id = new.campaign_id;
    if not found then
      raise exception 'Campanha não encontrada.' using errcode = 'P0002';
    end if;
    if v_campaign.status <> 'active' then
      raise exception 'A campanha está arquivada.' using errcode = 'CVARC';
    end if;
    if v_campaign.system_id <> new.system_id then
      raise exception 'O personagem precisa usar o mesmo sistema da campanha.'
        using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.campaign_members m
      where m.campaign_id = new.campaign_id and m.user_id = new.owner_id
    ) then
      raise exception 'O dono do personagem precisa participar da campanha.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger characters_before_write
  before insert or update on public.characters
  for each row execute function private.characters_before_write();

revoke all on function private.characters_before_write() from public;

-- -----------------------------------------------------------------------------
-- RLS: personagens
-- -----------------------------------------------------------------------------
alter table public.characters enable row level security;

create policy "Dono, mestres e (se permitido) o grupo veem o personagem"
  on public.characters for select
  to authenticated
  using (private.can_view_character_row(owner_id, campaign_id));

create policy "Usuário cria personagens próprios"
  on public.characters for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy "Dono ou mestre edita a ficha conforme as regras da campanha"
  on public.characters for update
  to authenticated
  using (private.can_edit_character_sheet_row(owner_id, campaign_id))
  with check (private.can_edit_character_sheet_row(owner_id, campaign_id));

create policy "Somente o dono exclui o personagem"
  on public.characters for delete
  to authenticated
  using (owner_id = (select auth.uid()));

revoke all on table public.characters from anon, authenticated;
grant select, delete on table public.characters to authenticated;
grant insert (name, system_id, campaign_id, sheet) on table public.characters to authenticated;
grant update (name, portrait_path, sheet) on table public.characters to authenticated;
grant all on table public.characters to service_role;

-- Vincula ou desvincula um personagem de uma campanha (somente o dono).
create function public.set_character_campaign(p_character_id uuid, p_campaign_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.characters c
    where c.id = p_character_id and c.owner_id = auth.uid()
  ) then
    raise exception 'Personagem não encontrado.' using errcode = 'P0002';
  end if;
  if p_campaign_id is not null and not private.can_participate(p_campaign_id) then
    raise exception 'Campanha não encontrada ou arquivada.' using errcode = 'P0002';
  end if;

  delete from public.encounter_combatants ec where ec.character_id = p_character_id;
  update public.characters set campaign_id = p_campaign_id where id = p_character_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Tabelas filhas
-- -----------------------------------------------------------------------------
create table public.character_resources (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters (id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9_:-]{1,64}$'),
  label text not null check (char_length(label) between 1 and 60 and private.is_single_line(label)),
  current integer not null default 0 check (current between 0 and 1000000),
  max integer check (max is null or max between 0 and 1000000),
  temp integer not null default 0 check (temp between 0 and 1000000),
  recovery public.resource_recovery not null default 'manual',
  display text not null default 'pool' check (display in ('health', 'pool', 'checkboxes')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint character_resources_key_unique unique (character_id, key),
  constraint character_resources_character_id_id_key unique (character_id, id),
  constraint character_resources_current_le_max check (max is null or current <= max)
);

create table public.character_conditions (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters (id) on delete cascade,
  key text not null check (char_length(key) between 1 and 40 and private.is_single_line(key)),
  level integer check (level is null or level between 1 and 10),
  note text not null default '' check (char_length(note) <= 200 and private.is_single_line(note)),
  created_at timestamptz not null default now(),
  constraint character_conditions_key_unique unique (character_id, key)
);

create table public.character_items (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120 and private.is_single_line(name)),
  category public.item_category not null default 'gear',
  quantity integer not null default 1 check (quantity between 0 and 99999),
  weight numeric(10, 2) check (weight is null or weight between 0 and 100000),
  description text not null default ''
    check (char_length(description) <= 4000 and private.is_clean_text(description)),
  notes text not null default '' check (char_length(notes) <= 2000 and private.is_clean_text(notes)),
  is_equipped boolean not null default false,
  data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 16384),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.character_abilities (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters (id) on delete cascade,
  kind public.ability_entry_kind not null,
  name text not null check (char_length(name) between 1 and 120 and private.is_single_line(name)),
  source text not null default '' check (char_length(source) <= 120 and private.is_single_line(source)),
  description text not null default ''
    check (char_length(description) <= 8000 and private.is_clean_text(description)),
  data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 16384),
  resource_id uuid,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint character_abilities_resource_fk
    foreign key (character_id, resource_id)
    references public.character_resources (character_id, id)
    on delete set null (resource_id)
);

create table public.character_events (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters (id) on delete cascade,
  actor_id uuid default auth.uid() references public.profiles (id) on delete set null,
  kind text not null check (kind in ('level_up', 'experience', 'ability_change', 'milestone', 'note')),
  summary text not null check (char_length(summary) between 1 and 300 and private.is_clean_text(summary)),
  data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 16384),
  occurred_at timestamptz not null default now()
);

create table public.character_snapshots (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters (id) on delete cascade,
  name text not null,
  sheet jsonb not null,
  version integer not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index character_resources_character_idx on public.character_resources (character_id, sort_order);
create index character_conditions_character_idx on public.character_conditions (character_id);
create index character_items_character_idx on public.character_items (character_id, sort_order);
create index character_abilities_character_idx on public.character_abilities (character_id, kind, sort_order);
create index character_events_character_idx on public.character_events (character_id, occurred_at desc);
create index character_snapshots_character_idx on public.character_snapshots (character_id, created_at desc);

create trigger character_resources_set_updated_at
  before update on public.character_resources
  for each row execute function private.set_updated_at();
create trigger character_items_set_updated_at
  before update on public.character_items
  for each row execute function private.set_updated_at();
create trigger character_abilities_set_updated_at
  before update on public.character_abilities
  for each row execute function private.set_updated_at();

-- Sinaliza mudanças de estado de jogo no personagem (para Realtime).
create function private.touch_character()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.characters
  set live_updated_at = now()
  where id = case when tg_op = 'DELETE' then old.character_id else new.character_id end;
  return null;
end;
$$;

create trigger character_resources_touch
  after insert or update or delete on public.character_resources
  for each row execute function private.touch_character();
create trigger character_conditions_touch
  after insert or update or delete on public.character_conditions
  for each row execute function private.touch_character();
create trigger character_items_touch
  after insert or update or delete on public.character_items
  for each row execute function private.touch_character();

-- Guarda uma cópia da ficha anterior a cada rajada de edições (no máximo uma a cada
-- 10 minutos, mantendo as 30 mais recentes).
create function private.snapshot_character()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.sheet is distinct from old.sheet and not exists (
    select 1 from public.character_snapshots s
    where s.character_id = new.id and s.created_at > now() - interval '10 minutes'
  ) then
    insert into public.character_snapshots (character_id, name, sheet, version, created_by)
    values (old.id, old.name, old.sheet, old.version, auth.uid());

    delete from public.character_snapshots s
    where s.character_id = new.id
      and s.id not in (
        select recent.id from public.character_snapshots recent
        where recent.character_id = new.id
        order by recent.created_at desc
        limit 30
      );
  end if;
  return null;
end;
$$;

create trigger characters_snapshot
  after update of sheet on public.characters
  for each row execute function private.snapshot_character();

revoke all on function private.touch_character() from public;
revoke all on function private.snapshot_character() from public;

-- -----------------------------------------------------------------------------
-- RLS: tabelas filhas
-- -----------------------------------------------------------------------------
alter table public.character_resources enable row level security;
alter table public.character_conditions enable row level security;
alter table public.character_items enable row level security;
alter table public.character_abilities enable row level security;
alter table public.character_events enable row level security;
alter table public.character_snapshots enable row level security;

-- Recursos, condições e inventário: estado de jogo.
create policy "Quem vê o personagem vê os recursos"
  on public.character_resources for select to authenticated
  using (private.can_view_character(character_id));
create policy "Dono ou mestre cria recursos"
  on public.character_resources for insert to authenticated
  with check (private.can_edit_character_play(character_id));
create policy "Dono ou mestre altera recursos"
  on public.character_resources for update to authenticated
  using (private.can_edit_character_play(character_id))
  with check (private.can_edit_character_play(character_id));
create policy "Dono ou mestre remove recursos"
  on public.character_resources for delete to authenticated
  using (private.can_edit_character_play(character_id));

create policy "Quem vê o personagem vê as condições"
  on public.character_conditions for select to authenticated
  using (private.can_view_character(character_id));
create policy "Dono ou mestre aplica condições"
  on public.character_conditions for insert to authenticated
  with check (private.can_edit_character_play(character_id));
create policy "Dono ou mestre altera condições"
  on public.character_conditions for update to authenticated
  using (private.can_edit_character_play(character_id))
  with check (private.can_edit_character_play(character_id));
create policy "Dono ou mestre remove condições"
  on public.character_conditions for delete to authenticated
  using (private.can_edit_character_play(character_id));

create policy "Quem vê o personagem vê o inventário"
  on public.character_items for select to authenticated
  using (private.can_view_character(character_id));
create policy "Dono ou mestre adiciona itens"
  on public.character_items for insert to authenticated
  with check (private.can_edit_character_play(character_id));
create policy "Dono ou mestre altera itens"
  on public.character_items for update to authenticated
  using (private.can_edit_character_play(character_id))
  with check (private.can_edit_character_play(character_id));
create policy "Dono ou mestre remove itens"
  on public.character_items for delete to authenticated
  using (private.can_edit_character_play(character_id));

-- Habilidades e magias: construção da ficha.
create policy "Quem vê o personagem vê as habilidades"
  on public.character_abilities for select to authenticated
  using (private.can_view_character(character_id));
create policy "Quem edita a ficha cria habilidades"
  on public.character_abilities for insert to authenticated
  with check (private.can_edit_character_sheet(character_id));
create policy "Quem edita a ficha altera habilidades"
  on public.character_abilities for update to authenticated
  using (private.can_edit_character_sheet(character_id))
  with check (private.can_edit_character_sheet(character_id));
create policy "Quem edita a ficha remove habilidades"
  on public.character_abilities for delete to authenticated
  using (private.can_edit_character_sheet(character_id));

-- Histórico: imutável; registrado por quem altera o estado de jogo.
create policy "Quem vê o personagem vê o histórico"
  on public.character_events for select to authenticated
  using (private.can_view_character(character_id));
create policy "Dono ou mestre registra eventos em nome próprio"
  on public.character_events for insert to authenticated
  with check (private.can_edit_character_play(character_id) and actor_id = (select auth.uid()));

-- Cópias de segurança: visíveis a quem pode restaurar a ficha.
create policy "Quem edita a ficha vê as cópias de segurança"
  on public.character_snapshots for select to authenticated
  using (private.can_edit_character_sheet(character_id));

revoke all on table public.character_resources, public.character_conditions,
  public.character_items, public.character_abilities, public.character_events,
  public.character_snapshots from anon, authenticated;

grant select, delete on table public.character_resources to authenticated;
grant insert (character_id, key, label, current, max, temp, recovery, display, sort_order)
  on table public.character_resources to authenticated;
grant update (label, current, max, temp, recovery, display, sort_order)
  on table public.character_resources to authenticated;

grant select, delete on table public.character_conditions to authenticated;
grant insert (character_id, key, level, note) on table public.character_conditions to authenticated;
grant update (level, note) on table public.character_conditions to authenticated;

grant select, delete on table public.character_items to authenticated;
grant insert (character_id, name, category, quantity, weight, description, notes, is_equipped, data, sort_order)
  on table public.character_items to authenticated;
grant update (name, category, quantity, weight, description, notes, is_equipped, data, sort_order)
  on table public.character_items to authenticated;

grant select, delete on table public.character_abilities to authenticated;
grant insert (character_id, kind, name, source, description, data, resource_id, sort_order)
  on table public.character_abilities to authenticated;
grant update (name, source, description, data, resource_id, sort_order)
  on table public.character_abilities to authenticated;

grant select on table public.character_events to authenticated;
grant insert (character_id, kind, summary, data, occurred_at)
  on table public.character_events to authenticated;

grant select on table public.character_snapshots to authenticated;

grant all on table public.character_resources, public.character_conditions,
  public.character_items, public.character_abilities, public.character_events,
  public.character_snapshots to service_role;

-- -----------------------------------------------------------------------------
-- Operações atômicas (SECURITY INVOKER: as policies acima continuam valendo)
-- -----------------------------------------------------------------------------

-- Cria o personagem e suas trilhas iniciais numa única transação.
create function public.create_character(
  p_name text,
  p_system_id text,
  p_campaign_id uuid default null,
  p_sheet jsonb default '{}'::jsonb,
  p_resources jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if jsonb_typeof(coalesce(p_resources, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_resources, '[]'::jsonb)) > 100 then
    raise exception 'Lista de recursos inválida.' using errcode = '22023';
  end if;

  insert into public.characters (name, system_id, campaign_id, sheet)
  values (p_name, p_system_id, p_campaign_id, coalesce(p_sheet, '{}'::jsonb))
  returning id into v_id;

  insert into public.character_resources
    (character_id, key, label, current, max, temp, recovery, display, sort_order)
  select
    v_id,
    r ->> 'key',
    r ->> 'label',
    coalesce((r ->> 'current')::integer, 0),
    (r ->> 'max')::integer,
    0,
    coalesce((r ->> 'recovery')::public.resource_recovery, 'manual'),
    coalesce(r ->> 'display', 'pool'),
    coalesce((r ->> 'sortOrder')::integer, 0)
  from jsonb_array_elements(coalesce(p_resources, '[]'::jsonb)) as r;

  return v_id;
end;
$$;

-- Dano, cura e ajustes de uma trilha. Mesmas regras de @codexveil/domain (resources.ts).
create function public.adjust_character_resource(
  p_resource_id uuid,
  p_operation text,
  p_amount integer
)
returns public.character_resources
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_row public.character_resources;
begin
  if p_amount is null or p_amount < 0 or p_amount > 1000000 then
    raise exception 'Quantidade inválida.' using errcode = '22023';
  end if;

  case p_operation
    when 'damage' then
      -- Em UPDATE, todas as expressões leem os valores antigos: o temporário absorve primeiro.
      update public.character_resources
      set temp = greatest(temp - p_amount, 0),
          current = greatest(current - greatest(p_amount - temp, 0), 0)
      where id = p_resource_id
      returning * into v_row;
    when 'heal' then
      update public.character_resources
      set current = case when max is null then current + p_amount else least(max, current + p_amount) end
      where id = p_resource_id
      returning * into v_row;
    when 'spend' then
      update public.character_resources
      set current = greatest(current - p_amount, 0)
      where id = p_resource_id
      returning * into v_row;
    when 'set_current' then
      update public.character_resources
      set current = case when max is null then p_amount else least(max, p_amount) end
      where id = p_resource_id
      returning * into v_row;
    when 'set_temp' then
      update public.character_resources
      set temp = p_amount
      where id = p_resource_id
      returning * into v_row;
    when 'set_max' then
      update public.character_resources
      set max = p_amount,
          current = least(current, p_amount)
      where id = p_resource_id
      returning * into v_row;
    else
      raise exception 'Operação desconhecida: %', p_operation using errcode = '22023';
  end case;

  if v_row.id is null then
    raise exception 'Recurso não encontrado.' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

-- Descanso: restaura trilhas conforme a recuperação (longo restaura curto e longo).
-- No descanso longo, pontos de vida temporários se encerram.
create function public.take_character_rest(p_character_id uuid, p_rest public.resource_recovery)
returns integer
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_rest not in ('short_rest', 'long_rest') then
    raise exception 'Tipo de descanso inválido.' using errcode = '22023';
  end if;
  if not private.can_edit_character_play(p_character_id) then
    raise exception 'Personagem não encontrado.' using errcode = 'P0002';
  end if;

  update public.character_resources
  set current = coalesce(max, current),
      temp = case when p_rest = 'long_rest' then 0 else temp end
  where character_id = p_character_id
    and (recovery = 'short_rest' or (p_rest = 'long_rest' and recovery = 'long_rest'));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create function public.adjust_item_quantity(p_item_id uuid, p_delta integer)
returns public.character_items
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_row public.character_items;
begin
  if p_delta is null or abs(p_delta) > 99999 then
    raise exception 'Ajuste inválido.' using errcode = '22023';
  end if;
  update public.character_items
  set quantity = least(greatest(quantity + p_delta, 0), 99999)
  where id = p_item_id
  returning * into v_row;
  if v_row.id is null then
    raise exception 'Item não encontrado.' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

revoke all on function public.set_character_campaign(uuid, uuid) from public, anon;
revoke all on function public.create_character(text, text, uuid, jsonb, jsonb) from public, anon;
revoke all on function public.adjust_character_resource(uuid, text, integer) from public, anon;
revoke all on function public.take_character_rest(uuid, public.resource_recovery) from public, anon;
revoke all on function public.adjust_item_quantity(uuid, integer) from public, anon;
grant execute on function public.set_character_campaign(uuid, uuid) to authenticated;
grant execute on function public.create_character(text, text, uuid, jsonb, jsonb) to authenticated;
grant execute on function public.adjust_character_resource(uuid, text, integer) to authenticated;
grant execute on function public.take_character_rest(uuid, public.resource_recovery) to authenticated;
grant execute on function public.adjust_item_quantity(uuid, integer) to authenticated;
