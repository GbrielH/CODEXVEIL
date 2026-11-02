-- Encerra sozinha a call esquecida: sem ninguém entrar ou sair há 6 horas, a sala vira "encerrada".
-- Chamada ao listar as salas (site e app); só olha o tempo, não expõe dados de ninguém.
create function public.close_idle_call_rooms()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.call_rooms r
  set status = 'ended', ended_at = now()
  where r.status = 'active'
    and greatest(
      r.created_at,
      coalesce((select max(greatest(p.joined_at, coalesce(p.left_at, p.joined_at)))
                from public.call_participants p where p.room_id = r.id), r.created_at)
    ) < now() - interval '6 hours';
$$;
revoke all on function public.close_idle_call_rooms() from public, anon;
grant execute on function public.close_idle_call_rooms() to authenticated;
