-- Tema Foxy (2026-11-22): o crítico é um vídeo com o fundo verde removido; sem efeito de falha.

alter table public.user_dice drop constraint user_dice_aura_check;
alter table public.user_dice
  add constraint user_dice_aura_check check (
    aura is null or aura in (
      'blood', 'storm', 'frost', 'arcane', 'shadow', 'holy', 'gears', 'forest', 'fire', 'skeleton',
      'cosmic', 'tarot', 'glitch', 'ink', 'abyss', 'time', 'gold', 'frog', 'vampire', 'bard',
      'rainbow', 'poison', 'cat', 'meteor', 'party', 'wind', 'ritual', 'claw', 'necro', 'pirate',
      'samurai', 'kaiju', 'cyber', 'werewolf', 'siren', 'alchemy', 'ghost', 'haki', 'cthulhu',
      'heaven', 'purple', 'wheel', 'capture', 'darklord', 'notebook', 'orbs', 'sakura', 'phoenix',
      'kitsune', 'mirror', 'aurora', 'zombie', 'sungod', 'tarrasque', 'sans', 'hollow', 'doom',
      'zoro', 'blackhole', 'fullmetal', 'sahur', 'spider', 'akatsuki', 'hisoka', 'valorant',
      'league', 'mario', 'foxy'
    )
  );

alter table public.dice_aura_grants drop constraint dice_aura_grants_aura_check;
alter table public.dice_aura_grants
  add constraint dice_aura_grants_aura_check check (
    aura in (
      'blood', 'storm', 'frost', 'arcane', 'shadow', 'holy', 'gears', 'forest', 'fire', 'skeleton',
      'cosmic', 'tarot', 'glitch', 'ink', 'abyss', 'time', 'gold', 'frog', 'vampire', 'bard',
      'rainbow', 'poison', 'cat', 'meteor', 'party', 'wind', 'ritual', 'claw', 'necro', 'pirate',
      'samurai', 'kaiju', 'cyber', 'werewolf', 'siren', 'alchemy', 'ghost', 'haki', 'cthulhu',
      'heaven', 'purple', 'wheel', 'capture', 'darklord', 'notebook', 'orbs', 'sakura', 'phoenix',
      'kitsune', 'mirror', 'aurora', 'zombie', 'sungod', 'tarrasque', 'sans', 'hollow', 'doom',
      'zoro', 'blackhole', 'fullmetal', 'sahur', 'spider', 'akatsuki', 'hisoka', 'valorant',
      'league', 'mario', 'foxy'
    )
  );
