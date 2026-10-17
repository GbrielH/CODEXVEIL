# Arquitetura e decisões

## Visão geral

```
┌───────────────────────┐   ┌────────────────────────┐
│ apps/web (Next.js 16) │   │ apps/mobile (Expo 57)  │
│ Server Components     │   │ Expo Router            │
│ Server Actions        │   │ supabase-js + SQLite   │
└──────────┬────────────┘   └───────────┬────────────┘
           │   pacotes compartilhados (TypeScript puro)
           │   domain · rpg-systems · validation · database · ui
           ▼                            ▼
┌──────────────────────────────────────────────────────┐
│ Supabase: Postgres (RLS) · Auth · Storage · Realtime │
└──────────────────────────────────────────────────────┘
```

Não existe servidor de aplicação próprio. Web e mobile falam direto com o Supabase usando
apenas a **publishable key**, e toda autorização é feita no Postgres (RLS, GRANTs por coluna e
funções SQL). A interface nunca é tratada como barreira de segurança.

## Monorepo

pnpm workspaces e Turborepo. Os pacotes exportam o código-fonte TypeScript direto
(`"exports": { ".": "./src/index.ts" }`), sem etapa de build. O Next.js os transpila
(`transpilePackages`) e o Metro os resolve no mobile. Assim, uma alteração num pacote aparece
nos dois apps sem republicar nada.

| Pacote        | Depende de                                   | Responsabilidade                                                                                                                                                      |
| ------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `domain`      | (nenhum)                                     | Regras de negócio puras: permissões por papel, motivos de recusa de convite, dano, cura e descanso, inventário, iniciativa, blocos, visibilidade, planos e `AppError` |
| `rpg-systems` | `domain`, `zod`                              | Contrato `RpgSystem`, registro de sistemas e módulo `dnd5e`                                                                                                           |
| `validation`  | `domain`, `rpg-systems`, `zod`               | Esquemas de entrada (formulários, blocos e uploads) usados pelos dois apps                                                                                            |
| `database`    | `domain`, `validation`, `supabase-js`, `zod` | Tipos do banco, consultas, autosave, Realtime e tradução de erros do Postgres                                                                                         |
| `ui`          | (nenhum)                                     | Tokens de design, emblema SVG, glifos e verificação de contraste                                                                                                      |
| `config`      | (nenhum)                                     | `tsconfig` base e configuração do ESLint                                                                                                                              |

Regra: **componentes visuais não são compartilhados**. A web usa HTML e Tailwind, e o mobile
usa React Native. O que é compartilhado são regras, tipos, validações, consultas e tokens.
Cada app tem seus componentes em `src/components`.

## Fluxo de dados

### Web

- **Leitura:** Server Components criam um cliente por requisição
  (`apps/web/src/lib/supabase/server.ts`, `@supabase/ssr` com cookies) e chamam as consultas de
  `@codexveil/database`.
- **Escrita simples** (criar campanha, convites, perfil): Server Actions validam com
  `@codexveil/validation` e chamam a consulta correspondente. O RLS valida de novo no banco.
- **Escrita interativa** (ficha, cena, combate e roteiro): Client Components usam o cliente do
  navegador (`lib/supabase/browser.ts`), o `Autosaver` e as funções atômicas (RPC).
- **Sessão:** `src/proxy.ts` (o antigo `middleware` do Next 16) renova o token a cada
  requisição e redireciona rotas privadas para `/entrar`, sinalizando quando a sessão expirou.

### Mobile

- Um único cliente `supabase-js` (`apps/mobile/src/lib/supabase.ts`) guarda a sessão no SQLite
  privado do app (`expo-sqlite/kv-store`) e pausa a renovação do token em segundo plano.
- As telas usam as mesmas consultas de `@codexveil/database` e as mesmas regras de
  `@codexveil/domain` e `@codexveil/rpg-systems` que a web.

## Sistemas de RPG extensíveis

A camada central (campanhas, participantes, sessões, armazenamento) não conhece regras de
nenhum sistema. Um personagem guarda:

- `characters.sheet`: JSON **somente com valores informados pelo usuário**, validado e migrado
  pelo módulo do sistema (`parseSheet`). Valores derivados (modificadores, bônus, CA) são
  sempre calculados por `computeDerived` e nunca gravados.
- Tabelas genéricas para o estado de jogo: `character_resources` (trilhas como vida, dados de
  vida, espaços de magia e moedas), `character_conditions`, `character_items` e
  `character_abilities` (com `data` livre por sistema).

O contrato está em `packages/rpg-systems/src/types.ts`. Cada sistema define o esquema e a
versão da ficha, a ficha padrão, os cálculos derivados, o resumo para listas, as trilhas
iniciais, as condições, a ficha de estatísticas de criaturas, os valores de combate para a cena,
as **regras de criação da campanha** (`campaignRulesSchema`, `parseCampaignRules`,
`describeCampaignRules`; gravadas em `campaigns.character_rules`) e a licença do conteúdo de
referência.

