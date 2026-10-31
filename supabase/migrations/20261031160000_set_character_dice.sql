-- Vincular dado ao personagem (2026-10-31): o dono escolhe o dado mesmo quando o mestre não
-- libera a edição das fichas (a escolha é só visual). Antes o update caía no RLS da ficha e não
-- gravava nada, sem erro.
create function public.set_character_dice(p_character_id uuid, p_dice_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.characters c
    where c.id = p_character_id and c.owner_id = (select auth.uid())
  ) then
    raise exception 'Só o dono do personagem escolhe o dado dele.' using errcode = '42501';
  end if;
  update public.characters set dice_id = p_dice_id where id = p_character_id;
end;
$$;

revoke all on function public.set_character_dice(uuid, uuid) from public, anon;
grant execute on function public.set_character_dice(uuid, uuid) to authenticated, service_role;
