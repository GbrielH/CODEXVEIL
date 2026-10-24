-- Corrige a confirmação de presença (2026-10-24): o upsert do cliente reescrevia session_id,
-- campaign_id e user_id no ON CONFLICT, mas o jogador só tem permissão de UPDATE em status, e
-- a resposta era recusada ("sem permissão"). Agora a resposta passa por esta função, que valida
-- a sessão e grava só a resposta do próprio usuário.

create function public.set_my_attendance(p_session_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign_id uuid;
begin
  if p_status is null or p_status not in ('yes', 'no') then
    raise exception 'Resposta inválida.' using errcode = '22023';
  end if;
  select s.campaign_id into v_campaign_id
    from public.sessions s
    where s.id = p_session_id and s.status = 'planned' and s.scheduled_at is not null;
  if v_campaign_id is null or not private.is_campaign_member(v_campaign_id) then
    raise exception 'Sessão não encontrada ou já iniciada.' using errcode = '42501';
  end if;
  insert into public.session_attendance (session_id, campaign_id, user_id, status)
    values (p_session_id, v_campaign_id, (select auth.uid()), p_status)
    on conflict (session_id, user_id) do update set status = excluded.status;
end;
$$;

revoke all on function public.set_my_attendance(uuid, text) from public, anon;
grant execute on function public.set_my_attendance(uuid, text) to authenticated;
