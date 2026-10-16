# Progresso do Codexveil

> Documento de retomada. Última atualização: **2026-10-16**.
> O que falta em relação ao prompt inicial está em [`PENDENCIAS.md`](PENDENCIAS.md).

## Estado atual

As fases de 1 a 7 do plano estão implementadas. O MVP está **publicado**: site em
<https://codexveil.vercel.app>, backend no projeto Supabase `CODEXVEIL` e APK gerado pelo EAS
(veja [`PROXIMOS_PASSOS.md`](PROXIMOS_PASSOS.md)). A API foi validada ao vivo por um teste de
integração (10/10). A fase 8 continua parcial: faltam o SMTP próprio (adiado), o uso real no
navegador e no aparelho com duas contas, os testes ponta a ponta e as auditorias.

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
| Personagens       | `/personagens`, `/personagens/novo`, `/personagens/[id]` (ficha em abas)                                                         |
| Perfil            | `/perfil`: nome, bio, avatar, preferências (densidade e animações) e envio do link de troca de senha                             |

A ficha tem as abas Jogo (vida, condições, recursos e descansos), Atributos (atributos,
salvaguardas e perícias), Inventário (itens e moedas), Habilidades e magias (ataques, magias,
talentos e traços), Personagem (história e descrição), Evolução (XP ou marcos, histórico e
cópias de segurança) e Ajustes (retrato, campanha e exclusão; só para quem pode editar a ficha).

### Mobile (`apps/mobile`, Expo SDK 57)

- Entrar, cadastro, recuperação de senha e aviso de sessão expirada.
- Abas: Painel, Campanhas, Personagens e Perfil (nome e bio).
- Campanha: participantes, personagens e sessões publicadas; criar campanha e sair dela.
- Convite: prévia, aceitar e recusar.
- Criação de personagem com a mesma regra da web (`buildDnd5eCharacter`).
- Ficha jogável com autosave versionado, ajustes atômicos de vida e recursos e Realtime.
- Leitura de sessões (apenas os blocos públicos de sessões publicadas, filtrados pelo banco).

### Pacotes compartilhados

| Pacote                   | Conteúdo                                                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `@codexveil/domain`      | Permissões, convites, recursos (dano, cura e descanso), inventário, iniciativa, blocos, visibilidade, planos e erros |
| `@codexveil/rpg-systems` | Contrato `RpgSystem`, registro de sistemas e módulo D&D 5e (SRD 5.2)                                                 |
| `@codexveil/validation`  | Esquemas zod (auth, perfil, campanhas, fichas, biblioteca, sessões e uploads)                                        |
| `@codexveil/database`    | Cliente tipado, consultas, autosave, Realtime, erros, tipos gerados e testes de RLS                                  |
| `@codexveil/ui`          | Tokens de cor e tipografia, emblema SVG, glifos e verificação de contraste                                           |
| `@codexveil/config`      | `tsconfig` e ESLint compartilhados                                                                                   |

### Banco (`supabase/`)

Seis migrações versionadas (fundação, campanhas, personagens, sessões e biblioteca, storage,
realtime), um seed de demonstração **somente local** e templates de e-mail em português.
Os detalhes estão em [`DATABASE.md`](DATABASE.md) e [`SECURITY.md`](SECURITY.md).

## Testes e verificações executados

Execução em 2026-10-16, Windows 10, Node 24 e pnpm 12.14:

| Comando                                                     | Resultado                 |
| ----------------------------------------------------------- | ------------------------- |
| `pnpm check --force` (lint, typecheck e testes)             | 20/20 tarefas com sucesso |
| `pnpm build --force` (`next build` e `expo export` Android) | 2/2 tarefas com sucesso   |

| Pacote                                                                                 | Arquivos de teste | Testes  |
| -------------------------------------------------------------------------------------- | ----------------- | ------- |
| `@codexveil/database` (RLS, migrações, seed, tipos, autosave, realtime, erros, config) | 12                | 137     |
| `@codexveil/database` — teste ao vivo (só com credenciais; veja abaixo)                | 1                 | 10      |
| `@codexveil/rpg-systems` (regras D&D 5e, ficha, registro)                              | 3                 | 74      |
| `@codexveil/domain`                                                                    | 7                 | 58      |
| `@codexveil/ui` (marca, contraste, CSS)                                                | 3                 | 22      |
| `@codexveil/validation`                                                                | 1                 | 15      |
| `@codexveil/web` (rotas, formatação de datas)                                          | 2                 | 12      |
| **Total**                                                                              | **29**            | **328** |

Os testes de RLS aplicam as migrações reais num Postgres 17 em WebAssembly (PGlite) e
executam as consultas com o papel e o JWT de cada usuário. Eles cobrem: jogador tentando ler
notas privadas e blocos `gm`, sessões não publicadas, troca de UUIDs, edição da ficha de outro
jogador, campanha alheia, usuário anônimo, convites (expiração, usos, e-mail e corrida),
campanha arquivada e mídia privada no Storage.

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
[`ARCHITECTURE.md`](ARCHITECTURE.md#tempo-real)).

### Não executado (limitações registradas)

- Uso do site num navegador e do app num aparelho com duas contas reais (veja
  [`PROXIMOS_PASSOS.md`](PROXIMOS_PASSOS.md), etapas 4 e 6).
- Fluxos de e-mail (confirmação e recuperação de senha) com SMTP próprio, adiados.
- Testes ponta a ponta de interface e auditorias de acessibilidade e desempenho.

## Erros conhecidos

Nenhum erro de tipo, lint, teste ou build. Os problemas conhecidos (limitações dos e-mails
padrão do Supabase e deploy da web sem ligação com o GitHub) estão em
[`PENDENCIAS.md`](PENDENCIAS.md#4-problemas-conhecidos).

## Configurações externas pendentes

1. SMTP próprio (Brevo, com o e-mail exclusivo do sistema) e, depois, o envio dos templates
   em português (`supabase config push --workdir deploy …`).
2. App da Vercel na conta GitHub `GbrielH`, para o deploy automático a cada push.
3. Domínio próprio (opcional).

O passo a passo está em [`DEPLOY.md`](DEPLOY.md).

## Próximo passo exato

Instalar o APK num Android e percorrer as etapas 4 e 6 de
[`PROXIMOS_PASSOS.md`](PROXIMOS_PASSOS.md) no site publicado e no app. Enquanto o SMTP não
estiver pronto, use contas com e-mails de membros da organização do Supabase. Gere um novo APK
para incluir a correção do Realtime. A lista completa e priorizada está em
[`PENDENCIAS.md`](PENDENCIAS.md#5-próximos-passos-sugeridos-em-ordem).
