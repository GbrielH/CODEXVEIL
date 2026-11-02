-- Agenda da campanha: o mestre propõe datas para a próxima sessão, cada membro responde
-- "posso", "talvez" ou "não posso" e o mestre confirma uma (que vira a data da sessão escolhida).
-- Escritas só por funções (security definer); leitura para os membros da campanha.

create table public.schedule_polls (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  session_id uuid references public.sessions (id) on delete set null,
  title text not null default '' check (char_length(title) <= 80),
  status text not null default 'open' check (status in ('open', 'closed')),
  chosen_option_id uuid,
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index schedule_polls_campaign_idx on public.schedule_polls (campaign_id, created_at desc);

create table public.schedule_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.schedule_polls (id) on delete cascade,
  starts_at timestamptz not null
);
create index schedule_options_poll_idx on public.schedule_options (poll_id, starts_at);

create table public.schedule_votes (
  option_id uuid not null references public.schedule_options (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  answer text not null check (answer in ('yes', 'maybe', 'no')),
  updated_at timestamptz not null default now(),
  primary key (option_id, user_id)
);

alter table public.schedule_polls enable row level security;
alter table public.schedule_options enable row level security;
alter table public.schedule_votes enable row level security;

create policy "Agenda: membros veem as votações"
  on public.schedule_polls for select to authenticated
  using (private.is_campaign_member(campaign_id));
create policy "Agenda: o mestre apaga a votação"
  on public.schedule_polls for delete to authenticated
  using (private.can_manage_campaign(campaign_id));
create policy "Agenda: membros veem as datas"
  on public.schedule_options for select to authenticated
  using (exists (select 1 from public.schedule_polls p where p.id = poll_id and private.is_campaign_member(p.campaign_id)));
create policy "Agenda: membros veem as respostas"
  on public.schedule_votes for select to authenticated
  using (exists (
    select 1 from public.schedule_options o join public.schedule_polls p on p.id = o.poll_id
    where o.id = option_id and private.is_campaign_member(p.campaign_id)
  ));

revoke all on table public.schedule_polls, public.schedule_options, public.schedule_votes from anon, authenticated;
grant select on table public.schedule_polls, public.schedule_options, public.schedule_votes to authenticated;
grant delete on table public.schedule_polls to authenticated;
grant all on table public.schedule_polls, public.schedule_options, public.schedule_votes to service_role;

create function public.create_schedule_poll(
  p_campaign_id uuid, p_session_id uuid, p_title text, p_starts timestamptz[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if not private.can_manage_campaign(p_campaign_id) then
    raise exception 'Só o mestre propõe datas.' using errcode = '42501';
  end if;
  if p_starts is null or cardinality(p_starts) not between 1 and 10 then
    raise exception 'Proponha de 1 a 10 datas.' using errcode = '22023';
  end if;
  if p_session_id is not null and not exists (
    select 1 from public.sessions s where s.id = p_session_id and s.campaign_id = p_campaign_id
  ) then
    raise exception 'A sessão não é desta campanha.' using errcode = '22023';
  end if;
  insert into public.schedule_polls (campaign_id, session_id, title)
  values (p_campaign_id, p_session_id, left(btrim(coalesce(p_title, '')), 80))
  returning id into v_id;
  insert into public.schedule_options (poll_id, starts_at)
  select v_id, s from (select distinct unnest(p_starts) as s) d;
  return v_id;
end;
$$;

create function public.vote_schedule(p_option_id uuid, p_answer text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_answer not in ('yes', 'maybe', 'no') then
    raise exception 'Resposta inválida.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.schedule_options o join public.schedule_polls p on p.id = o.poll_id
    where o.id = p_option_id and p.status = 'open' and private.is_campaign_member(p.campaign_id)
  ) then
    raise exception 'Votação fechada ou fora da sua campanha.' using errcode = '42501';
  end if;
  insert into public.schedule_votes (option_id, user_id, answer)
  values (p_option_id, (select auth.uid()), p_answer)
  on conflict (option_id, user_id) do update set answer = excluded.answer, updated_at = now();
end;
$$;

create function public.confirm_schedule(p_poll_id uuid, p_option_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_poll public.schedule_polls%rowtype;
  v_starts timestamptz;
begin
  select * into v_poll from public.schedule_polls where id = p_poll_id;
  if not found or not private.can_manage_campaign(v_poll.campaign_id) then
    raise exception 'Só o mestre confirma a data.' using errcode = '42501';
  end if;
  select starts_at into v_starts from public.schedule_options where id = p_option_id and poll_id = p_poll_id;
  if v_starts is null then
    raise exception 'Data não encontrada.' using errcode = 'P0002';
  end if;
  update public.schedule_polls set status = 'closed', chosen_option_id = p_option_id where id = p_poll_id;
  if v_poll.session_id is not null then
    update public.sessions set scheduled_at = v_starts where id = v_poll.session_id;
  end if;
end;
$$;

revoke all on function public.create_schedule_poll(uuid, uuid, text, timestamptz[]) from public, anon;
revoke all on function public.vote_schedule(uuid, text) from public, anon;
revoke all on function public.confirm_schedule(uuid, uuid) from public, anon;
grant execute on function public.create_schedule_poll(uuid, uuid, text, timestamptz[]) to authenticated;
grant execute on function public.vote_schedule(uuid, text) to authenticated;
grant execute on function public.confirm_schedule(uuid, uuid) to authenticated;
