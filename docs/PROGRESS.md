# Progresso do Codexveil

> Documento de retomada. Última atualização: **2026-10-19**. Para retomar o trabalho em andamento, veja primeiro a seção "Continuidade" de [`PROXIMOS_PASSOS.md`](PROXIMOS_PASSOS.md#continuidade-parada-em-2026-10-19-retomar-em-outra-máquina).
> O que falta em relação ao prompt inicial está em [`PENDENCIAS.md`](PENDENCIAS.md).

## Estado atual

As fases de 1 a 7 do plano estão implementadas. O MVP está **publicado**: site em
<https://codexveil.vercel.app>, backend no projeto Supabase `CODEXVEIL` e APK gerado pelo EAS
(veja [`PROXIMOS_PASSOS.md`](PROXIMOS_PASSOS.md)). A API foi validada ao vivo por um teste de
integração (11/11 em 2026-10-17). A fase 8 continua parcial: o SMTP próprio (Brevo) foi ligado em 2026-10-18,
com os templates em português, mas falta confirmar a entrega e o fluxo pelo app; faltam também o
uso real no navegador e no aparelho com duas contas, os testes ponta a ponta e as auditorias.

**Em 2026-10-17:** criação de personagens guiada pelas regras do SRD 5.2.1 na web e no app,
regras de criação definidas pelo mestre em cada campanha, mestres impedidos de criar
personagens nas próprias campanhas, "olho" nos campos de senha, remoção da foto de perfil,
redução das imagens antes do envio e correção do tempo real no navegador e no app. A migração
`20261016130000_character_creation_rules.sql` está **aplicada em produção** e o código foi
enviado ao `main`. O app tem um APK novo com essas mudanças (o fingerprint nativo mudou; link no
README). O site recebeu essas mudanças com o deploy automático, ligado na rodada seguinte.

**Em 2026-10-17, segunda rodada:** condições com as regras do SRD 5.2.1
(efeitos aplicados na ficha, duração em rodadas que diminui no fim do turno, contagem
automática no combate e botão "Passar rodada"; Exaustão cai 1 nível no descanso longo), listas
com a identidade visual e busca no site e no app, confirmações do app no visual do Codexveil,
crônica do personagem em pergaminho legível, área logada na largura toda da tela e a correção
de um defeito antigo que espremia os nomes das perícias. A migração
`20261017120000_condition_durations.sql` foi **aplicada em produção** e testada de ponta a ponta;
o GitHub foi ligado à Vercel e ao Expo pelo responsável, e o push desta rodada é o primeiro
publicado automaticamente. A resposta sobre
o conteúdo de D&D (o que do SRD está no sistema e o que não pode estar) está em
[`PENDENCIAS.md`](PENDENCIAS.md#cobertura-do-conteúdo-de-dd-srd-521).

**Em 2026-10-17, terceira rodada:** biblioteca com **itens da campanha** (criados pelo mestre
ou copiados do SRD e entregues aos personagens), **Bestiário SRD** (330 monstros e animais) e
**Itens mágicos SRD** (258) para copiar à campanha, botão de **ocultar/liberar** direto nas
listas, **detalhes ao passar o mouse** em magias, ataques e habilidades (no app, ao tocar), com
dano, resistência, área e círculo maior tirados do texto do SRD; lista de condições do jogador
limitada às que o personagem pode se aplicar (o mestre vê todas); **rolagem de dados** no
servidor com mural ao vivo do mestre e rolagens secretas; **turnos** com modos (combate,
exploração, investigação, interação social), ordem pela iniciativa ou definida pelo mestre,
participantes ocultos, ação/ação bônus/movimento/reação e a vez visível aos jogadores;
**aviso de sessão agendada** por notificação no app (falta o Firebase, veja o próximo passo); e
o app passou a fazer o que o site faz (mesa do mestre, sessões e roteiro, biblioteca, SRD,
convites, anotações, configurações, cadastro de habilidades, classes/níveis e recursos). As
migrações `20261017140000` a `20261017140300` foram **aplicadas em produção** e a Edge Function
`notify-session` foi publicada. Análise de espaço do Supabase em
[`ARMAZENAMENTO.md`](ARMAZENAMENTO.md).

| Fase                                                                            | Situação                                                                              |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1. Fundação (monorepo, TS, lint, testes, design system, apps)                   | Concluída                                                                             |
| 2. Backend e autenticação (migrações, RLS, Auth)                                | Concluída e validada ao vivo; e-mails em português dependem do SMTP                   |
| 3. Campanhas, convites, participantes e papéis                                  | Concluída                                                                             |
| 4. Fichas (D&D 5e: atributos, perícias, combate, inventário, magias e evolução) | Concluída                                                                             |
| 5. Mesa do mestre (grupo, cena, NPCs e monstros, combate)                       | Concluída (web)                                                                       |
| 6. Editor de sessões por blocos com conteúdo privado                            | Concluída (web; leitura no mobile)                                                    |
| 7. Mobile (Expo)                                                                | Concluída para os fluxos prioritários; APK gerado pelo EAS, falta testar num aparelho |
| 8. Qualidade e preparação para uso                                              | Parcial (veja [`PENDENCIAS.md`](PENDENCIAS.md))                                       |

## O que foi implementado

### Web (`apps/web`, Next.js 16, App Router)

| Área              | Rotas                                                                                                                            |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Público           | `/` (apresentação), `/licencas`, `/design` (vitrine do design system)                                                            |
| Autenticação      | `/entrar`, `/cadastro`, `/recuperar-senha`, `/redefinir-senha`, `/auth/confirmar`, `/auth/erro`                                  |
| Painel            | `/painel`: campanhas em andamento, próximas sessões, convites pendentes, seus personagens                                        |
| Campanhas         | `/campanhas`, `/campanhas/nova`, `/campanhas/[id]` (visão geral e participantes)                                                 |
| Campanha (mestre) | `.../convites`, `.../configuracoes` (configurações, arquivar, excluir), `.../mesa`                                               |
| Conteúdo          | `.../sessoes`, `.../sessoes/[id]` (leitura), `.../sessoes/[id]/editar`, `.../biblioteca`, `.../biblioteca/[id]`, `.../anotacoes` |
| Convites          | `/convite` (digitar o código), `/convite/[codigo]` (prévia, aceitar ou recusar)                                                  |
| Personagens       | `/personagens`, `/personagens/novo` (assistente de criação com as regras do SRD 5.2.1), `/personagens/[id]` (ficha em abas)      |
| Perfil            | `/perfil`: nome, bio, preferências (densidade e animações) e envio do link de troca de senha (sem foto de perfil)                |

A ficha tem as abas Jogo (vida, condições, recursos e descansos), Atributos (atributos,
salvaguardas e perícias), Inventário (itens e moedas), Habilidades e magias (ataques, magias,
talentos e traços), Personagem (história e descrição), Evolução (XP ou marcos, histórico e
cópias de segurança) e Ajustes (retrato, campanha e exclusão; só para quem pode editar a ficha).

### Mobile (`apps/mobile`, Expo SDK 57)

- Entrar, cadastro, recuperação de senha e aviso de sessão expirada.
- Abas: Painel, Campanhas, Personagens e Perfil (nome e bio).
- Campanha: participantes, personagens e sessões publicadas; criar campanha e sair dela.
- Convite: prévia, aceitar e recusar.
- Criação de personagem guiada, com o mesmo motor de regras da web (`listDnd5eChoices`,
  `validateDnd5eDraft`, `buildDnd5eCharacterFromDraft`); campanhas em que o usuário é mestre
  não aparecem na escolha.
- Criação de campanha com as regras de criação de personagens (nível inicial, métodos de
  atributo e alinhamentos malignos).
- Campos de senha com botão para mostrar ou ocultar.
- Abre também no navegador para testes locais (`expo start --web`, com `react-native-web` e
  `metro.config.js` aceitando o `.wasm` do SQLite).
- Ficha jogável com autosave versionado, ajustes atômicos de vida e recursos e Realtime.
- Leitura de sessões (apenas os blocos públicos de sessões publicadas, filtrados pelo banco).

### Pacotes compartilhados

| Pacote                   | Conteúdo                                                                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `@codexveil/domain`      | Permissões, convites, recursos (dano, cura e descanso), inventário, iniciativa, blocos, visibilidade, planos e erros                          |
| `@codexveil/rpg-systems` | Contrato `RpgSystem` (com regras de criação por campanha), registro de sistemas e módulo D&D 5e: dados do SRD 5.2.1 e motor da criação guiada |
| `@codexveil/validation`  | Esquemas zod (auth, perfil, campanhas, fichas, biblioteca, sessões e uploads)                                                                 |
| `@codexveil/database`    | Cliente tipado, consultas, autosave, Realtime, erros, tipos gerados e testes de RLS                                                           |
| `@codexveil/ui`          | Tokens de cor e tipografia, emblema SVG, glifos e verificação de contraste                                                                    |
| `@codexveil/config`      | `tsconfig` e ESLint compartilhados                                                                                                            |

### Banco (`supabase/`)

Oito migrações versionadas (fundação, campanhas, personagens, sessões e biblioteca, storage,
realtime, criação guiada e duração das condições; todas aplicadas em produção), um seed de
demonstração **somente local** e templates de e-mail em português.
Os detalhes estão em [`DATABASE.md`](DATABASE.md) e [`SECURITY.md`](SECURITY.md).

## Testes e verificações executados

Execução em 2026-10-17, Windows 11, Node 24.20 e pnpm 12.14:

| Comando                                             | Resultado                 |
| --------------------------------------------------- | ------------------------- |
| `pnpm check` (lint, typecheck e testes)             | 20/20 tarefas com sucesso |
| `pnpm build` (`next build` e `expo export` Android) | 2/2 tarefas com sucesso   |

| Pacote                                                                                 | Arquivos de teste | Testes  |
| -------------------------------------------------------------------------------------- | ----------------- | ------- |
| `@codexveil/database` (RLS, migrações, seed, tipos, autosave, realtime, erros, config) | 12                | 158     |
| `@codexveil/database` — teste ao vivo (só com credenciais; veja abaixo)                | 1                 | 11      |
| `@codexveil/rpg-systems` (regras, ficha, registro, SRD, criação guiada e condições)    | 6                 | 123     |
| `@codexveil/domain`                                                                    | 7                 | 58      |
| `@codexveil/ui` (marca, contraste, CSS)                                                | 3                 | 22      |
| `@codexveil/validation`                                                                | 1                 | 15      |
| `@codexveil/web` (rotas, formatação de datas)                                          | 2                 | 12      |
| **Total (sem o teste ao vivo)**                                                        | **31**            | **388** |

Os testes de RLS aplicam as migrações reais num Postgres 17 em WebAssembly (PGlite) e
executam as consultas com o papel e o JWT de cada usuário. Eles cobrem: jogador tentando ler
notas privadas e blocos `gm`, sessões não publicadas, troca de UUIDs, edição da ficha de outro
jogador, campanha alheia, usuário anônimo, convites (expiração, usos, e-mail e corrida),
campanha arquivada, mídia privada no Storage, mestre impedido de criar ou vincular personagem
na própria campanha, criação completa com a ficha travada e regras de criação da campanha.

**Percurso no navegador, sem login (2026-10-17):** antes da migração, o assistente foi aberto
numa cópia temporária na vitrine `/design` (já removida) e percorrido no Chrome automatizado:
um guerreiro humano soldado de 1º nível chegou à revisão sem pendências, e um mago elfo sábio
de 3º nível chegou à revisão apontando, corretamente, a perícia repetida entre classe e
antecedente. Esse percurso levou a duas correções: magias escolhidas numa lista agora ficam
indisponíveis nas outras, e a escolha "+2 em um atributo" do Aumento no Valor de Atributo
passou a funcionar sem valor prévio.

**Percurso logado contra o banco real (2026-10-17):** com a migração aplicada, um script no
Chrome automatizado criou contas temporárias (mestre e jogador) e uma campanha com nível
inicial 3 e métodos de atributo limitados, e entrou no site local (`localhost:3000`, ligado ao
Supabase de produção). Resultados:

- o jogador criou pelo assistente um guerreiro de 1º nível (ficha pessoal) e um mago elfo
  criminoso de 3º nível na campanha; os dois chegaram à revisão sem pendências e abriram a
  ficha com o aviso "Personagem criado". O banco gravou 12 itens, 16 habilidades e 11 trilhas
  (guerreiro) e 9 itens, 33 habilidades e 14 trilhas (mago);
- na campanha, o campo de nível some e só aparecem os métodos de atributo do mestre;
- o mestre não vê o botão "Criar personagem" na campanha, a campanha não aparece para ele no
  assistente e as "Regras da mesa" mostram o nível 3, os métodos e "Sem alinhamentos
  malignos";
- nenhum erro no console. As contas foram apagadas no fim, sem sobrar campanha ou personagem.

**Tempo real no navegador (corrigido em 2026-10-17):** o mesmo percurso mostrou que a ficha
ficava "Reconectando…" para sempre. Causa: o canal entrava antes de o cliente carregar a
sessão dos cookies, e o Realtime criava as assinaturas com o papel anônimo, que não lê as
tabelas ("invalid column for filter character_id"). O teste ao vivo não pegava o problema
porque, nele, o login acontece antes da assinatura. A correção (`realtime.ts`, usada pelo site
e pelo app) busca o token do usuário antes de entrar no canal e usa um tópico novo a cada
assinatura, porque o supabase-js reaproveitava o canal que estava sendo removido quando a
tela remontava. Depois dela, a ficha fica "Ao vivo" ao abrir, e um dano aplicado por outro
cliente apareceu na tela em 1,9 s.

**App no navegador (2026-10-17):** o mesmo percurso no app aberto no navegador (Expo web em
`localhost:8081`, o mesmo código do APK) entrou com uma conta temporária e criou um guerreiro de
1º nível (ficha pessoal) e um mago de 3º nível na campanha, com o nível travado pelo mestre e só
os métodos de atributo permitidos. As duas fichas abriram "Ao vivo", e o banco gravou 12
itens, 16 habilidades e 11 trilhas (guerreiro) e 9, 33 e 14 (mago). Nenhum erro no console, e
as contas foram apagadas no fim.

**Não testado ainda:** o APK num aparelho e o uso por pessoas com duas contas.

**Migração:** `20261016130000_character_creation_rules.sql` foi aplicada em produção em
2026-10-17 com `supabase db push`. Antes, o `--dry-run` listava só ela; depois, "Remote
database is up to date". Não houve backup antes: o plano gratuito não oferece backup
baixável, e esta máquina não tem Docker nem `pg_dump`. A migração acrescenta a coluna
`character_rules` (padrão `{}`), troca funções, gatilho e policies e reduz o limite do bucket
`campaign-media` para 2 MB; não apaga nem altera dados de usuários.

Os testes da criação guiada (`packages/rpg-systems/src/dnd5e/creation/creation.test.ts` e
`srd/srd.test.ts`) conferem os dados do SRD (339 magias, 12 classes, tabelas de 20 níveis,
referências entre dados) e montam personagens válidos de todas as classes nos níveis 1, 3,
5, 11 e 20, além de casos de regra: perícia repetida, especialização sem proficiência,
talento repetido, aumentos do antecedente, compra de pontos, nível e alinhamento da
campanha, CA sem armadura, deslocamento do monge, Iniciativa com Alerta e com o bardo.

**Condições, listas e diálogos (2026-10-17, segunda rodada):** 15 testes novos de regras
(`conditions.test.ts` e `registry.test.ts`) conferem as 15 condições do glossário do SRD 5.2.1
e as combinações: Paralisado impõe Incapacitado; Inconsciente impõe Incapacitado e Caído e
deixa Caído ao terminar; Petrificado anula Envenenado; vantagem e desvantagem se anulam;
Exaustão dá −2 por nível nos testes de d20 e −1,5 m por nível no deslocamento; valores
passivos mudam ±5. Sete testes novos de RLS cobrem a duração em rodadas: contagem, término,
várias rodadas de uma vez, permissões (jogador, mestre, outro jogador e estranho), valores
inválidos e o mapa de rodadas das instâncias da cena.

No navegador, numa vitrine temporária com dados de exemplo (já removida): o seletor novo abre
por clique e por teclado, filtra ao digitar ("env" → Envenenado), escolhe com Enter, devolve o
foco e fecha com Esc; o valor chega ao `<select>` nativo. Com Paralisado, Exaustão 2,
Envenenado e Invisível, a aba Jogo mostra iniciativa −2 (−4 da Exaustão; vantagem e
desvantagem se anulando), deslocamento 0, Percepção passiva 8 (base 13) e o aviso
"Incapacitado (por Paralisado)"; a aba Atributos mostra os selos Falha, Desv. e −4; a crônica
aparece em pergaminho com tinta escura. Esse teste revelou um defeito antigo: os campos
numéricos ignoravam a largura pedida (a classe `w-full` vence pela ordem do CSS) e espremiam
os nomes das perícias; agora a largura padrão só entra quando nenhuma outra é pedida. Com uma
conta temporária no site local: a área logada ocupa 1.344 px numa tela de 1.600 px (antes, no
máximo 1.152 px); no app (Expo web), "Sair da conta" abre o diálogo do Codexveil e "Cancelar"
o fecha sem sair. Nenhum erro no console.

**Condições contra o banco real (2026-10-17, depois da migração):** com contas temporárias, o
jogador criou um guerreiro numa campanha, aplicou Envenenado por 1 minuto pelo seletor novo da
ficha (o banco gravou 10 rodadas e a ficha mostrou os efeitos), usou "Passar rodada" (9) e o
mestre passou o turno no combate da mesa, que mostrava "9 rod." (8). A página da campanha,
que dava erro no site local antes da migração, abriu normalmente. Teste ao vivo: 11/11. As
contas foram apagadas no fim. **Não testado ainda:** a seção de condições do app num
aparelho.

### Teste ao vivo contra o Supabase real

`packages/database/test/live/supabase.live.test.ts` exercita as mesmas consultas de
`@codexveil/database` usadas por web e mobile, passando pelo supabase-js, PostgREST, Auth,
Storage e Realtime reais. Ele cria três contas temporárias já confirmadas (mestre, jogador e
estranho) e as apaga no fim, junto com os arquivos enviados. Só roda com as variáveis
`CODEXVEIL_LIVE_SUPABASE_URL`, `CODEXVEIL_LIVE_PUBLISHABLE_KEY` e `CODEXVEIL_LIVE_SECRET_KEY`.
A chave secreta serve só para criar e apagar as contas e pode ser obtida com
`pnpm exec supabase projects api-keys --project-ref <ref> --reveal`; nunca a coloque em
arquivo.

```bash
cd packages/database
CODEXVEIL_LIVE_SUPABASE_URL=… CODEXVEIL_LIVE_PUBLISHABLE_KEY=… CODEXVEIL_LIVE_SECRET_KEY=… \
  pnpm exec vitest run test/live
```

Em 2026-10-16 passaram 10 de 10, e depois da execução o projeto ficou sem nenhuma conta, dado
ou arquivo de teste. A primeira execução revelou que eventos do Realtime se perdiam logo após
a inscrição. A correção está em `realtime.ts` (veja
[`ARCHITECTURE.md`](ARCHITECTURE.md#tempo-real)). Em 2026-10-17, já com a migração da criação
guiada e a correção do tempo real no navegador, passaram 11 de 11: o caso novo grava um
personagem com inventário e habilidades e confirma que o mestre não cria personagem na própria
campanha. Em 2026-10-18, com todas as 14 migrações aplicadas, passaram de novo 11 de 11 (contas
temporárias criadas e apagadas pelo próprio teste).

### Não executado (limitações registradas)

- Uso do site num navegador e do app num aparelho por pessoas, com duas contas reais (veja
  [`PROXIMOS_PASSOS.md`](PROXIMOS_PASSOS.md), etapa 2). O percurso automatizado acima cobre só
  o site local.
- Fluxos de e-mail (confirmação e recuperação de senha) com SMTP próprio, adiados.
- Testes ponta a ponta de interface e auditorias de acessibilidade e desempenho.

## Erros conhecidos

Nenhum erro de tipo, lint, teste ou build. Os problemas conhecidos (limitações dos e-mails
padrão do Supabase, entre outros) estão em
[`PENDENCIAS.md`](PENDENCIAS.md#5-problemas-conhecidos).

## Configurações externas pendentes

1. SMTP próprio (Brevo, com o e-mail exclusivo do sistema) e, depois, o envio dos templates
   em português (`supabase config push --workdir deploy …`).
2. Firebase para as notificações de sessão (veja o próximo passo).
3. Domínio próprio (opcional).

O deploy automático está ligado: cada push em `main` publica o site e uma atualização OTA do
app (conferido em 2026-10-18).

O passo a passo está em [`DEPLOY.md`](DEPLOY.md).

## Próximo passo exato

- **2026-10-20 (itens 6 a 10):** feitos (`pnpm check` 20/20; testes novos de ícones de raça e
  do prompt de imagem). Ficha T20 agora usa o dado animado. Próximo: dado 3D estilo app "Dice"
  (em avaliação) e item 11.
- **2026-10-20 (dados realistas):** item 5 feito (`pnpm check` 20/20; animação não conferida
  no navegador nem no aparelho). Próximo: item 6 (selo do sistema em Meus livros).
- **2026-10-20 (aba Sessão):** item 4 feito no código (`pnpm check` 20/20; sem teste no
  navegador). Migração `20261020120000_session_reveal.sql` aplicada em
  produção (`supabase db push`). Próximo: item 5 (dados realistas).
- **2026-10-20:** itens 1 a 3 dos pedidos de 2026-10-20 feitos (combate roleplay: sem alvo, dano
  só após o mestre confirmar o acerto; `pnpm check` 20/20, não testado no navegador nem no
  aparelho). Próximo: item 4 (aba Sessão) de [`PROXIMOS_PASSOS.md`](PROXIMOS_PASSOS.md).

- **Tormenta20:** seguir a seção "Continuidade Tormenta20" de [`PROXIMOS_PASSOS.md`](PROXIMOS_PASSOS.md) (marco 3: tela do assistente de criação T20 no site).

0. **Livros (2026-10-19):** importar em Meus livros os pacotes `phb-2014`, `xgte`, `tcoe`,
   `mm-2014` e `mpmm` (em `livros-trabalho/out/`, validados com 0 erros) e marcar os livros na
   campanha; conferir a criação no site e no app. Depois: subclasses do Livro do Jogador, item 2
   (tradução do SRD) e item 7 (combate) de [`PROXIMOS_PASSOS.md`](PROXIMOS_PASSOS.md).
1. **Responsável:** criar o projeto no Firebase e enviar a chave FCM V1 ao Expo
   ([`PROXIMOS_PASSOS.md`](PROXIMOS_PASSOS.md), etapa 0c). **Claude:** enviar o
   `google-services.json` ao EAS (variável `GOOGLE_SERVICES_JSON`, tipo arquivo) e gerar o APK
   com notificações.
2. **Responsável:** instalar o APK `e02e7079` (link no README), se ainda não instalou: é o
   único que recebe as atualizações OTA atuais.
3. **Claude:** percurso automatizado no site e no app com as telas novas (itens, SRD, dados,
   turnos e as de 2026-10-18: capa, multiclasse, talentos, livros, dados por sessão) contra o
   banco real, com contas temporárias, e revisão de telas pequenas (360 px).
4. Usar o site e o app com duas contas.
5. SMTP próprio (Brevo) e templates em português.

A lista completa e priorizada está em
[`PENDENCIAS.md`](PENDENCIAS.md#6-próximos-passos-sugeridos-em-ordem).

### Terceira rodada (2026-10-17): verificações

- `pnpm check`: 20/20 tarefas (lint, tipos e testes; inclui 13 testes novos de RLS para itens,
  rolagens, turnos e notificações, 6 do catálogo do SRD, 4 de dados e 3 de turnos no domínio).
- `pnpm build`: 2/2.
- Migrações `20261017140000`–`20261017140300`: `db push --dry-run` e `db push` no CODEXVEIL.
- Edge Function `notify-session` publicada; chamada sem login responde 401.
- **Não testado ainda:** as telas novas contra o banco real (site e app), o envio real de
  notificações (depende do Firebase) e a revisão visual em telas pequenas.

### 2026-10-18 — quarta rodada (jogo em turnos, evolução, tema e magias em português)

Feito:

- **Jogo em turnos:** jogadores só rolam e agem com a sessão iniciada pelo mestre (o banco recusa
  com `CVSES`; site e app mostram o aviso). Ações registradas em `turn_actions` com orçamento do
  turno (1 ação + extras como Surto de Ação, 1 ação bônus, 1 movimento, 1 reação), alvo, rolagem e
  "Ação de movimento"; reações fora da vez; o jogador da vez ou o mestre encerra o turno, sem tempo
  limite. O mural de dados mostra ações e rolagens em ordem. O alvo de um ataque vê o aviso e as
  opções de reação.
- **Aba "Meu personagem" na campanha** (jogadores), ficha de jogo sem história; um personagem por
  jogador por campanha (índice único); rolagens da ficha são locais (teste, fora do mural).
- **Subida de nível** (site, aba Evolução): confirmação e painel com vida (média ou dado),
  habilidades novas, subclasse, aumento de atributo/talento/dádiva épica, magias, invocações,
  Metamagia e recursos recalculados (SRD 5.2.1).
- **Anotações:** menu ⋮ (fixar, editar, excluir), 1 fixada por pessoa, selo Geral/Pessoal.
- **Vincular à campanha:** lista o que precisa mudar para seguir as regras do mestre.
- **Equipar arma do SRD** cria o ataque correspondente.
- **Tema claro/escuro** no site (botão no menu; escolha salva no navegador). O app segue escuro.
- **Magias em português:** nomes PT das 339 magias do SRD (original em inglês como chave) e
  menções nas descrições de classes, espécies e invocações.
- **App:** telas exclusivas do mestre removidas (o app é para jogar); painel de turno no app.

Verificações (2026-10-18): `pnpm check` passou (20 tarefas; banco 178 testes, 11 ao vivo
pulados; rpg-systems 143; ui 33) e `pnpm build` passou (web e mobile). `supabase db push
--dry-run` listou só `20261018120000_gameplay_turns.sql`. Não verificado: uso real no navegador e
no celular (não foi aberto nada local, a pedido).

Pendente: aplicar a migração em produção antes do push; imagens oficiais (item 2); tema claro no
app; subida de nível no app.

### 2026-10-18 — grupo, aba Jogo completa, ícones e dados presenciais

- **Visão geral da campanha:** o jogador vê só os personagens dos outros (o seu fica em "Meu
  personagem"); com as fichas do grupo ocultas pelo mestre, a lista some.
- **Aba Jogo de "Meu personagem":** ataques, magias e habilidades juntos (sem trocar de aba).
- **Imagens:** ícones de classes e espécies do game-icons.net (CC BY 3.0, crédito em /licencas)
  no assistente do site e do app, e link para as ilustrações oficiais no D&D Beyond (a arte da
  Wizards não pode ser copiada).
- **Dados presenciais por sessão** (`sessions.physical_dice`, migração
  `20261018130000_physical_dice.sql`): o mestre marca na criação ou no editor da sessão; as ações
  do turno não rolam no app e o jogador pode anotar o resultado do dado físico
  (`perform_turn_action(..., p_manual_total)`); `campaign_session_state` informa a interface.

Verificações: `pnpm check` passou (banco 179 testes, 11 ao vivo pulados; rpg-systems 143; ui 33;
domain 66; validation 15; web 12) e `pnpm build` passou. `supabase db push --dry-run` lista só
`20261018130000_physical_dice.sql` (ainda não aplicada). Não verificado no navegador/celular.

### 2026-10-18 — visual do app reformulado

- Painel com destaque "Continuar jogando" (personagem da campanha ativa, com atalhos para ficha,
  dados e mesa), próxima sessão, atalhos e seções com ícones.
- Central da campanha: cartão "Meu personagem" com vida e condições no topo, atalhos maiores,
  companheiros com avatar (ícone da classe) e vida; o próprio personagem não se repete na lista.
- Componentes novos (`components/ui/layout.tsx`: SectionHeader, IconBubble, HeroCard,
  QuickAction) e avatar de personagem com o ícone da classe; listas, cartões e abas mais legíveis.

Verificações: `pnpm check` (20 tarefas) e build do app passaram. Não verificado no celular.

### 2026-10-18 — equipar itens corrigido e habilidades usáveis na aba Jogo

- **Correção:** equipar/desequipar itens (e excluir item, habilidade ou trilha, e registrar
  evento) eram desfeitos logo após salvar: o auxiliar `run` da ficha devolvia `undefined` também
  no sucesso de ações sem retorno, e a tela tratava isso como falha. Agora devolve `true` (site e
  app). O banco estava correto; novo teste `test/rls/equip.test.ts` confirma que o dono equipa e
  desequipa.
- **Ficha na campanha (site e app):** a aba Jogo mostra só as habilidades usáveis (com usos ou
  custo de ação, além de ataques e magias); as características passivas ficam na aba Atributos.

Verificações: `pnpm check` (20 tarefas) e `pnpm build` passaram. Não verificado no navegador ou no
celular.

### 2026-10-18 — armas equipadas, blocos vazios, comunidade e menu encolhível

- **Aba Jogo:** ataques de armas do inventário só aparecem com a arma equipada (ataques sem arma,
  como o desarmado, sempre aparecem; regra `isAttackAvailable` em rpg-systems, com teste). Vale
  para a lista de ataques e para as ações do turno, no site e no app.
- **Blocos vazios** (magias, habilidades usáveis) não aparecem na aba Jogo da campanha.
- **Sistemas da comunidade:** nova aba no site (`/comunidade`) e no app, com "Em breve".
- **Menu lateral do site encolhível** (só ícones); a escolha fica salva no navegador.

Verificações: `pnpm check` (20 tarefas) e `pnpm build` passaram. Não verificado no navegador ou no
celular.

### 2026-10-18 — efeitos visuais (dragão do carregamento e brasas)

- **Carregamento com dragão** (site e app): silhueta do dragão (game-icons.net, CC BY 3.0) soprando
  chamas animadas que esfriam de âmbar para vinho; usado em `LoadingState` e nas telas de
  carregamento das rotas do site. Com movimento reduzido (sistema ou perfil), fica parado.
- **Site:** brasas subindo devagar no fundo, entrada suave do conteúdo, cartões de campanha e
  personagem que sobem com brilho ao passar o mouse, resultado do dado "saltando" (verde no 20
  natural, vermelho no 1) e brilho pulsante no cartão do turno quando é a sua vez.
- **App** (Reanimated, já incluído no APK; sem build nativo): telas entram deslizando, filete do
  cartão de destaque pulsa como brasa e o resultado do dado salta.

Verificações: `pnpm check` (20 tarefas) e `pnpm build` passaram; um quadro do dragão foi
renderizado para conferir a composição. A animação em si não foi vista rodando no navegador nem
no celular.

### 2026-10-18 — livros oficiais por campanha e app mais enxuto

- **Conteúdo do sistema na campanha** (site e app, criação e configurações): "Sistema base" (só o
  SRD 5.2.1) ou "Base + livros oficiais", com 50 livros de D&D 5e (2014 e 2024) em 6 categorias
  (básicos, opções de personagem, monstros, mestre/itens, cenários, aventuras). Fica em
  `character_rules.sourcebooks` (JSON, sem migração; ids validados). Os livros têm direitos da
  Wizards: o Codexveil não traz o conteúdo deles, a escolha informa à mesa o que vale e aparece
  nas regras da campanha.
- **App:** menu inferior só com ícones; painel sem atalhos de criar (ficam nas abas Campanhas e
  Personagens); regras de criação da campanha só aparecem para o jogador enquanto ele não tem
  personagem ou o personagem ainda não cumpre as regras.

Verificações: `pnpm check` (20 tarefas; rpg-systems 144 testes) e `pnpm build` passaram. Não
verificado no navegador ou no celular.

### 2026-10-18 — links só dos livros liberados

- A aba Links (site) e os links da campanha (app) mostram as fontes gratuitas e só os livros que o
  mestre liberou (`dnd5eCampaignLinks`), cada um com a página dele no D&D Beyond (endereços
  conferidos por HTTP; Theros leva ao catálogo). Sistema base: só o gratuito.
- Pedido de transcrever os livros pagos (Xanathar, Tasha etc.) para automatizar a criação: não
  feito, por serem conteúdo protegido (o repositório é público). Alternativa proposta ao
  responsável: editor de conteúdo da mesa (cadastrado por ele, privado à campanha) e conteúdo de
  terceiros com licença aberta.

### 2026-10-18 — livros pagos só com o link da página oficial

- **Pedido do responsável:** os livros não precisam estar no Supabase. O trabalho em andamento de
  importar o conteúdo dos livros para a conta (tabelas `book_packs` e `book_entries`, migração
  `20261018140000_book_packs.sql`, página "Meus livros" e o conteúdo dos livros na criação e na
  subida de nível) foi **descartado antes de publicar**: a migração nunca foi aplicada e nada
  disso foi para o `main`. O código ficou guardado num `git stash` local desta máquina ("livros
  importados no Supabase…"), caso volte a ser útil.
- **Escolha dos livros** (criação e configurações da campanha, no site e no app): aviso de que são
  livros pagos, vendidos pela Wizards na página oficial, com o link da página de cada livro; as
  fontes gratuitas (regras gratuitas de 2024, SRD 5.2.1 e D&D Beyond) ficam com o link direto.
- **Regras da campanha no assistente de criação:** o texto diz que os livros liberados são pagos e,
  no site, traz o link oficial de cada um.
- **Aba Links:** "Gratuitos" com leitura direta no site oficial; "Livros da campanha" avisa que são
  pagos e leva à página oficial de cada um.

Verificações: `pnpm check` 20/20 (rpg-systems 144 testes; banco 180, com 11 ao vivo pulados; domain
66; ui 33; validation 15; web 12) e `pnpm build` 2/2. Sem migração. Não verificado no navegador
nem no celular.

### 2026-10-18 — capa da campanha, classes por seletor, multiclasse e talentos

- **Capa da campanha** (backend já existia): o mestre escolhe a imagem ao criar a campanha (vai
  junto com o formulário, já reduzida no navegador; limite das Server Actions em 3 MB) e troca ou
  remove em Configurações. A capa aparece nos cartões do Painel e da lista de Campanhas, no site
  e no app; sem capa, um fundo com as iniciais. Os participantes leem pela regra de Storage que
  já existia.
- **Nova campanha (site):** a página usa a largura toda: capa ao lado de nome, descrição e
  sistema; as regras de criação ficam em grade nas telas largas (consulta de contêiner, então as
  Configurações continuam numa coluna).
- **Classes sem digitação** (aba Personagem, site e app): classe, nível, subclasse e dado de vida
  vêm das regras. Fichas antigas com classe escrita à mão ganham um seletor das classes do SRD.
  O nível só muda pela subida de nível.
- **Multiclasse na subida de nível** (site): o seletor "Classe que sobe de nível" traz as classes
  da ficha e as classes novas. Pré-requisito do SRD 5.2.1 (13 no atributo principal da classe
  nova e das atuais; "ou"/"e" conforme a classe), treinamentos da classe nova
  (`MULTICLASS_TRAINING`, com perícia e instrumento por seletor), dado de vida da classe nova,
  magias do 1º nível e espaços de magia pelo nível de conjurador somado (metade arredondada para
  cima para paladino e patrulheiro). No app, a ficha só mostra as classes e orienta usar o site.
- **Talentos no aumento de atributo:** a lista ficava vazia porque só oferecia talentos gerais (o
  SRD só tem Agarrador além do aumento). Agora, pelas regras de 2024, entram também os de origem
  (Alerta, Atacante Selvagem, Habilidoso com 3 perícias, Iniciado em Magia com lista, truques,
  magia e atributo), os de estilo de luta para quem tem Estilo de Luta e as dádivas no 19º nível,
  todos por seletor.
- **Imagens oficiais de classes e espécies:** não adicionadas. Comprar os livros dá o direito de
  ler, não de redistribuir a arte da Wizards num repositório e num site públicos. O assistente
  continua com os ícones do game-icons.net e o link para a página oficial.

Verificações: `pnpm check` 20/20 (rpg-systems 150 testes, com 6 novos de multiclasse e talentos;
banco 180, com 11 ao vivo pulados; domain 66; ui 33; validation 15; web 12) e `pnpm build` 2/2.
Sem migração. Não verificado no navegador nem no celular (envio de capa, telas novas e
multiclasse ainda não foram usados de verdade).

### 2026-10-18 — livros na ficha, personagens com imagem e dados só com a sessão

- **Livros na criação da ficha** (site e app): na ficha pessoal, o passo Início traz o seletor
  "Sistema base" ou "Base + livros oficiais" (pagos, com link da página oficial); numa campanha,
  aparecem os livros escolhidos pelo mestre, sem seleção. A escolha fica em
  `sheet.identity.sourcebooks` (sem migração; valores inválidos viram lista vazia). No servidor e
  no app, a ficha de campanha recebe os livros do mestre. Na aba Personagem, a ficha pessoal troca
  os livros pelo mesmo seletor.
- **Vincular à campanha:** a ficha não entra se usar livros que o mestre não liberou (a lista de
  pendências diz quais). Fichas de outro sistema já não aparecem na lista e o banco recusa.
- **Aba Personagens com imagem** (site e app): cartões com o retrato em destaque ou o ícone da
  classe, como os de campanha.
- **Dados em "Meu personagem"** (site): os botões continuam, mas só rolam com a sessão em
  andamento (vão para o mural); antes disso, ou com dados presenciais, o clique avisa
  "Rolagem indisponível". Na página da ficha, as rolagens de teste continuam locais.

Verificações: `pnpm check` 20/20 (rpg-systems 152 testes; banco 180, com 11 ao vivo pulados) e
`pnpm build` 2/2. Sem migração. Não verificado no navegador nem no celular.

### 2026-10-18 — subida de nível e capa da campanha no app

- **Subida de nível no app** (aba Personagem da ficha, botão "Subir de nível"): as mesmas regras do
  site, só com seletores: a classe que sobe ou uma classe nova (multiclasse, com os pré-requisitos e
  o motivo de cada bloqueio), perícia e instrumento da classe nova, vida pela média ou pelo dado,
  aumento de atributo ou talento (Habilidoso e Iniciado em Magia com as escolhas deles), magias,
  invocações e Metamagia. Grava recursos, vida, habilidades e o marco, como o site.
- **Capa da campanha no app:** o mestre escolhe a capa ao criar a campanha e troca ou remove na
  central da campanha; a capa aparece no topo da central para todos.

Verificações: `pnpm check` 20/20 e `pnpm build` 2/2. Sem migração e sem mudança nativa (o app
recebe por atualização OTA). Não verificado no celular.
