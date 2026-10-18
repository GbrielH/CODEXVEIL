-- =============================================================================
-- Codexveil — 14 · Jogo em turnos: ações registradas, sessão iniciada e regras da mesa
--
-- * Ações dos jogadores (e rolagens) só valem com a sessão em andamento: o mestre inicia e
--   encerra a sessão; fora dela, `roll_dice` e `perform_turn_action` recusam jogadores.
-- * `turn_actions`: cada ação feita no turno (ação, ação bônus, reação, movimento ou livre),
--   com alvo e rolagem, em ordem. O banco controla o orçamento do turno: 1 ação (mais as
--   extras concedidas, ex.: Surto de Ação), 1 ação bônus, 1 movimento e 1 reação por rodada.
-- * `end_turn`: o jogador da vez (ou o mestre) encerra o turno; o próximo da ordem assume.
-- * Um personagem por jogador em cada campanha; uma anotação fixada por pessoa.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Sessão em andamento
-- -----------------------------------------------------------------------------
create function private.has_session_in_progress(p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.sessions s
    where s.campaign_id = p_campaign_id and s.status = 'in_progress'
  );
$$;

revoke all on function private.has_session_in_progress(uuid) from public;
grant execute on function private.has_session_in_progress(uuid) to authenticated, service_role;

