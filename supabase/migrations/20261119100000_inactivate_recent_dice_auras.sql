-- Mantém os temas recentes catalogados como "Em breve", mas impede uso até nova implementação.

update public.user_dice
set aura = null
where aura in (
  'sungod', 'tarrasque', 'sans', 'hollow', 'doom', 'zoro', 'blackhole', 'fullmetal', 'sahur',
  'spider', 'akatsuki', 'hisoka', 'valorant', 'league', 'mario'
);

update public.profiles
set preferences = preferences #- '{dice,aura}'
where preferences #>> '{dice,aura}' in (
  'sungod', 'tarrasque', 'sans', 'hollow', 'doom', 'zoro', 'blackhole', 'fullmetal', 'sahur',
  'spider', 'akatsuki', 'hisoka', 'valorant', 'league', 'mario'
);

delete from public.dice_aura_grants
where aura in (
  'sungod', 'tarrasque', 'sans', 'hollow', 'doom', 'zoro', 'blackhole', 'fullmetal', 'sahur',
  'spider', 'akatsuki', 'hisoka', 'valorant', 'league', 'mario'
);

create or replace function private.can_use_aura(p_user_id uuid, p_aura text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_aura not in (
      'sungod', 'tarrasque', 'sans', 'hollow', 'doom', 'zoro', 'blackhole', 'fullmetal', 'sahur',
      'spider', 'akatsuki', 'hisoka', 'valorant', 'league', 'mario'
    )
    and (
      private.is_creator(p_user_id)
      or exists (
        select 1 from public.dice_aura_grants g where g.user_id = p_user_id and g.aura = p_aura
      )
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
      'kitsune', 'mirror', 'aurora', 'zombie'
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
      'kitsune', 'mirror', 'aurora', 'zombie'
    )
  );
