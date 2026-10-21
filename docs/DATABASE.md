# Modelo de dados e migrações

O esquema fica em `supabase/migrations/` (Postgres 17 no Supabase). As regras de acesso estão
em [`SECURITY.md`](SECURITY.md).

## Convenções

- Todas as tabelas de `public` têm RLS habilitado e **GRANTs explícitos por coluna**. Colunas
  controladas pelo servidor (`id`, `version`, `created_at`, `owner_id`, `code`, `uses_count`
  etc.) não podem ser escritas pelos clientes.
- Funções auxiliares de autorização ficam no esquema `private`, que não é exposto pela API.
- Funções `SECURITY DEFINER` usam `set search_path = ''` e nomes qualificados.
- Textos têm limites de tamanho e rejeitam caracteres de controle (`private.is_clean_text`,
  `private.is_single_line`). JSONs têm tipo e tamanho máximo verificados.
- Timestamps em `timestamptz`. `updated_at` e `version` são mantidos por gatilhos.
- Erros de regra de negócio usam SQLSTATEs próprios: `CVLIM` (limite do plano) e `CVARC`
  (campanha arquivada).

## Migrações

| `20261019120000_tormenta20.sql` | Sistema `tormenta20` em `rpg_systems`; `book_entries.kind` aceita `deity` e `equipment`; edição livre em `book_packs` (ex.: "Jogo do Ano"); jogadores leem divindades e equipamento dos livros liberados |

| Arquivo                                       | Conteúdo                                                                                                                                                                                                                    |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20261016120000_foundation.sql`               | Esquema `private`, enums, utilitários, `rpg_systems`, `plans`, `user_plans`, `profiles` e criação do perfil no cadastro                                                                                                     |
| `20261016120100_campaigns.sql`                | `campaigns`, `campaign_members`, `campaign_invites`, funções de autorização e RPCs de convite, participantes, transferência e arquivamento                                                                                  |
| `20261016120200_characters.sql`               | `characters` e tabelas filhas, regras de visualização e edição, histórico, cópias de segurança e operações atômicas                                                                                                         |
| `20261016120300_sessions_library.sql`         | `creatures`, `creature_gm_data`, `sessions`, `session_blocks`, `session_entities`, `encounters`, `encounter_combatants`, `campaign_notes` e operações de roteiro                                                            |
| `20261016120400_storage.sql`                  | Buckets `avatars` e `campaign-media` e as policies de `storage.objects`                                                                                                                                                     |
| `20261016120500_realtime.sql`                 | Tabelas publicadas em `supabase_realtime`                                                                                                                                                                                   |
| `20261016130000_character_creation_rules.sql` | `campaigns.character_rules`; mestres não são donos de personagens das próprias campanhas (`CVGMC`); `create_character` com inventário e habilidades iniciais; envio de avatares bloqueado; mídia de até 2 MB                |
| `20261017120000_condition_durations.sql`      | Duração das condições em rodadas: `character_conditions.rounds_remaining`, `session_entities.condition_rounds` (podado pela lista `conditions`) e as funções `tick_character_conditions` e `tick_session_entity_conditions` |

## Entidades

### Contas e referência

| Tabela                 | Descrição                                                                                                                                                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`             | Um por conta (`auth.users`), criado por gatilho. Guarda nome de exibição, bio e `preferences` (JSON). **Não tem papel global.** A coluna `avatar_path` ficou sem uso: o produto não tem foto de perfil e o cliente não pode mais alterá-la. |
| `rpg_systems`          | Sistemas suportados (hoje `dnd5e`). Cada id precisa existir em `@codexveil/rpg-systems`.                                                                                                                                                    |
| `plans` / `user_plans` | Limites configuráveis por plano (`null` = ilimitado). Sem linha em `user_plans`, vale o plano `free`.                                                                                                                                       |

### Campanhas

| Tabela             | Descrição                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `campaigns`        | Nome, descrição, capa, sistema, dono, `status` (`active`/`archived`), `archived_at`, as configurações `party_sheets_visible` e `players_can_edit_sheets` e `character_rules` (JSON de até 4 KB com as regras de criação do mestre, validado pelo módulo do sistema; em D&D: nível inicial, métodos de atributo, alinhamentos malignos e os livros oficiais liberados, `sourcebooks`). A capa (`cover_path`) é enviada pelo mestre no site e no app. |
| `campaign_members` | PK `(campaign_id, user_id)` e `role` (`gm`/`player`). Só é escrita por gatilho (o dono vira mestre) e por RPCs.                                                                                                                                                                                                                                                                                                                                     |
| `campaign_invites` | Código de 12 caracteres gerado no banco, `invited_email` opcional (convite pessoal de uso único), `max_uses` (1 a 50), `uses_count`, `expires_at` (até 30 dias), `revoked_at` e `declined_at`.                                                                                                                                                                                                                                                      |
| `campaign_notes`   | Anotações com `visibility`: `members` (todos), `gm` (mestres e o autor) ou `author` (só o autor). Têm `is_pinned` e `version`.                                                                                                                                                                                                                                                                                                                      |

