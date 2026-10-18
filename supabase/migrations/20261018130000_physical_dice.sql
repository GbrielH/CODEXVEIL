-- =============================================================================
-- Codexveil — 15 · Dados presenciais por sessão
--
-- * `sessions.physical_dice`: o mestre escolhe, em cada sessão, se a mesa rola dados físicos.
--   Nesse caso as ações do turno não rolam no app; o jogador pode anotar o resultado do dado.
-- * `campaign_session_state`: para a interface saber se a sessão começou e como se rola.
-- =============================================================================

alter table public.sessions add column physical_dice boolean not null default false;

grant insert (physical_dice) on table public.sessions to authenticated;
grant update (physical_dice) on table public.sessions to authenticated;

create function public.campaign_session_state(p_campaign_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'playing', coalesce(bool_or(true), false),
    'physicalDice', coalesce(bool_or(s.physical_dice), false)
  )
  from public.sessions s
  where private.is_campaign_member(p_campaign_id)
    and s.campaign_id = p_campaign_id
    and s.status = 'in_progress';
$$;

revoke all on function public.campaign_session_state(uuid) from public;
grant execute on function public.campaign_session_state(uuid) to authenticated;

-- Ações do turno: mesma regra de antes, mais o resultado do dado físico.
drop function public.perform_turn_action(uuid, text, text, uuid, boolean, text, text);

create function public.perform_turn_action(
  p_combatant_id uuid,
  p_kind text,
  p_label text,
  p_target_combatant_id uuid default null,
  p_grants_action boolean default false,
  p_roll_expression text default null,
  p_roll_mode text default 'normal',
  p_manual_total integer default null
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
  v_physical boolean;
  v_total integer;
  v_detail text;
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

  -- Sessão com dados presenciais: ninguém rola no app; o resultado do dado físico (opcional)
  -- é anotado na ação.
  select coalesce(bool_or(s.physical_dice), false) into v_physical
  from public.sessions s
  where s.campaign_id = v_encounter.campaign_id and s.status = 'in_progress';

  if v_physical then
    if p_manual_total is not null then
      if p_manual_total < -999 or p_manual_total > 9999 then
        raise exception 'Resultado inválido.' using errcode = '22023';
      end if;
      v_total := p_manual_total;
      v_detail := 'Dado físico';
    end if;
  elsif p_roll_expression is not null and btrim(p_roll_expression) <> '' then
    v_roll := public.roll_dice(
      v_encounter.campaign_id,
      p_roll_expression,
      v_label || coalesce(' → ' || v_target_name, ''),
      coalesce(p_roll_mode, 'normal'),
      case when v_combatant.is_hidden then 'gm' else 'members' end,
      v_combatant.character_id
    );
    v_total := v_roll.total;
  end if;

  insert into public.turn_actions (
    campaign_id, encounter_id, combatant_id, round, kind, label, grants_action, actor_name,
    target_combatant_id, target_name, target_character_id, roll_id, roll_total, roll_detail, hidden
  )
  values (
    v_encounter.campaign_id, v_encounter.id, p_combatant_id, v_encounter.round, p_kind, v_label,
    coalesce(p_grants_action, false), v_actor, p_target_combatant_id, v_target_name, v_target_character,
    v_roll.id, v_total, v_detail, v_combatant.is_hidden
  )
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.perform_turn_action(uuid, text, text, uuid, boolean, text, text, integer) from public, anon;
grant execute on function public.perform_turn_action(uuid, text, text, uuid, boolean, text, text, integer) to authenticated, service_role;

