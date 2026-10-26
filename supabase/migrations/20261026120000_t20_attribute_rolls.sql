-- =============================================================================
-- Tormenta20: rolagem de atributos sorteada no servidor e válida uma vez só.
--   * `t20_attribute_dice()` devolve os 24 dados (6 × 4d6) da rolagem pendente da pessoa; se
--     não houver, sorteia no banco (regra do livro: 4d6 descartando o menor; enquanto a soma dos
--     atributos for menor que 6, a menor rolagem é refeita) e guarda. Recarregar a página ou
--     chamar de novo devolve o mesmo resultado.
--   * `consume_t20_attribute_dice()` é chamada ao criar o personagem: a próxima criação rola de novo.
--   * A tabela não aceita escrita direta (só as funções), então não dá para apagar e rolar outra vez.
-- =============================================================================

create table public.t20_attribute_rolls (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  dice jsonb not null,
  created_at timestamptz not null default now()
);

comment on table public.t20_attribute_rolls is 'Rolagem de atributos (Tormenta20) pendente de cada pessoa, sorteada no servidor.';

alter table public.t20_attribute_rolls enable row level security;

create policy "Rolagem T20: a pessoa lê a própria"
  on public.t20_attribute_rolls for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.t20_attribute_rolls from anon, authenticated;
grant select on table public.t20_attribute_rolls to authenticated;

-- Valor do atributo pelo total do 4d6 (Tabela 1-2 do Jogo do Ano).
create function private.t20_attribute_from_total(p_total integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_total <= 7 then -2
    when p_total <= 9 then -1
    when p_total <= 11 then 0
    when p_total <= 13 then 1
    when p_total <= 15 then 2
    when p_total <= 17 then 3
    else 4
  end;
$$;

-- Total de um 4d6 descartando o menor.
create function private.t20_roll_total(p_dice jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce(sum(value::integer), 0) - coalesce(min(value::integer), 0)
  from jsonb_array_elements_text(p_dice) as value;
$$;

create function private.t20_roll_4d6()
returns jsonb
language sql
volatile
set search_path = ''
as $$
  select jsonb_build_array(
    1 + floor(random() * 6)::integer,
    1 + floor(random() * 6)::integer,
    1 + floor(random() * 6)::integer,
    1 + floor(random() * 6)::integer
  );
$$;

create function public.t20_attribute_dice()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_dice jsonb;
  v_rolls jsonb[];
  v_sum integer;
  v_lowest integer;
  v_lowest_total integer;
  v_guard integer := 0;
  i integer;
begin
  if v_uid is null then
    raise exception 'Sessão necessária.' using errcode = '42501';
  end if;
  select dice into v_dice from public.t20_attribute_rolls where user_id = v_uid;
  if v_dice is not null then
    return v_dice;
  end if;

  v_rolls := array[private.t20_roll_4d6(), private.t20_roll_4d6(), private.t20_roll_4d6(),
                   private.t20_roll_4d6(), private.t20_roll_4d6(), private.t20_roll_4d6()];
  loop
    v_sum := 0;
    v_lowest := 1;
    v_lowest_total := 99;
    for i in 1..6 loop
      v_sum := v_sum + private.t20_attribute_from_total(private.t20_roll_total(v_rolls[i]));
      if private.t20_roll_total(v_rolls[i]) < v_lowest_total then
        v_lowest_total := private.t20_roll_total(v_rolls[i]);
        v_lowest := i;
      end if;
    end loop;
    exit when v_sum >= 6 or v_guard >= 50;
    v_rolls[v_lowest] := private.t20_roll_4d6();
    v_guard := v_guard + 1;
  end loop;

  v_dice := to_jsonb(v_rolls);
  insert into public.t20_attribute_rolls (user_id, dice) values (v_uid, v_dice)
  on conflict (user_id) do nothing;
  -- Em corrida (duas abas), vale o que foi gravado primeiro.
  select dice into v_dice from public.t20_attribute_rolls where user_id = v_uid;
  return v_dice;
end;
$$;

create function public.consume_t20_attribute_dice()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.t20_attribute_rolls where user_id = (select auth.uid());
$$;

revoke all on function public.t20_attribute_dice() from public, anon;
revoke all on function public.consume_t20_attribute_dice() from public, anon;
grant execute on function public.t20_attribute_dice() to authenticated;
grant execute on function public.consume_t20_attribute_dice() to authenticated;
