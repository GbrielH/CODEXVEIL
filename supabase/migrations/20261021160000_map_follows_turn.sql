-- Grade (2026-10-21): em combate, o mapa mostrado aos jogadores acompanha de quem é a vez (o
-- mapa onde está o token do personagem da vez). Ligado por padrão; desligado, o mestre troca à mão.
-- A troca é feita pela tela do mestre (aba Sessão), que acompanha os turnos.
alter table public.campaigns add column map_follows_turn boolean not null default true;
grant update (map_follows_turn) on table public.campaigns to authenticated;
