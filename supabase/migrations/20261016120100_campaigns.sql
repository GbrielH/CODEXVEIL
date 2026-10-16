-- =============================================================================
-- Codexveil — 02 · Campanhas, participantes e convites
--
-- O papel do usuário pertence à participação (campaign_members), nunca ao perfil.
-- Inserções em campaign_members só acontecem por gatilho (dono vira mestre) ou pela
-- função accept_campaign_invite; não há policy de escrita direta para clientes.
-- =============================================================================

create function private.is_single_line(p_value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_value = btrim(p_value) and p_value !~ '[[:cntrl:]]';
$$;

grant execute on function private.is_single_line(text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Campanhas
-- -----------------------------------------------------------------------------
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  system_id text not null references public.rpg_systems (id),
  name text not null check (char_length(name) between 2 and 80 and private.is_single_line(name)),
  description text not null default ''
    check (char_length(description) <= 2000 and private.is_clean_text(description)),
  cover_path text,
  status public.campaign_status not null default 'active',
  archived_at timestamptz,
  party_sheets_visible boolean not null default true,
  players_can_edit_sheets boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaigns_archived_consistency check ((status = 'archived') = (archived_at is not null)),
  constraint campaigns_cover_path check (
    cover_path is null
    or (char_length(cover_path) <= 300 and cover_path like 'campaigns/' || id::text || '/cover/%')
  )
);

comment on column public.campaigns.owner_id is 'Mestre responsável. Sempre participa com papel gm.';
comment on column public.campaigns.party_sheets_visible is
  'Jogadores podem consultar (somente leitura) as fichas dos demais personagens.';
comment on column public.campaigns.players_can_edit_sheets is
  'Jogadores podem editar a construção da própria ficha. Vida, recursos e inventário seguem editáveis.';

create index campaigns_owner_id_idx on public.campaigns (owner_id);

create trigger campaigns_set_updated_at
  before update on public.campaigns
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Participantes
-- -----------------------------------------------------------------------------
create table public.campaign_members (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.campaign_role not null default 'player',
  joined_at timestamptz not null default now(),
  primary key (campaign_id, user_id)
);

create index campaign_members_user_id_idx on public.campaign_members (user_id);

-- -----------------------------------------------------------------------------
-- Funções de autorização (SECURITY DEFINER: consultam participações sem esbarrar
-- nas próprias policies, evitando recursão de RLS)
-- -----------------------------------------------------------------------------
create function private.campaign_role(p_campaign_id uuid)
returns public.campaign_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.campaign_members m
  where m.campaign_id = p_campaign_id
    and m.user_id = (select auth.uid());
$$;

create function private.is_campaign_member(p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.campaign_members m
    where m.campaign_id = p_campaign_id and m.user_id = (select auth.uid())
  );
$$;

create function private.is_campaign_gm(p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.campaign_members m
    where m.campaign_id = p_campaign_id
      and m.user_id = (select auth.uid())
      and m.role = 'gm'
  );
$$;

-- Mestre de uma campanha ativa: pode alterar conteúdo.
create function private.can_manage_campaign(p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.campaign_members m
    join public.campaigns c on c.id = m.campaign_id
    where m.campaign_id = p_campaign_id
      and m.user_id = (select auth.uid())
      and m.role = 'gm'
      and c.status = 'active'
  );
$$;

-- Participante de uma campanha ativa: pode criar personagens e anotações.
create function private.can_participate(p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.campaign_members m
    join public.campaigns c on c.id = m.campaign_id
    where m.campaign_id = p_campaign_id
      and m.user_id = (select auth.uid())
      and c.status = 'active'
  );
$$;

create function private.shares_campaign_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.campaign_members mine
    join public.campaign_members theirs on theirs.campaign_id = mine.campaign_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = p_user_id
  );
$$;

-- E-mail confirmado da conta atual (convites pessoais só valem para e-mails verificados).
create function private.current_verified_email()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select lower(u.email)
  from auth.users u
  where u.id = (select auth.uid())
    and u.email_confirmed_at is not null;
