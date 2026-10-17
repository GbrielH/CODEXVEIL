-- =============================================================================
-- Codexveil — 11 · Rolagens de dados
--
-- Os dados são rolados NO BANCO (função roll_dice, SECURITY DEFINER): o cliente informa a
-- expressão ("1d20+5", "2d6+3") e o servidor sorteia, soma e grava. Ninguém grava um
-- resultado escolhido, nem altera uma rolagem depois (não há policy de insert/update).
--
-- Visibilidade: 'members' aparece para toda a mesa; 'gm' (rolagem secreta) só para quem rolou
-- e para os mestres. As rolagens chegam ao mural do mestre em tempo real (Realtime + RLS).
--
-- Espaço: cada campanha guarda só as 200 rolagens mais recentes (as antigas são apagadas a
-- cada nova rolagem). Veja docs/ARMAZENAMENTO.md.
-- =============================================================================

create table public.dice_rolls (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  character_id uuid references public.characters (id) on delete set null,
  -- Nome mostrado no mural (do personagem ou da conta), gravado no momento da rolagem.
  roller_name text not null check (char_length(roller_name) between 1 and 120),
  label text not null default '' check (char_length(label) <= 80 and private.is_single_line(label)),
  expression text not null check (char_length(expression) between 1 and 60),
  mode text not null default 'normal' check (mode in ('normal', 'advantage', 'disadvantage')),
  -- [{sign, count, sides, values: [...], kept: [...]}] — `kept` difere de `values` na vantagem.
  dice jsonb not null check (jsonb_typeof(dice) = 'array' and pg_column_size(dice) <= 16384),
  modifier integer not null default 0,
  total integer not null,
  visibility public.content_visibility not null default 'members'
    check (visibility in ('members', 'gm')),
  created_at timestamptz not null default now()
);

comment on table public.dice_rolls is
  'Rolagens feitas no servidor (roll_dice). Somente leitura para os clientes; 200 por campanha.';

create index dice_rolls_campaign_idx on public.dice_rolls (campaign_id, created_at desc);
create index dice_rolls_user_idx on public.dice_rolls (user_id);
create index dice_rolls_character_idx on public.dice_rolls (character_id) where character_id is not null;

alter table public.dice_rolls enable row level security;

create policy "A mesa vê as rolagens abertas; o mestre e quem rolou veem as secretas"
  on public.dice_rolls for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_campaign_gm(campaign_id)
    or (visibility = 'members' and private.is_campaign_member(campaign_id))
  );
create policy "Mestres limpam o mural de rolagens"
  on public.dice_rolls for delete to authenticated
  using (private.can_manage_campaign(campaign_id));

revoke all on table public.dice_rolls from anon, authenticated;
grant select, delete on table public.dice_rolls to authenticated;
grant all on table public.dice_rolls to service_role;

-- Rola os dados de uma expressão como "1d20+5", "2d6+1d4+3" ou "d100".
-- Vantagem/desvantagem vale para o primeiro 1d20 da expressão (rola dois e fica com o
-- maior/menor). Limites: 10 termos, 100 dados, faces entre 2 e 1000.
create function public.roll_dice(
  p_campaign_id uuid,
  p_expression text,
  p_label text default '',
  p_mode text default 'normal',
  p_visibility text default 'members',
  p_character_id uuid default null
)
returns public.dice_rolls
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_expression text := lower(regexp_replace(coalesce(p_expression, ''), '\s', '', 'g'));
  v_label text := btrim(left(btrim(regexp_replace(coalesce(p_label, ''), '[[:cntrl:]]', ' ', 'g')), 80));
  v_term text[];
  v_sign integer;
  v_count integer;
  v_sides integer;
  v_values integer[];
  v_kept integer[];
  v_dice jsonb := '[]'::jsonb;
  v_modifier integer := 0;
  v_total integer := 0;
  v_dice_count integer := 0;
  v_terms integer := 0;
  v_mode text := 'normal';
  v_name text;
  v_first integer;
  v_second integer;
  v_row public.dice_rolls;
