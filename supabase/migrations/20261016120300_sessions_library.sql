-- =============================================================================
-- Codexveil — 04 · Biblioteca, sessões, roteiros, cena, combate e anotações
--
-- Privacidade: segredos não dependem de esconder elementos na interface.
--   * Dados exclusivos do mestre sobre NPCs/monstros ficam em `creature_gm_data`, tabela
--     com RLS somente para mestres. Jogadores só leem o perfil público em `creatures`
--     quando o mestre o revela (visibility = 'members').
--   * Blocos de roteiro com visibility = 'gm' nunca saem do banco para jogadores — em
--     consultas, respostas da API ou eventos Realtime (que também respeitam RLS).
--   * Sessões não publicadas são invisíveis aos jogadores, inclusive seus blocos públicos.
--   * A cena (session_entities) e os encontros são exclusivos dos mestres.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Biblioteca: NPCs e monstros reutilizáveis da campanha
-- -----------------------------------------------------------------------------
create table public.creatures (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  kind public.creature_kind not null,
  name text not null check (char_length(name) between 1 and 80 and private.is_single_line(name)),
  subtitle text not null default ''
    check (char_length(subtitle) <= 80 and private.is_single_line(subtitle)),
  description text not null default ''
    check (char_length(description) <= 4000 and private.is_clean_text(description)),
  image_path text,
  visibility public.content_visibility not null default 'gm'
    check (visibility in ('members', 'gm')),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creatures_id_campaign_key unique (id, campaign_id),
  constraint creatures_image_path check (
    image_path is null
    or (char_length(image_path) <= 300
        and image_path like 'campaigns/' || campaign_id::text || '/creatures/%')
  )
);

comment on table public.creatures is
  'Perfil público de NPCs e monstros reutilizáveis. Estatísticas e segredos ficam em creature_gm_data.';

create table public.creature_gm_data (
  creature_id uuid primary key,
  campaign_id uuid not null,
  stats jsonb not null default '{}'::jsonb
    check (jsonb_typeof(stats) = 'object' and pg_column_size(stats) <= 65536),
  notes text not null default '' check (char_length(notes) <= 8000 and private.is_clean_text(notes)),
  secrets text not null default ''
    check (char_length(secrets) <= 8000 and private.is_clean_text(secrets)),
  updated_at timestamptz not null default now(),
  constraint creature_gm_data_creature_fk
    foreign key (creature_id, campaign_id)
    references public.creatures (id, campaign_id)
    on delete cascade
);

comment on table public.creature_gm_data is
  'Estatísticas, observações e segredos de NPCs/monstros. Visível somente aos mestres.';

create index creatures_campaign_kind_idx on public.creatures (campaign_id, kind, name);
create index creatures_image_path_idx on public.creatures (image_path) where image_path is not null;

create trigger creatures_set_updated_at
  before update on public.creatures
  for each row execute function private.set_updated_at();
create trigger creature_gm_data_set_updated_at
  before update on public.creature_gm_data
  for each row execute function private.set_updated_at();

create function private.creatures_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.creature_gm_data (creature_id, campaign_id) values (new.id, new.campaign_id);
  return new;
end;
$$;

create trigger creatures_after_insert
  after insert on public.creatures
  for each row execute function private.creatures_after_insert();

revoke all on function private.creatures_after_insert() from public;

alter table public.creatures enable row level security;
alter table public.creature_gm_data enable row level security;

create policy "Mestres veem a biblioteca; jogadores veem o que foi revelado"
  on public.creatures for select to authenticated
  using (
    private.is_campaign_gm(campaign_id)
    or (visibility = 'members' and private.is_campaign_member(campaign_id))
  );
create policy "Mestres criam registros"
  on public.creatures for insert to authenticated
  with check (private.can_manage_campaign(campaign_id));
create policy "Mestres alteram registros"
  on public.creatures for update to authenticated
  using (private.can_manage_campaign(campaign_id))
  with check (private.can_manage_campaign(campaign_id));
create policy "Mestres removem registros"
  on public.creatures for delete to authenticated
  using (private.can_manage_campaign(campaign_id));

