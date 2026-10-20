-- Cor dos dados vale só para a sessão (pedido de 2026-10-20): ao iniciar ou encerrar uma
-- sessão, as cores da campanha são apagadas e cada um escolhe de novo na próxima.

create function private.reset_dice_colors_on_session_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' and new.status = 'in_progress')
    or (tg_op = 'UPDATE' and new.status is distinct from old.status
        and (new.status = 'in_progress' or old.status = 'in_progress')) then
    update public.campaign_members set dice_color = null
      where campaign_id = new.campaign_id and dice_color is not null;
  end if;
  return new;
end;
$$;

revoke all on function private.reset_dice_colors_on_session_change() from public;

create trigger sessions_reset_dice_colors
  after insert or update of status on public.sessions
  for each row execute function private.reset_dice_colors_on_session_change();
