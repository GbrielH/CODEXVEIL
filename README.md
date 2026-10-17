# Codexveil

Plataforma de gerenciamento de RPG de mesa: campanhas, convites, fichas digitais, sessões com roteiro por blocos, biblioteca de NPCs e monstros e mesa do mestre com combate e segredos protegidos no banco de dados.

O projeto começa com D&D 5e (SRD 5.2) e foi projetado para receber outros sistemas sem exigir uma reescrita da aplicação.

## Aplicações

- **Web:** Next.js, responsiva e instalável como PWA, com todas as funcionalidades.
- **Mobile:** Expo/React Native para Android, com conta, painel, campanhas, convites, criação de personagens, ficha jogável com sincronização em tempo real e leitura de sessões.
- **Backend:** Supabase (Postgres, Auth, Storage e Realtime). A autorização é feita por políticas RLS no banco de dados; a interface não é considerada uma barreira de segurança.

## Links

| O quê                                                | Link                                                                                                                                                                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Site (produção)                                      | <https://codexveil.vercel.app>                                                                                                                                                                                |
| APK Android com atualização automática (recomendado) | <https://expo.dev/artifacts/eas/biJnmUweuBVeBI7xSMpxQH3lQMN7hZPfDJPklJ-Ay_0.apk> ([build `de6ceb5c`](https://expo.dev/accounts/gabriel.xxtth/projects/codexveil/builds/de6ceb5c-3d68-4be9-ad97-e19e2725b56b)) |
| APK Android reserva (sem atualização automática)     | <https://expo.dev/artifacts/eas/OZvl6Lk0rZtf9G-IwxtKQMX7BM-HEj9KNdZ428o85PU.apk>                                                                                                                              |
| Todos os builds do app (EAS)                         | <https://expo.dev/accounts/gabriel.xxtth/projects/codexveil/builds>                                                                                                                                           |
| Repositório                                          | <https://github.com/GbrielH/CODEXVEIL>                                                                                                                                                                        |

Para instalar o APK, abra o link no celular Android, baixe o arquivo e permita a instalação de fontes desconhecidas. A cada novo build, atualize esta tabela e [`docs/PROXIMOS_PASSOS.md`](docs/PROXIMOS_PASSOS.md).

O estado atual do projeto está documentado em [`docs/PROGRESS.md`](docs/PROGRESS.md), os próximos passos em [`docs/PROXIMOS_PASSOS.md`](docs/PROXIMOS_PASSOS.md) e o que ainda falta em relação ao escopo inicial em [`docs/PENDENCIAS.md`](docs/PENDENCIAS.md).

## Estrutura do projeto

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
docs/             Arquitetura, banco, segurança, licenças, deploy, progresso e pendências
```

## Tecnologias e versões

| Área                                  | Versão                   |
| ------------------------------------- | ------------------------ |
| Node.js                               | 24 (`.node-version`)     |
| pnpm / Turborepo                      | 12.14 / 2.11             |
| TypeScript                            | 6.0 (modo estrito)       |
| Next.js / React (web)                 | 16.4 / 19.3              |
| Tailwind CSS                          | 4.3                      |
| Expo / React Native / React (mobile)  | SDK 57 / 0.86.3 / 19.2.3 |
| Supabase JS / SSR / CLI               | 2.118 / 0.12 / 2.121     |
| Zod                                   | 4.6                      |
| Vitest / PGlite (Postgres 17 em WASM) | 5.0 / 0.5                |

## Pré-requisitos

- Node.js 24 e pnpm 12. O comando `corepack enable` habilita o Corepack para gerenciar a versão do gerenciador de pacotes definida no projeto.
- Um projeto Supabase **novo e exclusivo** para o Codexveil na nuvem **ou** Docker para executar o Supabase localmente com a CLI. Não reutilize o banco de outro projeto: as migrações criam esquema, funções, buckets e políticas próprios.
- Para gerar o APK, uma conta Expo com acesso ao EAS Build. A CLI do EAS é executada via `npx`, e não é necessário instalar o Android Studio na máquina.

## Instalação

Na raiz do projeto, execute:

```bash
pnpm install
```

## Configuração do Supabase

Escolha uma das opções abaixo.

### Opção A — ambiente local

Requer Docker instalado e em execução.

```bash
pnpm exec supabase start
pnpm exec supabase db reset
pnpm exec supabase status
```

Os comandos iniciam os serviços locais, aplicam as migrações e os dados de demonstração e exibem as URLs e chaves de acesso.

O seed cria duas contas de demonstração com a senha `Codexveil123`:

- `mestre.demo@codexveil.dev`
- `jogadora.demo@codexveil.dev`

Os e-mails locais podem ser consultados no Inbucket/Mailpit em <http://127.0.0.1:54324>.

> **Importante:** essas credenciais são apenas para demonstração local. Não as utilize em produção.

### Opção B — Supabase na nuvem

1. Crie um projeto exclusivo em [supabase.com](https://supabase.com).
2. Vincule o projeto à CLI:

   ```bash
   pnpm exec supabase link --project-ref <ref-do-projeto>
   ```

3. Aplique as migrações:

   ```bash
   pnpm exec supabase db push
   ```

O comando `db push` não aplica o seed de demonstração.

Configure também no painel do Supabase a URL do site, as URLs de redirecionamento, os modelos de e-mail e o SMTP. Consulte [`docs/DEPLOY.md`](docs/DEPLOY.md) para obter mais detalhes.

## Variáveis de ambiente

Copie os arquivos de exemplo e preencha os valores necessários:

```bash
cp apps/web/.env.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env.local
```

No Windows PowerShell, se o comando `cp` não funcionar no seu ambiente, você pode usar `Copy-Item`.

| Variável                               | Aplicação | Descrição                                                               |
| -------------------------------------- | --------- | ----------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Web       | URL do projeto Supabase                                                 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Web       | Chave pública `sb_publishable_...` ou chave anon compatível             |
| `NEXT_PUBLIC_SITE_URL`                 | Web       | URL pública do site, usada nos links de e-mail                          |
| `EXPO_PUBLIC_SUPABASE_URL`             | Mobile    | URL do Supabase; no emulador Android local, use `http://10.0.2.2:54321` |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Mobile    | Chave pública do Supabase                                               |
| `EXPO_PUBLIC_SITE_URL`                 | Mobile    | URL do site usada em convites e redefinições de senha                   |

