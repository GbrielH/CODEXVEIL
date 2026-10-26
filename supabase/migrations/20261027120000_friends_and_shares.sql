-- =============================================================================
-- Amigos, convite direto e personagens compartilhados (2026-10-27).
--   * `profiles.friend_code`: código de 8 caracteres para adicionar alguém como amigo.
--   * `friendships`: pedido (pending) e amizade (accepted), um registro por par de contas.
--     Amigos (e pedidos) veem o perfil público um do outro.
--   * `campaign_invites.invited_user_id`: convite pessoal para um amigo, sem expor o e-mail
--     dele ao mestre. Só o amigo convidado aceita; aparece nos convites pendentes dele.
--   * `character_shares`: o dono deixa amigos verem a ficha (somente leitura).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Código de amigo
-- ---------------------------------------------------------------------------
create function private.generate_friend_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_code text;
begin
  loop
    v_code := left(private.generate_invite_code(), 8);
    exit when not exists (select 1 from public.profiles p where p.friend_code = v_code);
  end loop;
  return v_code;
end;
$$;
revoke all on function private.generate_friend_code() from public;

alter table public.profiles add column friend_code text unique
  check (friend_code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$');
update public.profiles set friend_code = private.generate_friend_code() where friend_code is null;
alter table public.profiles alter column friend_code set not null;
alter table public.profiles alter column friend_code set default private.generate_friend_code();

-- ---------------------------------------------------------------------------
-- Amizades
-- ---------------------------------------------------------------------------
create type public.friendship_status as enum ('pending', 'accepted');

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  check (requester_id <> addressee_id)
);
create unique index friendships_pair_idx
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index friendships_addressee_idx on public.friendships (addressee_id);

comment on table public.friendships is 'Pedidos de amizade e amizades aceitas; cada par de contas tem um registro.';

alter table public.friendships enable row level security;

create policy "Amizades: as duas pessoas veem"
  on public.friendships for select to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));
create policy "Amizades: qualquer uma das duas desfaz"
  on public.friendships for delete to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

revoke all on table public.friendships from anon, authenticated;
grant select, delete on table public.friendships to authenticated;
grant all on table public.friendships to service_role;

-- As duas contas são amigas (pedido aceito)?
create function private.are_friends(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = (select auth.uid()) and f.addressee_id = p_user_id)
        or (f.addressee_id = (select auth.uid()) and f.requester_id = p_user_id))
  );
$$;
revoke all on function private.are_friends(uuid) from public;
grant execute on function private.are_friends(uuid) to authenticated, service_role;

-- Há pedido ou amizade entre as duas contas (para mostrar nome e retrato)?
create function private.has_friend_link(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships f
    where (f.requester_id = (select auth.uid()) and f.addressee_id = p_user_id)
       or (f.addressee_id = (select auth.uid()) and f.requester_id = p_user_id)
  );
$$;
revoke all on function private.has_friend_link(uuid) from public;
grant execute on function private.has_friend_link(uuid) to authenticated, service_role;

create policy "Amigos e pedidos de amizade veem o perfil"
  on public.profiles for select to authenticated
  using (private.has_friend_link(id));

