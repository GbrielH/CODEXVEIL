-- =============================================================================
-- Reativa as 15 auras que estavam "Em breve" (2026-11-21)
--
-- Sungod, Tarrasque, Sans, Hollow Knight, Doutor Destino, Zoro, Buraco Negro, Fullmetal, Sahur,
-- Homem-Aranha, Akatsuki, Hisoka, Valorant, League e Mario foram refeitas (animação própria,
-- sem ilustração colada) e voltam a valer: lista aceita completa e `can_use_aura` sem exceções.
-- =============================================================================

create or replace function private.can_use_aura(p_user_id uuid, p_aura text)
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
      'league', 'mario'
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
      'league', 'mario'
    )
  );
