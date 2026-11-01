-- NPC com ficha de jogador (2026-11-01): o mestre cria uma ficha pessoal pelo assistente (que
-- progride como a dos jogadores) e a guarda na biblioteca da campanha. A ficha continua fora do
-- grupo (campaign_id nulo), então só o dono vê e edita; `npc_campaign_id` só diz onde listá-la.
alter table public.characters
  add column npc_campaign_id uuid references public.campaigns (id) on delete set null,
  add constraint characters_npc_outside_party check (npc_campaign_id is null or campaign_id is null);

create index characters_npc_campaign_id_idx on public.characters (npc_campaign_id)
  where npc_campaign_id is not null;

create function public.set_character_npc_campaign(p_character_id uuid, p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_character public.characters;
begin
  select * into v_character from public.characters c
  where c.id = p_character_id and c.owner_id = (select auth.uid());
  if not found then
    raise exception 'Só o dono da ficha pode guardá-la como NPC.' using errcode = '42501';
  end if;
  if p_campaign_id is not null then
    if v_character.campaign_id is not null then
      raise exception 'Esta ficha já joga numa campanha.' using errcode = '22023';
    end if;
    if not private.is_campaign_gm(p_campaign_id) then
      raise exception 'Só o mestre guarda NPCs na campanha.' using errcode = '42501';
    end if;
    if not exists (
      select 1 from public.campaigns c
      where c.id = p_campaign_id and c.status = 'active' and c.system_id = v_character.system_id
    ) then
      raise exception 'A ficha precisa usar o mesmo sistema de uma campanha ativa.'
        using errcode = '22023';
    end if;
  end if;
  update public.characters set npc_campaign_id = p_campaign_id where id = p_character_id;
end;
$$;

revoke all on function public.set_character_npc_campaign(uuid, uuid) from public, anon;
grant execute on function public.set_character_npc_campaign(uuid, uuid)
  to authenticated, service_role;
