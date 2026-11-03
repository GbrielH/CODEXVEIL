-- Estimativa mensal de minutos de participante do LiveKit (2026-11-03).
-- Cada conexão mantém um intervalo próprio com heartbeat. A tabela não expõe presenças de
-- terceiros; a soma global sai apenas pela função agregada call_usage_month().

create table public.call_presence (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.call_rooms (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz,
  check (last_seen_at >= started_at),
  check (ended_at is null or ended_at >= started_at)
);

comment on table public.call_presence is
  'Intervalos de conexão usados para estimar minutos de participante do LiveKit.';
create unique index call_presence_one_open_idx
  on public.call_presence (room_id, user_id) where ended_at is null;
create index call_presence_month_idx on public.call_presence (started_at, last_seen_at);
create index call_presence_room_idx on public.call_presence (room_id, started_at);

alter table public.call_presence enable row level security;
create policy "Call: cada pessoa vê somente a própria presença"
  on public.call_presence for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.call_presence from anon, authenticated;
grant select on table public.call_presence to authenticated;
grant all on table public.call_presence to service_role;

create function private.close_call_presence_on_room_end()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'ended' and (old.status <> 'ended' or old.ended_at is distinct from new.ended_at) then
    update public.call_presence p
    set ended_at = greatest(
      p.started_at,
      least(p.last_seen_at, coalesce(new.ended_at, now()))
    )
    where p.room_id = new.id and p.ended_at is null;
  end if;
  return new;
end;
$$;
revoke all on function private.close_call_presence_on_room_end() from public;
create trigger call_rooms_close_presence
after update of status, ended_at on public.call_rooms
for each row execute function private.close_call_presence_on_room_end();

-- Aproveita o último intervalo conhecido das salas anteriores. Reconexões antigas foram
-- sobrescritas em call_participants e, por isso, não podem ser reconstruídas com exatidão.
insert into public.call_presence (room_id, user_id, started_at, last_seen_at, ended_at)
select p.room_id,
       p.user_id,
       p.joined_at,
       greatest(p.joined_at, coalesce(p.left_at, r.ended_at, p.joined_at)),
       case
         when p.left_at is not null or r.ended_at is not null
           then greatest(p.joined_at, least(coalesce(p.left_at, 'infinity'::timestamptz),
                                             coalesce(r.ended_at, 'infinity'::timestamptz)))
         else null
       end
from public.call_participants p
join public.call_rooms r on r.id = p.room_id
where p.status = 'approved';

create function public.start_call_presence(p_room_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_id uuid;
begin
  if v_user is null or not exists (
    select 1
    from public.call_rooms r
    join public.call_participants p on p.room_id = r.id
    where r.id = p_room_id
      and r.status = 'active'
      and p.user_id = v_user
      and p.status = 'approved'
  ) then
    raise exception 'Você não está nesta call.' using errcode = '42501';
  end if;

  update public.call_presence
  set ended_at = greatest(started_at, least(last_seen_at, now()))
  where room_id = p_room_id and user_id = v_user and ended_at is null;

  insert into public.call_presence (room_id, user_id)
  values (p_room_id, v_user)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.heartbeat_call_presence(p_presence_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.call_presence p
  set last_seen_at = now()
  from public.call_rooms r, public.call_participants cp
  where p.id = p_presence_id
    and p.user_id = (select auth.uid())
    and p.ended_at is null
    and r.id = p.room_id
    and r.status = 'active'
    and cp.room_id = p.room_id
    and cp.user_id = p.user_id
    and cp.status = 'approved';
  if not found then
    raise exception 'Esta presença de call não está ativa.' using errcode = '42501';
  end if;
end;
$$;

create function public.end_call_presence(p_presence_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.call_presence p
  set ended_at = greatest(
    p.started_at,
    least(now(), coalesce(r.ended_at, now()))
  )
  from public.call_rooms r
  where p.id = p_presence_id
    and p.room_id = r.id
    and p.user_id = (select auth.uid())
    and p.ended_at is null;
$$;

-- A saída explícita fecha também qualquer intervalo aberto da pessoa.
create or replace function public.leave_call_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.call_presence p
  set ended_at = greatest(p.started_at, least(now(), coalesce(r.ended_at, now())))
  from public.call_rooms r
  where p.room_id = p_room_id
    and p.room_id = r.id
    and p.user_id = (select auth.uid())
    and p.ended_at is null;

  update public.call_participants
  set left_at = now()
  where room_id = p_room_id and user_id = (select auth.uid());
end;
$$;

-- Heartbeats mantêm uma sala ativa; sem atividade por seis horas, encerra a sala e os intervalos.
create or replace function public.close_idle_call_rooms()
returns void
language sql
security definer
set search_path = ''
as $$
  with closed as (
    update public.call_rooms r
    set status = 'ended', ended_at = now()
    where r.status = 'active'
      and greatest(
        r.created_at,
        coalesce((
          select max(greatest(p.last_seen_at, coalesce(p.ended_at, p.last_seen_at)))
          from public.call_presence p where p.room_id = r.id
        ), r.created_at)
      ) < now() - interval '6 hours'
    returning r.id, r.ended_at
  )
  update public.call_presence p
  set ended_at = greatest(p.started_at, least(p.last_seen_at, c.ended_at))
  from closed c
  where p.room_id = c.id and p.ended_at is null;
$$;

-- Soma minutos de participante no mês corrente de São Paulo. Intervalos abertos terminam no
-- último heartbeat; salas encerradas nunca contam além de call_rooms.ended_at.
create function public.call_usage_month()
returns table (used_minutes numeric, month_start timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with bounds as (
    select
      date_trunc('month', now() at time zone 'America/Sao_Paulo')
        at time zone 'America/Sao_Paulo' as starts_at,
      (date_trunc('month', now() at time zone 'America/Sao_Paulo') + interval '1 month')
        at time zone 'America/Sao_Paulo' as ends_at
  ), intervals as (
    select
      greatest(p.started_at, b.starts_at) as starts_at,
      least(
        coalesce(p.ended_at, p.last_seen_at),
        coalesce(r.ended_at, 'infinity'::timestamptz),
        now(),
        b.ends_at
      ) as ends_at,
      b.starts_at as month_start
    from public.call_presence p
    join public.call_rooms r on r.id = p.room_id
    cross join bounds b
    where p.started_at < b.ends_at
      and coalesce(p.ended_at, p.last_seen_at) > b.starts_at
  )
  select
    coalesce(sum(greatest(0, extract(epoch from (i.ends_at - i.starts_at))) / 60), 0),
    b.starts_at
  from bounds b
  left join intervals i on true
  group by b.starts_at;
$$;

revoke all on function public.start_call_presence(uuid) from public, anon;
revoke all on function public.heartbeat_call_presence(uuid) from public, anon;
revoke all on function public.end_call_presence(uuid) from public, anon;
revoke all on function public.call_usage_month() from public, anon;
grant execute on function public.start_call_presence(uuid) to authenticated;
grant execute on function public.heartbeat_call_presence(uuid) to authenticated;
grant execute on function public.end_call_presence(uuid) to authenticated;
grant execute on function public.call_usage_month() to authenticated;
