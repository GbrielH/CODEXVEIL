# Deploy, APK e backups

Este guia assume um projeto Supabase **novo e exclusivo** para o Codexveil. Os comandos rodam
na raiz do repositório.

> **Situação em 2026-10-16:** nenhum destes passos foi executado ainda (não há projeto
> Supabase nem conta EAS configurados). Ao seguir o guia pela primeira vez, registre o que
> precisar de ajuste.

## 1. Supabase: projeto e migrações

1. Crie o projeto em <https://supabase.com/dashboard> e escolha a região mais próxima dos
   jogadores (por exemplo, `sa-east-1`).
2. Vincule e aplique as migrações:

   ```bash
   pnpm exec supabase login
   pnpm exec supabase link --project-ref <ref-do-projeto>
   pnpm exec supabase db push        # aplica supabase/migrations (o seed NÃO é aplicado)
   ```

3. Confira no painel: **Database → Tables** deve listar as tabelas de `public`, todas com RLS,
   e **Storage** deve ter os buckets `avatars` (público) e `campaign-media` (privado).
4. Confira se **Realtime** está habilitado no projeto. A migração `…_realtime.sql` adiciona as
   tabelas à publicação `supabase_realtime`.

## 2. Autenticação

No painel do projeto:

| Onde                                                   | Valor                                                                                                                                                      |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication → URL Configuration → **Site URL**      | URL pública do site, ex.: `https://codexveil.app`                                                                                                          |
| Authentication → URL Configuration → **Redirect URLs** | `https://codexveil.app/**` e `codexveil://**` (para o app no futuro). Em homologação, inclua também a URL de preview.                                      |
| Authentication → Sign In / Providers → Email           | **Confirm email** ligado, senha mínima de 8 caracteres e **Secure password change** ligado (igual ao `supabase/config.toml`)                               |
| Authentication → Email Templates                       | Copie o HTML e o assunto de `supabase/templates/confirmation.html`, `recovery.html` e `email_change.html`. Os assuntos estão em `supabase/config.toml`.    |
| Authentication → SMTP Settings                         | Configure um provedor próprio (Resend, Amazon SES, Postmark etc.). O SMTP embutido do Supabase tem limite muito baixo de envios e não serve para produção. |

Os templates montam o link como `{{ .SiteURL }}/auth/confirmar?token_hash=…&type=…`, então a
**Site URL precisa ser exatamente a URL do site**. A rota `/auth/confirmar` valida o token e só
redireciona para caminhos internos.

## 3. Variáveis de ambiente

São todas públicas: só a URL do projeto e a **publishable key** (Project Settings → API Keys).
**Nunca** use `service_role` ou `sb_secret_…`: os apps recusam iniciar com elas.

| Variável                                                                        | Web | Mobile |
| ------------------------------------------------------------------------------- | --- | ------ |
| `NEXT_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_URL`                         | ✓   | ✓      |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✓   | ✓      |
| `NEXT_PUBLIC_SITE_URL` / `EXPO_PUBLIC_SITE_URL` (sem barra no final)            | ✓   | ✓      |
| `ANDROID_PACKAGE` (opcional, padrão `app.codexveil.mobile`)                     |     | build  |
| `EAS_PROJECT_ID`                                                                |     | build  |

As variáveis `NEXT_PUBLIC_*` e `EXPO_PUBLIC_*` entram no bundle **no momento do build**.
Depois de alterá-las, gere o build de novo.

## 4. Site (Next.js)

### Vercel (recomendado)

1. Importe o repositório e defina **Root Directory = `apps/web`**. A Vercel detecta o workspace
   pnpm pela raiz e instala todos os pacotes.
2. Em Settings → General, use **Node.js 24.x**.
3. O projeto usa pnpm 12 (`packageManager` no `package.json` raiz). Se a instalação falhar por
   causa da versão do pnpm, adicione a variável `ENABLE_EXPERIMENTAL_COREPACK=1`.
4. Cadastre as três variáveis `NEXT_PUBLIC_*` (seção 3) nos ambientes Production e Preview.
5. Faça o deploy e atualize a **Site URL** e as **Redirect URLs** do Supabase com o domínio
   final.

