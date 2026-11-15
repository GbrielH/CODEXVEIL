-- =============================================================================
-- Aura "esqueleto" (2026-11-15)
--
-- Pedido do responsável: nova aura de esqueleto (no crítico, uma caveira gargalhando). Segue as
-- mesmas regras das demais (criador e amigos com liberação).
-- =============================================================================

alter table public.user_dice drop constraint user_dice_aura_check;
alter table public.user_dice
  add constraint user_dice_aura_check check (
    aura is null
    or aura in (
      'blood', 'storm', 'frost', 'arcane', 'shadow', 'holy', 'gears', 'forest', 'fire', 'skeleton'
    )
  );

alter table public.dice_aura_grants drop constraint dice_aura_grants_aura_check;
alter table public.dice_aura_grants
  add constraint dice_aura_grants_aura_check check (
    aura in (
      'blood', 'storm', 'frost', 'arcane', 'shadow', 'holy', 'gears', 'forest', 'fire', 'skeleton'
    )
  );
