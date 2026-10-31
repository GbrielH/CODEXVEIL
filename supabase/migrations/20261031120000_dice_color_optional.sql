-- A cor dos dados deixa de ser escolhida na sessão (2026-10-31): cada jogador define a aparência
-- dos dados em "Meus dados" (perfil). Rolar não exige mais cor escolhida.
drop trigger if exists dice_rolls_require_color on public.dice_rolls;
drop function if exists private.dice_rolls_require_color();