### Criação guiada de personagens (D&D 5e)

A criação segue os passos do SRD 5.2.1 (classe → origem: antecedente, espécie e idiomas →
atributos → alinhamento → detalhes) e só oferece opções válidas para o personagem. A lógica
fica toda em `packages/rpg-systems/src/dnd5e/`, compartilhada por web, mobile e servidor:

- `srd/`: dados do SRD 5.2.1 (12 classes com habilidades do 1º ao 20º nível e a subclasse do
  SRD, 9 espécies, 4 antecedentes, talentos, idiomas, armas, armaduras, ferramentas,
  equipamento inicial, invocações, metamagia e as 339 magias com o cabeçalho técnico).
- `creation/draft.ts`: o rascunho (`Dnd5eDraft`), os métodos de atributo (conjunto padrão,
  compra de pontos e rolagem 4d6) e o esquema zod usado no servidor.
- `creation/choices.ts`: `listDnd5eChoices(draft)` devolve as escolhas que as regras exigem
  agora (perícias, ordens, estilo de luta, maestria, especializações, linhagem, talentos e as
  escolhas aninhadas deles, magias, equipamento), cada uma com o passo do assistente e as
  opções indisponíveis já marcadas com o motivo. `validateDnd5eDraft(draft, contexto)` confere
  tudo, inclusive regras que cruzam passos (perícia repetida, talento não repetível, listas do
  Iniciado em Magia, limites de 20 e 30, nível e métodos definidos pelo mestre).
- `creation/build.ts`: monta a ficha, as trilhas (PV, dados de vida, espaços de magia ou de
  pacto e usos de habilidades), as habilidades de classe, espécie e talentos, as magias, os
  ataques das armas iniciais e o inventário. CA, deslocamento, PV, salvaguardas, perícias e
  proficiência em Iniciativa seguem as regras do SRD.

As interfaces (`apps/web/src/components/characters/dnd5e-wizard/` e
`apps/mobile/src/app/(app)/personagem/novo.tsx`) só desenham as escolhas. Na web, a Server
Action repete a validação com as regras da campanha lidas do banco antes de gravar. A gravação
usa `create_character`, que cria ficha, trilhas, inventário e habilidades numa transação.

**Para adicionar um sistema:**

1. Crie `packages/rpg-systems/src/<id>/` implementando `RpgSystem`.
2. Registre-o em `packages/rpg-systems/src/registry.ts` (`SYSTEM_IDS` e `systems`).
3. Crie uma migração que insira a linha em `public.rpg_systems`. A chave estrangeira impede
   personagens e campanhas de sistemas desconhecidos.
4. Crie a interface de ficha do sistema (`apps/web/src/components/sheets/<id>/` e o
   equivalente no mobile). As telas de campanha, sessão, mesa e biblioteca usam só o contrato
   e não mudam.
5. Documente a licença do conteúdo em [`CONTENT_LICENSES.md`](CONTENT_LICENSES.md).

## Concorrência e persistência

- **Ficha:** controle otimista. `characters.version` sobe a cada alteração (gatilho), e o
  cliente grava com `where version = <lida>`. Se nenhuma linha for afetada, há conflito, e o
  usuário escolhe entre recarregar e sobrescrever. O `Autosaver`
  (`packages/database/src/autosave.ts`) agrupa as edições (debounce), envia uma gravação por
  vez e só mostra "salvo" depois da confirmação do servidor.
- **Vida, recursos e quantidades:** funções atômicas no banco (`adjust_character_resource`,
  `adjust_item_quantity`, `adjust_session_entity_hp`). Mestre e jogador podem causar dano ao
  mesmo tempo sem que uma atualização se perca.
- **Recuperação:** `character_snapshots` guarda até 30 cópias automáticas da ficha (no máximo
  uma a cada 10 minutos) para desfazer perdas acidentais.
- **Sessões, anotações e encontros** também têm `version` incrementada por gatilho.

## Tempo real

Apenas tabelas que mudam durante uma partida são publicadas: participantes, personagens,
recursos, condições, cena, encontros e combatentes. O Realtime (Postgres Changes) aplica o RLS
a cada assinante. Mesmo assim, os clientes usam os eventos **apenas como sinal** para
recarregar os dados pelas consultas normais (`packages/database/src/realtime.ts`), com
agrupamento de rajadas. O status (`live`, `connecting`, `offline`) aparece na interface.

O canal fica `SUBSCRIBED` antes de o servidor terminar de assinar o Postgres, e mudanças nesse
intervalo não geram eventos (verificado contra o Supabase real). Por isso o estado só vira
`live` quando chega a mensagem de sistema do Postgres Changes (`status: ok`), com uma
salvaguarda de 5 s. Nesse momento, e a cada reconexão, os dados são recarregados uma vez.