### Outro host Node

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm --filter @codexveil/web build
pnpm --filter @codexveil/web start     # porta 3000; use um proxy reverso com HTTPS
```

O site precisa de HTTPS em produção: os cookies de sessão e a instalação como PWA dependem
disso.

## 5. App Android (APK e AAB)

Não é preciso ter o Android Studio: o build roda nos servidores do EAS.

1. Instale a CLI do EAS (ela não é dependência do projeto; a Expo recomenda a instalação
   global), crie uma conta em <https://expo.dev> e entre:

   ```bash
   npm install -g eas-cli
   cd apps/mobile
   eas login
   eas init
   ```

   Como a configuração é dinâmica (`app.config.ts`), o `eas init` mostra o **project ID** em
   vez de gravá-lo. Guarde-o como `EAS_PROJECT_ID`.

2. Cadastre as variáveis no EAS (painel do projeto em expo.dev → Environment variables, ou
   `eas env:create`): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
   `EXPO_PUBLIC_SITE_URL` e `EAS_PROJECT_ID`, no ambiente usado pelo perfil (`preview` ou
   `production`). O arquivo `apps/mobile/.env.local` **não** vai para o build, porque está no
   `.gitignore`.
3. Para gerar o APK de teste (perfil `preview`, distribuição interna):

   ```bash
   pnpm --filter @codexveil/mobile build:apk
   ```

   Ao terminar, o EAS mostra um link ou QR code para baixar e instalar o APK no aparelho
   (permita a instalação de fontes desconhecidas).

4. Para a Play Store (perfil `production`, Android App Bundle):

   ```bash
   pnpm --filter @codexveil/mobile build:aab
   ```

   Antes de cada envio, aumente `version` e `android.versionCode` em
   `apps/mobile/app.config.ts`. A chave de assinatura é gerada e guardada pelo EAS: não a
   coloque no repositório.

Observações:

- O perfil `development` exige o pacote `expo-dev-client`, que não está instalado (veja
  [`PENDENCIAS.md`](PENDENCIAS.md#4-problemas-conhecidos)).
- Para testar localmente sem build: `pnpm dev:mobile` e abra no Expo Go. No emulador Android, o
  Supabase local fica em `http://10.0.2.2:54321`.

## 6. Migrações e backups em produção

### Aplicar mudanças de esquema

1. Desenvolva e teste a migração localmente, seguindo [`DATABASE.md`](DATABASE.md#como-evoluir-o-esquema-sem-perder-dados).
2. **Faça um backup antes** (veja abaixo).
3. `pnpm exec supabase db push`. A CLI aplica só as migrações que ainda não rodaram e mostra a
   lista antes de confirmar.
4. Publique a web e o app **depois** da migração. Como as migrações são aditivas, a versão
   anterior dos apps continua funcionando durante a transição.

Nunca altere o banco de produção pelo SQL Editor sem registrar a mudança numa migração: os
ambientes deixariam de ser reproduzíveis.

### Backups

- **Automáticos:** os planos pagos do Supabase fazem backup diário (Database → Backups). O
  Point-in-Time Recovery é um complemento opcional. No plano gratuito não há backup que você
  possa baixar, então mantenha cópias manuais.
- **Manuais** (antes de cada migração e periodicamente). O `supabase db dump` roda o `pg_dump`
  num contêiner e **exige Docker**:

  ```bash
  pnpm exec supabase db dump -f backups/roles.sql --role-only     # papéis
  pnpm exec supabase db dump -f backups/schema.sql                # estrutura
  pnpm exec supabase db dump -f backups/data.sql --use-copy --data-only   # dados
  ```

  Sem Docker, use o `pg_dump` do PostgreSQL 17 com a connection string (Project Settings →
  Database), por exemplo
  `pg_dump "<connection-string>" --schema=public --schema=private --schema=auth -Fc -f backups/codexveil.dump`.

  Guarde os arquivos fora do repositório (não versione a pasta `backups/`) e de forma
  criptografada: eles contêm dados pessoais dos usuários.

- **Storage:** os arquivos dos buckets **não** entram nos dumps do banco. Para copiá-los, use
  a API de Storage ou o endpoint compatível com S3 do Supabase (Project Settings → Storage).

### Restaurar

Num projeto Supabase novo, a partir dos três arquivos gerados pelo `supabase db dump`:

```bash
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file backups/roles.sql \
  --file backups/schema.sql \
  --command 'SET session_replication_role = replica' \
  --file backups/data.sql \
  --dbname "<connection-string>"
```

`session_replication_role = replica` desliga os gatilhos durante a carga, para que eles não
recalculem versões, números de sessão nem limites. Pegue a connection string em Project
Settings → Database. Teste a restauração periodicamente num projeto separado.

## 7. Checklist antes de abrir para usuários

- [ ] Migrações aplicadas e `supabase db push` sem pendências.
- [ ] Site URL, Redirect URLs, templates de e-mail e SMTP próprio configurados.
- [ ] Cadastro, confirmação de e-mail, login, recuperação de senha e convite testados com duas
      contas reais.
- [ ] Jogador **não** vê notas `gm`, blocos privados, sessões não publicadas nem dados secretos
      de NPCs (repita os cenários de [`SECURITY.md`](SECURITY.md#testes-de-segurança) na
      prática).
- [ ] Upload de avatar, retrato, imagem de NPC e imagem de roteiro funcionando.
- [ ] Realtime: vida alterada pelo mestre aparece na ficha do jogador (e o contrário).
- [ ] APK instalado e testado num aparelho Android.
- [ ] Backup manual feito e restauração testada.
- [ ] Itens pendentes de [`PENDENCIAS.md`](PENDENCIAS.md) revisados e aceitos ou resolvidos.
