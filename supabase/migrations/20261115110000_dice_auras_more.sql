-- =============================================================================
-- Mais auras dos dados e liberação para amigos (2026-11-15)
--
-- Pedido do responsável:
--   * auras novas: engrenagens/tecnologia, floresta, fogo e dragão;
--   * a conta de criador escolhe, para cada amigo, quais auras ele pode usar. O amigo passa a
--     poder gravar essas auras nos dados dele; ao retirar a liberação, a aura sai dos dados dele.
-- =============================================================================

alter table public.user_dice drop constraint user_dice_aura_check;
alter table public.user_dice
  add constraint user_dice_aura_check check (
    aura is null
    or aura in (
      'blood', 'storm', 'frost', 'arcane', 'shadow', 'holy', 'gears', 'forest', 'fire', 'dragon'
    )
  );

create table public.dice_aura_grants (
  user_id uuid not null references public.profiles (id) on delete cascade,
  aura text not null check (
    aura in (
      'blood', 'storm', 'frost', 'arcane', 'shadow', 'holy', 'gears', 'forest', 'fire', 'dragon'
    )
  ),
  granted_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, aura)
);
comment on table public.dice_aura_grants is
  'Auras dos dados liberadas por uma conta de criador para um amigo.';

alter table public.dice_aura_grants enable row level security;
grant select, delete on table public.dice_aura_grants to authenticated;
grant insert (user_id, aura) on table public.dice_aura_grants to authenticated;

create policy dice_aura_grants_select on public.dice_aura_grants
  for select to authenticated
  using (user_id = (select auth.uid()) or granted_by = (select auth.uid()));

create policy dice_aura_grants_insert on public.dice_aura_grants
  for insert to authenticated
  with check (
    granted_by = (select auth.uid())
    and private.is_creator((select auth.uid()))
    and private.are_friends(user_id)
  );

create policy dice_aura_grants_delete on public.dice_aura_grants
  for delete to authenticated
  using (granted_by = (select auth.uid()));

-- A conta pode usar a aura? Criador usa todas; os demais, só as liberadas.
create function private.can_use_aura(p_user_id uuid, p_aura text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_creator(p_user_id)
    or exists (
      select 1 from public.dice_aura_grants g where g.user_id = p_user_id and g.aura = p_aura
    );
$$;
revoke all on function private.can_use_aura(uuid, text) from public;
grant execute on function private.can_use_aura(uuid, text) to authenticated, service_role;

create or replace function private.user_dice_aura_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.aura is not null and not private.can_use_aura(new.owner_id, new.aura) then
    raise exception 'Esta aura não foi liberada para a sua conta.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function private.profile_dice_aura_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.preferences #>> '{dice,aura}' is not null
    and not private.can_use_aura(new.id, new.preferences #>> '{dice,aura}') then
    new.preferences := new.preferences #- '{dice,aura}';
  end if;
  return new;
end;
$$;

-- Ao retirar a liberação, a aura sai do dado padrão e dos dados salvos do amigo.
create function private.dice_aura_grant_revoked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_use_aura(old.user_id, old.aura) then
    update public.user_dice set aura = null where owner_id = old.user_id and aura = old.aura;
    update public.profiles
      set preferences = preferences #- '{dice,aura}'
      where id = old.user_id and preferences #>> '{dice,aura}' = old.aura;
  end if;
  return old;
end;
$$;

create trigger dice_aura_grant_revoked
  after delete on public.dice_aura_grants
  for each row execute function private.dice_aura_grant_revoked();
