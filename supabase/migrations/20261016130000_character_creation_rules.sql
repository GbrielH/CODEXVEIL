-- =============================================================================
-- Codexveil — 07 · Criação guiada de personagens e ajustes de mídia
--
--   * campaigns.character_rules: regras de criação definidas pelo mestre (nível inicial,
--     métodos de atributo...). O conteúdo é do módulo do sistema de RPG; o banco só garante
--     que é um objeto JSON pequeno.
--   * Mestres não criam personagens na própria campanha: usam NPCs e monstros. A regra vale
--     para novos personagens e para vincular um existente (SQLSTATE próprio CVGMC).
--   * create_character passa a gravar também o inventário inicial e as habilidades, magias e
--     ataques montados pelo assistente, na mesma transação.
--   * Habilidades iniciais: o dono pode gravá-las na transação que cria o personagem, mesmo
--     quando a campanha trava a edição da ficha pelos jogadores.
--   * Avatares deixam de existir no produto: o envio e a troca de arquivos no bucket
--     `avatars` são bloqueados (leitura e remoção continuam). A mídia das campanhas passa a
--     aceitar no máximo 2 MB por arquivo; os apps comprimem as imagens antes do envio.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Regras de criação por campanha
-- -----------------------------------------------------------------------------
alter table public.campaigns
  add column character_rules jsonb not null default '{}'::jsonb
    constraint campaigns_character_rules_check
    check (jsonb_typeof(character_rules) = 'object' and pg_column_size(character_rules) <= 4096);

comment on column public.campaigns.character_rules is
  'Regras de criação de personagens do mestre (ex.: nível inicial). Validadas pelo módulo do sistema.';

grant insert (character_rules), update (character_rules) on table public.campaigns to authenticated;

-- -----------------------------------------------------------------------------
-- Mestres não são donos de personagens das próprias campanhas
-- -----------------------------------------------------------------------------
create or replace function private.characters_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign public.campaigns;
  v_limit integer;
begin
  if tg_op = 'INSERT' then
    new.version := 1;
    new.created_at := now();
    new.updated_at := now();
    new.live_updated_at := now();

    v_limit := (private.plan_limits(new.owner_id)).max_owned_characters;
    if v_limit is not null then
      perform pg_advisory_xact_lock(
        hashtextextended('codexveil:characters:' || new.owner_id::text, 0)
      );
      if (select count(*) from public.characters c where c.owner_id = new.owner_id) >= v_limit then
        perform private.raise_limit_reached('maxOwnedCharacters');
      end if;
    end if;
  else
    if new.system_id is distinct from old.system_id or new.owner_id is distinct from old.owner_id then
      raise exception 'O sistema e o dono de um personagem não podem ser alterados.'
        using errcode = '42501';
    end if;
    if (new.name, new.portrait_path, new.sheet, new.campaign_id)
       is distinct from (old.name, old.portrait_path, old.sheet, old.campaign_id) then
      new.version := old.version + 1;
      new.updated_at := now();
    else
      new.version := old.version;
      new.updated_at := old.updated_at;
    end if;
  end if;

  if new.campaign_id is not null
     and (tg_op = 'INSERT' or new.campaign_id is distinct from old.campaign_id) then
    select * into v_campaign from public.campaigns c where c.id = new.campaign_id;
    if not found then
      raise exception 'Campanha não encontrada.' using errcode = 'P0002';
    end if;
    if v_campaign.status <> 'active' then
      raise exception 'A campanha está arquivada.' using errcode = 'CVARC';
    end if;
    if v_campaign.system_id <> new.system_id then
      raise exception 'O personagem precisa usar o mesmo sistema da campanha.'
        using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.campaign_members m
      where m.campaign_id = new.campaign_id and m.user_id = new.owner_id
    ) then
      raise exception 'O dono do personagem precisa participar da campanha.'
        using errcode = '42501';
    end if;
    if exists (
      select 1 from public.campaign_members m
      where m.campaign_id = new.campaign_id and m.user_id = new.owner_id and m.role = 'gm'
    ) then
      raise exception 'Mestres não criam personagens na própria campanha: use NPCs e monstros da biblioteca.'
        using errcode = 'CVGMC';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.characters_before_write() from public;

