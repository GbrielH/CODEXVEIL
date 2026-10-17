-- =============================================================================
-- Codexveil — 08 · Duração das condições
--
--   * character_conditions.rounds_remaining: rodadas restantes de uma condição do
--     personagem; null = dura até ser removida. A contagem diminui no fim de cada turno de
--     quem tem a condição (no combate, quando o mestre passa o turno).
--   * session_entities.condition_rounds: o mesmo para as instâncias da cena, como mapa
--     condição → rodadas restantes, sempre podado para as condições da lista `conditions`.
--   * tick_character_conditions / tick_session_entity_conditions: passam rodadas de forma
--     atômica e devolvem as condições que terminaram. O que acontece depois (Inconsciente
--     deixa a criatura Caída, por exemplo) é regra do sistema de RPG e fica no código.
--
-- As funções são SECURITY INVOKER: as mesmas policies de RLS continuam valendo.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Personagens
-- -----------------------------------------------------------------------------
alter table public.character_conditions
  add column rounds_remaining integer
    constraint character_conditions_rounds_range
      check (rounds_remaining is null or rounds_remaining between 1 and 10000);

comment on column public.character_conditions.rounds_remaining is
  'Rodadas restantes; null = até ser removida. Diminui no fim de cada turno de quem tem a condição.';

grant insert (rounds_remaining), update (rounds_remaining) on public.character_conditions to authenticated;

create function public.tick_character_conditions(p_character_id uuid, p_rounds integer default 1)
returns setof text
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  if p_rounds is null or p_rounds not between 1 and 10000 then
    raise exception 'Quantidade de rodadas inválida.' using errcode = '22023';
  end if;
  if not private.can_edit_character_play(p_character_id) then
    raise exception 'Personagem não encontrado.' using errcode = 'P0002';
  end if;

  return query
    with expired as (
      delete from public.character_conditions c
      where c.character_id = p_character_id
        and c.rounds_remaining is not null
        and c.rounds_remaining <= p_rounds
      returning c.key
    )
    select expired.key from expired;

  update public.character_conditions c
  set rounds_remaining = c.rounds_remaining - p_rounds
  where c.character_id = p_character_id
    and c.rounds_remaining is not null
    and c.rounds_remaining > p_rounds;
end;
$$;

comment on function public.tick_character_conditions(uuid, integer) is
  'Passa rodadas nas condições do personagem e devolve as chaves das que terminaram.';

-- -----------------------------------------------------------------------------
-- Instâncias da cena (NPCs e monstros)
-- -----------------------------------------------------------------------------
create function private.are_valid_condition_rounds(p_rounds jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_rounds is null or jsonb_typeof(p_rounds) <> 'object' then false
    else (
      select count(*) <= 20
        and coalesce(bool_and(
          case
            when char_length(e.key) not between 1 and 40 then false
            when jsonb_typeof(e.value) <> 'number' then false
            else (e.value)::numeric between 1 and 10000
              and (e.value)::numeric = trunc((e.value)::numeric)
          end
        ), true)
      from jsonb_each(p_rounds) e
    )
  end;
$$;

grant execute on function private.are_valid_condition_rounds(jsonb) to authenticated, service_role;

alter table public.session_entities
  add column condition_rounds jsonb not null default '{}'::jsonb
    constraint session_entities_condition_rounds_valid
      check (private.are_valid_condition_rounds(condition_rounds));

comment on column public.session_entities.condition_rounds is
  'Rodadas restantes por condição (chave da lista conditions → inteiro de 1 a 10000). Condições fora do mapa duram até serem removidas.';

-- O mapa só guarda condições presentes na lista: remover uma condição remove a duração dela.
create function private.session_entities_prune_condition_rounds()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Valores que não são objeto ficam como estão: a restrição de verificação os recusa.
  if jsonb_typeof(new.condition_rounds) = 'object' then
    new.condition_rounds := coalesce(
      (
        select jsonb_object_agg(e.key, e.value)
        from jsonb_each(new.condition_rounds) e
        where e.key = any(new.conditions)
      ),
      '{}'::jsonb
    );
  end if;
  return new;
end;
$$;

create trigger session_entities_prune_condition_rounds
  before insert or update of conditions, condition_rounds on public.session_entities
  for each row execute function private.session_entities_prune_condition_rounds();

grant insert (condition_rounds), update (condition_rounds) on public.session_entities to authenticated;

create function public.tick_session_entity_conditions(p_entity_id uuid, p_rounds integer default 1)
returns setof text
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_rounds jsonb;
  v_expired text[];
  v_next jsonb;
  v_count integer;
begin
  if p_rounds is null or p_rounds not between 1 and 10000 then
    raise exception 'Quantidade de rodadas inválida.' using errcode = '22023';
  end if;

  select e.condition_rounds into v_rounds
  from public.session_entities e
  where e.id = p_entity_id
  for update;
  if not found then
    raise exception 'Entidade não encontrada.' using errcode = 'P0002';
  end if;
  if v_rounds = '{}'::jsonb then
    return;
  end if;

  select coalesce(array_agg(r.key), '{}') into v_expired
  from jsonb_each(v_rounds) r
  where (r.value)::integer <= p_rounds;

  select coalesce(jsonb_object_agg(r.key, (r.value)::integer - p_rounds), '{}'::jsonb) into v_next
  from jsonb_each(v_rounds) r
  where (r.value)::integer > p_rounds;

  update public.session_entities e
  set conditions = array(select c from unnest(e.conditions) c where not (c = any(v_expired))),
      condition_rounds = v_next
  where e.id = p_entity_id;
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'Sem permissão para alterar a cena.' using errcode = '42501';
  end if;

  return query select unnest(v_expired);
end;
$$;

comment on function public.tick_session_entity_conditions(uuid, integer) is
  'Passa rodadas nas condições de uma instância da cena e devolve as chaves das que terminaram.';

revoke all on function public.tick_character_conditions(uuid, integer) from public, anon;
revoke all on function public.tick_session_entity_conditions(uuid, integer) from public, anon;
grant execute on function public.tick_character_conditions(uuid, integer) to authenticated;
grant execute on function public.tick_session_entity_conditions(uuid, integer) to authenticated;
