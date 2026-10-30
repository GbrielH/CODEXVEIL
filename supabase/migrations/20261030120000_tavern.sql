-- =============================================================================
-- Taverna (2026-10-30): chat livre entre jogadores.
--   * Cada mensagem é de uma campanha (todos os participantes veem) ou direta para um amigo
--     (só as duas pessoas veem).
--   * Mensagens duram 24 horas: a leitura já esconde as mais antigas e cada mensagem nova apaga
--     as vencidas (não precisa de tarefa agendada).
--   * Publicada no Realtime (o RLS vale para cada assinante).
-- =============================================================================

create table public.tavern_messages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns (id) on delete cascade,
  recipient_id uuid references public.profiles (id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000 and private.is_clean_text(body)),
  created_at timestamptz not null default now(),
  check ((campaign_id is null) <> (recipient_id is null))
);

create index tavern_messages_campaign_idx on public.tavern_messages (campaign_id, created_at desc) where campaign_id is not null;
create index tavern_messages_direct_idx
  on public.tavern_messages (least(sender_id, recipient_id), greatest(sender_id, recipient_id), created_at desc)
  where recipient_id is not null;
create index tavern_messages_created_idx on public.tavern_messages (created_at);

comment on table public.tavern_messages is 'Taverna: mensagens de campanha ou diretas entre amigos; duram 24 horas.';

alter table public.tavern_messages enable row level security;

create policy "Taverna: participantes leem as das últimas 24 horas"
  on public.tavern_messages for select to authenticated
  using (
    created_at > now() - interval '24 hours'
    and (
      (campaign_id is not null and private.is_campaign_member(campaign_id))
      or (recipient_id is not null and (select auth.uid()) in (sender_id, recipient_id))
    )
  );

create policy "Taverna: escreve na campanha em que participa ou para um amigo"
  on public.tavern_messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and (
      (campaign_id is not null and private.is_campaign_member(campaign_id))
      or (recipient_id is not null and private.are_friends(recipient_id))
    )
  );

create policy "Taverna: o autor apaga a própria mensagem"
  on public.tavern_messages for delete to authenticated
  using (sender_id = (select auth.uid()));

revoke all on table public.tavern_messages from anon, authenticated;
grant select, delete on table public.tavern_messages to authenticated;
grant insert (campaign_id, recipient_id, body) on table public.tavern_messages to authenticated;
grant all on table public.tavern_messages to service_role;

-- Cada mensagem nova apaga as que passaram de 24 horas.
create function private.tavern_cleanup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.tavern_messages where created_at < now() - interval '24 hours';
  return null;
end;
$$;
revoke all on function private.tavern_cleanup() from public;

create trigger tavern_messages_cleanup
  after insert on public.tavern_messages
  for each statement execute function private.tavern_cleanup();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.tavern_messages;
  end if;
end;
$$;