$$;

revoke all on function private.campaign_role(uuid) from public;
revoke all on function private.is_campaign_member(uuid) from public;
revoke all on function private.is_campaign_gm(uuid) from public;
revoke all on function private.can_manage_campaign(uuid) from public;
revoke all on function private.can_participate(uuid) from public;
revoke all on function private.shares_campaign_with(uuid) from public;
revoke all on function private.current_verified_email() from public;
grant execute on function private.campaign_role(uuid) to authenticated, service_role;
grant execute on function private.is_campaign_member(uuid) to authenticated, service_role;
grant execute on function private.is_campaign_gm(uuid) to authenticated, service_role;
grant execute on function private.can_manage_campaign(uuid) to authenticated, service_role;
grant execute on function private.can_participate(uuid) to authenticated, service_role;
grant execute on function private.shares_campaign_with(uuid) to authenticated, service_role;
grant execute on function private.current_verified_email() to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Gatilhos de campanha: limites do plano e participação do dono
-- -----------------------------------------------------------------------------
create function private.campaigns_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
begin
  new.status := 'active';
  new.archived_at := null;
  new.created_at := now();
  new.updated_at := now();

  v_limit := (private.plan_limits(new.owner_id)).max_owned_campaigns;
  if v_limit is not null then
    perform pg_advisory_xact_lock(hashtextextended('codexveil:campaigns:' || new.owner_id::text, 0));
    if (select count(*) from public.campaigns c where c.owner_id = new.owner_id) >= v_limit then
      perform private.raise_limit_reached('maxOwnedCampaigns');
    end if;
  end if;
  return new;
end;
$$;

create function private.campaigns_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.campaign_members (campaign_id, user_id, role)
  values (new.id, new.owner_id, 'gm');
  return new;
end;
$$;

create trigger campaigns_before_insert
  before insert on public.campaigns
  for each row execute function private.campaigns_before_insert();

create trigger campaigns_after_insert
  after insert on public.campaigns
  for each row execute function private.campaigns_after_insert();

revoke all on function private.campaigns_before_insert() from public;
revoke all on function private.campaigns_after_insert() from public;

-- -----------------------------------------------------------------------------
-- RLS: campanhas, participantes e perfis compartilhados
-- -----------------------------------------------------------------------------
alter table public.campaigns enable row level security;
alter table public.campaign_members enable row level security;

create policy "Participantes veem a campanha"
  on public.campaigns for select
  to authenticated
  using (owner_id = (select auth.uid()) or private.is_campaign_member(id));

create policy "Usuário cria campanhas próprias"
  on public.campaigns for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy "Mestres editam campanhas ativas"
  on public.campaigns for update
  to authenticated
  using (private.can_manage_campaign(id))
  with check (private.can_manage_campaign(id));

create policy "Somente o mestre responsável exclui a campanha"
  on public.campaigns for delete
  to authenticated
  using (owner_id = (select auth.uid()));

create policy "Participantes veem os demais participantes"
  on public.campaign_members for select
  to authenticated
  using (private.is_campaign_member(campaign_id));

create policy "Participantes de uma mesma campanha veem os perfis uns dos outros"
  on public.profiles for select
  to authenticated
  using (private.shares_campaign_with(id));

revoke all on table public.campaigns, public.campaign_members from anon, authenticated;
grant select, delete on table public.campaigns to authenticated;
grant insert (name, description, system_id, party_sheets_visible, players_can_edit_sheets)
  on table public.campaigns to authenticated;
grant update (name, description, cover_path, party_sheets_visible, players_can_edit_sheets)
  on table public.campaigns to authenticated;
grant select on table public.campaign_members to authenticated;
grant all on table public.campaigns, public.campaign_members to service_role;

