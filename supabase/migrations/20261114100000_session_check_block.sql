-- =============================================================================
-- Bloco "Teste" no roteiro da sessão (2026-11-14)
--
-- Pedido do QA (Ordem Paranormal 2, vale para todos os sistemas): durante a sessão, o mestre tem
-- botões para rolar os testes do roteiro e libera, na hora, o que os jogadores descobrem.
--   data = { skill, dc, expression, result }
--   * skill: perícia ou atributo testado ("Percepção", "Investigação"…);
--   * dc: dificuldade (inteiro) ou null;
--   * expression: rolagem sugerida para o botão do mestre ("1d20", "2d6"…) ou null;
--   * result: o que se descobre ao passar (é o que os jogadores veem quando liberado).
-- Sem campo de nota: ao liberar, o bloco inteiro vai para os jogadores, então observações do
-- mestre ficam em blocos `gm_note` (nunca liberados). Visibilidade: 'gm' até o mestre liberar.
-- =============================================================================

alter type public.session_block_type add value if not exists 'check';

create or replace function private.is_valid_block_data(p_type public.session_block_type, p_data jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_ok boolean;
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    return false;
  end if;

  case p_type::text
    when 'paragraph', 'heading', 'subheading', 'gm_note' then
      v_ok := jsonb_typeof(p_data -> 'text') = 'string';
    when 'callout' then
      v_ok := jsonb_typeof(p_data -> 'text') = 'string'
        and p_data ->> 'tone' in ('lore', 'info', 'warning', 'danger')
        and jsonb_typeof(p_data -> 'title') in ('string', 'null');
    when 'image' then
      v_ok := jsonb_typeof(p_data -> 'path') = 'string'
        and jsonb_typeof(p_data -> 'alt') = 'string'
        and jsonb_typeof(p_data -> 'caption') in ('string', 'null');
    when 'divider' then
      v_ok := p_data = '{}'::jsonb;
    when 'list' then
      v_ok := p_data ->> 'style' in ('bulleted', 'numbered')
        and jsonb_typeof(p_data -> 'items') = 'array'
        and jsonb_array_length(p_data -> 'items') <= 200
        and not exists (
          select 1 from jsonb_array_elements(p_data -> 'items') e where jsonb_typeof(e) <> 'string'
        );
    when 'checklist' then
      v_ok := jsonb_typeof(p_data -> 'items') = 'array'
        and jsonb_array_length(p_data -> 'items') <= 200
        and not exists (
          select 1 from jsonb_array_elements(p_data -> 'items') e
          where jsonb_typeof(e -> 'id') is distinct from 'string'
             or jsonb_typeof(e -> 'text') is distinct from 'string'
             or jsonb_typeof(e -> 'checked') is distinct from 'boolean'
        );
    when 'npc_ref', 'monster_ref' then
      v_ok := jsonb_typeof(p_data -> 'creatureId') = 'string'
        and (p_data ->> 'creatureId' = '' or private.try_uuid(p_data ->> 'creatureId') is not null)
        and jsonb_typeof(p_data -> 'note') in ('string', 'null');
    when 'character_ref' then
      v_ok := jsonb_typeof(p_data -> 'characterId') = 'string'
        and (p_data ->> 'characterId' = '' or private.try_uuid(p_data ->> 'characterId') is not null)
        and jsonb_typeof(p_data -> 'note') in ('string', 'null');
    when 'content_ref' then
      v_ok := p_data ->> 'kind' in ('session', 'note')
        and jsonb_typeof(p_data -> 'targetId') = 'string'
        and (p_data ->> 'targetId' = '' or private.try_uuid(p_data ->> 'targetId') is not null)
        and jsonb_typeof(p_data -> 'note') in ('string', 'null');
    when 'check' then
      v_ok := jsonb_typeof(p_data -> 'skill') = 'string'
        and char_length(p_data ->> 'skill') <= 80
        and (jsonb_typeof(p_data -> 'dc') = 'null'
          or (jsonb_typeof(p_data -> 'dc') = 'number' and (p_data ->> 'dc')::numeric between 0 and 100))
        and (jsonb_typeof(p_data -> 'expression') = 'null'
          or (jsonb_typeof(p_data -> 'expression') = 'string' and char_length(p_data ->> 'expression') <= 60))
        and jsonb_typeof(p_data -> 'result') = 'string'
        and not (p_data ? 'note');
    else
      v_ok := false;
  end case;

  return coalesce(v_ok, false);
end;
$$;

-- A missão pronta cria os blocos já marcados "para liberar na mesa": o mestre precisa poder gravar
-- `revealable` na inserção (antes só podia mudar depois, por update).
grant insert (revealable) on table public.session_blocks to authenticated;