O canal entra com o token que o cliente do Realtime tiver naquele instante. No navegador e no
app a sessão é carregada de forma assíncrona; se a tela assinasse antes, o Realtime criaria as
assinaturas com o papel anônimo e recusaria todas. Por isso `subscribeToChanges` chama
`realtime.setAuth()` antes de entrar no canal. Cada assinatura também usa um tópico próprio,
porque o supabase-js reaproveita o canal de mesmo tópico e a remoção é assíncrona. Os dois
problemas foram vistos no navegador em 2026-10-17.

## Erros

- `AppError` (`packages/domain/src/errors.ts`) tem códigos estáveis (`forbidden`, `conflict`,
  `not_found`, `session_expired`, `limit_reached`, `network`, `not_configured` etc.) e mensagens
  em português.
- `packages/database/src/errors.ts` traduz os erros do Postgres e do PostgREST. Os SQLSTATEs
  próprios são `CVLIM` (limite do plano, com o recurso no `hint`) e `CVARC` (campanha
  arquivada).
- Os erros nunca são escondidos: a causa original fica preservada em `cause` e a interface
  mostra uma mensagem compreensível.

## Design system

- Paleta oficial (Carvão `#171719`, Vinho `#571F2B`, Prata `#B8B8BC`, Pergaminho `#E4D8BD`)
  e cores derivadas em `packages/ui/src/tokens.ts`. Para a web, `packages/ui/scripts/build-css.ts`
  gera `packages/ui/css/tokens.css`; o mobile importa os tokens em `apps/mobile/src/lib/theme.ts`.
- O contraste das combinações usadas é verificado em teste (`contrast.test.ts`).
- O emblema e o logotipo são SVG originais (`brand.ts`). `pnpm brand:assets` gera todos os
  ícones (favicon, PWA, Android adaptativo e splash) a partir deles, sem imagens externas.
- Fontes: Cinzel (títulos), Alegreya (textos de leitura) e Inter (interface). A web as serve
  pelo próprio domínio (`next/font`), e o mobile as embute no app (`@expo-google-fonts`).

## Planos e limites

As tabelas `plans` e `user_plans` e os gatilhos que aplicam `max_owned_campaigns`,
`max_owned_characters` e `max_members_per_campaign` já existem. Hoje só há o plano `free`, sem
limites (`null` = ilimitado), e não há cobrança, preço nem assinatura simulada. Só o backend
(`service_role`) altera o plano de um usuário.

## Decisões registradas

| Decisão                                                     | Motivo                                                                                                                |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Supabase sem servidor próprio                               | RLS cobre a autorização. Edge Functions ficam para operações privilegiadas reais (e-mails, rotinas agendadas).        |
| Papel por campanha (`campaign_members.role`)                | O mesmo usuário é mestre numa campanha e jogador em outra.                                                            |
| Ficha como JSON validado mais tabelas de estado de jogo     | Os sistemas variam na estrutura da ficha. Vida e recursos precisam de atualizações atômicas e de Realtime por linha.  |
| Segredos de NPCs numa tabela separada (`creature_gm_data`)  | O RLS é por linha. Separar a tabela garante que jogadores nunca recebam a coluna secreta, nem pelo Realtime.          |
| Roteiro em blocos JSON tipados (nunca HTML)                 | Validação no cliente (zod) e no banco (`is_valid_block_data`), sem XSS armazenado, e `schema_version` para evolução.  |
| Posição dos blocos em `double precision`                    | Permite inserir entre dois blocos sem renumerar. `reorder_session_blocks` renumera quando necessário.                 |
| Mídia privada com URLs assinadas                            | Capas, retratos e imagens de roteiro seguem a visibilidade do registro.                                               |
| Sem foto de perfil                                          | O usuário é identificado pelas iniciais. Menos dados pessoais e menos uso de armazenamento.                           |
| Imagens reduzidas no navegador                              | Redimensionar e regravar em WebP antes do envio poupa o armazenamento do Supabase; o bucket limita a 2 MB.            |
| Criação de personagem guiada por regras compartilhadas      | Web, mobile e servidor usam o mesmo motor (`listDnd5eChoices`, `validateDnd5eDraft`, `buildDnd5eCharacterFromDraft`). |
| Mestres não são donos de personagens das próprias campanhas | O mestre conduz com NPCs e monstros; a regra fica no banco (`CVGMC`), não só na interface.                            |
| Só conteúdo do SRD 5.2.1 na criação                         | É o conteúdo oficial que a licença CC-BY-4.0 permite reproduzir; livros comerciais ficam de fora (prompt, §8).        |
| Testes de RLS com PGlite                                    | Testam as policies reais sem Docker nem banco externo, na CI e em qualquer máquina.                                   |
| Pacotes sem build                                           | Menos configuração, e o mesmo código é usado pelos dois apps.                                                         |
