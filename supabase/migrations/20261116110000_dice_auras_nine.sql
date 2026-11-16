-- =============================================================================
-- Nove auras novas (2026-11-16)
--
-- Deus do Sol, Aceleração do Tempo, Tarrasque, Vazio Roxo, Roda da Adaptação, Esfera de Captura,
-- Lorde Sombrio, Caderno Sombrio e Sete Esferas. Mesmas regras das demais.
-- =============================================================================

alter table public.user_dice drop constraint user_dice_aura_check;
alter table public.user_dice
  add constraint user_dice_aura_check check (
    aura is null
    or aura in (
      'blood', 'storm', 'frost', 'arcane', 'shadow', 'holy', 'gears', 'forest', 'fire', 'skeleton',
      'cosmic', 'tarot', 'glitch', 'ink', 'abyss', 'time', 'gold', 'frog',
      'vampire', 'bard', 'rainbow', 'poison', 'cat', 'meteor', 'party', 'wind', 'ritual', 'claw',
      'necro', 'pirate', 'samurai', 'kaiju', 'cyber', 'werewolf', 'siren', 'alchemy', 'ghost',
      'haki', 'cthulhu',
      'sungod', 'heaven', 'tarrasque', 'purple', 'wheel', 'capture', 'darklord', 'notebook', 'orbs'
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
      'haki', 'cthulhu',
      'sungod', 'heaven', 'tarrasque', 'purple', 'wheel', 'capture', 'darklord', 'notebook', 'orbs'
    )
  );
