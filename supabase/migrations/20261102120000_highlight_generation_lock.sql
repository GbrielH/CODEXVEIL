-- Uma geração de Melhores Momentos por sessão por vez. O lock fica no próprio registro de uso;
-- execuções abandonadas expiram em três minutos (a rota tem limite de 60 segundos).

alter table public.highlight_runs
  drop constraint highlight_runs_status_check;
alter table public.highlight_runs
  add constraint highlight_runs_status_check check (status in ('running', 'done', 'failed'));

create unique index highlight_runs_one_running_per_session_idx
  on public.highlight_runs (session_id)
  where status = 'running';

create function public.start_highlight_run(p_session_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign_id uuid;
  v_run_id uuid;
begin
  select s.campaign_id into v_campaign_id
  from public.sessions s
  where s.id = p_session_id;

  if v_campaign_id is null then
    raise exception 'Sessão não encontrada.' using errcode = 'P0002';
  end if;
  if not private.is_campaign_gm(v_campaign_id) then
    raise exception 'Só o mestre gera os momentos.' using errcode = '42501';
  end if;

  update public.highlight_runs
  set status = 'failed', error = 'Geração interrompida antes de terminar.'
  where session_id = p_session_id
    and status = 'running'
    and created_at < now() - interval '3 minutes';

  begin
    insert into public.highlight_runs (session_id, campaign_id, status)
    values (p_session_id, v_campaign_id, 'running')
    returning id into v_run_id;
  exception when unique_violation then
    raise exception 'Já existe uma geração em andamento para esta sessão.' using errcode = '55P03';
  end;

  return v_run_id;
end;
$$;

create function public.finish_highlight_run(
  p_run_id uuid,
  p_status text,
  p_model text default '',
  p_tokens_in integer default 0,
  p_tokens_out integer default 0,
  p_moments integer default 0,
  p_error text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('done', 'failed') then
    raise exception 'Estado final inválido.' using errcode = '22023';
  end if;

  update public.highlight_runs
  set status = p_status,
      model = left(coalesce(p_model, ''), 200),
      tokens_in = greatest(coalesce(p_tokens_in, 0), 0),
      tokens_out = greatest(coalesce(p_tokens_out, 0), 0),
      moments = greatest(coalesce(p_moments, 0), 0),
      error = case when p_status = 'failed' then left(coalesce(p_error, ''), 500) else '' end
  where id = p_run_id
    and status = 'running'
    and private.is_campaign_gm(campaign_id);

  if not found then
    raise exception 'A geração não está mais em andamento.' using errcode = '55000';
  end if;
end;
$$;

revoke all on function public.start_highlight_run(uuid) from public, anon;
revoke all on function public.finish_highlight_run(uuid, text, text, integer, integer, integer, text)
  from public, anon;
grant execute on function public.start_highlight_run(uuid) to authenticated;
grant execute on function public.finish_highlight_run(uuid, text, text, integer, integer, integer, text)
  to authenticated;