### Personagens

| Tabela                 | Descrição                                                                                                                                                                                                                                                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `characters`           | Dono, campanha opcional, sistema, nome, retrato, `sheet` (JSON do sistema, até 256 KB; em D&D guarda também os livros usados, `identity.sourcebooks`), `version` (concorrência otimista) e `live_updated_at` (sinal para o Realtime). O dono precisa ser **jogador** da campanha: mestres usam NPCs e monstros (gatilho, SQLSTATE `CVGMC`). |
| `character_resources`  | Trilhas como vida, dados de vida, espaços de magia, usos e moedas: `current`, `max`, `temp`, `recovery` (`manual`, `short_rest`, `long_rest`) e `display`. Chave única `(character_id, key)`.                                                                                                                                               |
| `character_conditions` | Uma linha por condição ativa, com `level` opcional (por exemplo, Exaustão) e `rounds_remaining` (rodadas restantes, de 1 a 10.000; `null` dura até ser removida).                                                                                                                                                                           |
| `character_items`      | Inventário: categoria, quantidade, peso, descrição, notas, `is_equipped` e `data` por sistema.                                                                                                                                                                                                                                              |
| `character_abilities`  | Traços de espécie, talentos, características de classe, magias e ataques (`kind`), com `data` por sistema e vínculo opcional a uma trilha de usos.                                                                                                                                                                                          |
| `character_events`     | Histórico de evolução imutável (subida de nível, XP, marcos, notas).                                                                                                                                                                                                                                                                        |
| `character_snapshots`  | Cópias automáticas da ficha: no máximo uma a cada 10 minutos, mantendo as 30 mais recentes.                                                                                                                                                                                                                                                 |

### Biblioteca, sessões e combate

| Tabela                                | Descrição                                                                                                                                                                                                                                                |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `creatures`                           | NPCs e monstros reutilizáveis da campanha: perfil público (nome, subtítulo, descrição, imagem) e `visibility` (`gm` ou `members` = revelado).                                                                                                            |
| `creature_gm_data`                    | 1:1 com `creatures`: estatísticas, observações e **segredos**. Só mestres leem e escrevem.                                                                                                                                                               |
| `sessions`                            | `number` sequencial por campanha (gatilho com trava), título, data, `status`, `is_published`, `recap` e `version`. Só uma sessão pode estar `in_progress` por campanha.                                                                                  |
| `session_blocks`                      | Roteiro: `type` (13 tipos), `position` (`double precision`), `visibility` (`members`/`gm`), `data` (JSON validado por tipo) e `schema_version`. `gm_note` é sempre privado.                                                                              |
| `session_entities`                    | **Instâncias** de NPCs e monstros na cena, com vida, CA, iniciativa, condições (e `condition_rounds`, as rodadas restantes de cada uma) e notas próprias. A instância copia os valores do registro-base; alterar uma não afeta o registro nem as outras. |
| `encounters` / `encounter_combatants` | Combate: rodada, combatente ativo, iniciativa, desempate e derrotado. Cada combatente vem de uma instância da cena ou de um personagem da campanha.                                                                                                      |

### Integridade entre campanhas

As tabelas filhas de campanha usam **chaves estrangeiras compostas** `(id, campaign_id)`. Isso
impede, no próprio banco, que um bloco aponte para a sessão de outra campanha ou que um
combatente use a instância de outra cena. Gatilhos também verificam que um personagem só entra
numa campanha do mesmo sistema da qual o dono participa, e que só entra em combates da própria
campanha.

## Funções expostas (RPC)

