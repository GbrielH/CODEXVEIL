-- Ações de combate personalizadas (pedido de 2026-10-20): o mestre cria ações próprias da
-- campanha (nome, tipo de ação, descrição e dado opcional) que aparecem para os jogadores no turno.
-- Guardadas como lista JSON em campaigns.custom_actions (até 40; a aplicação valida o formato).

alter table public.campaigns
  add column custom_actions jsonb not null default '[]'::jsonb
    check (jsonb_typeof(custom_actions) = 'array' and jsonb_array_length(custom_actions) <= 40);

comment on column public.campaigns.custom_actions is
  'Ações de combate criadas pelo mestre: [{ id, name, kind, description, roll }].';

grant update (custom_actions) on table public.campaigns to authenticated;
