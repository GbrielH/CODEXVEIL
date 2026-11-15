-- =============================================================================
-- Remove a aura "dragão" (2026-11-15)
--
-- Pedido do responsável: o efeito ficou ruim e sai do produto. Dados e liberações que a usavam
-- ficam sem aura, e a lista de auras aceitas volta a não incluí-la.
-- =============================================================================

update public.user_dice set aura = null where aura = 'dragon';
update public.profiles
  set preferences = preferences #- '{dice,aura}'
  where preferences #>> '{dice,aura}' = 'dragon';
delete from public.dice_aura_grants where aura = 'dragon';

alter table public.user_dice drop constraint user_dice_aura_check;
alter table public.user_dice
  add constraint user_dice_aura_check check (
    aura is null
    or aura in ('blood', 'storm', 'frost', 'arcane', 'shadow', 'holy', 'gears', 'forest', 'fire')
  );

alter table public.dice_aura_grants drop constraint dice_aura_grants_aura_check;
alter table public.dice_aura_grants
  add constraint dice_aura_grants_aura_check check (
    aura in ('blood', 'storm', 'frost', 'arcane', 'shadow', 'holy', 'gears', 'forest', 'fire')
  );
