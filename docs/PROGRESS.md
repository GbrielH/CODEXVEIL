# Progresso do Codexveil

> Documento de retomada. Última atualização: **2026-10-17**.
> O que falta em relação ao prompt inicial está em [`PENDENCIAS.md`](PENDENCIAS.md).

## Estado atual

As fases de 1 a 7 do plano estão implementadas. O MVP está **publicado**: site em
<https://codexveil.vercel.app>, backend no projeto Supabase `CODEXVEIL` e APK gerado pelo EAS
(veja [`PROXIMOS_PASSOS.md`](PROXIMOS_PASSOS.md)). A API foi validada ao vivo por um teste de
integração (11/11 em 2026-10-17). A fase 8 continua parcial: faltam o SMTP próprio (adiado), o
uso real no navegador e no aparelho com duas contas, os testes ponta a ponta e as auditorias.

**Em 2026-10-17:** criação de personagens guiada pelas regras do SRD 5.2.1 na web e no app,
regras de criação definidas pelo mestre em cada campanha, mestres impedidos de criar
personagens nas próprias campanhas, "olho" nos campos de senha, remoção da foto de perfil,
redução das imagens antes do envio e correção do tempo real no navegador e no app. A migração
`20261016130000_character_creation_rules.sql` está **aplicada em produção** e o código foi
enviado ao `main`. **O site publicado e o APK ainda não têm essas mudanças:** o deploy
automático depende de ligar o GitHub à Vercel e ao Expo, e o app precisa de um APK novo (veja
[`PROXIMOS_PASSOS.md`](PROXIMOS_PASSOS.md), etapas 0 e 1).

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

Sete migrações versionadas (fundação, campanhas, personagens, sessões e biblioteca, storage,
realtime e criação guiada; a sétima ainda não foi aplicada em produção), um seed de
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
| `@codexveil/database` (RLS, migrações, seed, tipos, autosave, realtime, erros, config) | 12                | 151     |
| `@codexveil/database` — teste ao vivo (só com credenciais; veja abaixo)                | 1                 | 11      |
| `@codexveil/rpg-systems` (regras, ficha, registro, dados do SRD e criação guiada)      | 5                 | 108     |
| `@codexveil/domain`                                                                    | 7                 | 58      |
| `@codexveil/ui` (marca, contraste, CSS)                                                | 3                 | 22      |
| `@codexveil/validation`                                                                | 1                 | 15      |
| `@codexveil/web` (rotas, formatação de datas)                                          | 2                 | 12      |
| **Total (sem o teste ao vivo)**                                                        | **30**            | **366** |

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

**Não testado ainda:** o assistente no app (num aparelho ou no navegador) e o uso por pessoas
com duas contas.

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
campanha.

### Não executado (limitações registradas)

- Uso do site num navegador e do app num aparelho por pessoas, com duas contas reais (veja
  [`PROXIMOS_PASSOS.md`](PROXIMOS_PASSOS.md), etapa 2). O percurso automatizado acima cobre só
  o site local.
- Fluxos de e-mail (confirmação e recuperação de senha) com SMTP próprio, adiados.
- Testes ponta a ponta de interface e auditorias de acessibilidade e desempenho.

## Erros conhecidos

Nenhum erro de tipo, lint, teste ou build. Os problemas conhecidos (limitações dos e-mails
padrão do Supabase e deploy automático ainda não ligado ao GitHub) estão em
[`PENDENCIAS.md`](PENDENCIAS.md#5-problemas-conhecidos).

## Configurações externas pendentes

1. SMTP próprio (Brevo, com o e-mail exclusivo do sistema) e, depois, o envio dos templates
   em português (`supabase config push --workdir deploy …`).
2. Ligar o repositório `GbrielH/CODEXVEIL` à Vercel e ao Expo, para o deploy automático a cada
   push. Sem isso, o site publicado continua na versão anterior (a CLI da Vercel desta máquina
   está sem login).
3. Domínio próprio (opcional).

O passo a passo está em [`DEPLOY.md`](DEPLOY.md).

## Próximo passo exato

1. **Responsável:** ligar o GitHub à Vercel e ao Expo (links em
   [`PROXIMOS_PASSOS.md`](PROXIMOS_PASSOS.md), etapa 1). O push seguinte publica o site.
2. **Claude:** gerar o APK novo pelo workflow do EAS logo após este push (o fingerprint nativo
   mudou), atualizar os links do APK e confirmar o site publicado.
3. Instalar o APK novo e usar o site e o app com duas contas.

A lista completa e priorizada está em
[`PENDENCIAS.md`](PENDENCIAS.md#6-próximos-passos-sugeridos-em-ordem).
