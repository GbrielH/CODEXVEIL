-- NPCs com ficha completa fora de "Meus personagens" (2026-11-02).
--
-- A ficha guardada como NPC de uma campanha (`npc_campaign_id`) deixa de aparecer na lista de
-- personagens do dono. O mestre pode mostrá-la lá também ("Adicionar aos personagens"), com
-- `npc_listed`; sem isso, ela vive só na biblioteca da campanha.
alter table public.characters
  add column npc_listed boolean not null default false;

comment on column public.characters.npc_listed is
  'NPC de campanha que o dono também quer ver em "Meus personagens" (por padrão, não).';

create function public.set_character_npc_listed(p_character_id uuid, p_listed boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.characters
  set npc_listed = coalesce(p_listed, false)
  where id = p_character_id
    and owner_id = (select auth.uid())
    and npc_campaign_id is not null;
  if not found then
    raise exception 'Só o dono de um NPC de campanha pode mudar onde ele aparece.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.set_character_npc_listed(uuid, boolean) from public, anon;
grant execute on function public.set_character_npc_listed(uuid, boolean) to authenticated, service_role;
