-- Sessão presencial ou online (pedido de 2026-10-20).
--   * sessions.mode: 'presencial' (o mestre escolhe dados físicos ou virtuais) ou 'online'
--     (dados virtuais sempre ligados; depois, o grid da sessão).
--   * Online nunca usa dados físicos (CHECK).
--   * campaign_session_state passa a informar o modo.

alter table public.sessions
  add column mode text not null default 'presencial' check (mode in ('presencial', 'online'));

update public.sessions set physical_dice = false where mode = 'online';

alter table public.sessions
  add constraint sessions_online_virtual_dice check (mode = 'presencial' or not physical_dice);

comment on column public.sessions.mode is
  'presencial: o mestre escolhe dados físicos ou virtuais; online: dados virtuais sempre ligados.';

grant insert (mode) on table public.sessions to authenticated;
grant update (mode) on table public.sessions to authenticated;

create or replace function public.campaign_session_state(p_campaign_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'playing', coalesce(bool_or(true), false),
    'physicalDice', coalesce(bool_or(s.physical_dice), false),
    'mode', coalesce(max(s.mode), 'presencial')
  )
  from public.sessions s
  where private.is_campaign_member(p_campaign_id)
    and s.campaign_id = p_campaign_id
    and s.status = 'in_progress';
$$;