| Função                                                                                                | Uso                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_invite_preview(code)`                                                                            | Prévia do convite. Os detalhes da campanha só aparecem se o convite for utilizável.                                                                                    |
| `accept_campaign_invite(code)` / `decline_campaign_invite(code)`                                      | Aceitar (com trava e verificação de limite) ou recusar um convite.                                                                                                     |
| `revoke_campaign_invite(id)` / `get_my_pending_invites()`                                             | Revogar um convite / listar os convites pessoais pendentes do usuário.                                                                                                 |
| `remove_campaign_member`, `leave_campaign`, `set_campaign_member_role`, `transfer_campaign_ownership` | Gestão de participantes.                                                                                                                                               |
| `archive_campaign` / `unarchive_campaign`                                                             | Arquivar (revoga os convites pendentes) e desarquivar.                                                                                                                 |
| `create_character`                                                                                    | Cria o personagem com trilhas, inventário (`p_items`, até 200) e habilidades, magias e ataques (`p_abilities`, até 300, ligados às trilhas pela chave) numa transação. |
| `set_character_campaign`                                                                              | Vincula ou desvincula um personagem de uma campanha (só o dono).                                                                                                       |
| `adjust_character_resource` / `take_character_rest` / `adjust_item_quantity`                          | Dano, cura, gasto e descanso, de forma atômica.                                                                                                                        |
| `adjust_session_entity_hp`                                                                            | Dano e cura de instâncias da cena.                                                                                                                                     |
| `tick_character_conditions(id, rodadas)` / `tick_session_entity_conditions(id, rodadas)`              | Passam rodadas nas condições de um personagem ou de uma instância da cena (fim do turno), removem as que terminam e devolvem as chaves delas.                          |
| `duplicate_session` / `reorder_session_blocks`                                                        | Duplicar um roteiro e renumerar os blocos.                                                                                                                             |

As funções de personagem, cena e roteiro são `SECURITY INVOKER`, então as policies continuam
valendo. As de convite e participantes são `SECURITY DEFINER` e verificam o papel explicitamente.

## Arquivamento e exclusão

- **Arquivar** uma campanha a deixa somente leitura: as funções `can_manage_campaign` e
  `can_participate` exigem `status = 'active'`. Os dados são preservados, os convites
  pendentes são revogados e é possível desarquivar.
- **Excluir** uma campanha é definitivo, exige confirmação na interface e só o dono pode
  fazê-lo. Em cascata, remove sessões, blocos, biblioteca, cena, combates, anotações e
  participações. **Os personagens não são excluídos**: só se desvinculam
  (`on delete set null`). A mídia da campanha é removida do Storage pela aplicação.
- **Remover um participante** (ou sair da campanha) desvincula os personagens dele, que
  continuam pertencendo ao jogador.
- **Excluir a conta** remove em cascata o perfil, as campanhas próprias e os personagens.

## Concorrência

Os detalhes estão em [`ARCHITECTURE.md`](ARCHITECTURE.md#concorrência-e-persistência). Em resumo:
versão otimista em fichas, sessões, anotações e encontros; funções atômicas para vida, recursos
e quantidades; e travas consultivas (`pg_advisory_xact_lock`) para numerar sessões e checar
limites sem condição de corrida.

## Seed de demonstração

`supabase/seed.sql` roda **apenas localmente** (`supabase db reset`). Ele cria duas contas
(`mestre.demo@codexveil.dev` e `jogadora.demo@codexveil.dev`, senha `Codexveil123`) e uma
campanha com registros identificados pelo prefixo `[DEMO]`. `supabase db push` nunca aplica o
seed. Um teste (`packages/database/test/seed.test.ts`) garante que ele continua válido.

## Como evoluir o esquema sem perder dados

1. Crie uma nova migração: `pnpm exec supabase migration new <nome>`.
   **Nunca edite uma migração que já foi aplicada em algum ambiente.**
2. Prefira mudanças aditivas: nova coluna com `default`, nova tabela, novo valor de enum.
   Para renomear ou remover algo, faça em duas etapas: adicione o novo, migre os dados e
   atualize os apps; só numa migração posterior remova o antigo.
3. Toda tabela nova precisa de RLS habilitado, policies, GRANTs explícitos e testes em
   `packages/database/test/rls/`.
4. Regenere os tipos com `pnpm db:types`. O comando aplica as migrações no PGlite e gera
   `packages/database/src/types.gen.ts` sem Docker, e um teste falha se os tipos estiverem
   desatualizados.
5. Rode `pnpm check` e, no ambiente remoto, `pnpm exec supabase db push`.
6. Mudanças na estrutura da ficha (`sheet`) não precisam de migração SQL: aumente
   `sheetSchemaVersion` no módulo do sistema e trate a conversão em `parseSheet`.
   O mesmo vale para `schema_version` dos blocos de roteiro.

Para backups e restauração, veja [`DEPLOY.md`](DEPLOY.md#6-migrações-e-backups-em-produção).

## Terceira rodada (2026-10-17)

| Migração                            | O que cria                                                                                                                                                                                         |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20261017140000_campaign_items`     | `campaign_items`: itens do mestre (ou copiados do SRD, `srd_name`), revelados com `visibility`; até 500 por campanha.                                                                              |
| `20261017140100_dice_rolls`         | `dice_rolls` + `roll_dice()` (SECURITY DEFINER): o servidor sorteia; 200 rolagens por campanha; Realtime.                                                                                          |
| `20261017140200_turns`              | Modo e ordem em `encounters`; `sort_order`, `is_hidden`, `turn_state` em `encounter_combatants`; padrões em `campaigns`; `campaign_turns` (resumo para jogadores, mantido por gatilhos; Realtime). |
| `20261017140300_push_notifications` | `push_tokens` + `register_push_token()`; `session_notifications` (gravada só pela Edge Function `notify-session`).                                                                                 |

