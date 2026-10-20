-- Cor dos dados de cada participante (pedido de 2026-10-20): os dados 3D da caixinha do canto
-- aparecem na cor escolhida por quem rolou. Cada um muda só a própria cor (RPC).

alter table public.campaign_members
  add column dice_color text check (dice_color is null or dice_color ~ '^#[0-9a-fA-F]{6}$');

comment on column public.campaign_members.dice_color is 'Cor dos dados 3D do participante (#rrggbb).';

create function public.set_my_dice_color(p_campaign_id uuid, p_color text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_color is not null and p_color !~ '^#[0-9a-fA-F]{6}$' then
    raise exception 'Cor inválida.' using errcode = '22023';
  end if;
  update public.campaign_members
    set dice_color = p_color
    where campaign_id = p_campaign_id and user_id = (select auth.uid());
  if not found then
    raise exception 'Você não participa desta campanha.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.set_my_dice_color(uuid, text) from public;
grant execute on function public.set_my_dice_color(uuid, text) to authenticated;
