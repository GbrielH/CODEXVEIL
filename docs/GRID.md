# Grade da sessão (mapa tático) — especificação

Status: **implementada em 2026-10-21** (passos 1 a 6). Falta o passo 7: verificação real com duas contas no navegador e no aparelho. No app, o movimento é por toque (token → quadrado), não por arrastar. Este documento registra as decisões do
responsável e o plano técnico, para a implementação seguir sem novas perguntas.

## Decisões do responsável

| #   | Tema       | Decisão                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Mapa       | O mestre envia a imagem do mapa e aumenta/diminui a imagem até ela combinar com a grade. **Cada quadrado = 1,5 m.** Vários mapas por sessão (um por cena), o mestre escolhe qual está ativo. Imagem de até 5 MB (reduzida no envio, como as outras imagens).                                                                                                                                                        |
| 2   | Grade      | Quadrada nesta versão (hexagonal fica para depois). Linhas visíveis por padrão; o mestre tem um botão para esconder.                                                                                                                                                                                                                                                                                                |
| 3   | Tokens     | Aparecem como tokens: personagens dos jogadores, monstros e NPCs da biblioteca e marcadores livres. Tamanho pelo porte. Por isso **a criação de criaturas passa a pedir o tamanho** (D&D e Tormenta20). Imagem do token: retrato do personagem/criatura ou iniciais na cor dos dados do dono. Vida: barra para personagens; monstros mostram ao jogador só "ferido"/"muito ferido" (número exato só para o mestre). |
| 4   | Permissões | Jogador move só o próprio token, a qualquer momento (não só na vez). Mestre move tudo e esconde tokens (ex.: monstro que ainda não apareceu). Tudo em tempo real.                                                                                                                                                                                                                                                   |
| 5   | Site x app | **Mestrar só no site** (enviar mapa, ajustar escala, posicionar monstros, névoa, esconder linhas). No app o jogador **vê a grade e move apenas o próprio token** (vai por OTA, sem APK).                                                                                                                                                                                                                            |
| 6   | Escopo     | Já na primeira versão: **névoa de guerra** e **linha de visão (opcional, o mestre liga/desliga por mapa)**. Fora desta versão: régua de medição, áreas de magia (cone/círculo), desenho livre, grade hexagonal.                                                                                                                                                                                                     |

## Tamanho do token por porte

| Porte (D&D / T20)                      | Quadrados                  | Observação                        |
| -------------------------------------- | -------------------------- | --------------------------------- |
| Minúsculo                              | 1×1 (meio quadrado visual) | ocupa 1 quadrado, desenhado menor |
| Pequeno                                | 1×1                        |                                   |
| Médio                                  | 1×1                        | padrão de personagens             |
| Grande                                 | 2×2                        |                                   |
| Enorme                                 | 3×3                        |                                   |
| Imenso (D&D Gargantuan / T20 Colossal) | 4×4                        |                                   |

## O que já existe e o que muda

- **D&D:** `CREATURE_SIZES` e o campo `size` já existem no stat block
  (`packages/rpg-systems/src/dnd5e/stat-block.ts`, padrão `medium`). Mudança: deixar o campo
  obrigatório e em destaque na criação da criatura.
- **Tormenta20:** o tamanho só existe no texto livre ("Monstro Grande") em
  `packages/rpg-systems/src/tormenta20/stat-block.ts`. Mudança: campo `size` estruturado
  (Minúsculo, Pequeno, Médio, Grande, Enorme, Colossal), obrigatório na criação, com migração que
  tenta ler o porte do texto atual.
- **Personagens:** porte vem da raça/espécie (a maioria Médio; alguns Pequenos).
- **Imagens:** bucket privado `campaign-media` (até 5 MB, PNG/JPEG/WebP), com URLs assinadas, como
  a capa da campanha. Os mapas vão em `campaigns/{campaign_id}/maps/{arquivo}`.

