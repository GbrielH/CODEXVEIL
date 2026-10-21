-- Grade da sessão, passo 1 (docs/GRID.md): o tamanho da criatura vira um dado próprio, lido pelo
-- mapa para o tamanho do token (Miúdo/Pequeno/Médio = 1×1, Grande = 2×2, Enorme = 3×3,
-- Imenso/Colossal = 4×4). Fica em `creatures` (perfil), não no bloco secreto do mestre.

alter table public.creatures
  add column size text not null default 'medium'
  check (size in ('tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'));

comment on column public.creatures.size is
  'Porte da criatura (tamanho do token na grade): tiny, small, medium, large, huge, gargantuan.';

-- Registros existentes: D&D lê o porte do bloco de estatísticas; Tormenta20, do texto de tipo
-- ("Monstro Grande", "Humanoide (orc) Médio").
update public.creatures c
  set size = g.stats ->> 'size'
  from public.creature_gm_data g
  join public.campaigns ca on ca.id = g.campaign_id
  where g.creature_id = c.id
    and ca.system_id = 'dnd5e'
    and g.stats ->> 'size' in ('tiny', 'small', 'medium', 'large', 'huge', 'gargantuan');

update public.creatures c
  set size = case
    when lower(g.stats ->> 'type') ~ 'colossal' then 'gargantuan'
    when lower(g.stats ->> 'type') ~ 'enorme' then 'huge'
    when lower(g.stats ->> 'type') ~ 'grande' then 'large'
    when lower(g.stats ->> 'type') ~ 'pequeno' then 'small'
    when lower(g.stats ->> 'type') ~ 'min[uú]sculo' then 'tiny'
    else 'medium'
  end
  from public.creature_gm_data g
  join public.campaigns ca on ca.id = g.campaign_id
  where g.creature_id = c.id
    and ca.system_id = 'tormenta20';

-- Nova criatura: o bloco do mestre já nasce com o porte escolhido (o D&D usa `stats.size`).
create or replace function private.creatures_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.creature_gm_data (creature_id, campaign_id, stats)
    values (new.id, new.campaign_id, jsonb_build_object('size', new.size));
  return new;
end;
$$;

-- D&D: mudar o porte no bloco de estatísticas atualiza o porte da criatura (e o token).
create function private.creature_gm_data_sync_size()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.stats ->> 'size' in ('tiny', 'small', 'medium', 'large', 'huge', 'gargantuan')
    and new.stats ->> 'size' is distinct from old.stats ->> 'size' then
    update public.creatures set size = new.stats ->> 'size'
      where id = new.creature_id and size is distinct from new.stats ->> 'size';
  end if;
  return new;
end;
$$;

revoke all on function private.creature_gm_data_sync_size() from public;

create trigger creature_gm_data_sync_size
  after update of stats on public.creature_gm_data
  for each row execute function private.creature_gm_data_sync_size();
