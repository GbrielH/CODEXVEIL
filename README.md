# Codexveil

Plataforma de gerenciamento de RPG de mesa: campanhas, convites, fichas digitais, sessões
com roteiro por blocos, biblioteca de NPCs e monstros, mesa do mestre com combate e
segredos protegidos no banco de dados. Começa com D&D 5e (SRD 5.2) e foi desenhada para
receber outros sistemas sem reescrever a aplicação.

- **Web** (Next.js, responsiva e instalável como PWA): todas as funcionalidades.
- **Mobile** (Expo/React Native, Android): conta, painel, campanhas, convites, criação de
  personagens, ficha jogável com sincronização em tempo real e leitura de sessões.
- **Backend**: Supabase (Postgres + Auth + Storage + Realtime). Toda autorização é feita
  por RLS no banco — a interface nunca é barreira de segurança.

> Estado atual e próximos passos: [`docs/PROGRESS.md`](docs/PROGRESS.md).

## Estrutura

```
apps/
  web/            Next.js 16 (App Router), React 19, Tailwind CSS 4
  mobile/         Expo SDK 57, React Native 0.86, Expo Router
packages/
  domain/         Regras de negócio puras (permissões, convites, recursos, iniciativa, blocos)
  rpg-systems/    Contrato de sistemas de RPG + módulo D&D 5e (SRD 5.2)
  validation/     Esquemas zod compartilhados (formulários, blocos, uploads)
  database/       Tipos do banco, consultas, autosave, Realtime e testes de RLS (PGlite)
  ui/             Design system: tokens, emblema e glifos (web e mobile)
  config/         TypeScript e ESLint compartilhados
supabase/
  migrations/     Esquema versionado, policies RLS, funções e buckets
  seed.sql        Dados de DEMONSTRAÇÃO (somente ambiente local)
  templates/      E-mails de autenticação em português
docs/             Arquitetura, banco, segurança, licenças, deploy e progresso
```

## Tecnologias e versões

| Área | Versão |
| --- | --- |
| Node.js | 24 (`.node-version`) |
| pnpm / Turborepo | 12.14 / 2.11 |
| TypeScript | 6.0 (modo estrito) |
| Next.js / React (web) | 16.4 / 19.3 |
| Tailwind CSS | 4.3 |
| Expo / React Native / React (mobile) | SDK 57 / 0.86.3 / 19.2.3 |
| Supabase JS / SSR / CLI | 2.118 / 0.12 / 2.121 |
| zod | 4.6 |
| Vitest / PGlite (Postgres 17 em WASM) | 5.0 / 0.5 |

## Pré-requisitos

- Node.js 24 e pnpm 12 (`corepack enable` instala a versão de `packageManager`).
- Um projeto Supabase **novo e exclusivo do Codexveil** (nuvem) **ou** Docker para rodar o
  Supabase localmente com a CLI. Não reutilize o banco de outro projeto: as migrações
  criam esquema, funções, buckets e políticas próprios.
- Para o APK: conta Expo (EAS Build). Não é preciso Android Studio na máquina.

## Instalação

```bash
pnpm install
```

### Configurar o Supabase

**Opção A — local (requer Docker):**

```bash
pnpm exec supabase start      # sobe Postgres, Auth, Storage, Realtime e Studio
pnpm exec supabase db reset   # aplica supabase/migrations e o seed de demonstração
pnpm exec supabase status     # mostra a URL da API e a publishable key
```

O seed cria duas contas de **demonstração** (senha `Codexveil123`):
`mestre.demo@codexveil.dev` e `jogadora.demo@codexveil.dev`. E-mails locais aparecem no
Inbucket/Mailpit em `http://127.0.0.1:54324`.

**Opção B — nuvem:** crie um projeto em <https://supabase.com>, depois:

```bash
pnpm exec supabase link --project-ref <ref-do-projeto>
pnpm exec supabase db push    # aplica as migrações (o seed NÃO é aplicado)
```

Em seguida configure no painel do projeto (detalhes em [`docs/DEPLOY.md`](docs/DEPLOY.md)):
Site URL, URLs de redirecionamento, templates de e-mail e SMTP.

### Variáveis de ambiente

Copie os modelos e preencha **apenas valores públicos** (URL e publishable key):

```bash
cp apps/web/.env.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env.local
```

| Variável | Onde | Descrição |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | web | URL do projeto (local: `http://127.0.0.1:54321`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | web | Publishable key (`sb_publishable_…`) ou anon key |
| `NEXT_PUBLIC_SITE_URL` | web | URL pública do site (links de e-mail) |
| `EXPO_PUBLIC_SUPABASE_URL` | mobile | No emulador Android, o Supabase local é `http://10.0.2.2:54321` |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | mobile | Mesma publishable key |
| `EXPO_PUBLIC_SITE_URL` | mobile | Site usado em convites e redefinição de senha |

Os apps validam a configuração ao iniciar e **recusam chaves secretas**
(`service_role` / `sb_secret_…`). Sem configuração, o site abre normalmente e as áreas que
dependem do backend explicam o que falta, sem fingir que funcionam.

## Comandos

| Comando | O que faz |
| --- | --- |
| `pnpm dev:web` | Site em `http://localhost:3000` |
| `pnpm dev:mobile` | Expo (abra no Expo Go ou num development build) |
| `pnpm check` | Lint + typecheck + testes de todos os pacotes |
| `pnpm test` | Testes (domínio, regras D&D, validação, RLS no Postgres, web) |
| `pnpm build` | Build de produção da web e bundle Android do app (`expo export`) |
| `pnpm format` | Prettier |
| `pnpm db:types` | Regenera `packages/database/src/types.gen.ts` a partir das migrações (sem Docker) |
| `pnpm brand:assets` | Regenera ícones e splash a partir do emblema vetorial |
| `pnpm --filter @codexveil/mobile build:apk` | APK de teste via EAS Build (ver `docs/DEPLOY.md`) |

### Testes de banco sem Docker

Os testes de `packages/database` aplicam as **migrações reais** num Postgres 17 em WASM
(PGlite) com um shim mínimo do Supabase e executam cada consulta com o papel e o JWT do
usuário — exatamente como o PostgREST. Assim as policies RLS são testadas de verdade
(jogador tentando ler notas privadas, trocar UUIDs, editar a ficha de outro jogador etc.)
sem depender de nenhum banco externo.

## Documentação

- [Arquitetura e decisões](docs/ARCHITECTURE.md)
- [Modelo de dados e migrações](docs/DATABASE.md)
- [Segurança e autorização](docs/SECURITY.md)
- [Licenças de conteúdo](docs/CONTENT_LICENSES.md)
- [Deploy, APK e backups](docs/DEPLOY.md)
- [Progresso](docs/PROGRESS.md)