## Plano técnico (proposta)

### Banco (nova migração)

- `session_maps`: `id`, `campaign_id`, `session_id`, `name`, `image_path`, `image_scale`
  (zoom da imagem sobre a grade), `image_offset_x/y`, `cols`, `rows`, `show_grid` (bool),
  `line_of_sight` (bool), `is_active` (um ativo por sessão, índice único parcial), `version`.
- `map_tokens`: `id`, `map_id`, `campaign_id`, `kind` (`character` | `creature` | `marker`),
  `character_id` / `creature_id` (opcionais), `label`, `x`, `y` (em quadrados), `size`
  (quadrados de lado), `is_hidden`, `vision_radius` (em quadrados, para a linha de visão).
- Névoa: `session_maps.fog_revealed` (retângulos revelados em JSON), editada só pelo mestre.
- Paredes (linha de visão): `session_maps.walls` (segmentos `x1,y1,x2,y2` em JSON).
- **RLS:** membros leem mapas da sessão publicada; tokens com `is_hidden` só para o mestre; névoa
  e paredes só o mestre altera. **Jogador só atualiza `x`/`y` do token do próprio personagem**
  (RPC `move_my_token`, `SECURITY DEFINER`, conferindo o dono e os limites do mapa).
- Realtime nas três tabelas.

### Site (mestre e jogador)

- Aba Sessão do mestre: lista de mapas da sessão, enviar imagem, ajustar zoom/posição da imagem
  sob a grade de 1,5 m, ativar mapa, mostrar/esconder linhas, adicionar tokens (personagens da
  campanha, criaturas da biblioteca, marcador livre), esconder/mostrar token, pintar/apagar
  névoa, desenhar paredes e ligar a linha de visão.
- Jogador: vê o mapa ativo, a névoa (áreas não reveladas ficam escuras) e, com linha de visão
  ligada, só o que o próprio token enxerga; arrasta só o próprio token.
- Renderização: canvas 2D (ou SVG) com pan/zoom; tokens com retrato ou iniciais na cor dos dados.

### App (só jogador)

- Tela do mapa ativo da sessão: ver, dar zoom/arrastar a visão e mover o próprio token.
  `react-native-svg` (já instalado) e gestos do React Native; sem dependência nativa nova, então
  sai por atualização OTA, sem APK.

### Linha de visão (opcional por mapa)

- Calculada no cliente a partir dos segmentos de parede (`map_walls`) e do `vision_radius` do
  token do jogador (polígono de visibilidade por raycasting). O mestre vê tudo.
- Observação de segurança: a linha de visão é **visual**; os tokens escondidos pelo mestre
  (`is_hidden`) é que são protegidos pelo banco (RLS).

## Ordem sugerida de implementação

1. Tamanho obrigatório na criação de criaturas (D&D e T20) e porte dos personagens.
2. Migração (`session_maps`, `map_tokens`, `map_fog`, `map_walls`, RLS, RPC `move_my_token`) e
   testes de RLS.
3. Site: mapa, escala da imagem, grade e tokens com movimento em tempo real.
4. Site: névoa de guerra.
5. Site: paredes e linha de visão opcional.
6. App: visualização e movimento do próprio token.
7. Documentação (DATABASE, SECURITY, PROGRESS, PROXIMOS_PASSOS) e verificação com duas contas.

## Adições de 2026-10-21

- Imagem nos tokens: imagem própria (mestre) → foto do personagem → imagem da criatura → iniciais.
- Paredes com estilo (pedra, tijolo, ruína, madeira, deserto, cerca viva, grade de ferro, invisível),
  visíveis para todos; a grade de ferro não bloqueia a linha de visão e a invisível só o mestre vê.
- Distância percorrida: etiqueta ao arrastar e rastro com "Nome: X m" para toda a mesa. D&D: diagonal
  = 1 quadrado; Tormenta20: diagonais alternadas (1,5 m / 3 m).
