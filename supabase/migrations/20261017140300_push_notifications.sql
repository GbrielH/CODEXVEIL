-- =============================================================================
-- Codexveil — 13 · Notificações push (app Android)
--
-- * `push_tokens`: aparelhos de cada conta (token do serviço de push da Expo). O app registra
--   o aparelho pela função register_push_token; cada conta só vê e apaga os próprios.
--   Um aparelho pertence à última conta que entrou nele.
-- * `session_notifications`: qual data de cada sessão já foi avisada. Gravada só pela Edge
--   Function `notify-session` (chave secreta), que envia o aviso quando o mestre agenda ou
--   remarca uma sessão publicada. Os mestres podem consultar quando o aviso saiu.
-- =============================================================================

create table public.push_tokens (
  token text primary key
    check (char_length(token) between 10 and 255 and token ~ '^Expo(nent)?PushToken\[[^]]+\]$'),
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('android', 'ios')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.push_tokens is 'Aparelhos que recebem notificações push de cada conta.';

create index push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

create policy "Usuário vê os próprios aparelhos"
  on public.push_tokens for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Usuário remove os próprios aparelhos"
  on public.push_tokens for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.push_tokens from anon, authenticated;
grant select, delete on table public.push_tokens to authenticated;
grant all on table public.push_tokens to service_role;

create function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Entre na sua conta para receber notificações.' using errcode = '42501';
  end if;
  if coalesce(p_platform, '') not in ('android', 'ios')
     or p_token is null
     or char_length(p_token) not between 10 and 255
     or p_token !~ '^Expo(nent)?PushToken\[[^]]+\]$' then
    raise exception 'Aparelho inválido para notificações.' using errcode = '22023';
  end if;

  insert into public.push_tokens (token, user_id, platform)
  values (p_token, v_uid, p_platform)
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();

  -- No máximo 10 aparelhos por conta: os mais antigos saem.
  delete from public.push_tokens t
  where t.token in (
    select o.token from public.push_tokens o
    where o.user_id = v_uid
    order by o.updated_at desc
    offset 10
  );
end;
$$;

revoke all on function public.register_push_token(text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;

create table public.session_notifications (
  session_id uuid primary key references public.sessions (id) on delete cascade,
  -- Data da sessão que foi avisada; um novo aviso só sai se o mestre mudar a data.
  scheduled_for timestamptz not null,
  recipients integer not null default 0 check (recipients >= 0),
  sent_at timestamptz not null default now()
);

comment on table public.session_notifications is
  'Avisos de sessão agendada já enviados (gravados pela Edge Function notify-session).';

alter table public.session_notifications enable row level security;

create policy "Mestres veem os avisos das sessões"
  on public.session_notifications for select to authenticated
  using (
    exists (
      select 1 from public.sessions s
      where s.id = session_id and private.is_campaign_gm(s.campaign_id)
    )
  );

revoke all on table public.session_notifications from anon, authenticated;
grant select on table public.session_notifications to authenticated;
grant all on table public.session_notifications to service_role;