-- Pede amizade pelo código (ou pelo id, para quem já joga junto). Se a outra pessoa já tinha
-- pedido, aceita direto.
create function public.request_friend(p_code text default null, p_user_id uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_target uuid;
  v_existing public.friendships;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;
  if p_code is not null then
    select p.id into v_target from public.profiles p
    where p.friend_code = private.normalize_invite_code(p_code);
  elsif p_user_id is not null and private.shares_campaign_with(p_user_id) then
    v_target := p_user_id;
  end if;
  if v_target is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if v_target = v_uid then
    return jsonb_build_object('ok', false, 'reason', 'self');
  end if;

  select * into v_existing from public.friendships f
  where least(f.requester_id, f.addressee_id) = least(v_uid, v_target)
    and greatest(f.requester_id, f.addressee_id) = greatest(v_uid, v_target)
  for update;
  if found then
    if v_existing.status = 'accepted' then
      return jsonb_build_object('ok', true, 'status', 'accepted');
    elsif v_existing.addressee_id = v_uid then
      update public.friendships set status = 'accepted', accepted_at = now() where id = v_existing.id;
      return jsonb_build_object('ok', true, 'status', 'accepted');
    end if;
    return jsonb_build_object('ok', true, 'status', 'pending');
  end if;

  if (select count(*) from public.friendships f where v_uid in (f.requester_id, f.addressee_id)) >= 500 then
    return jsonb_build_object('ok', false, 'reason', 'limit');
  end if;
  insert into public.friendships (requester_id, addressee_id) values (v_uid, v_target);
  return jsonb_build_object('ok', true, 'status', 'pending');
end;
$$;
revoke all on function public.request_friend(text, uuid) from public, anon;
grant execute on function public.request_friend(text, uuid) to authenticated;

-- Aceita um pedido recebido.
create function public.accept_friend(p_friendship_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.friendships
  set status = 'accepted', accepted_at = now()
  where id = p_friendship_id and addressee_id = (select auth.uid()) and status = 'pending';
  if not found then
    raise exception 'Pedido não encontrado.' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.accept_friend(uuid) from public, anon;
grant execute on function public.accept_friend(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Convite direto para um amigo
-- ---------------------------------------------------------------------------
alter table public.campaign_invites
  add column invited_user_id uuid references public.profiles (id) on delete cascade;
alter table public.campaign_invites
  add constraint campaign_invites_user_single_use check (invited_user_id is null or max_uses = 1);
create index campaign_invites_pending_user_idx on public.campaign_invites (invited_user_id)
  where invited_user_id is not null and revoked_at is null and declined_at is null;

create or replace function private.invite_rejection_reason(
  p_invite public.campaign_invites,
  p_campaign public.campaigns
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_invite.revoked_at is not null then
    return 'revoked';
  elsif p_invite.declined_at is not null then
    return 'declined';
  elsif p_campaign.status <> 'active' then
    return 'campaign_archived';
  elsif p_invite.max_uses is not null and p_invite.uses_count >= p_invite.max_uses then
    return 'exhausted';
  elsif p_invite.expires_at <= now() then
    return 'expired';
  elsif p_invite.invited_email is not null
    and p_invite.invited_email is distinct from private.current_verified_email() then
    return 'email_mismatch';
  elsif p_invite.invited_user_id is not null and p_invite.invited_user_id is distinct from (select auth.uid()) then
    return 'email_mismatch';
  elsif exists (
    select 1 from public.campaign_members m
    where m.campaign_id = p_campaign.id and m.user_id = (select auth.uid())
  ) then
    return 'already_member';
  end if;
  return null;
end;
$$;

create or replace function public.get_my_pending_invites()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'code', i.code,
        'campaignId', c.id,
        'campaignName', c.name,
        'systemId', c.system_id,
        'ownerName', p.display_name,
        'expiresAt', i.expires_at
      )
      order by i.created_at desc
    ),
    '[]'::jsonb
  )
  from public.campaign_invites i
  join public.campaigns c on c.id = i.campaign_id
  join public.profiles p on p.id = c.owner_id
  where (i.invited_email = private.current_verified_email() or i.invited_user_id = (select auth.uid()))
    and i.revoked_at is null
    and i.declined_at is null
    and i.expires_at > now()
    and (i.max_uses is null or i.uses_count < i.max_uses)
    and c.status = 'active'
    and not exists (
      select 1 from public.campaign_members m
      where m.campaign_id = c.id and m.user_id = (select auth.uid())
    );
$$;

-- O mestre convida um amigo direto: convite pessoal de uso único, válido por 14 dias.
create function public.invite_friend_to_campaign(p_campaign_id uuid, p_friend_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_campaign(p_campaign_id) then
    raise exception 'Só o mestre convida para a campanha.' using errcode = '42501';
  end if;
  if not private.are_friends(p_friend_id) then
    raise exception 'Só dá para convidar amigos.' using errcode = '42501';
  end if;
  if exists (select 1 from public.campaign_members m where m.campaign_id = p_campaign_id and m.user_id = p_friend_id) then
    raise exception 'Essa pessoa já participa da campanha.' using errcode = 'CVCOR';
  end if;
  if exists (
    select 1 from public.campaign_invites i
    where i.campaign_id = p_campaign_id and i.invited_user_id = p_friend_id
      and i.revoked_at is null and i.declined_at is null and i.expires_at > now() and i.uses_count = 0
  ) then
    return;
  end if;
  insert into public.campaign_invites (campaign_id, max_uses, expires_at, invited_user_id)
  values (p_campaign_id, 1, now() + interval '14 days', p_friend_id);
end;
$$;
revoke all on function public.invite_friend_to_campaign(uuid, uuid) from public, anon;
grant execute on function public.invite_friend_to_campaign(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Personagens compartilhados com amigos
-- ---------------------------------------------------------------------------
create table public.character_shares (
  character_id uuid not null references public.characters (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (character_id, user_id)
);
create index character_shares_user_idx on public.character_shares (user_id);

comment on table public.character_shares is 'Amigos que podem ver (sem editar) a ficha de um personagem.';

create function private.owns_character(p_character_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.characters c where c.id = p_character_id and c.owner_id = (select auth.uid()));
$$;
revoke all on function private.owns_character(uuid) from public;
grant execute on function private.owns_character(uuid) to authenticated, service_role;

create function private.is_character_shared_with_me(p_character_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.character_shares s
    join public.characters c on c.id = s.character_id
    where s.character_id = p_character_id
      and s.user_id = (select auth.uid())
      -- Vale enquanto as duas contas continuam amigas.
      and exists (
        select 1 from public.friendships f
        where f.status = 'accepted'
          and least(f.requester_id, f.addressee_id) = least(c.owner_id, s.user_id)
          and greatest(f.requester_id, f.addressee_id) = greatest(c.owner_id, s.user_id)
      )
  );
$$;
revoke all on function private.is_character_shared_with_me(uuid) from public;
grant execute on function private.is_character_shared_with_me(uuid) to authenticated, service_role;

alter table public.character_shares enable row level security;

create policy "Compartilhamentos: dono e quem recebeu veem"
  on public.character_shares for select to authenticated
  using (user_id = (select auth.uid()) or private.owns_character(character_id));
create policy "Compartilhamentos: o dono compartilha com amigos"
  on public.character_shares for insert to authenticated
  with check (private.owns_character(character_id) and private.are_friends(user_id));
create policy "Compartilhamentos: o dono ou quem recebeu remove"
  on public.character_shares for delete to authenticated
  using (user_id = (select auth.uid()) or private.owns_character(character_id));

revoke all on table public.character_shares from anon, authenticated;
grant select, delete on table public.character_shares to authenticated;
grant insert (character_id, user_id) on table public.character_shares to authenticated;
grant all on table public.character_shares to service_role;

-- A ficha (e tudo que depende de `can_view_character`: recursos, itens, retrato…) passa a
-- valer também para amigos com quem o dono compartilhou. Editar continua igual.
create policy "Amigos com a ficha compartilhada veem o personagem"
  on public.characters for select to authenticated
  using (private.is_character_shared_with_me(id));

create or replace function private.can_view_character(p_character_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select private.can_view_character_row(c.owner_id, c.campaign_id)
     from public.characters c where c.id = p_character_id),
    false
  ) or private.is_character_shared_with_me(p_character_id);
$$;
