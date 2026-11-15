-- =============================================================================
-- Oito auras novas (2026-11-15)
--
-- Pedido do responsável: Olho Cósmico (`cosmic`), Cartas do Destino (`tarot`), Glitch
-- (`glitch`), Tinta (`ink`), Abissal (`abyss`), Tempo (`time`), Ouro (`gold`) e Sapo Rei
-- (`frog`). Mesmas regras das demais (criador e amigos com liberação).
-- =============================================================================

alter table public.user_dice drop constraint user_dice_aura_check;
alter table public.user_dice
  add constraint user_dice_aura_check check (
    aura is null
    or aura in (
      'blood', 'storm', 'frost', 'arcane', 'shadow', 'holy', 'gears', 'forest', 'fire', 'skeleton',
      'cosmic', 'tarot', 'glitch', 'ink', 'abyss', 'time', 'gold', 'frog'
    )
  );

alter table public.dice_aura_grants drop constraint dice_aura_grants_aura_check;
alter table public.dice_aura_grants
  add constraint dice_aura_grants_aura_check check (
    aura in (
      'blood', 'storm', 'frost', 'arcane', 'shadow', 'holy', 'gears', 'forest', 'fire', 'skeleton',
      'cosmic', 'tarot', 'glitch', 'ink', 'abyss', 'time', 'gold', 'frog'
    )
  );