-- -----------------------------------------------------------------------------
-- Habilidades iniciais em campanhas com a ficha travada
-- -----------------------------------------------------------------------------
-- `now()` é o instante de início da transação: só é igual a `created_at` dentro da mesma
-- transação que inseriu o personagem, ou seja, na chamada de create_character.
create function private.is_character_being_created(p_character_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.characters c
    where c.id = p_character_id
      and c.owner_id = (select auth.uid())
      and c.created_at = now()
  );
$$;

revoke all on function private.is_character_being_created(uuid) from public;
grant execute on function private.is_character_being_created(uuid) to authenticated, service_role;

drop policy "Quem edita a ficha cria habilidades" on public.character_abilities;
create policy "Quem edita a ficha (ou cria o personagem) cria habilidades"
  on public.character_abilities for insert to authenticated
  with check (
    private.can_edit_character_sheet(character_id)
    or private.is_character_being_created(character_id)
  );

-- -----------------------------------------------------------------------------
-- create_character com inventário e habilidades iniciais
-- -----------------------------------------------------------------------------
drop function public.create_character(text, text, uuid, jsonb, jsonb);

create function public.create_character(
  p_name text,
  p_system_id text,
  p_campaign_id uuid default null,
  p_sheet jsonb default '{}'::jsonb,
  p_resources jsonb default '[]'::jsonb,
  p_items jsonb default '[]'::jsonb,
  p_abilities jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if jsonb_typeof(coalesce(p_resources, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_resources, '[]'::jsonb)) > 100 then
    raise exception 'Lista de recursos inválida.' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) > 200 then
    raise exception 'Lista de itens inválida.' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_abilities, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_abilities, '[]'::jsonb)) > 300 then
    raise exception 'Lista de habilidades inválida.' using errcode = '22023';
  end if;

  insert into public.characters (name, system_id, campaign_id, sheet)
  values (p_name, p_system_id, p_campaign_id, coalesce(p_sheet, '{}'::jsonb))
  returning id into v_id;

  insert into public.character_resources
    (character_id, key, label, current, max, temp, recovery, display, sort_order)
  select
    v_id,
    r ->> 'key',
    r ->> 'label',
    coalesce((r ->> 'current')::integer, 0),
    (r ->> 'max')::integer,
    0,
    coalesce((r ->> 'recovery')::public.resource_recovery, 'manual'),
    coalesce(r ->> 'display', 'pool'),
    coalesce((r ->> 'sortOrder')::integer, 0)
  from jsonb_array_elements(coalesce(p_resources, '[]'::jsonb)) as r;

  insert into public.character_items
    (character_id, name, category, quantity, weight, description, notes, is_equipped, sort_order)
  select
    v_id,
    i ->> 'name',
    coalesce((i ->> 'category')::public.item_category, 'gear'),
    coalesce((i ->> 'quantity')::integer, 1),
    (i ->> 'weight')::numeric,
    coalesce(i ->> 'description', ''),
    coalesce(i ->> 'notes', ''),
    coalesce((i ->> 'isEquipped')::boolean, false),
    coalesce((i ->> 'sortOrder')::integer, 0)
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as i;

  insert into public.character_abilities
    (character_id, kind, name, source, description, data, resource_id, sort_order)
  select
    v_id,
    (a ->> 'kind')::public.ability_entry_kind,
    a ->> 'name',
    coalesce(a ->> 'source', ''),
    coalesce(a ->> 'description', ''),
    coalesce(a -> 'data', '{}'::jsonb),
    (
      select r.id from public.character_resources r
      where r.character_id = v_id and r.key = a ->> 'resourceKey'
    ),
    coalesce((a ->> 'sortOrder')::integer, 0)
  from jsonb_array_elements(coalesce(p_abilities, '[]'::jsonb)) as a;

  return v_id;
end;
$$;

revoke all on function public.create_character(text, text, uuid, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.create_character(text, text, uuid, jsonb, jsonb, jsonb, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- Mídia: sem novos avatares e limite menor para imagens das campanhas
-- -----------------------------------------------------------------------------
drop policy "Avatares: envio somente na própria pasta" on storage.objects;
drop policy "Avatares: substituição somente na própria pasta" on storage.objects;
revoke update (avatar_path) on table public.profiles from authenticated;

update storage.buckets set file_size_limit = 2097152 where id = 'campaign-media';
