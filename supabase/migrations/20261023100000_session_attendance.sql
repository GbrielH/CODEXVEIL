-- Confirmar presença (2026-10-23): o jogador responde se vai a uma sessão agendada; o mestre vê
-- confirmados, recusas e quem não respondeu.
create table public.session_attendance (
  session_id uuid not null,
  campaign_id uuid not null,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  status text not null check (status in ('yes', 'no')),
  updated_at timestamptz not null default now(),
  primary key (session_id, user_id),
  constraint session_attendance_session_fk
    foreign key (session_id, campaign_id) references public.sessions (id, campaign_id) on delete cascade
);

comment on table public.session_attendance is 'Resposta de presença de cada participante a uma sessão agendada.';

create trigger session_attendance_set_updated_at
  before update on public.session_attendance
  for each row execute function private.set_updated_at();

alter table public.session_attendance enable row level security;

create policy "Presença: membros da campanha leem"
  on public.session_attendance for select to authenticated
  using (private.is_campaign_member(campaign_id));

-- Só a própria resposta, em sessão agendada que ainda não começou.
create policy "Presença: o participante responde"
  on public.session_attendance for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and private.is_campaign_member(campaign_id)
    and exists (
      select 1 from public.sessions s
      where s.id = session_id and s.campaign_id = campaign_id and s.status = 'planned' and s.scheduled_at is not null
    )
  );

create policy "Presença: o participante muda a resposta"
  on public.session_attendance for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.sessions s
      where s.id = session_id and s.campaign_id = campaign_id and s.status = 'planned' and s.scheduled_at is not null
    )
  );

revoke all on table public.session_attendance from anon, authenticated;
grant select, insert on table public.session_attendance to authenticated;
grant update (status) on table public.session_attendance to authenticated;
grant all on table public.session_attendance to service_role;
