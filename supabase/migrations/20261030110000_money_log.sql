-- =============================================================================
-- Histórico de moedas (2026-10-30): cada gasto ou recebimento de dinheiro do personagem
-- (tibares no Tormenta20; PC/PP/PE/PO/PL no D&D) fica registrado com valor e descrição.
--   * `character_money_log`: quem vê a ficha vê o histórico.
--   * `record_money(personagem, moeda, valor, descrição)`: altera o saldo e registra na mesma
--     transação, com as permissões de quem joga a ficha (vida, recursos e inventário).
-- =============================================================================

create table public.character_money_log (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters (id) on delete cascade,
  -- Chave da trilha de moeda (`tibar`, `currency_gp`…).
  resource_key text not null check (char_length(resource_key) between 1 and 40),
  -- Positivo = recebeu; negativo = gastou.
  amount integer not null check (amount <> 0 and abs(amount) <= 100000000),
  balance integer not null,
  description text not null check (char_length(btrim(description)) between 1 and 200),
  author_id uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index character_money_log_character_idx on public.character_money_log (character_id, created_at desc);

comment on table public.character_money_log is 'Gastos e recebimentos de moeda do personagem, com descrição.';

alter table public.character_money_log enable row level security;

create policy "Histórico de moedas: quem vê a ficha lê"
  on public.character_money_log for select to authenticated
  using (private.can_view_character(character_id));

revoke all on table public.character_money_log from anon, authenticated;
grant select on table public.character_money_log to authenticated;
grant all on table public.character_money_log to service_role;

-- Gasta (valor negativo) ou recebe (positivo) e registra. Recusa gastar mais do que tem.
create function public.record_money(
  p_character_id uuid,
  p_resource_key text,
  p_amount integer,
  p_description text
)
returns public.character_resources
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.character_resources;
begin
  if not private.can_edit_character_play(p_character_id) then
    raise exception 'Você não pode alterar este personagem.' using errcode = '42501';
  end if;
  if p_amount is null or p_amount = 0 or abs(p_amount) > 100000000 then
    raise exception 'Valor inválido.' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_description, ''))) = 0 then
    raise exception 'Descreva o gasto ou o recebimento.' using errcode = '22023';
  end if;

  select * into v_row from public.character_resources r
  where r.character_id = p_character_id and r.key = p_resource_key
  for update;
  if not found then
    raise exception 'Moeda não encontrada na ficha.' using errcode = 'P0002';
  end if;
  if v_row.current + p_amount < 0 then
    raise exception 'Saldo insuficiente.' using errcode = '22023';
  end if;

  update public.character_resources
  set current = current + p_amount
  where id = v_row.id
  returning * into v_row;

  insert into public.character_money_log (character_id, resource_key, amount, balance, description, author_id)
  values (p_character_id, p_resource_key, p_amount, v_row.current, left(btrim(p_description), 200), auth.uid());

  return v_row;
end;
$$;

revoke all on function public.record_money(uuid, text, integer, text) from public, anon;
grant execute on function public.record_money(uuid, text, integer, text) to authenticated;
