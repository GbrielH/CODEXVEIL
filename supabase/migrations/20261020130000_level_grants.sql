-- Subida de nível nas campanhas (pedido de 2026-10-20): o mestre sobe o nível dos jogadores e o
-- jogador só escolhe as melhorias do nível novo na aba Evolução.
--   * characters.granted_level: até que nível o mestre liberou (0 = nada liberado).
--   * Só o mestre muda granted_level (RPC grant_character_level; a coluna não tem grant direto).
--   * Em campanha, o jogador não sobe além do nível liberado (gatilho, SQLSTATE CVLVL).
--   * Com nível liberado pendente, o dono pode salvar a ficha e criar as habilidades do nível
--     mesmo quando a campanha bloqueia a edição de fichas.

alter table public.characters
  add column granted_level smallint not null default 0 check (granted_level between 0 and 20);

comment on column public.characters.granted_level is
  'Nível liberado pelo mestre (campanha). O jogador sobe até ele escolhendo as melhorias.';

-- Nível total da ficha: soma dos níveis das classes (D&D 5e e Tormenta20 usam identity.classes).
create function private.sheet_level(p_sheet jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce(sum(
    case when jsonb_typeof(c -> 'level') = 'number' then (c ->> 'level')::numeric::integer else 0 end
  ), 0)::integer
  from jsonb_array_elements(
    case when jsonb_typeof(p_sheet -> 'identity' -> 'classes') = 'array' then p_sheet -> 'identity' -> 'classes' else '[]'::jsonb end
  ) as c;
$$;

revoke all on function private.sheet_level(jsonb) from public;
grant execute on function private.sheet_level(jsonb) to authenticated, service_role;

-- Dono com nível liberado ainda não aplicado.
create function private.has_pending_level(p_character_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select c.owner_id = (select auth.uid())
        and c.campaign_id is not null
        and c.granted_level > private.sheet_level(c.sheet)
     from public.characters c where c.id = p_character_id),
    false
  );
$$;

revoke all on function private.has_pending_level(uuid) from public;
grant execute on function private.has_pending_level(uuid) to authenticated, service_role;

-- Habilidades do nível novo: quem edita a ficha ou o dono com nível liberado pendente.
create or replace function private.can_edit_character_sheet(p_character_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select private.can_edit_character_sheet_row(c.owner_id, c.campaign_id)
     from public.characters c where c.id = p_character_id),
    false
  ) or private.has_pending_level(p_character_id);
$$;

drop policy "Dono ou mestre edita a ficha conforme as regras da campanha" on public.characters;
create policy "Dono ou mestre edita a ficha conforme as regras da campanha"
  on public.characters for update
  to authenticated
  using (
    private.can_edit_character_sheet_row(owner_id, campaign_id)
    or (owner_id = (select auth.uid()) and campaign_id is not null and granted_level > private.sheet_level(sheet))
  )
  with check (
    private.can_edit_character_sheet_row(owner_id, campaign_id)
    or (owner_id = (select auth.uid()) and campaign_id is not null and granted_level >= private.sheet_level(sheet))
  );

-- Em campanha, só o mestre muda o nível liberado, e o jogador não passa dele.
create function private.characters_level_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_gm boolean;
begin
  if new.campaign_id is null then
    return new;
  end if;
  select exists (
    select 1 from public.campaign_members m
    where m.campaign_id = new.campaign_id and m.user_id = (select auth.uid()) and m.role = 'gm'
  ) into v_is_gm;
  -- Chamadas internas (service_role, sem usuário) não passam pela regra.
  if (select auth.uid()) is null or v_is_gm then
    return new;
  end if;
  if new.granted_level is distinct from old.granted_level then
    raise exception 'Só o mestre libera níveis.' using errcode = 'CVLVL';
  end if;
  if private.sheet_level(new.sheet) > private.sheet_level(old.sheet)
     and private.sheet_level(new.sheet) > new.granted_level then
    raise exception 'O mestre ainda não liberou este nível.' using errcode = 'CVLVL';
  end if;
  return new;
end;
$$;

create trigger characters_level_guard
  before update on public.characters
  for each row execute function private.characters_level_guard();

-- O mestre libera o próximo nível (ou um nível específico) de um personagem da campanha.
create function public.grant_character_level(p_character_id uuid, p_level integer default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_character public.characters%rowtype;
  v_target integer;
begin
  select * into v_character from public.characters where id = p_character_id;
  if not found or v_character.campaign_id is null then
    raise exception 'Personagem fora de campanha.' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.campaign_members m
    join public.campaigns c on c.id = m.campaign_id
    where m.campaign_id = v_character.campaign_id and m.user_id = (select auth.uid()) and m.role = 'gm' and c.status = 'active'
  ) then
    raise exception 'Só o mestre libera níveis.' using errcode = '42501';
  end if;
  v_target := coalesce(p_level, greatest(v_character.granted_level, private.sheet_level(v_character.sheet)) + 1);
  v_target := least(20, greatest(0, v_target));
  update public.characters set granted_level = v_target where id = p_character_id;
  return v_target;
end;
$$;

revoke all on function public.grant_character_level(uuid, integer) from public;
grant execute on function public.grant_character_level(uuid, integer) to authenticated;
