-- Aba Sessão (pedido de 2026-10-20): a lore da sessão fica oculta por padrão e o mestre libera
-- trechos durante o jogo com um clique. Os jogadores recebem os trechos liberados em tempo real.
--   * Blocos novos nascem privados (visibility = 'gm'); os existentes não mudam.
--   * session_blocks e sessions entram na publicação do Realtime. O Realtime respeita o RLS:
--     jogadores só recebem blocos públicos de sessões publicadas.

alter table public.session_blocks alter column visibility set default 'gm';

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'session_blocks'
    ) then
      alter publication supabase_realtime add table public.session_blocks;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sessions'
    ) then
      alter publication supabase_realtime add table public.sessions;
    end if;
  end if;
end
$$;
