-- =============================================================================
-- Aura "garras" (2026-11-15)
--
-- Pedido de um amigo do responsável: corte verde de garras de urso no crítico, com rugido.
-- Mesmas regras das demais.
-- =============================================================================

alter table public.user_dice drop constraint user_dice_aura_check;
alter table public.user_dice
  add constraint user_dice_aura_check check (
    aura is null
    or aura in (
      'blood', 'storm', 'frost', 'arcane', 'shadow', 'holy', 'gears', 'forest', 'fire', 'skeleton',
      'cosmic', 'tarot', 'glitch', 'ink', 'abyss', 'time', 'gold', 'frog',
      'vampire', 'bard', 'rainbow', 'poison', 'cat', 'meteor', 'party', 'wind', 'ritual', 'claw'
    )
  );

alter table public.dice_aura_grants drop constraint dice_aura_grants_aura_check;
alter table public.dice_aura_grants
  add constraint dice_aura_grants_aura_check check (
    aura in (
      'blood', 'storm', 'frost', 'arcane', 'shadow', 'holy', 'gears', 'forest', 'fire', 'skeleton',
      'cosmic', 'tarot', 'glitch', 'ink', 'abyss', 'time', 'gold', 'frog',
      'vampire', 'bard', 'rainbow', 'poison', 'cat', 'meteor', 'party', 'wind', 'ritual', 'claw'
    )
  );
