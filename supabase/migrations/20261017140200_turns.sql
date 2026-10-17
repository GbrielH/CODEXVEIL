-- =============================================================================
-- Codexveil — 12 · Turnos: modos de jogo, ordem manual e o turno visível aos jogadores
--
-- * O encontro (encounters) ganha um modo (combate, exploração, investigação, interação
--   social) e a forma de ordenar os turnos: pela iniciativa ou na ordem que o mestre definir.
-- * Cada participante do encontro pode ser ocultado dos jogadores e guarda o que já usou no
--   turno (ação, ação bônus, reação, movimento).
-- * Os encontros continuam exclusivos do mestre. Os jogadores leem `campaign_turns`, um
--   resumo mantido por gatilhos: modo, rodada, de quem é a vez e a ordem (sem os ocultos e,
--   se o mestre preferir, sem a ordem completa).
-- * A campanha guarda o modo e a ordem padrão dos encontros novos.
-- =============================================================================

alter table public.campaigns
  add column default_turn_mode text not null default 'combat'
    check (default_turn_mode in ('combat', 'exploration', 'investigation', 'social')),
  add column default_turn_order text not null default 'initiative'
    check (default_turn_order in ('initiative', 'manual')),
  add column players_see_turn_order boolean not null default true;

comment on column public.campaigns.default_turn_mode is 'Modo dos encontros novos (combate, exploração…).';
comment on column public.campaigns.default_turn_order is 'Ordem dos turnos dos encontros novos: iniciativa ou manual.';
comment on column public.campaigns.players_see_turn_order is
  'Jogadores veem a ordem completa dos turnos (senão, só de quem é a vez).';

grant update (default_turn_mode, default_turn_order, players_see_turn_order)
  on table public.campaigns to authenticated;

alter table public.encounters
  add column mode text not null default 'combat'
    check (mode in ('combat', 'exploration', 'investigation', 'social')),
  add column order_mode text not null default 'initiative'
    check (order_mode in ('initiative', 'manual'));

alter table public.encounter_combatants
  add column sort_order integer not null default 0 check (sort_order between -100000 and 100000),
  add column is_hidden boolean not null default false,
  add column turn_state jsonb not null default '{}'::jsonb
    check (jsonb_typeof(turn_state) = 'object' and pg_column_size(turn_state) <= 1024);

comment on column public.encounter_combatants.is_hidden is 'Oculto dos jogadores no resumo do turno.';
comment on column public.encounter_combatants.turn_state is
  'O que já foi usado no turno atual: {"action":true,"bonusAction":false,"reaction":false,"movement":false}.';

grant insert (mode, order_mode) on table public.encounters to authenticated;
grant update (mode, order_mode) on table public.encounters to authenticated;
grant insert (sort_order, is_hidden) on table public.encounter_combatants to authenticated;
grant update (sort_order, is_hidden, turn_state) on table public.encounter_combatants to authenticated;

-- -----------------------------------------------------------------------------
-- Resumo do turno para os jogadores
-- -----------------------------------------------------------------------------
create table public.campaign_turns (
  campaign_id uuid primary key references public.campaigns (id) on delete cascade,
  encounter_id uuid not null references public.encounters (id) on delete cascade,
  session_id uuid not null,
  name text not null,
  mode text not null,
  status public.encounter_status not null,
  round integer not null,
  -- Nulos quando ninguém está na vez ou quando é a vez de alguém oculto.
  active_name text,
  active_character_id uuid,
  -- [{id, name, kind, characterId, defeated, current}] na ordem dos turnos, sem os ocultos.
  turn_order jsonb not null default '[]'::jsonb check (jsonb_typeof(turn_order) = 'array'),
  updated_at timestamptz not null default now()
);

comment on table public.campaign_turns is
  'Resumo do encontro aberto de cada campanha, visível aos participantes (mantido por gatilhos).';

create index campaign_turns_encounter_idx on public.campaign_turns (encounter_id);

alter table public.campaign_turns enable row level security;

create policy "Participantes veem o turno da campanha"
  on public.campaign_turns for select to authenticated
  using (private.is_campaign_member(campaign_id));

revoke all on table public.campaign_turns from anon, authenticated;
grant select on table public.campaign_turns to authenticated;
grant all on table public.campaign_turns to service_role;

