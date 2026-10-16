-- =============================================================================
-- Codexveil — 06 · Realtime
--
-- Somente tabelas cujo estado muda durante uma sessão de jogo são publicadas.
-- O Realtime (Postgres Changes) aplica as mesmas policies RLS a cada assinante, então
-- jogadores não recebem linhas que não poderiam consultar. Em eventos DELETE, apenas a
-- chave primária é enviada. Os clientes usam os eventos como sinal para recarregar os
-- dados pelas consultas normais (que também passam pelo RLS).
-- =============================================================================

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.campaign_members,
      public.characters,
      public.character_resources,
      public.character_conditions,
      public.session_entities,
      public.encounters,
      public.encounter_combatants;
  end if;
end;
$$;
