-- =============================================================================
-- Auras dos dados, só para criadores (2026-11-15)
--
-- Pedido do responsável: escolher uma aura para o dado (sangue, tempestade, gelo, arcana, sombra,
-- sagrada), disponível apenas para contas de criador.
--   * `profiles.creator_features`: liga os recursos de criador. Ninguém liga a própria flag: as
--     colunas que o usuário pode alterar no perfil são liberadas uma a uma e esta não está entre
--     elas. Ela é ligada só por quem administra o banco (fora do Git, sem e-mail em arquivo).
--   * `user_dice.aura`: aura do dado salvo em "Meus dados"; recusada para quem não é criador.
--   * Preferências do perfil (`preferences.dice.aura`): sem a flag, a aura é removida ao salvar.
-- =============================================================================

alter table public.profiles add column creator_features boolean not null default false;
comment on column public.profiles.creator_features is
  'Recursos de criador (auras dos dados). Só administradores ligam; o usuário não altera.';

alter table public.user_dice
  add column aura text check (aura is null or aura in ('blood', 'storm', 'frost', 'arcane', 'shadow', 'holy'));
comment on column public.user_dice.aura is 'Aura do dado (somente contas de criador).';

grant insert (aura) on table public.user_dice to authenticated;
grant update (aura) on table public.user_dice to authenticated;

create function private.is_creator(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.creator_features from public.profiles p where p.id = p_user_id), false);
$$;

revoke all on function private.is_creator(uuid) from public;
grant execute on function private.is_creator(uuid) to authenticated, service_role;

create function private.user_dice_aura_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.aura is not null and not private.is_creator(new.owner_id) then
    raise exception 'Auras dos dados são exclusivas de contas de criador.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger user_dice_aura_guard
  before insert or update of aura on public.user_dice
  for each row execute function private.user_dice_aura_guard();

create function private.profile_dice_aura_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not new.creator_features and new.preferences #> '{dice,aura}' is not null then
    new.preferences := new.preferences #- '{dice,aura}';
  end if;
  return new;
end;
$$;

create trigger profiles_dice_aura_guard
  before insert or update of preferences on public.profiles
  for each row execute function private.profile_dice_aura_guard();