-- -----------------------------------------------------------------------------
-- Convites
-- -----------------------------------------------------------------------------
-- Código com 60 bits de aleatoriedade criptográfica (bytes aleatórios de UUIDs v4,
-- sem os bits de versão/variante). Cada byte módulo 32 é uniforme (256 = 8 × 32).
create function private.generate_invite_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_code text := '';
begin
  v_bytes := substring(uuid_send(gen_random_uuid()) from 1 for 6)
          || substring(uuid_send(gen_random_uuid()) from 11 for 6);
  for i in 0..11 loop
    v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
  end loop;
  return v_code;
end;
$$;

revoke all on function private.generate_invite_code() from public;
grant execute on function private.generate_invite_code() to authenticated, service_role;

create table public.campaign_invites (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  -- O gatilho sempre regenera o código; o cliente nunca o escolhe (sem GRANT na coluna).
  code text not null unique default private.generate_invite_code()
    check (code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{12}$'),
  role public.campaign_role not null default 'player' check (role = 'player'),
  invited_email text check (
    invited_email is null
    or (
      char_length(invited_email) between 3 and 254
      and invited_email = lower(btrim(invited_email))
      and invited_email ~ '^[^@[:space:]]+@[^@[:space:]]+$'
    )
  ),
  max_uses integer check (max_uses is null or max_uses between 1 and 50),
  uses_count integer not null default 0 check (uses_count >= 0),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  declined_at timestamptz,
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint campaign_invites_expiry
    check (expires_at > created_at and expires_at <= created_at + interval '30 days'),
  constraint campaign_invites_personal_single_use check (invited_email is null or max_uses = 1),
  constraint campaign_invites_uses check (max_uses is null or uses_count <= max_uses)
);

comment on table public.campaign_invites is
  'Convites por código/link. invited_email preenchido = convite pessoal de uso único.';

create index campaign_invites_campaign_id_idx on public.campaign_invites (campaign_id);
create index campaign_invites_pending_email_idx on public.campaign_invites (invited_email)
  where invited_email is not null and revoked_at is null and declined_at is null;

create function private.campaign_invites_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- O cliente nunca escolhe o código nem os campos de controle.
  new.created_by := auth.uid();
  new.created_at := now();
  new.uses_count := 0;
  new.revoked_at := null;
  new.declined_at := null;
  new.role := 'player';
  new.invited_email := nullif(lower(btrim(new.invited_email)), '');
  if new.invited_email is not null then
    new.max_uses := 1;
  end if;
  loop
    new.code := private.generate_invite_code();
    exit when not exists (select 1 from public.campaign_invites i where i.code = new.code);
  end loop;
  return new;
end;
$$;

create trigger campaign_invites_before_insert
  before insert on public.campaign_invites
  for each row execute function private.campaign_invites_before_insert();

revoke all on function private.campaign_invites_before_insert() from public;

alter table public.campaign_invites enable row level security;

create policy "Mestres veem os convites da campanha"
  on public.campaign_invites for select
  to authenticated
  using (private.is_campaign_gm(campaign_id));

create policy "Mestres criam convites em campanhas ativas"
  on public.campaign_invites for insert
  to authenticated
  with check (private.can_manage_campaign(campaign_id));

create policy "Mestres excluem convites"
  on public.campaign_invites for delete
  to authenticated
  using (private.is_campaign_gm(campaign_id));

revoke all on table public.campaign_invites from anon, authenticated;
grant select, delete on table public.campaign_invites to authenticated;
grant insert (campaign_id, invited_email, max_uses, expires_at)
  on table public.campaign_invites to authenticated;
grant all on table public.campaign_invites to service_role;

-- Normaliza códigos digitados (espaços, hífens, minúsculas).
create function private.normalize_invite_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[[:space:]-]', '', 'g'));
$$;

-- Motivo pelo qual o usuário atual não pode aceitar o convite (NULL = pode aceitar).
-- Os códigos coincidem com InviteRejectionReason em @codexveil/domain.
create function private.invite_rejection_reason(
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
  elsif exists (
    select 1 from public.campaign_members m
    where m.campaign_id = p_campaign.id and m.user_id = (select auth.uid())
  ) then
    return 'already_member';
  end if;
  return null;
end;
$$;

revoke all on function private.normalize_invite_code(text) from public;
revoke all on function private.invite_rejection_reason(public.campaign_invites, public.campaigns)
  from public;

-- Prévia do convite antes de aceitar. Detalhes da campanha só aparecem quando o
-- convite é utilizável (ou quando o usuário já participa dela).
create function public.get_invite_preview(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_code text := private.normalize_invite_code(p_code);
  v_invite public.campaign_invites;
  v_campaign public.campaigns;
  v_reason text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;
  if v_code !~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{12}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_code');
  end if;

  select * into v_invite from public.campaign_invites i where i.code = v_code;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  select * into v_campaign from public.campaigns c where c.id = v_invite.campaign_id;

  v_reason := private.invite_rejection_reason(v_invite, v_campaign);
  if v_reason is not null and v_reason <> 'already_member' then
    return jsonb_build_object('ok', false, 'reason', v_reason);
  end if;

  return jsonb_build_object(
    'ok', v_reason is null,
    'reason', v_reason,
    'expiresAt', v_invite.expires_at,
    'isPersonal', v_invite.invited_email is not null,
    'campaign', jsonb_build_object(
      'id', v_campaign.id,
      'name', v_campaign.name,
      'description', v_campaign.description,
      'systemId', v_campaign.system_id,
      'ownerName', (select p.display_name from public.profiles p where p.id = v_campaign.owner_id),
      'memberCount', (
        select count(*) from public.campaign_members m where m.campaign_id = v_campaign.id
      )
    )
  );
end;
$$;

create function public.accept_campaign_invite(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := private.normalize_invite_code(p_code);
  v_invite public.campaign_invites;
  v_campaign public.campaigns;
  v_reason text;
  v_limit integer;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;
  if v_code !~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{12}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_code');
  end if;

  -- Trava o convite: aceites simultâneos são serializados e respeitam max_uses.
  select * into v_invite from public.campaign_invites i where i.code = v_code for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  select * into v_campaign from public.campaigns c where c.id = v_invite.campaign_id for share;

  v_reason := private.invite_rejection_reason(v_invite, v_campaign);
  if v_reason is not null then
    return jsonb_build_object(
      'ok', false,
      'reason', v_reason,
      'campaignId', case when v_reason = 'already_member' then v_campaign.id end
    );
  end if;

  v_limit := (private.plan_limits(v_campaign.owner_id)).max_members_per_campaign;
  if v_limit is not null
    and (select count(*) from public.campaign_members m where m.campaign_id = v_campaign.id) >= v_limit
  then
    perform private.raise_limit_reached('maxMembersPerCampaign');
  end if;

  insert into public.campaign_members (campaign_id, user_id, role)
  values (v_campaign.id, v_uid, v_invite.role);

  update public.campaign_invites set uses_count = uses_count + 1 where id = v_invite.id;

  return jsonb_build_object('ok', true, 'campaignId', v_campaign.id);
end;
$$;

-- Recusa um convite pessoal. Convites por link não precisam de registro de recusa.
create function public.decline_campaign_invite(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_code text := private.normalize_invite_code(p_code);
  v_invite public.campaign_invites;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  select * into v_invite from public.campaign_invites i where i.code = v_code for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if v_invite.invited_email is null then
    return jsonb_build_object('ok', true);
  end if;
  if v_invite.invited_email is distinct from private.current_verified_email() then
    return jsonb_build_object('ok', false, 'reason', 'email_mismatch');
  end if;

  update public.campaign_invites
  set declined_at = coalesce(declined_at, now())
  where id = v_invite.id;
  return jsonb_build_object('ok', true);
end;
$$;

create function public.revoke_campaign_invite(p_invite_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_campaign_id uuid;
begin
  select i.campaign_id into v_campaign_id from public.campaign_invites i where i.id = p_invite_id;
  if v_campaign_id is null or not private.is_campaign_gm(v_campaign_id) then
    raise exception 'Convite não encontrado.' using errcode = 'P0002';
  end if;
  update public.campaign_invites
  set revoked_at = coalesce(revoked_at, now())
  where id = p_invite_id;
end;
$$;

-- Convites pessoais pendentes para o e-mail verificado do usuário atual (dashboard).
create function public.get_my_pending_invites()
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
  where i.invited_email = private.current_verified_email()
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

-- -----------------------------------------------------------------------------
-- Gestão de participantes e do ciclo de vida da campanha
-- -----------------------------------------------------------------------------

-- Remove a participação e desvincula os personagens do usuário (que continuam dele).
create function private.detach_member(p_campaign_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.encounter_combatants ec
  using public.characters ch
  where ec.character_id = ch.id
    and ch.campaign_id = p_campaign_id
    and ch.owner_id = p_user_id;

  update public.characters
  set campaign_id = null
  where campaign_id = p_campaign_id and owner_id = p_user_id;

  delete from public.campaign_members
  where campaign_id = p_campaign_id and user_id = p_user_id;
end;
$$;

revoke all on function private.detach_member(uuid, uuid) from public;

create function public.remove_campaign_member(p_campaign_id uuid, p_user_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_campaign public.campaigns;
  v_target_role public.campaign_role;
begin
  select * into v_campaign from public.campaigns c where c.id = p_campaign_id;
  if not found or not private.is_campaign_member(p_campaign_id) then
    raise exception 'Campanha não encontrada.' using errcode = 'P0002';
  end if;
  if v_campaign.status <> 'active' then
    raise exception 'A campanha está arquivada.' using errcode = 'CVARC';
  end if;

  select m.role into v_target_role
  from public.campaign_members m
  where m.campaign_id = p_campaign_id and m.user_id = p_user_id;
  if v_target_role is null then
    raise exception 'Participante não encontrado.' using errcode = 'P0002';
  end if;

  if p_user_id = v_campaign.owner_id then
    raise exception 'O mestre responsável não pode ser removido.' using errcode = '42501';
  end if;
  if p_user_id = v_uid then
    raise exception 'Para sair da campanha, use leave_campaign.' using errcode = '42501';
  end if;
  if v_target_role = 'gm' and v_uid <> v_campaign.owner_id then
    raise exception 'Somente o mestre responsável remove outros mestres.' using errcode = '42501';
  end if;
  if not private.is_campaign_gm(p_campaign_id) then
    raise exception 'Somente mestres removem participantes.' using errcode = '42501';
  end if;

  perform private.detach_member(p_campaign_id, p_user_id);
end;
$$;

create function public.leave_campaign(p_campaign_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_owner_id uuid;
begin
  select c.owner_id into v_owner_id from public.campaigns c where c.id = p_campaign_id;
  if v_owner_id is null or not private.is_campaign_member(p_campaign_id) then
    raise exception 'Campanha não encontrada.' using errcode = 'P0002';
  end if;
  if v_owner_id = v_uid then
    raise exception 'O mestre responsável não pode sair; transfira a campanha ou arquive-a.'
      using errcode = '42501';
  end if;
  perform private.detach_member(p_campaign_id, v_uid);
end;
$$;

create function public.set_campaign_member_role(
  p_campaign_id uuid,
  p_user_id uuid,
  p_role public.campaign_role
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_campaign public.campaigns;
begin
  select * into v_campaign from public.campaigns c where c.id = p_campaign_id;
  if not found or not private.is_campaign_member(p_campaign_id) then
    raise exception 'Campanha não encontrada.' using errcode = 'P0002';
  end if;
  if v_campaign.owner_id <> auth.uid() then
    raise exception 'Somente o mestre responsável altera papéis.' using errcode = '42501';
  end if;
  if v_campaign.status <> 'active' then
    raise exception 'A campanha está arquivada.' using errcode = 'CVARC';
  end if;
  if p_user_id = v_campaign.owner_id then
    raise exception 'O papel do mestre responsável não pode ser alterado.' using errcode = '42501';
  end if;

  update public.campaign_members
  set role = p_role
  where campaign_id = p_campaign_id and user_id = p_user_id;
  if not found then
    raise exception 'Participante não encontrado.' using errcode = 'P0002';
  end if;
end;
$$;

create function public.transfer_campaign_ownership(p_campaign_id uuid, p_new_owner_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_campaign public.campaigns;
  v_limit integer;
begin
  select * into v_campaign from public.campaigns c where c.id = p_campaign_id for update;
  if not found or not private.is_campaign_member(p_campaign_id) then
    raise exception 'Campanha não encontrada.' using errcode = 'P0002';
  end if;
  if v_campaign.owner_id <> auth.uid() then
    raise exception 'Somente o mestre responsável transfere a campanha.' using errcode = '42501';
  end if;
  if v_campaign.status <> 'active' then
    raise exception 'A campanha está arquivada.' using errcode = 'CVARC';
  end if;
  if not exists (
    select 1 from public.campaign_members m
    where m.campaign_id = p_campaign_id and m.user_id = p_new_owner_id and m.role = 'gm'
  ) then
    raise exception 'O novo responsável precisa ser mestre desta campanha.' using errcode = '42501';
  end if;

  v_limit := (private.plan_limits(p_new_owner_id)).max_owned_campaigns;
  if v_limit is not null
    and (select count(*) from public.campaigns c where c.owner_id = p_new_owner_id) >= v_limit
  then
    perform private.raise_limit_reached('maxOwnedCampaigns');
  end if;

  update public.campaigns set owner_id = p_new_owner_id where id = p_campaign_id;
end;
$$;

create function public.archive_campaign(p_campaign_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.campaigns c
    where c.id = p_campaign_id and c.owner_id = auth.uid()
  ) then
    raise exception 'Somente o mestre responsável arquiva a campanha.' using errcode = '42501';
  end if;

  update public.campaigns
  set status = 'archived', archived_at = now()
  where id = p_campaign_id and status = 'active';

  -- Convites pendentes deixam de valer.
  update public.campaign_invites
  set revoked_at = now()
  where campaign_id = p_campaign_id and revoked_at is null;
end;
$$;

create function public.unarchive_campaign(p_campaign_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.campaigns c
    where c.id = p_campaign_id and c.owner_id = auth.uid()
  ) then
    raise exception 'Somente o mestre responsável desarquiva a campanha.' using errcode = '42501';
  end if;

  update public.campaigns
  set status = 'active', archived_at = null
  where id = p_campaign_id and status = 'archived';
end;
$$;

revoke all on function public.get_invite_preview(text) from public, anon;
revoke all on function public.accept_campaign_invite(text) from public, anon;
revoke all on function public.decline_campaign_invite(text) from public, anon;
revoke all on function public.revoke_campaign_invite(uuid) from public, anon;
revoke all on function public.get_my_pending_invites() from public, anon;
revoke all on function public.remove_campaign_member(uuid, uuid) from public, anon;
revoke all on function public.leave_campaign(uuid) from public, anon;
revoke all on function public.set_campaign_member_role(uuid, uuid, public.campaign_role)
  from public, anon;
revoke all on function public.transfer_campaign_ownership(uuid, uuid) from public, anon;
revoke all on function public.archive_campaign(uuid) from public, anon;
revoke all on function public.unarchive_campaign(uuid) from public, anon;

grant execute on function public.get_invite_preview(text) to authenticated;
grant execute on function public.accept_campaign_invite(text) to authenticated;
grant execute on function public.decline_campaign_invite(text) to authenticated;
grant execute on function public.revoke_campaign_invite(uuid) to authenticated;
grant execute on function public.get_my_pending_invites() to authenticated;
grant execute on function public.remove_campaign_member(uuid, uuid) to authenticated;
grant execute on function public.leave_campaign(uuid) to authenticated;
grant execute on function public.set_campaign_member_role(uuid, uuid, public.campaign_role)
  to authenticated;
grant execute on function public.transfer_campaign_ownership(uuid, uuid) to authenticated;
grant execute on function public.archive_campaign(uuid) to authenticated;
grant execute on function public.unarchive_campaign(uuid) to authenticated;
