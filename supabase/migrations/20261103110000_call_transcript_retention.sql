-- Retenção das transcrições de call (2026-11-03).
-- As salas e os Melhores Momentos permanecem; somente as falas de calls encerradas há mais de
-- 24 horas são removidas.

create function public.purge_expired_call_transcripts()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.transcript_segments t
  using public.call_rooms r
  where t.room_id = r.id
    and r.status = 'ended'
    and r.ended_at is not null
    and r.ended_at <= now() - interval '24 hours';
$$;

comment on function public.purge_expired_call_transcripts() is
  'Apaga somente falas de calls encerradas há pelo menos 24 horas.';

revoke all on function public.purge_expired_call_transcripts() from public, anon;
grant execute on function public.purge_expired_call_transcripts() to authenticated, service_role;

-- Lista apenas metadados das calls encerradas ainda dentro da janela de download. A autorização
-- repete a política de leitura das falas: participante aprovado, dono ou mestre da campanha.
create function public.list_recent_ended_calls()
returns table (
  id uuid,
  slug text,
  title text,
  campaign_name text,
  session_name text,
  started_at timestamptz,
  ended_at timestamptz,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id,
    r.slug,
    r.title,
    c.name,
    case
      when s.id is null then null
      else 'Sessão ' || s.number::text || ' · ' || s.title
    end,
    coalesce((select min(p.started_at) from public.call_presence p where p.room_id = r.id), r.created_at),
    r.ended_at,
    r.ended_at + interval '24 hours'
  from public.call_rooms r
  join public.campaigns c on c.id = r.campaign_id
  left join public.sessions s on s.id = r.session_id
  where r.status = 'ended'
    and r.ended_at is not null
    and r.ended_at > now() - interval '24 hours'
    and r.ended_at <= now()
    and (
      private.can_access_call_content(r.id)
      or private.can_edit_transcript(r.id)
    )
  order by r.ended_at desc;
$$;

revoke all on function public.list_recent_ended_calls() from public, anon;
grant execute on function public.list_recent_ended_calls() to authenticated;

-- Permite distinguir uma sessão sem transcrição de outra cujas falas já venceram. Só o mestre da
-- campanha recebe essa informação.
create function public.session_transcript_expired(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.call_rooms r
    where r.session_id = p_session_id
      and r.status = 'ended'
      and r.ended_at is not null
      and r.ended_at <= now() - interval '24 hours'
      and private.can_edit_transcript(r.id)
  ) and not exists (
    select 1 from public.transcript_segments t where t.session_id = p_session_id
  );
$$;

revoke all on function public.session_transcript_expired(uuid) from public, anon;
grant execute on function public.session_transcript_expired(uuid) to authenticated;
