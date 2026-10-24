-- Cor dos dados só existe durante a sessão (pedido de 2026-10-23): é escolhida no início da
-- sessão em andamento e não vale para a campanha. Fora da sessão não se escolhe cor, e as
-- rolagens não exigem cor. Apaga as cores que sobraram fora de sessões.

create or replace function public.set_my_dice_color(p_campaign_id uuid, p_color text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_color is null or p_color !~ '^#[0-9a-fA-F]{6}$' then
    raise exception 'Cor inválida.' using errcode = '22023';
  end if;
  if not private.is_campaign_member(p_campaign_id) then
    raise exception 'Você não participa desta campanha.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.sessions s
    where s.campaign_id = p_campaign_id and s.status = 'in_progress'
  ) then
    raise exception 'A cor dos dados é escolhida no início da sessão.' using errcode = 'CVCOR';
  end if;
  if not private.is_campaign_gm(p_campaign_id) and not exists (
    select 1 from public.campaign_members m
    where m.campaign_id = p_campaign_id and m.role = 'gm' and m.dice_color is not null
  ) then
    raise exception 'O mestre escolhe a cor dos dados primeiro.' using errcode = 'CVCOR';
  end if;
  if exists (
    select 1 from public.campaign_members m
    where m.campaign_id = p_campaign_id and m.user_id <> (select auth.uid()) and lower(m.dice_color) = lower(p_color)
  ) then
    raise exception 'Essa cor já é de outra pessoa da mesa.' using errcode = 'CVCOR';
  end if;
  update public.campaign_members
    set dice_color = p_color
    where campaign_id = p_campaign_id and user_id = (select auth.uid());
end;
$$;

create or replace function private.dice_rolls_require_color()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is not null
    and exists (
      select 1 from public.sessions s
      where s.campaign_id = new.campaign_id and s.status = 'in_progress'
    )
    and not exists (
      select 1 from public.campaign_members m
      where m.campaign_id = new.campaign_id and m.user_id = new.user_id and m.dice_color is not null
    ) then
    raise exception 'Escolha a cor dos seus dados antes de rolar.' using errcode = 'CVCOR';
  end if;
  return new;
end;
$$;

update public.campaign_members m
  set dice_color = null
  where m.dice_color is not null
    and not exists (
      select 1 from public.sessions s
      where s.campaign_id = m.campaign_id and s.status = 'in_progress'
    );
