# Auditoria de gravações e permissões de coluna — 2026-11-02

## Escopo

Foram procuradas todas as chamadas `.upsert()`, `.update()` e `.insert()` em `packages/` e
`apps/`, fora de testes e de `node_modules`. Para cada gravação PostgREST, as colunas enviadas
foram comparadas com os `GRANT INSERT` e `GRANT UPDATE` acumulados nas migrações.

As gravações auditadas cobrem estas tabelas: `tavern_messages`, `sessions`, `session_blocks`,
`session_entities`, `encounters`, `encounter_combatants`, `profiles`, `campaign_notes`,
`session_maps`, `map_tokens`, `session_map_secrets`, `campaigns`, `creatures`,
`creature_gm_data`, `campaign_items`, `character_items`, `campaign_invites`,
`character_shares`, `character_drafts`, `user_dice`, `conflict_objectives`, `card_decks`,
`characters`, `character_answers`, `character_resources`, `character_conditions`,
`character_abilities`, `character_events`, `call_rooms`, `transcript_segments`,
`session_highlights`, `book_packs`, `book_entries`, `campaign_boards` e
`assimilacao_master`.

## Resultado

- `character_answers` pode continuar usando `upsert`: a migração concede `INSERT` e `UPDATE` da
  tabela inteira, portanto as chaves `character_id` e `campaign_id` enviadas pelo PostgREST não
  causam 42501.
- `saveMapSecrets`, corrigido antes desta auditoria, foi reconferido: atualiza somente `drawings`
  e insere `map_id`, `campaign_id` e `drawings` apenas quando a linha ainda não existe.
- Foi encontrado um defeito em `saveCardDeck`: o `upsert` enviava `campaign_id`, `deck`, `pile`,
  `drawn` e `shown`, mas `authenticated` só pode atualizar `pile`, `drawn` e `shown`. Ao salvar
  de novo um baralho existente, o `ON CONFLICT DO UPDATE` podia falhar com 42501.
- `saveCardDeck` agora tenta `UPDATE` apenas das três colunas mutáveis e, se nenhuma linha existir,
  faz `INSERT` com as chaves. Não foi necessário mudar grants nem criar migração.
- As demais gravações respeitam os grants de coluna acumulados. As ocorrências `.update()` nos
  componentes dos apps eram atualizações de estado/autosave, não chamadas PostgREST; as gravações
  do banco ficam nas consultas auditadas.

## Teste de regressão

`packages/database/test/rls/conflict-objectives.test.ts` reproduz, com o papel `authenticated`, o
`INSERT ... ON CONFLICT DO UPDATE SET campaign_id, deck, ...` recusado com 42501 e confirma que o
novo caminho atualiza somente `pile` e `drawn`. O conjunto PGlite intermediário passou com 232
testes e 11 testes ao vivo pulados; os números finais da rodada estão em `PROGRESS.md`.
