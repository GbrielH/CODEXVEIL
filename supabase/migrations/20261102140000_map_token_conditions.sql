-- Condições nos tokens do mapa. O catálogo (nomes, ícones e descrições) fica no domínio; o banco
-- guarda só chave, duração opcional e nível opcional. Somente o mestre altera. Jogadores recebem
-- as condições apenas dos tokens que a política existente já permite ver.

create function private.are_valid_map_token_conditions(p_value jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_item jsonb;
  v_rounds numeric;
  v_level numeric;
begin
  if p_value is null or jsonb_typeof(p_value) <> 'array' or jsonb_array_length(p_value) > 32
     or pg_column_size(p_value) > 8192 then
    return false;
  end if;
  for v_item in select value from jsonb_array_elements(p_value)
  loop
    if jsonb_typeof(v_item) <> 'object'
       or jsonb_typeof(v_item -> 'key') <> 'string'
       or char_length(v_item ->> 'key') not between 1 and 40 then
      return false;
    end if;
    if v_item ? 'rounds' then
      if jsonb_typeof(v_item -> 'rounds') <> 'number' then return false; end if;
      v_rounds := (v_item ->> 'rounds')::numeric;
      if v_rounds <> trunc(v_rounds) or v_rounds not between 1 and 10000 then return false; end if;
    end if;
    if v_item ? 'level' then
      if jsonb_typeof(v_item -> 'level') <> 'number' then return false; end if;
      v_level := (v_item ->> 'level')::numeric;
      if v_level <> trunc(v_level) or v_level not between 1 and 6 then return false; end if;
    end if;
  end loop;
  return true;
exception when others then
  return false;
end;
$$;

revoke all on function private.are_valid_map_token_conditions(jsonb) from public;
grant execute on function private.are_valid_map_token_conditions(jsonb) to authenticated, service_role;

alter table public.map_tokens
  add column conditions jsonb not null default '[]'::jsonb
    check (private.are_valid_map_token_conditions(conditions));

grant update (conditions) on table public.map_tokens to authenticated;

-- Ao começar uma rodada nova, reduz a duração em todos os tokens da campanha. A condição que
-- chegaria a zero sai do array. O gatilho usa a rodada do encontro já existente.
create function private.tick_map_token_conditions_on_round()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delta integer;
begin
  if new.status <> 'active' or old.round < 1 or new.round <= old.round then return new; end if;
  v_delta := new.round - old.round;

  update public.map_tokens t
  set conditions = (
    select coalesce(jsonb_agg(
      case
        when item ? 'rounds' then jsonb_set(item, '{rounds}', to_jsonb((item ->> 'rounds')::integer - v_delta))
        else item
      end
      order by position
    ), '[]'::jsonb)
    from jsonb_array_elements(t.conditions) with ordinality as entry(item, position)
    where not (item ? 'rounds' and (item ->> 'rounds')::integer <= v_delta)
  )
  where t.campaign_id = new.campaign_id and t.conditions <> '[]'::jsonb;
  return new;
end;
$$;

revoke all on function private.tick_map_token_conditions_on_round() from public;

create trigger encounters_tick_map_token_conditions
  after update of round on public.encounters
  for each row execute function private.tick_map_token_conditions_on_round();
