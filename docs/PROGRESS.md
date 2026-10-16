# Progresso do Codexveil

> Documento de retomada. Última atualização: **2026-10-16**.
> O que falta em relação ao prompt inicial está em [`PENDENCIAS.md`](PENDENCIAS.md).

## Estado atual

As fases de 1 a 7 do plano estão implementadas. A fase 8 (qualidade e preparação para uso)
está parcial: código, testes e documentação estão prontos, mas **a validação ao vivo contra
um Supabase real ainda não foi feita**, porque a máquina de desenvolvimento não tem Docker e
ainda não existe um projeto Supabase do Codexveil.

| Fase                                                                            | Situação                                                    |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1. Fundação (monorepo, TS, lint, testes, design system, apps)                   | Concluída                                                   |
| 2. Backend e autenticação (migrações, RLS, Auth)                                | Concluída; falta validar o Auth ao vivo                     |
| 3. Campanhas, convites, participantes e papéis                                  | Concluída                                                   |
| 4. Fichas (D&D 5e: atributos, perícias, combate, inventário, magias e evolução) | Concluída                                                   |
| 5. Mesa do mestre (grupo, cena, NPCs e monstros, combate)                       | Concluída (web)                                             |
| 6. Editor de sessões por blocos com conteúdo privado                            | Concluída (web; leitura no mobile)                          |
| 7. Mobile (Expo)                                                                | Concluída para os fluxos prioritários; APK ainda não gerado |
| 8. Qualidade e preparação para uso                                              | Parcial (veja [`PENDENCIAS.md`](PENDENCIAS.md))             |

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
| `@codexveil/database` (RLS, migrações, seed, tipos, autosave, realtime, erros, config) | 12                | 134     |
| `@codexveil/rpg-systems` (regras D&D 5e, ficha, registro)                              | 3                 | 74      |
| `@codexveil/domain`                                                                    | 7                 | 58      |
| `@codexveil/ui` (marca, contraste, CSS)                                                | 3                 | 22      |
| `@codexveil/validation`                                                                | 1                 | 15      |
| `@codexveil/web` (rotas, formatação de datas)                                          | 2                 | 12      |
| **Total**                                                                              | **28**            | **315** |

Os testes de RLS aplicam as migrações reais num Postgres 17 em WebAssembly (PGlite) e
executam as consultas com o papel e o JWT de cada usuário. Eles cobrem: jogador tentando ler
notas privadas e blocos `gm`, sessões não publicadas, troca de UUIDs, edição da ficha de outro
jogador, campanha alheia, usuário anônimo, convites (expiração, usos, e-mail e corrida),
campanha arquivada e mídia privada no Storage.

### Não executado (limitações registradas)

- Execução contra um Supabase real: Auth com e-mail, Storage, Realtime e PostgREST de verdade.
  A máquina não tem Docker e não há projeto na nuvem.
- Uso do site num navegador com backend e do app num emulador ou aparelho.
- Geração do APK, que depende de uma conta Expo/EAS.
- Testes ponta a ponta e auditorias de acessibilidade e desempenho.

## Erros conhecidos

Nenhum erro de tipo, lint, teste ou build. Os problemas de configuração conhecidos (`eas-cli`
precisa de instalação global, perfil `development` do EAS sem `expo-dev-client`, `channel` sem
`expo-updates`) estão em [`PENDENCIAS.md`](PENDENCIAS.md#4-problemas-conhecidos).

## Configurações externas pendentes

1. Projeto Supabase exclusivo: `supabase link` e `supabase db push`.
2. No painel do Supabase: Site URL, URLs de redirecionamento, templates de e-mail e SMTP.
3. `apps/web/.env.local` e `apps/mobile/.env.local` com a URL e a publishable key.
4. Conta Expo, `EAS_PROJECT_ID` e as variáveis `EXPO_PUBLIC_*` cadastradas no EAS.
5. Hospedagem da web e domínio.

O passo a passo está em [`DEPLOY.md`](DEPLOY.md).

## Próximo passo exato

Criar o projeto Supabase, aplicar as migrações (`pnpm exec supabase db push`), configurar o
Auth (veja [`DEPLOY.md`](DEPLOY.md#2-autenticação)), preencher `apps/web/.env.local` e rodar
`pnpm dev:web`. Depois, percorrer os critérios de aceitação de 1 a 15 com duas contas (mestre
e jogador) e corrigir o que aparecer. A lista completa e priorizada está em
[`PENDENCIAS.md`](PENDENCIAS.md#5-próximos-passos-sugeridos-em-ordem).