begin
  if v_uid is null then
    raise exception 'Entre na sua conta para rolar dados.' using errcode = '42501';
  end if;
  if not private.can_participate(p_campaign_id) then
    raise exception 'Você não participa desta campanha, ou ela está arquivada.' using errcode = '42501';
  end if;
  if coalesce(p_mode, '') not in ('normal', 'advantage', 'disadvantage')
     or coalesce(p_visibility, '') not in ('members', 'gm') then
    raise exception 'Modo ou visibilidade da rolagem inválidos.' using errcode = '22023';
  end if;
  if char_length(v_expression) not between 1 and 60
     or v_expression !~ '^[+-]?(\d{0,3}d\d{1,4}|\d{1,5})([+-](\d{0,3}d\d{1,4}|\d{1,5}))*$' then
    raise exception 'Expressão de dados inválida. Use algo como 1d20+5 ou 2d6+3.' using errcode = '22023';
  end if;

  if p_character_id is not null then
    select c.name into v_name
    from public.characters c
    where c.id = p_character_id
      and c.campaign_id = p_campaign_id
      and (c.owner_id = v_uid or private.is_campaign_gm(p_campaign_id));
    if v_name is null then
      raise exception 'Este personagem não pode rolar nesta campanha.' using errcode = '42501';
    end if;
  else
    select p.display_name into v_name from public.profiles p where p.id = v_uid;
  end if;

  for v_term in select regexp_matches(v_expression, '([+-]?)(\d*d\d+|\d+)', 'g') loop
    v_terms := v_terms + 1;
    if v_terms > 10 then
      raise exception 'Use no máximo 10 termos na expressão.' using errcode = '22023';
    end if;
    v_sign := case when v_term[1] = '-' then -1 else 1 end;
    if position('d' in v_term[2]) = 0 then
      v_modifier := v_modifier + v_sign * v_term[2]::integer;
      continue;
    end if;
    v_count := coalesce(nullif(split_part(v_term[2], 'd', 1), '')::integer, 1);
    v_sides := split_part(v_term[2], 'd', 2)::integer;
    if v_count not between 1 and 100 or v_sides not between 2 and 1000 then
      raise exception 'Use de 1 a 100 dados, com 2 a 1000 faces.' using errcode = '22023';
    end if;
    v_dice_count := v_dice_count + v_count;
    if v_dice_count > 100 then
      raise exception 'Use no máximo 100 dados por rolagem.' using errcode = '22023';
    end if;
    v_values := array[]::integer[];
    for v_index in 1..v_count loop
      v_values := v_values || (1 + floor(random() * v_sides))::integer;
    end loop;
    v_kept := v_values;
    if p_mode <> 'normal' and v_mode = 'normal' and v_count = 1 and v_sides = 20 and v_sign = 1 then
      v_first := v_values[1];
      v_second := (1 + floor(random() * 20))::integer;
      v_values := array[v_first, v_second];
      v_kept := array[case when p_mode = 'advantage' then greatest(v_first, v_second) else least(v_first, v_second) end];
      v_mode := p_mode;
    end if;
    v_total := v_total + v_sign * (select coalesce(sum(value), 0)::integer from unnest(v_kept) as value);
    v_dice := v_dice || jsonb_build_array(jsonb_build_object(
      'sign', v_sign,
      'count', v_count,
      'sides', v_sides,
      'values', to_jsonb(v_values),
      'kept', to_jsonb(v_kept)
    ));
  end loop;

  if v_dice_count = 0 then
    raise exception 'Inclua pelo menos um dado na expressão (ex.: 1d20).' using errcode = '22023';
  end if;

  insert into public.dice_rolls (
    campaign_id, user_id, character_id, roller_name, label, expression, mode, dice, modifier, total, visibility
  )
  values (
    p_campaign_id, v_uid, p_character_id, coalesce(nullif(v_name, ''), 'Participante'), v_label, v_expression,
    v_mode, v_dice, v_modifier, v_total + v_modifier, p_visibility::public.content_visibility
  )
  returning * into v_row;

  -- Guarda só as 200 rolagens mais recentes da campanha.
  delete from public.dice_rolls d
  where d.id in (
    select r.id
    from public.dice_rolls r
    where r.campaign_id = p_campaign_id
    order by r.created_at desc, r.id desc
    offset 200
  );

  return v_row;
end;
$$;

revoke all on function public.roll_dice(uuid, text, text, text, text, uuid) from public, anon;
grant execute on function public.roll_dice(uuid, text, text, text, text, uuid) to authenticated, service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.dice_rolls;
  end if;
end;
$$;