create policy "Somente mestres veem dados secretos"
  on public.creature_gm_data for select to authenticated
  using (private.is_campaign_gm(campaign_id));
create policy "Somente mestres alteram dados secretos"
  on public.creature_gm_data for update to authenticated
  using (private.can_manage_campaign(campaign_id))
  with check (private.can_manage_campaign(campaign_id));

revoke all on table public.creatures, public.creature_gm_data from anon, authenticated;
grant select, delete on table public.creatures to authenticated;
grant insert (campaign_id, kind, name, subtitle, description, visibility)
  on table public.creatures to authenticated;
grant update (name, subtitle, description, image_path, visibility)
  on table public.creatures to authenticated;
grant select on table public.creature_gm_data to authenticated;
grant update (stats, notes, secrets) on table public.creature_gm_data to authenticated;
grant all on table public.creatures, public.creature_gm_data to service_role;

-- -----------------------------------------------------------------------------
-- Sessões
-- -----------------------------------------------------------------------------
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  -- Atribuído pelo gatilho (sequencial por campanha); o valor padrão nunca é gravado.
  number integer not null default 0,
  title text not null check (char_length(title) between 1 and 120 and private.is_single_line(title)),
  scheduled_at timestamptz,
  status public.session_status not null default 'planned',
  is_published boolean not null default false,
  recap text not null default '' check (char_length(recap) <= 20000 and private.is_clean_text(recap)),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sessions_number_key unique (campaign_id, number),
  constraint sessions_id_campaign_key unique (id, campaign_id)
);

comment on column public.sessions.is_published is
  'Sessões não publicadas (e todos os seus blocos) são invisíveis aos jogadores.';
comment on column public.sessions.recap is 'Resumo público, visível aos jogadores quando publicada.';

create unique index sessions_one_in_progress_idx on public.sessions (campaign_id)
  where status = 'in_progress';
create index sessions_campaign_schedule_idx on public.sessions (campaign_id, scheduled_at);

create function private.sessions_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtextextended('codexveil:sessions:' || new.campaign_id::text, 0));
    new.number := coalesce(
      (select max(s.number) from public.sessions s where s.campaign_id = new.campaign_id), 0
    ) + 1;
    new.version := 1;
    new.created_at := now();
    new.updated_at := now();
  else
    if new.campaign_id is distinct from old.campaign_id then
      raise exception 'Uma sessão não pode mudar de campanha.' using errcode = '42501';
    end if;
    new.number := old.number;
    new.version := old.version + 1;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger sessions_before_write
  before insert or update on public.sessions
  for each row execute function private.sessions_before_write();

revoke all on function private.sessions_before_write() from public;