-- Rolagens de jogadores só com a sessão em andamento (o mestre rola quando quiser).
create function private.require_session_for_player(p_campaign_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_campaign_gm(p_campaign_id) and not private.has_session_in_progress(p_campaign_id) then
    raise exception 'A sessão ainda não começou: o mestre precisa iniciá-la.' using errcode = 'CVSES';
  end if;
end;
$$;

revoke all on function private.require_session_for_player(uuid) from public;
grant execute on function private.require_session_for_player(uuid) to authenticated, service_role;

create function private.dice_rolls_require_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is not null and not exists (
    select 1 from public.campaign_members m
    where m.campaign_id = new.campaign_id and m.user_id = new.user_id and m.role = 'gm'
  ) and not private.has_session_in_progress(new.campaign_id) then
    raise exception 'A sessão ainda não começou: o mestre precisa iniciá-la.' using errcode = 'CVSES';
  end if;
  return new;
end;
$$;

create trigger dice_rolls_require_session
  before insert on public.dice_rolls
  for each row execute function private.dice_rolls_require_session();

revoke all on function private.dice_rolls_require_session() from public;

-- Para a interface avisar os jogadores: a sessão em andamento pode não estar publicada (e,
-- assim, invisível para eles), então a resposta vem desta função, só para membros.
create function public.campaign_session_in_progress(p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_campaign_member(p_campaign_id) and private.has_session_in_progress(p_campaign_id);
$$;

revoke all on function public.campaign_session_in_progress(uuid) from public;
grant execute on function public.campaign_session_in_progress(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Ações do turno
-- -----------------------------------------------------------------------------
create table public.turn_actions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  encounter_id uuid not null references public.encounters (id) on delete cascade,
  combatant_id uuid not null references public.encounter_combatants (id) on delete cascade,
  round integer not null,
  kind text not null check (kind in ('action', 'bonus_action', 'reaction', 'movement', 'free')),
  label text not null check (char_length(label) between 1 and 120 and private.is_single_line(label)),
  -- Concede ação extra neste turno (ex.: Surto de Ação).
  grants_action boolean not null default false,
  actor_name text not null,
  target_combatant_id uuid references public.encounter_combatants (id) on delete set null,
  target_name text,
  target_character_id uuid references public.characters (id) on delete set null,
  roll_id uuid references public.dice_rolls (id) on delete set null,
  roll_total integer,
  roll_detail text check (roll_detail is null or char_length(roll_detail) <= 300),
  hidden boolean not null default false,
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.turn_actions is
  'Ações feitas nos turnos, em ordem (gravadas por perform_turn_action). Ocultas: só mestres.';

create index turn_actions_campaign_idx on public.turn_actions (campaign_id, created_at desc);
create index turn_actions_combatant_idx on public.turn_actions (combatant_id, round);

alter table public.turn_actions enable row level security;

create policy "A mesa vê as ações; as de participantes ocultos só o mestre"
  on public.turn_actions for select to authenticated
  using (private.is_campaign_gm(campaign_id) or (not hidden and private.is_campaign_member(campaign_id)));
create policy "Mestres apagam ações"
  on public.turn_actions for delete to authenticated
  using (private.can_manage_campaign(campaign_id));

revoke all on table public.turn_actions from anon, authenticated;
grant select, delete on table public.turn_actions to authenticated;
grant all on table public.turn_actions to service_role;

-- Quem pode agir pelo participante: o mestre (qualquer um) ou o dono do personagem.
create function private.can_act_for_combatant(p_combatant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.encounter_combatants ec
    left join public.characters ch on ch.id = ec.character_id
    where ec.id = p_combatant_id
      and (private.is_campaign_gm(ec.campaign_id) or ch.owner_id = (select auth.uid()))
  );
$$;

revoke all on function private.can_act_for_combatant(uuid) from public;
grant execute on function private.can_act_for_combatant(uuid) to authenticated, service_role;

create function public.perform_turn_action(
  p_combatant_id uuid,
  p_kind text,
  p_label text,
  p_target_combatant_id uuid default null,
  p_grants_action boolean default false,
  p_roll_expression text default null,
  p_roll_mode text default 'normal'
)
returns public.turn_actions
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_combatant public.encounter_combatants%rowtype;
  v_encounter public.encounters%rowtype;
  v_actor text;
  v_target_name text;
  v_target_character uuid;
  v_target_hidden boolean;
  v_used integer;
  v_extra integer;
  v_roll public.dice_rolls;
  v_row public.turn_actions;
  v_label text := btrim(left(btrim(regexp_replace(coalesce(p_label, ''), '[[:cntrl:]]', ' ', 'g')), 120));
begin
  if (select auth.uid()) is null then
    raise exception 'Entre na sua conta.' using errcode = '42501';
  end if;
  if coalesce(p_kind, '') not in ('action', 'bonus_action', 'reaction', 'movement', 'free') or v_label = '' then
    raise exception 'Ação inválida.' using errcode = '22023';
  end if;

  select * into v_combatant from public.encounter_combatants c where c.id = p_combatant_id;
  if not found or not private.can_act_for_combatant(p_combatant_id) then
    raise exception 'Você não pode agir por este participante.' using errcode = '42501';
  end if;
  select * into v_encounter from public.encounters e where e.id = v_combatant.encounter_id;
  if v_encounter.status <> 'active' then
    raise exception 'Os turnos ainda não começaram.' using errcode = 'CVTRN';
  end if;
  perform private.require_session_for_player(v_encounter.campaign_id);

  -- Fora da própria vez, só reações.
  if p_kind <> 'reaction' and v_encounter.active_combatant_id is distinct from p_combatant_id then
    raise exception 'Não é a vez deste participante.' using errcode = 'CVTRN';
  end if;

  -- Orçamento do turno (por rodada).
  select count(*) into v_used
  from public.turn_actions a
  where a.combatant_id = p_combatant_id and a.round = v_encounter.round and a.kind = p_kind;
  if p_kind = 'action' then
    select count(*) into v_extra
    from public.turn_actions a
    where a.combatant_id = p_combatant_id and a.round = v_encounter.round and a.grants_action;
    if v_used >= 1 + v_extra then
      raise exception 'A ação deste turno já foi usada.' using errcode = 'CVTRN';
    end if;
  elsif p_kind in ('bonus_action', 'reaction', 'movement') and v_used >= 1 then
    raise exception '% deste turno já foi usado(a).',
      case p_kind when 'bonus_action' then 'A ação bônus' when 'reaction' then 'A reação' else 'O movimento' end
      using errcode = 'CVTRN';
  end if;

  select coalesce(ch.name, se.name, 'Participante') into v_actor
  from public.encounter_combatants ec
  left join public.characters ch on ch.id = ec.character_id
  left join public.session_entities se on se.id = ec.session_entity_id
  where ec.id = p_combatant_id;

  if p_target_combatant_id is not null then
    select coalesce(ch.name, se.name), ec.character_id, ec.is_hidden
    into v_target_name, v_target_character, v_target_hidden
    from public.encounter_combatants ec
    left join public.characters ch on ch.id = ec.character_id
    left join public.session_entities se on se.id = ec.session_entity_id
    where ec.id = p_target_combatant_id and ec.encounter_id = v_combatant.encounter_id;
    if v_target_name is null then
      raise exception 'Alvo inválido.' using errcode = '22023';
    end if;
  end if;

  if p_roll_expression is not null and btrim(p_roll_expression) <> '' then
    v_roll := public.roll_dice(
      v_encounter.campaign_id,
      p_roll_expression,
      v_label || coalesce(' → ' || v_target_name, ''),
      coalesce(p_roll_mode, 'normal'),
      case when v_combatant.is_hidden then 'gm' else 'members' end,
      v_combatant.character_id
    );
  end if;

  insert into public.turn_actions (
    campaign_id, encounter_id, combatant_id, round, kind, label, grants_action, actor_name,
    target_combatant_id, target_name, target_character_id, roll_id, roll_total, hidden
  )
  values (
    v_encounter.campaign_id, v_encounter.id, p_combatant_id, v_encounter.round, p_kind, v_label,
    coalesce(p_grants_action, false), v_actor, p_target_combatant_id, v_target_name, v_target_character,
    v_roll.id, v_roll.total, v_combatant.is_hidden
  )
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.perform_turn_action(uuid, text, text, uuid, boolean, text, text) from public, anon;
grant execute on function public.perform_turn_action(uuid, text, text, uuid, boolean, text, text) to authenticated, service_role;

-- Encerra o turno do participante da vez: o jogador dono ou o mestre. Devolve o novo estado.
create function public.end_turn(p_encounter_id uuid)
returns table (new_round integer, next_combatant_id uuid, ended_combatant_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_encounter public.encounters%rowtype;
  v_order uuid[];
  v_index integer;
  v_next uuid;
  v_round integer;
  v_step integer;
  v_len integer;
  v_candidate uuid;
begin
  select * into v_encounter from public.encounters e where e.id = p_encounter_id for update;
  if not found or v_encounter.status <> 'active' or v_encounter.active_combatant_id is null then
    raise exception 'Não há turno em andamento.' using errcode = 'CVTRN';
  end if;
  if not private.can_act_for_combatant(v_encounter.active_combatant_id) then
    raise exception 'Só o jogador da vez ou o mestre encerram o turno.' using errcode = '42501';
  end if;
  perform private.require_session_for_player(v_encounter.campaign_id);

  select array_agg(r.id order by r.position) into v_order
  from (
    select ec.id, row_number() over (
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

  v_len := coalesce(array_length(v_order, 1), 0);
  v_index := coalesce(array_position(v_order, v_encounter.active_combatant_id), 0);
  v_round := v_encounter.round;
  v_next := null;
  for v_step in 1..v_len loop
    v_candidate := v_order[((v_index - 1 + v_step) % v_len) + 1];
    if not (select ec.is_defeated from public.encounter_combatants ec where ec.id = v_candidate) then
      v_next := v_candidate;
      if ((v_index - 1 + v_step) % v_len) + 1 <= v_index then
        v_round := v_round + 1;
      end if;
      exit;
    end if;
  end loop;

  update public.encounters e
  set active_combatant_id = v_next, round = v_round
  where e.id = p_encounter_id;

  -- O próximo recupera ação, ação bônus, movimento e reação.
  update public.encounter_combatants ec set turn_state = '{}'::jsonb where ec.id = v_next;

  return query select v_round, v_next, v_encounter.active_combatant_id;
end;
$$;

revoke all on function public.end_turn(uuid) from public, anon;
grant execute on function public.end_turn(uuid) to authenticated, service_role;

-- Jogadores também precisam ver os participantes do encontro para escolher alvos: a lista
-- pública (sem ocultos) já está em campaign_turns.turn_order (ids dos participantes).

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.turn_actions;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Um personagem por jogador em cada campanha
-- -----------------------------------------------------------------------------
-- Personagens repetidos na mesma campanha (anteriores a esta regra): fica o mais recente.
update public.characters c
set campaign_id = null
where c.campaign_id is not null
  and exists (
    select 1 from public.characters newer
    where newer.campaign_id = c.campaign_id
      and newer.owner_id = c.owner_id
      and (newer.created_at, newer.id) > (c.created_at, c.id)
  );

create unique index characters_one_per_player_idx
  on public.characters (campaign_id, owner_id)
  where campaign_id is not null;

-- -----------------------------------------------------------------------------
-- Uma anotação fixada por pessoa em cada campanha
-- -----------------------------------------------------------------------------
update public.campaign_notes n
set is_pinned = false
where n.is_pinned
  and exists (
    select 1 from public.campaign_notes newer
    where newer.campaign_id = n.campaign_id
      and newer.author_id = n.author_id
      and newer.is_pinned
      and (newer.updated_at, newer.id) > (n.updated_at, n.id)
  );

create unique index campaign_notes_one_pinned_idx
  on public.campaign_notes (campaign_id, author_id)
  where is_pinned;
