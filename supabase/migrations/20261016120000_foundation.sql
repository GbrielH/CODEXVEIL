-- =============================================================================
-- Codexveil — 01 · Fundação
-- Esquema privado, tipos, funções utilitárias, sistemas de RPG, planos e perfis.
--
-- Convenções (válidas para todas as migrações):
--   * Toda tabela de `public` tem RLS habilitado e GRANTs explícitos. Desde 2026 o
--     Supabase não expõe tabelas novas à Data API sem GRANT; nunca concedemos nada a
--     `anon` além de dados de referência públicos.
--   * Funções SECURITY DEFINER usam `set search_path = ''` e nomes qualificados.
--   * Funções auxiliares de autorização ficam em `private`, que não é exposto pela API.
--   * Erros de regra de negócio usam SQLSTATEs próprios, lidos pelos clientes:
--       CVLIM — limite do plano atingido (hint = recurso limitado)
--       CVARC — campanha arquivada (somente leitura)
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Tipos enumerados
-- -----------------------------------------------------------------------------
create type public.campaign_role as enum ('gm', 'player');
create type public.campaign_status as enum ('active', 'archived');
create type public.content_visibility as enum ('members', 'gm', 'author');
create type public.creature_kind as enum ('npc', 'monster');
create type public.resource_recovery as enum ('manual', 'short_rest', 'long_rest');
create type public.item_category as enum (
  'weapon', 'armor', 'gear', 'consumable', 'tool', 'treasure', 'other'
);
create type public.ability_entry_kind as enum (
  'class_feature', 'species_trait', 'feat', 'background_feature', 'spell', 'attack', 'other'
);
create type public.session_status as enum ('planned', 'in_progress', 'completed');
create type public.session_block_type as enum (
  'paragraph', 'heading', 'subheading', 'callout', 'gm_note', 'image', 'divider',
  'list', 'checklist', 'npc_ref', 'monster_ref', 'character_ref', 'content_ref'
);
create type public.encounter_status as enum ('preparing', 'active', 'ended');

-- -----------------------------------------------------------------------------
-- Funções utilitárias
-- -----------------------------------------------------------------------------
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Converte texto em uuid sem lançar erro (usado ao interpretar caminhos do Storage).
create function private.try_uuid(p_value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p_value::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

-- Texto de usuário sem caracteres de controle (exceto quebra de linha e tabulação).
create function private.is_clean_text(p_value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_value !~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]';
$$;

-- -----------------------------------------------------------------------------
-- Sistemas de RPG (dados de referência; a lógica fica em @codexveil/rpg-systems)
-- -----------------------------------------------------------------------------
create table public.rpg_systems (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9_-]{1,31}$'),
  name text not null check (char_length(name) between 2 and 120),
  short_name text not null check (char_length(short_name) between 1 and 30),
  is_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.rpg_systems is
  'Sistemas suportados. Cada id precisa existir no registro de @codexveil/rpg-systems.';

insert into public.rpg_systems (id, name, short_name)
values ('dnd5e', 'Dungeons & Dragons 5ª Edição (SRD 5.2)', 'D&D 5e');

alter table public.rpg_systems enable row level security;

create policy "Sistemas de RPG são públicos"
  on public.rpg_systems for select
  to anon, authenticated
  using (true);

revoke all on table public.rpg_systems from anon, authenticated;
grant select on table public.rpg_systems to anon, authenticated;
grant all on table public.rpg_systems to service_role;

-- -----------------------------------------------------------------------------
-- Planos e limites (estrutura para monetização futura; nenhum limite ativo hoje)
-- -----------------------------------------------------------------------------
create table public.plans (
  id text primary key check (id ~ '^[a-z0-9_-]{2,32}$'),
  name text not null check (char_length(name) between 2 and 60),
  -- NULL = ilimitado.
  max_owned_campaigns integer check (max_owned_campaigns > 0),
  max_owned_characters integer check (max_owned_characters > 0),
  max_members_per_campaign integer check (max_members_per_campaign > 1),
  max_storage_mb integer check (max_storage_mb > 0),
  created_at timestamptz not null default now()
);

comment on table public.plans is
  'Limites configuráveis por plano. Sem preços nem cobrança: apenas regras validadas no banco.';

insert into public.plans (id, name) values ('free', 'Gratuito');

create table public.user_plans (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan_id text not null default 'free' references public.plans (id),
  updated_at timestamptz not null default now()
);

comment on table public.user_plans is
  'Plano de cada usuário. Ausência de linha = plano free. Só o backend (service_role) altera.';

alter table public.plans enable row level security;
alter table public.user_plans enable row level security;

create policy "Planos são visíveis a usuários autenticados"
  on public.plans for select
  to authenticated
  using (true);

create policy "Usuário vê o próprio plano"
  on public.user_plans for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.plans, public.user_plans from anon, authenticated;
grant select on table public.plans, public.user_plans to authenticated;
grant all on table public.plans, public.user_plans to service_role;

-- Limites efetivos de um usuário (plano free quando não há registro).
create function private.plan_limits(p_user_id uuid)
returns public.plans
language sql
stable
security definer
set search_path = ''
as $$
  select p.*
  from public.plans p
  where p.id = coalesce(
    (select up.plan_id from public.user_plans up where up.user_id = p_user_id),
    'free'
  );
$$;

create function private.raise_limit_reached(p_resource text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Limite do plano atingido: %', p_resource
    using errcode = 'CVLIM', hint = p_resource;
end;
$$;

-- -----------------------------------------------------------------------------
-- Perfis
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
    check (
      char_length(display_name) between 2 and 40
      and display_name = btrim(display_name)
      and display_name !~ '[[:cntrl:]]'
    ),
  avatar_path text check (avatar_path is null or char_length(avatar_path) <= 300),
  bio text not null default '' check (char_length(bio) <= 500 and private.is_clean_text(bio)),
  preferences jsonb not null default '{}'::jsonb
    check (jsonb_typeof(preferences) = 'object' and pg_column_size(preferences) <= 4096),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Perfil público de cada conta. O papel (mestre/jogador) pertence à participação na campanha.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

alter table public.profiles enable row level security;

create policy "Usuário vê o próprio perfil"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "Usuário atualiza o próprio perfil"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    -- O avatar precisa estar na pasta do próprio usuário no bucket `avatars`.
    and (avatar_path is null or avatar_path like (select auth.uid())::text || '/%')
  );

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name, avatar_path, bio, preferences) on table public.profiles to authenticated;
grant all on table public.profiles to service_role;

-- Cria o perfil quando uma conta é criada no Supabase Auth.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := btrim(regexp_replace(
    coalesce(new.raw_user_meta_data ->> 'display_name', ''),
    '[[:cntrl:]]', '', 'g'
  ));
  v_name := left(v_name, 40);
  if char_length(v_name) < 2 then
    v_name := 'Aventureiro';
  end if;

  insert into public.profiles (id, display_name) values (new.id, v_name);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

revoke all on function private.set_updated_at() from public;
revoke all on function private.handle_new_user() from public;
revoke all on function private.plan_limits(uuid) from public;
revoke all on function private.raise_limit_reached(text) from public;
grant execute on function private.try_uuid(text) to authenticated, service_role;
grant execute on function private.is_clean_text(text) to authenticated, service_role;
