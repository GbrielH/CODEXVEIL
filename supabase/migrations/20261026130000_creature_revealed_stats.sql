-- =============================================================================
-- Biblioteca da campanha: o mestre escolhe quais partes da ficha da criatura os jogadores veem
-- (CA, PV, atributos, ações…), e pode liberar ou ocultar a qualquer momento.
--   * `creatures.revealed_stats`: chaves do bloco de estatísticas liberadas (`armorClass`,
--     `actions`, `defense`…). Vazio = nada da ficha à mostra (só o perfil, se o registro estiver
--     revelado).
--   * `creature_revealed_stats(id)`: devolve aos membros só essas chaves de `creature_gm_data.stats`,
--     e só de registros revelados ao grupo. Notas, segredos e o resto da ficha nunca saem.
-- =============================================================================

alter table public.creatures
  add column revealed_stats text[] not null default '{}'
    check (cardinality(revealed_stats) <= 40);

comment on column public.creatures.revealed_stats is
  'Chaves do bloco de estatísticas que os jogadores podem ver (o mestre libera e oculta à vontade).';

-- Só o mestre altera (a política de update da tabela já restringe a quem pode gerenciar a campanha).
grant update (revealed_stats) on table public.creatures to authenticated;

create function public.creature_revealed_stats(p_creature_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(entry.key, entry.value), '{}'::jsonb)
  from public.creatures c
  join public.creature_gm_data g on g.creature_id = c.id
  cross join lateral jsonb_each(g.stats) as entry
  where c.id = p_creature_id
    and private.is_campaign_member(c.campaign_id)
    and (c.visibility = 'members' or private.is_campaign_gm(c.campaign_id))
    and entry.key = any (c.revealed_stats);
$$;

revoke all on function public.creature_revealed_stats(uuid) from public, anon;
grant execute on function public.creature_revealed_stats(uuid) to authenticated;
