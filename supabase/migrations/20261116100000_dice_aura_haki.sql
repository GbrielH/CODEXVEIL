-- =============================================================================
-- Auras "haki do rei" e "cthulhu", e remoção de "abelhas" (2026-11-16)
--
-- Pedido do responsável: novas auras (pressão esmagadora com raios pretos e vermelhos; Cthulhu
-- chegando e destruindo tudo); a aura
-- "abelhas" sai do produto (dados, preferências e liberações que a usavam ficam sem aura).
-- Mesmas regras das demais.
-- =============================================================================

update public.user_dice set aura = null where aura = 'bees';
update public.profiles
  set preferences = preferences #- '{dice,aura}'
  where preferences #>> '{dice,aura}' = 'bees';
delete from public.dice_aura_grants where aura = 'bees';

alter table public.user_dice drop constraint user_dice_aura_check;
alter table public.user_dice
  add constraint user_dice_aura_check check (
    aura is null
    or aura in (
      'blood', 'storm', 'frost', 'arcane', 'shadow', 'holy', 'gears', 'forest', 'fire', 'skeleton',
      'cosmic', 'tarot', 'glitch', 'ink', 'abyss', 'time', 'gold', 'frog',
      'vampire', 'bard', 'rainbow', 'poison', 'cat', 'meteor', 'party', 'wind', 'ritual', 'claw',
      'necro', 'pirate', 'samurai', 'kaiju', 'cyber', 'werewolf', 'siren', 'alchemy', 'ghost',
      'haki', 'cthulhu'
    )
  );

alter table public.dice_aura_grants drop constraint dice_aura_grants_aura_check;
alter table public.dice_aura_grants
  add constraint dice_aura_grants_aura_check check (
    aura in (
      'blood', 'storm', 'frost', 'arcane', 'shadow', 'holy', 'gears', 'forest', 'fire', 'skeleton',
      'cosmic', 'tarot', 'glitch', 'ink', 'abyss', 'time', 'gold', 'frog',
      'vampire', 'bard', 'rainbow', 'poison', 'cat', 'meteor', 'party', 'wind', 'ritual', 'claw',
      'necro', 'pirate', 'samurai', 'kaiju', 'cyber', 'werewolf', 'siren', 'alchemy', 'ghost',
      'haki', 'cthulhu'
    )
  );
