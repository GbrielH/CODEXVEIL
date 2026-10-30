-- =============================================================================
-- Quadros dentro de cada sessão (pedido de 2026-10-30): o mestre planeja a sessão no quadro dela,
-- no editor da sessão, em vez de uma aba "Quadros" solta na campanha.
--   * `session_id`: a sessão do quadro (apagar a sessão apaga os quadros dela).
--   * Quadros antigos vão para a sessão mais recente da campanha (sem sessão, ficam sem nenhuma
--     até o mestre criar uma; continuam só do mestre, como antes).
--   * O quadro e a sessão precisam ser da mesma campanha.
-- =============================================================================

alter table public.campaign_boards
  add column session_id uuid references public.sessions (id) on delete cascade;

comment on column public.campaign_boards.session_id is
  'Sessão do quadro (o mestre planeja cada sessão no quadro dela).';

create index campaign_boards_session_idx on public.campaign_boards (session_id, created_at);

update public.campaign_boards b
set session_id = (
  select s.id from public.sessions s
  where s.campaign_id = b.campaign_id
  order by s.number desc
  limit 1
)
where b.session_id is null;

create function private.check_board_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.session_id is not null and not exists (
    select 1 from public.sessions s where s.id = new.session_id and s.campaign_id = new.campaign_id
  ) then
    raise exception 'A sessão não é desta campanha.' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger campaign_boards_check_session
  before insert or update of session_id, campaign_id on public.campaign_boards
  for each row execute function private.check_board_session();

grant insert (session_id) on table public.campaign_boards to authenticated;