Para o ambiente local, a URL da API do Supabase normalmente é `http://127.0.0.1:54321`.

Os aplicativos validam a configuração ao iniciar e rejeitam chaves secretas, como `service_role` e `sb_secret_...`. Sem a configuração necessária, o site informa quais recursos dependem do backend.

> **Nunca** coloque chaves secretas em variáveis públicas ou no repositório.

## Comandos disponíveis

Execute os comandos na raiz do projeto.

| Comando                                     | Descrição                                                                   |
| ------------------------------------------- | --------------------------------------------------------------------------- |
| `pnpm dev:web`                              | Inicia o site em <http://localhost:3000>                                    |
| `pnpm dev:mobile`                           | Inicia o Expo para abrir o aplicativo no Expo Go ou em um development build |
| `pnpm check`                                | Executa lint, verificação de tipos e testes dos pacotes                     |
| `pnpm test`                                 | Executa os testes de domínio, regras de D&D, validação, RLS e web           |
| `pnpm build`                                | Executa o build de produção da web e exporta o bundle Android do app        |
| `pnpm format`                               | Formata os arquivos com Prettier                                            |
| `pnpm db:types`                             | Regenera os tipos do banco a partir das migrações, sem Docker               |
| `pnpm brand:assets`                         | Regenera ícones e splash a partir do emblema vetorial                       |
| `pnpm --filter @codexveil/mobile build:apk` | Gera um APK de teste usando EAS Build                                       |

Consulte [`docs/DEPLOY.md`](docs/DEPLOY.md) para obter instruções de build, publicação e backups.

### Testes de banco sem Docker

Os testes do pacote `packages/database` aplicam as migrações em um Postgres 17 executado em WebAssembly por meio do PGlite, com um shim mínimo do Supabase.

As consultas são executadas com o papel e o JWT do usuário para testar as políticas RLS, incluindo cenários como tentativas de acessar notas privadas, trocar UUIDs e editar a ficha de outro jogador, sem depender de um banco externo.

## Documentação

- [Arquitetura e decisões](docs/ARCHITECTURE.md)
- [Modelo de dados e migrações](docs/DATABASE.md)
- [Segurança e autorização](docs/SECURITY.md)
- [Licenças de conteúdo](docs/CONTENT_LICENSES.md)
- [Deploy, APK e backups](docs/DEPLOY.md)
- [Progresso do projeto](docs/PROGRESS.md)
- [Pendências em relação ao escopo inicial](docs/PENDENCIAS.md)
- [Próximos passos](docs/PROXIMOS_PASSOS.md)
- [Instruções para agentes e regra de documentação](AGENTS.md)