create function private.refresh_campaign_turn(p_encounter_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_encounter public.encounters%rowtype;
  v_show_order boolean;
  v_order jsonb;
  v_active_name text;
  v_active_character uuid;
  v_active_visible boolean;
begin
  select * into v_encounter from public.encounters e where e.id = p_encounter_id;
  if not found then
    return; -- encontro removido: o resumo sai em cascata
  end if;
  if v_encounter.status = 'ended' then
    delete from public.campaign_turns t where t.encounter_id = p_encounter_id;
    return;
  end if;

  select c.players_see_turn_order into v_show_order
  from public.campaigns c
  where c.id = v_encounter.campaign_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'name', r.name,
        'kind', r.kind,
        'characterId', r.character_id,
        'defeated', r.is_defeated,
        'current', coalesce(r.id = v_encounter.active_combatant_id, false)
      )
      order by r.position
    ) filter (where not r.is_hidden),
    '[]'::jsonb
  )
  into v_order
  from (
    select
      ec.id,
      ec.is_defeated,
      ec.is_hidden,
      ec.character_id,
      coalesce(ch.name, se.name, '—') as name,
      case when ec.character_id is not null then 'character' else coalesce(se.kind::text, 'monster') end as kind,
      row_number() over (
        order by
          case when v_encounter.order_mode = 'manual' then ec.sort_order else 0 end,
          case when v_encounter.order_mode = 'manual' then 0 else coalesce(ec.initiative, -1000) end desc,
          case when v_encounter.order_mode = 'manual' then 0 else ec.tiebreaker end desc,
          coalesce(ch.name, se.name),
          ec.id
      ) as position
    from public.encounter_combatants ec
    left join public.characters ch on ch.id = ec.character_id
    left join public.session_entities se on se.id = ec.session_entity_id
    where ec.encounter_id = p_encounter_id
  ) r;

  select coalesce(ch.name, se.name), ec.character_id, not ec.is_hidden
  into v_active_name, v_active_character, v_active_visible
  from public.encounter_combatants ec
  left join public.characters ch on ch.id = ec.character_id
  left join public.session_entities se on se.id = ec.session_entity_id
  where ec.id = v_encounter.active_combatant_id;

  if not coalesce(v_active_visible, false) then
    v_active_name := null;
    v_active_character := null;
  end if;

  insert into public.campaign_turns (
    campaign_id, encounter_id, session_id, name, mode, status, round,
    active_name, active_character_id, turn_order, updated_at
  )
  values (
    v_encounter.campaign_id, v_encounter.id, v_encounter.session_id, v_encounter.name, v_encounter.mode,
    v_encounter.status, v_encounter.round, v_active_name, v_active_character,
    case when coalesce(v_show_order, true) then v_order else '[]'::jsonb end, now()
  )
  on conflict (campaign_id) do update set
    encounter_id = excluded.encounter_id,
    session_id = excluded.session_id,
    name = excluded.name,
    mode = excluded.mode,
    status = excluded.status,
    round = excluded.round,
    active_name = excluded.active_name,
    active_character_id = excluded.active_character_id,
    turn_order = excluded.turn_order,
    updated_at = excluded.updated_at;
end;
$$;

revoke all on function private.refresh_campaign_turn(uuid) from public;

create function private.encounters_refresh_turn()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.refresh_campaign_turn(new.id);
  return null;
end;
$$;

create trigger encounters_refresh_turn
  after insert or update on public.encounters
  for each row execute function private.encounters_refresh_turn();

create function private.encounter_combatants_refresh_turn()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.refresh_campaign_turn(old.encounter_id);
  else
    perform private.refresh_campaign_turn(new.encounter_id);
  end if;
  return null;
end;
$$;

create trigger encounter_combatants_refresh_turn
  after insert or update or delete on public.encounter_combatants
  for each row execute function private.encounter_combatants_refresh_turn();

create function private.campaigns_refresh_turn()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.refresh_campaign_turn(t.encounter_id)
  from public.campaign_turns t
  where t.campaign_id = new.id;
  return null;
end;
$$;

create trigger campaigns_refresh_turn
  after update of players_see_turn_order on public.campaigns
  for each row
  when (old.players_see_turn_order is distinct from new.players_see_turn_order)
  execute function private.campaigns_refresh_turn();

revoke all on function private.encounters_refresh_turn() from public;
revoke all on function private.encounter_combatants_refresh_turn() from public;
revoke all on function private.campaigns_refresh_turn() from public;

-- Encontros já abertos ganham o resumo agora.
select private.refresh_campaign_turn(e.id) from public.encounters e where e.status <> 'ended';

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.campaign_turns;
  end if;
end;
$$;