## Quarta rodada (2026-10-18)

Migração `20261018120000_gameplay_turns.sql`:

- `turn_actions` (ações do turno, com alvo e rolagem; ocultas só para o mestre; no Realtime).
- `perform_turn_action`, `end_turn` e `campaign_session_in_progress` (RPC; membros sabem se a
  sessão começou mesmo sem ela estar publicada).
- Gatilho `dice_rolls_require_session`: jogadores só rolam com sessão em andamento (`CVSES`).
- Índices únicos `characters_one_per_player_idx` e `campaign_notes_one_pinned_idx` (duplicatas
  antigas são desvinculadas/desafixadas antes).

Migração `20261021140000_map_tools.sql`: `session_maps.fog_auto_reveal`, `areas` (áreas de magia do
mestre) e `drawings` (desenhos e anotações públicos); tabela `session_map_secrets` (desenhos só do
mestre; RLS sem acesso para jogadores).

Migração `20261021130000_token_images.sql`: `map_tokens.image_path` (imagem própria do token em
`campaigns/{id}/maps/`; jogador lê só a de token visível do mapa ativo). Paredes com estilo:
`session_maps.walls` guarda `[x1, y1, x2, y2, "estilo"]`.

Migração `20261021110000_session_maps.sql` (grade da sessão): tabelas `session_maps` e
`map_tokens`, RLS (jogador: mapa ativo e tokens não ocultos), índice de um mapa ativo por
campanha, RPC `move_my_token` e leitura de `campaigns/{id}/maps/*` só do mapa ativo para jogadores.
Névoa (`fog_revealed`) e paredes (`walls`) ficam em JSON no próprio mapa.

Migração `20261021100000_creature_size.sql` (+ `20261021100100_creature_size_grants.sql`):
`creatures.size` (`tiny`…`gargantuan`, padrão `medium`), lido pela grade da sessão; o bloco do
mestre nasce com o porte e, no D&D, mudar `stats.size` atualiza `creatures.size` (gatilho
`creature_gm_data_sync_size`).

Migração `20261020180000_dice_color_per_session.sql`: gatilho `sessions_reset_dice_colors` apaga
`campaign_members.dice_color` da campanha quando uma sessão começa ou termina.

Migração `20261020170000_dice_color_required.sql`: cor única por campanha (índice
`campaign_members_dice_color_unique_idx`), `set_my_dice_color` exige que um mestre já tenha cor
(jogadores) e recusa cor repetida ou vazia (`CVCOR`), e o gatilho `dice_rolls_require_color`
impede rolar sem cor.

Migração `20261020160000_dice_colors.sql`: `campaign_members.dice_color` (`#rrggbb`) e RPC
`set_my_dice_color(campaign, color)` (SECURITY DEFINER; só altera a própria participação).

Migração `20261020150000_custom_actions.sql`: `campaigns.custom_actions` (lista JSON de ações
criadas pelo mestre, até 40; só o mestre atualiza).

Migração `20261020140000_session_mode.sql`: `sessions.mode` (`presencial`/`online`; online nunca
com `physical_dice`, por CHECK) e `campaign_session_state` passa a devolver `mode`.

Migração `20261020130000_level_grants.sql` (subida de nível na campanha): `characters.granted_level`
(nível liberado pelo mestre, só muda pela RPC `grant_character_level`); gatilho
`characters_level_guard` impede o jogador de passar do nível liberado (SQLSTATE `CVLVL`); com
nível liberado pendente, o dono salva a ficha e cria as habilidades do nível mesmo com a edição de
fichas bloqueada (`private.has_pending_level`, `private.sheet_level`). Testes em
`test/rls/level-grants.test.ts`.

Migração `20261020120000_session_reveal.sql` (aba Sessão): blocos de roteiro novos nascem
privados (`visibility` padrão `gm`) e `session_blocks` e `sessions` entram no Realtime (o RLS
continua valendo: jogadores só recebem blocos públicos de sessões publicadas).

Migração `20261018140000_book_packs.sql`: `book_packs` (livro importado: dono, `book_key`,
nome, categoria, edição, contagem por tipo e `is_ready`) e `book_entries` (`kind`, `key`, `name`,
`data` JSON de até 128 KB). Limites de 40 livros por usuário e 6.000 entradas por livro. Leitura:
o dono e os participantes das campanhas do dono cujo `character_rules.sourcebooks` contém o
`book_key` (só livros prontos). Escrita: só o dono.

Migração `20261018130000_physical_dice.sql`: coluna `sessions.physical_dice` (padrão `false`),
RPC `campaign_session_state` (`{ playing, physicalDice }`, só membros) e `perform_turn_action`
recriada com `p_manual_total` (em sessão presencial não chama `roll_dice` e grava o total anotado
com `roll_detail = 'Dado físico'`).