-- Sessão publicada de uma campanha da qual o usuário participa.
create function private.is_published_session_member(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.sessions s
    join public.campaign_members m on m.campaign_id = s.campaign_id
    where s.id = p_session_id
      and s.is_published
      and m.user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_published_session_member(uuid) from public;
grant execute on function private.is_published_session_member(uuid) to authenticated, service_role;

alter table public.sessions enable row level security;

create policy "Mestres veem todas as sessões; jogadores, as publicadas"
  on public.sessions for select to authenticated
  using (
    private.is_campaign_gm(campaign_id)
    or (is_published and private.is_campaign_member(campaign_id))
  );
create policy "Mestres criam sessões"
  on public.sessions for insert to authenticated
  with check (private.can_manage_campaign(campaign_id));
create policy "Mestres alteram sessões"
  on public.sessions for update to authenticated
  using (private.can_manage_campaign(campaign_id))
  with check (private.can_manage_campaign(campaign_id));
create policy "Mestres removem sessões"
  on public.sessions for delete to authenticated
  using (private.can_manage_campaign(campaign_id));

revoke all on table public.sessions from anon, authenticated;
grant select, delete on table public.sessions to authenticated;
grant insert (campaign_id, title, scheduled_at, status, is_published, recap)
  on table public.sessions to authenticated;
grant update (title, scheduled_at, status, is_published, recap)
  on table public.sessions to authenticated;
grant all on table public.sessions to service_role;

-- -----------------------------------------------------------------------------
-- Blocos de roteiro
-- -----------------------------------------------------------------------------

-- Validação estrutural dos dados de cada tipo de bloco (espelha @codexveil/validation).
create function private.is_valid_block_data(p_type public.session_block_type, p_data jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_ok boolean;
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    return false;
  end if;

  case p_type
    when 'paragraph', 'heading', 'subheading', 'gm_note' then
      v_ok := jsonb_typeof(p_data -> 'text') = 'string';
    when 'callout' then
      v_ok := jsonb_typeof(p_data -> 'text') = 'string'
        and p_data ->> 'tone' in ('lore', 'info', 'warning', 'danger')
        and jsonb_typeof(p_data -> 'title') in ('string', 'null');
    when 'image' then
      v_ok := jsonb_typeof(p_data -> 'path') = 'string'
        and jsonb_typeof(p_data -> 'alt') = 'string'
        and jsonb_typeof(p_data -> 'caption') in ('string', 'null');
    when 'divider' then
      v_ok := p_data = '{}'::jsonb;
    when 'list' then
      v_ok := p_data ->> 'style' in ('bulleted', 'numbered')
        and jsonb_typeof(p_data -> 'items') = 'array'
        and jsonb_array_length(p_data -> 'items') <= 200
        and not exists (
          select 1 from jsonb_array_elements(p_data -> 'items') e where jsonb_typeof(e) <> 'string'
        );
    when 'checklist' then
      v_ok := jsonb_typeof(p_data -> 'items') = 'array'
        and jsonb_array_length(p_data -> 'items') <= 200
        and not exists (
          select 1 from jsonb_array_elements(p_data -> 'items') e
          where jsonb_typeof(e -> 'id') is distinct from 'string'
             or jsonb_typeof(e -> 'text') is distinct from 'string'
             or jsonb_typeof(e -> 'checked') is distinct from 'boolean'
        );
    when 'npc_ref', 'monster_ref' then
      v_ok := jsonb_typeof(p_data -> 'creatureId') = 'string'
        and (p_data ->> 'creatureId' = '' or private.try_uuid(p_data ->> 'creatureId') is not null)
        and jsonb_typeof(p_data -> 'note') in ('string', 'null');
    when 'character_ref' then
      v_ok := jsonb_typeof(p_data -> 'characterId') = 'string'
        and (p_data ->> 'characterId' = '' or private.try_uuid(p_data ->> 'characterId') is not null)
        and jsonb_typeof(p_data -> 'note') in ('string', 'null');
    when 'content_ref' then
      v_ok := p_data ->> 'kind' in ('session', 'note')
        and jsonb_typeof(p_data -> 'targetId') = 'string'
        and (p_data ->> 'targetId' = '' or private.try_uuid(p_data ->> 'targetId') is not null)
        and jsonb_typeof(p_data -> 'note') in ('string', 'null');
  end case;

  return coalesce(v_ok, false);
end;
$$;

grant execute on function private.is_valid_block_data(public.session_block_type, jsonb)
  to authenticated, service_role;

create table public.session_blocks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  campaign_id uuid not null,
  type public.session_block_type not null,
  position double precision not null check (position > -1e15 and position < 1e15),
  visibility public.content_visibility not null default 'members'
    check (visibility in ('members', 'gm')),
  data jsonb not null default '{}'::jsonb check (pg_column_size(data) <= 65536),
  schema_version integer not null default 1 check (schema_version >= 1),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_blocks_session_fk
    foreign key (session_id, campaign_id)
    references public.sessions (id, campaign_id)
    on delete cascade,
  constraint session_blocks_gm_note_private check (type <> 'gm_note' or visibility = 'gm'),
  constraint session_blocks_data_valid check (private.is_valid_block_data(type, data)),
  -- Imagens de roteiro ficam na pasta de sessões da própria campanha (podem ser
  -- reaproveitadas entre sessões, o que permite duplicar roteiros com imagens).
  constraint session_blocks_image_path check (
    type <> 'image'
    or data ->> 'path' = ''
    or data ->> 'path' like 'campaigns/' || campaign_id::text || '/sessions/%'
  )
);

comment on table public.session_blocks is
  'Roteiro por blocos (JSON estruturado e versionado, nunca HTML). visibility = gm é privado.';

create index session_blocks_session_position_idx on public.session_blocks (session_id, position);
create index session_blocks_image_path_idx on public.session_blocks ((data ->> 'path'))
  where type = 'image';

create trigger session_blocks_set_updated_at
  before update on public.session_blocks
  for each row execute function private.set_updated_at();

alter table public.session_blocks enable row level security;

create policy "Mestres veem todos os blocos; jogadores, os públicos de sessões publicadas"
  on public.session_blocks for select to authenticated
  using (
    private.is_campaign_gm(campaign_id)
    or (visibility = 'members' and private.is_published_session_member(session_id))
  );
create policy "Mestres criam blocos"
  on public.session_blocks for insert to authenticated
  with check (private.can_manage_campaign(campaign_id));
create policy "Mestres alteram blocos"
  on public.session_blocks for update to authenticated
  using (private.can_manage_campaign(campaign_id))
  with check (private.can_manage_campaign(campaign_id));
create policy "Mestres removem blocos"
  on public.session_blocks for delete to authenticated
  using (private.can_manage_campaign(campaign_id));

revoke all on table public.session_blocks from anon, authenticated;
grant select, delete on table public.session_blocks to authenticated;
grant insert (session_id, campaign_id, type, position, visibility, data, schema_version)
  on table public.session_blocks to authenticated;
grant update (position, visibility, data, schema_version) on table public.session_blocks to authenticated;
grant all on table public.session_blocks to service_role;

-- -----------------------------------------------------------------------------
-- Cena da sessão: instâncias de NPCs e monstros (independentes do registro-base)
-- -----------------------------------------------------------------------------
create function private.are_valid_condition_keys(p_keys text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(cardinality(p_keys), 0) <= 20
    and not exists (
      select 1 from unnest(p_keys) k
      where k is null or char_length(k) not between 1 and 40 or not private.is_single_line(k)
    );
$$;

grant execute on function private.are_valid_condition_keys(text[]) to authenticated, service_role;

create table public.session_entities (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  campaign_id uuid not null,
  creature_id uuid,
  kind public.creature_kind not null,
  name text not null check (char_length(name) between 1 and 80 and private.is_single_line(name)),
  hp_current integer check (hp_current is null or hp_current between 0 and 1000000),
  hp_max integer check (hp_max is null or hp_max between 0 and 1000000),
  hp_temp integer not null default 0 check (hp_temp between 0 and 1000000),
  armor_class integer check (armor_class is null or armor_class between 0 and 100),
  initiative_bonus integer not null default 0 check (initiative_bonus between -50 and 50),
  conditions text[] not null default '{}' check (private.are_valid_condition_keys(conditions)),
  notes text not null default '' check (char_length(notes) <= 2000 and private.is_clean_text(notes)),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_entities_id_campaign_key unique (id, campaign_id),
  constraint session_entities_session_fk
    foreign key (session_id, campaign_id)
    references public.sessions (id, campaign_id)
    on delete cascade,
  constraint session_entities_creature_fk
    foreign key (creature_id, campaign_id)
    references public.creatures (id, campaign_id)
    on delete set null (creature_id),
  constraint session_entities_hp check (hp_max is null or hp_current is null or hp_current <= hp_max)
);

comment on table public.session_entities is
  'Instâncias na cena. Alterar a vida de uma instância não afeta o registro-base nem outras instâncias.';

create index session_entities_session_idx on public.session_entities (session_id, sort_order);

create trigger session_entities_set_updated_at
  before update on public.session_entities
  for each row execute function private.set_updated_at();

alter table public.session_entities enable row level security;

create policy "Somente mestres veem a cena"
  on public.session_entities for select to authenticated
  using (private.is_campaign_gm(campaign_id));
create policy "Mestres adicionam à cena"
  on public.session_entities for insert to authenticated
  with check (private.can_manage_campaign(campaign_id));
create policy "Mestres alteram a cena"
  on public.session_entities for update to authenticated
  using (private.can_manage_campaign(campaign_id))
  with check (private.can_manage_campaign(campaign_id));
create policy "Mestres removem da cena"
  on public.session_entities for delete to authenticated
  using (private.can_manage_campaign(campaign_id));

revoke all on table public.session_entities from anon, authenticated;
grant select, delete on table public.session_entities to authenticated;
grant insert (session_id, campaign_id, creature_id, kind, name, hp_current, hp_max, hp_temp,
  armor_class, initiative_bonus, conditions, notes, sort_order)
  on table public.session_entities to authenticated;
grant update (name, hp_current, hp_max, hp_temp, armor_class, initiative_bonus, conditions, notes,
  sort_order)
  on table public.session_entities to authenticated;
grant all on table public.session_entities to service_role;

create function public.adjust_session_entity_hp(
  p_entity_id uuid,
  p_operation text,
  p_amount integer
)
returns public.session_entities
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_row public.session_entities;
begin
  if p_amount is null or p_amount < 0 or p_amount > 1000000 then
    raise exception 'Quantidade inválida.' using errcode = '22023';
  end if;

  case p_operation
    when 'damage' then
      update public.session_entities
      set hp_temp = greatest(hp_temp - p_amount, 0),
          hp_current = greatest(coalesce(hp_current, 0) - greatest(p_amount - hp_temp, 0), 0)
      where id = p_entity_id
      returning * into v_row;
    when 'heal' then
      update public.session_entities
      set hp_current = case
        when hp_max is null then coalesce(hp_current, 0) + p_amount
        else least(hp_max, coalesce(hp_current, 0) + p_amount)
      end
      where id = p_entity_id
      returning * into v_row;
    when 'set_current' then
      update public.session_entities
      set hp_current = case when hp_max is null then p_amount else least(hp_max, p_amount) end
      where id = p_entity_id
      returning * into v_row;
    when 'set_temp' then
      update public.session_entities
      set hp_temp = p_amount
      where id = p_entity_id
      returning * into v_row;
    else
      raise exception 'Operação desconhecida: %', p_operation using errcode = '22023';
  end case;

  if v_row.id is null then
    raise exception 'Entidade não encontrada.' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

-- -----------------------------------------------------------------------------
-- Combate: encontros e ordem de iniciativa
-- -----------------------------------------------------------------------------
create table public.encounters (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  campaign_id uuid not null,
  name text not null default 'Encontro'
    check (char_length(name) between 1 and 80 and private.is_single_line(name)),
  status public.encounter_status not null default 'preparing',
  round integer not null default 0 check (round between 0 and 10000),
  active_combatant_id uuid,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint encounters_id_campaign_key unique (id, campaign_id),
  constraint encounters_session_fk
    foreign key (session_id, campaign_id)
    references public.sessions (id, campaign_id)
    on delete cascade
);

create table public.encounter_combatants (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null,
  campaign_id uuid not null,
  session_entity_id uuid,
  character_id uuid references public.characters (id) on delete cascade,
  initiative integer check (initiative is null or initiative between -50 and 100),
  tiebreaker integer not null default 0 check (tiebreaker between -50 and 50),
  is_defeated boolean not null default false,
  created_at timestamptz not null default now(),
  constraint encounter_combatants_encounter_fk
    foreign key (encounter_id, campaign_id)
    references public.encounters (id, campaign_id)
    on delete cascade,
  constraint encounter_combatants_entity_fk
    foreign key (session_entity_id, campaign_id)
    references public.session_entities (id, campaign_id)
    on delete cascade,
  constraint encounter_combatants_one_source check (num_nonnulls(session_entity_id, character_id) = 1),
  constraint encounter_combatants_entity_unique unique (encounter_id, session_entity_id),
  constraint encounter_combatants_character_unique unique (encounter_id, character_id)
);

alter table public.encounters
  add constraint encounters_active_combatant_fk
  foreign key (active_combatant_id) references public.encounter_combatants (id) on delete set null;

create index encounters_session_idx on public.encounters (session_id);
create index encounter_combatants_encounter_idx on public.encounter_combatants (encounter_id);
create index encounter_combatants_character_idx on public.encounter_combatants (character_id)
  where character_id is not null;

create function private.encounters_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;

create trigger encounters_before_update
  before update on public.encounters
  for each row execute function private.encounters_before_update();

-- Personagens só entram em combates da própria campanha.
create function private.encounter_combatants_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.character_id is not null and not exists (
    select 1 from public.characters c
    where c.id = new.character_id and c.campaign_id = new.campaign_id
  ) then
    raise exception 'O personagem não pertence a esta campanha.' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger encounter_combatants_before_insert
  before insert on public.encounter_combatants
  for each row execute function private.encounter_combatants_before_insert();

revoke all on function private.encounters_before_update() from public;
revoke all on function private.encounter_combatants_before_insert() from public;

alter table public.encounters enable row level security;
alter table public.encounter_combatants enable row level security;

create policy "Somente mestres veem encontros"
  on public.encounters for select to authenticated
  using (private.is_campaign_gm(campaign_id));
create policy "Mestres criam encontros"
  on public.encounters for insert to authenticated
  with check (private.can_manage_campaign(campaign_id));
create policy "Mestres conduzem encontros"
  on public.encounters for update to authenticated
  using (private.can_manage_campaign(campaign_id))
  with check (private.can_manage_campaign(campaign_id));
create policy "Mestres removem encontros"
  on public.encounters for delete to authenticated
  using (private.can_manage_campaign(campaign_id));

create policy "Somente mestres veem combatentes"
  on public.encounter_combatants for select to authenticated
  using (private.is_campaign_gm(campaign_id));
create policy "Mestres adicionam combatentes"
  on public.encounter_combatants for insert to authenticated
  with check (private.can_manage_campaign(campaign_id));
create policy "Mestres alteram combatentes"
  on public.encounter_combatants for update to authenticated
  using (private.can_manage_campaign(campaign_id))
  with check (private.can_manage_campaign(campaign_id));
create policy "Mestres removem combatentes"
  on public.encounter_combatants for delete to authenticated
  using (private.can_manage_campaign(campaign_id));

revoke all on table public.encounters, public.encounter_combatants from anon, authenticated;
grant select, delete on table public.encounters to authenticated;
grant insert (session_id, campaign_id, name, status) on table public.encounters to authenticated;
grant update (name, status, round, active_combatant_id) on table public.encounters to authenticated;
grant select, delete on table public.encounter_combatants to authenticated;
grant insert (encounter_id, campaign_id, session_entity_id, character_id, initiative, tiebreaker,
  is_defeated)
  on table public.encounter_combatants to authenticated;
grant update (initiative, tiebreaker, is_defeated) on table public.encounter_combatants to authenticated;
grant all on table public.encounters, public.encounter_combatants to service_role;

-- -----------------------------------------------------------------------------
-- Anotações da campanha
-- -----------------------------------------------------------------------------
create table public.campaign_notes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120 and private.is_single_line(title)),
  body text not null default '' check (char_length(body) <= 20000 and private.is_clean_text(body)),
  visibility public.content_visibility not null default 'members',
  is_pinned boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.campaign_notes.visibility is
  'members = todos; gm = mestres e o autor; author = somente o autor.';

create index campaign_notes_campaign_idx on public.campaign_notes (campaign_id, is_pinned desc, updated_at desc);

create function private.campaign_notes_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.campaign_id is distinct from old.campaign_id or new.author_id is distinct from old.author_id then
    raise exception 'Campanha e autor de uma anotação não podem ser alterados.' using errcode = '42501';
  end if;
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;

create trigger campaign_notes_before_update
  before update on public.campaign_notes
  for each row execute function private.campaign_notes_before_update();

revoke all on function private.campaign_notes_before_update() from public;

alter table public.campaign_notes enable row level security;

create policy "Anotações visíveis conforme a visibilidade"
  on public.campaign_notes for select to authenticated
  using (
    private.is_campaign_member(campaign_id)
    and (
      visibility = 'members'
      or author_id = (select auth.uid())
      or (visibility = 'gm' and private.is_campaign_gm(campaign_id))
    )
  );
create policy "Participantes escrevem anotações próprias"
  on public.campaign_notes for insert to authenticated
  with check (author_id = (select auth.uid()) and private.can_participate(campaign_id));
create policy "Autor edita as próprias anotações"
  on public.campaign_notes for update to authenticated
  using (author_id = (select auth.uid()) and private.can_participate(campaign_id))
  with check (author_id = (select auth.uid()) and private.can_participate(campaign_id));
create policy "Autor ou mestre remove anotações visíveis a todos"
  on public.campaign_notes for delete to authenticated
  using (
    author_id = (select auth.uid())
    or (visibility = 'members' and private.can_manage_campaign(campaign_id))
  );

revoke all on table public.campaign_notes from anon, authenticated;
grant select, delete on table public.campaign_notes to authenticated;
grant insert (campaign_id, title, body, visibility, is_pinned) on table public.campaign_notes to authenticated;
grant update (title, body, visibility, is_pinned) on table public.campaign_notes to authenticated;
grant all on table public.campaign_notes to service_role;

-- -----------------------------------------------------------------------------
-- Operações de roteiro
-- -----------------------------------------------------------------------------

-- Duplica uma sessão e seus blocos (a cópia nasce planejada e não publicada).
create function public.duplicate_session(p_session_id uuid)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_source public.sessions;
  v_new_id uuid;
begin
  select * into v_source from public.sessions s where s.id = p_session_id;
  if not found or not private.can_manage_campaign(v_source.campaign_id) then
    raise exception 'Sessão não encontrada.' using errcode = 'P0002';
  end if;

  insert into public.sessions (campaign_id, title, scheduled_at, status, is_published, recap)
  values (
    v_source.campaign_id,
    left(v_source.title || ' (cópia)', 120),
    null,
    'planned',
    false,
    ''
  )
  returning id into v_new_id;

  -- A cópia reaproveita os mesmos arquivos de imagem (mesma campanha).
  insert into public.session_blocks (session_id, campaign_id, type, position, visibility, data, schema_version)
  select v_new_id, b.campaign_id, b.type, b.position, b.visibility, b.data, b.schema_version
  from public.session_blocks b
  where b.session_id = p_session_id;

  return v_new_id;
end;
$$;

-- Renumera as posições dos blocos na ordem informada (deve conter todos os blocos).
create function public.reorder_session_blocks(p_session_id uuid, p_block_ids uuid[])
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_total integer;
  v_updated integer;
begin
  select count(*) into v_total from public.session_blocks b where b.session_id = p_session_id;
  if v_total <> coalesce(cardinality(p_block_ids), 0)
     or (select count(distinct id) from unnest(p_block_ids) as id) <> v_total
     or exists (
       select 1 from unnest(p_block_ids) as given(id)
       where not exists (
         select 1 from public.session_blocks b where b.id = given.id and b.session_id = p_session_id
       )
     ) then
    raise exception 'A nova ordem precisa conter exatamente os blocos da sessão.' using errcode = '22023';
  end if;

  update public.session_blocks b
  set position = ordered.ord * 1024
  from unnest(p_block_ids) with ordinality as ordered(id, ord)
  where b.id = ordered.id and b.session_id = p_session_id;
  get diagnostics v_updated = row_count;

  -- O RLS filtra silenciosamente o UPDATE de quem não é mestre: sinalizamos explicitamente.
  if v_updated <> v_total then
    raise exception 'Somente mestres reordenam o roteiro.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.adjust_session_entity_hp(uuid, text, integer) from public, anon;
revoke all on function public.duplicate_session(uuid) from public, anon;
revoke all on function public.reorder_session_blocks(uuid, uuid[]) from public, anon;
grant execute on function public.adjust_session_entity_hp(uuid, text, integer) to authenticated;
grant execute on function public.duplicate_session(uuid) to authenticated;
grant execute on function public.reorder_session_blocks(uuid, uuid[]) to authenticated;
