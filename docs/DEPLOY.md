# Deploy, APK e backups

Este guia assume um projeto Supabase **novo e exclusivo** para o Codexveil. Os comandos rodam
na raiz do repositório.

> **Ambientes em uso (2026-10-16):**
>
> | Serviço    | Recurso                                                                            |
> | ---------- | ---------------------------------------------------------------------------------- |
> | Supabase   | Projeto `CODEXVEIL` (`ityfhobhpjzhlkgvjhfb`, us-east-2), organização CODEXVEIL     |
> | Vercel     | Projeto `codexveil` (conta `henrique0limah-6628`) → <https://codexveil.vercel.app> |
> | Expo / EAS | Projeto `@gabriel.xxtth/codexveil`                                                 |

## 1. Supabase: projeto e migrações

1. Crie o projeto em <https://supabase.com/dashboard> e escolha a região mais próxima dos
   jogadores (por exemplo, `sa-east-1`).
2. Vincule e aplique as migrações. A CLI usa um papel de login temporário, então a senha do
   banco não é necessária:

   ```bash
   pnpm exec supabase login
   pnpm exec supabase link --project-ref <ref-do-projeto>
   pnpm exec supabase db push --dry-run   # confere a lista antes
   pnpm exec supabase db push             # aplica supabase/migrations (o seed NÃO é aplicado)
   ```

3. Confira no painel: **Database → Tables** deve listar as tabelas de `public`, todas com RLS,
   e **Storage** deve ter os buckets `avatars` (público) e `campaign-media` (privado).
4. Confira se **Realtime** está habilitado no projeto. A migração `…_realtime.sql` adiciona as
   tabelas à publicação `supabase_realtime`.

## 2. Autenticação

A configuração de produção do Auth está versionada em `deploy/supabase/config.toml`: Site URL,
Redirect URLs, regras de senha, `secure_password_change` e os templates em português. Ela é
enviada pela CLI, que mostra o diff e só altera o que o arquivo declara:

```bash
pnpm exec supabase config diff --workdir deploy --project-ref ityfhobhpjzhlkgvjhfb
pnpm exec supabase config push --workdir deploy --project-ref ityfhobhpjzhlkgvjhfb
```

**Nunca envie o `supabase/config.toml` da raiz para a produção.** Ele é do ambiente local e
reduziria o intervalo entre e-mails para 1 s, desligaria o MFA e mudaria o pooler.

**SMTP próprio (Brevo):** no plano gratuito, o Supabase **recusa templates personalizados**
com o provedor de e-mail padrão. O provedor padrão também só entrega para membros da
organização. Configure o SMTP no painel (Authentication → Emails → SMTP Settings), porque a
senha é segredo e não fica no repositório:

| Campo        | Valor                                                                       |
| ------------ | --------------------------------------------------------------------------- |
| Sender email | Remetente verificado na Brevo (Senders, Domains & Dedicated IPs → Senders)  |
| Sender name  | `Codexveil`                                                                 |
| Host         | `smtp-relay.brevo.com`                                                      |
| Port         | `587`                                                                       |
| Username     | O "Login" exibido em Brevo → SMTP & API → SMTP (formato `…@smtp-brevo.com`) |
| Password     | Uma SMTP key gerada nessa mesma tela (não é a senha da conta Brevo)         |

Depois do SMTP, rode o `config push` acima para enviar os templates.

**Configurado em 2026-10-18:** remetente `Codexveil <codexveil@gmail.com>` (verificado na
Brevo), login `bec567001@smtp-brevo.com`, porta 587. Os templates foram enviados no mesmo dia.
Os arquivos enviados à produção são as cópias em `deploy/supabase/templates/` (a CLI recusa
caminhos fora da pasta `deploy`); mantenha-as iguais a `supabase/templates/`.

Os templates montam o link como `{{ .SiteURL }}/auth/confirmar?token_hash=…&type=…`, então a
**Site URL precisa ser exatamente a URL do site**. A rota `/auth/confirmar` valida o token e só
redireciona para caminhos internos. Ela também aceita o `?code=` dos e-mails padrão (fluxo
PKCE), mas esse fluxo só funciona no mesmo navegador em que o pedido foi feito e não serve para
a recuperação de senha iniciada pelo app.

## 3. Variáveis de ambiente

São todas públicas: só a URL do projeto e a **publishable key** (Project Settings → API Keys).
**Nunca** use `service_role` ou `sb_secret_…`: os apps recusam iniciar com elas.

| Variável                                                                        | Web | Mobile |
| ------------------------------------------------------------------------------- | --- | ------ |
| `NEXT_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_URL`                         | ✓   | ✓      |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✓   | ✓      |
| `NEXT_PUBLIC_SITE_URL` / `EXPO_PUBLIC_SITE_URL` (sem barra no final)            | ✓   | ✓      |
| `ANDROID_PACKAGE` (opcional, padrão `app.codexveil.mobile`)                     |     | build  |

As variáveis `NEXT_PUBLIC_*` e `EXPO_PUBLIC_*` entram no bundle **no momento do build**.
Depois de alterá-las, gere o build de novo.

**Segredo do servidor (só web):** `GEMINI_API_KEY` liga o assistente de IA (card no menu). É
lida só pela rota `/api/assistente` na Vercel (Production); nunca vai para o navegador nem para o
app. Sem ela, o card não aparece. Basta um novo deploy depois de criá-la.

## 4. Site (Next.js)

### Vercel (em uso)

O projeto `codexveil` tem Framework **Next.js**, **Root Directory = `apps/web`**, **Node.js
24.x** e as três variáveis `NEXT_PUBLIC_*` (seção 3) em Production, Preview e Development. A
Vercel lê o `packageManager` e usa o pnpm 12.14 sem configuração extra (confirmado no log do
primeiro build: instalação em 12 s, build em 53 s).

**Deploy pela CLI** (na raiz do repositório):

```bash
npx vercel@latest link --yes --project codexveil   # uma vez por máquina; cria .vercel/
npx vercel@latest deploy --prod
```

A CLI envia a **pasta local**, não o Git. O `.vercelignore` espelha o `.gitignore` para que
builds locais, caches e arquivos `.env` nunca sejam enviados. Se o `vercel link` acrescentar
`.env*` ao fim do `.gitignore`, remova a linha, porque ela anula a exceção `!.env.example`.

**Deploy automático a cada push (integração Git da Vercel):** com o repositório ligado, cada
push em `main` publica em produção e cada branch ou pull request ganha um deploy de preview.
Os builds partem do GitHub; o `.vercelignore` só vale para deploys pela CLI.

Para ligar (uma vez): abra <https://vercel.com/henrique0limah-6628/codexveil/settings/git>,
clique em **Connect Git Repository** → **GitHub**. Se a conta `GbrielH` não aparecer na lista,
use **Add GitHub Account** (ou "Adjust GitHub App Permissions") e instale o app da Vercel na
conta `GbrielH` com acesso ao repositório `CODEXVEIL`. Depois escolha `GbrielH/CODEXVEIL`. O
Root Directory continua `apps/web`, e a branch de produção é `main`. **Ligado** pelo responsável
em 2026-10-17; em 2026-10-18 cada push em `main` aparece no GitHub com o status "Vercel:
Deployment has completed".

**Domínio:** ao trocar `codexveil.vercel.app` por um domínio próprio, atualize
`NEXT_PUBLIC_SITE_URL` e `EXPO_PUBLIC_SITE_URL`, o `site_url` e as `additional_redirect_urls`
de `deploy/supabase/config.toml` (e rode o `config push`) e gere novos builds.

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

A CLI do EAS não é dependência do projeto. Use-a com `npx --yes eas-cli@latest …` ou instale-a
globalmente (`npm install -g eas-cli`). Rode os comandos dentro de `apps/mobile`, onde está o
`eas.json`. Ela usa a mesma sessão da CLI do Expo (`npx expo whoami`).

**Configuração em uso:**

- `app.config.ts` fixa `owner` (`gabriel.xxtth`) e `extra.eas.projectId`. São identificadores
  públicos. Para criar o projeto em outra conta, rode `eas init --account <conta>` e atualize
  as duas constantes.
- `eas.json` tem um perfil `base` (Node 24.15.0, pnpm 12.14.0) estendido por `preview` (APK,
  distribuição interna, ambiente e canal `preview`) e `production` (AAB, ambiente e canal
  `production`).
- **Atualizações OTA (EAS Update):** `expo-updates` está instalado, e o `app.config.ts` define
  `updates.url` e `runtimeVersion: { policy: 'fingerprint' }`. O APK baixa o JavaScript novo do
  seu canal ao abrir. Uma atualização só chega a builds com o **mesmo fingerprint nativo**:
  mudar dependências nativas, plugins ou campos nativos do `app.config.ts` exige um APK novo.
- O fingerprint inclui os caminhos do pnpm dos módulos nativos. Uma dependência nova que mude
  as dependências pares (peer) de `expo`, `expo-router` ou `expo-system-ui` muda esses caminhos
  e exige um APK novo, mesmo sem código nativo novo: foi o caso do `react-native-web` em
  2026-10-17. O `apps/mobile/.gitignore`, gerado pelo Expo, também entra no fingerprint e por
  isso é versionado. Para conferir antes:
  `eas fingerprint:compare --build-id <id> --environment preview`. No Windows o pnpm encurta os
  nomes das pastas, então a comparação local sempre acusa diferença; use-a só para ver o que
  mudou.
- As variáveis `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e
  `EXPO_PUBLIC_SITE_URL` ficam no EAS, nos ambientes `preview` e `production`. O
  `apps/mobile/.env.local` **não** vai para o build.

  ```bash
  eas env:set --name EXPO_PUBLIC_SITE_URL --value https://codexveil.vercel.app \
    --visibility plaintext --environment preview --environment production --non-interactive
  eas env:list preview
  eas config --platform android --profile preview   # confere o perfil e as variáveis
  ```

- A chave de assinatura Android (keystore) foi gerada e é guardada pelo EAS. Não a coloque no
  repositório. Para fazer uma cópia: `eas credentials --platform android`.

**Atualização automática a cada push (GitHub Actions, desde 2026-10-19):** o workflow
`.github/workflows/ci.yml` roda em cada push em `main`: o job **Lint, tipos e testes**
(`pnpm check`) e, se passar, **App — atualização OTA**, que roda
`eas-cli update --branch preview --platform android --environment preview` na máquina do
GitHub. Assim o empacotamento não usa os minutos de CI/CD do plano gratuito do EAS (o antigo
EAS Workflow `atualizar-app.yml` esgotou os 60 minutos de outubro e foi removido). Mesmo
modelo do FinFlow.

- **Segredo necessário:** `EXPO_TOKEN` em GitHub → Settings → Secrets and variables → Actions
  (crie em expo.dev → Account settings → Access tokens). Sem ele, o job falha avisando.
- **Runtime:** a política é `fingerprint`. A atualização só chega aos APKs com o mesmo código
  nativo; se mudar algo nativo, gere um APK novo à mão (abaixo) e as próximas atualizações
  passam a valer para ele.

**Gerar um APK manualmente:**

```bash
eas build --platform android --profile preview
```

**Não gere o APK pelo Windows.** O build falha na fase "Configure expo-updates" com "Runtime
version calculated on local machine not equal to runtime version calculated during build": o
fingerprint inclui os caminhos de `node_modules/.pnpm`, e no Windows o pnpm encurta esses nomes
(limite de caminho), então o cálculo local nunca bate com o do servidor (visto em 2026-10-26;
`EAS_SKIP_AUTO_FINGERPRINT` e `.fingerprintignore` não resolvem). Use o workflow **APK**
(`.github/workflows/apk.yml`, GitHub → Actions → APK → Run workflow, ou
`gh workflow run apk.yml`): ele roda no Linux, com o mesmo cálculo das atualizações OTA, e usa o
segredo `EXPO_TOKEN`. Um build que falha nessa fase não consome a cota.

No fim, a página do build no expo.dev mostra um link e um QR code para baixar o APK no
aparelho (permita a instalação de fontes desconhecidas). APKs gerados antes do
`expo-updates` (versionCode 1 e o primeiro build do versionCode 2) **não** recebem
atualizações OTA; instale um APK gerado depois dele.

**Para a Play Store** (Android App Bundle): `eas build --platform android --profile
production`. Antes de cada envio, aumente `version` e `android.versionCode` em
`apps/mobile/app.config.ts`.

Observações:

- Não há perfil `development`. Para criar um, rode, dentro de `apps/mobile`,
  `pnpm exec expo install expo-dev-client` e adicione um perfil com `"developmentClient": true`.
- Para testar localmente sem build: `pnpm dev:mobile` e abra no Expo Go.

## 6. Migrações e backups em produção

### Aplicar mudanças de esquema

1. Desenvolva e teste a migração localmente, seguindo [`DATABASE.md`](DATABASE.md#como-evoluir-o-esquema-sem-perder-dados).
2. **Faça um backup antes** (veja abaixo).
3. `pnpm exec supabase db push`. A CLI aplica só as migrações que ainda não rodaram e mostra a
   lista antes de confirmar.
4. Publique a web e o app **depois** da migração. Como as migrações são aditivas, a versão
   anterior dos apps continua funcionando durante a transição.

**`20261016130000_character_creation_rules.sql` (criação guiada):** precisa estar aplicada
antes de publicar o código que a acompanha, porque o site e o app passam a ler
`campaigns.character_rules` e a enviar inventário e habilidades para `create_character`. Com a
versão anterior dos apps, o que muda é só o que foi decidido: o mestre não cria mais
personagem na própria campanha, o envio de avatar é recusado e imagens acima de 2 MB são
recusadas (a versão nova reduz as imagens antes de enviar).

**`20261017120000_condition_durations.sql` (duração das condições):** precisa estar aplicada
antes de publicar o código que a acompanha, porque o site e o app passam a ler
`character_conditions.rounds_remaining` e `session_entities.condition_rounds`; sem ela, a
ficha e a mesa do mestre dão erro. A migração só acrescenta colunas, funções e um gatilho, e a
versão anterior dos apps continua funcionando com ela.

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
- [ ] Upload de retrato, imagem de NPC e imagem de roteiro funcionando (imagens reduzidas antes
      do envio, até 2 MB).
- [ ] Realtime: vida alterada pelo mestre aparece na ficha do jogador (e o contrário).
- [ ] APK instalado e testado num aparelho Android.
- [ ] Backup manual feito e restauração testada.
- [ ] Itens pendentes de [`PENDENCIAS.md`](PENDENCIAS.md) revisados e aceitos ou resolvidos.

## 8. Edge Functions e notificações (2026-10-17)

- Publicar a função: `pnpm exec supabase functions deploy notify-session --project-ref
ityfhobhpjzhlkgvjhfb --no-verify-jwt --use-api` (o JWT é conferido dentro da função).
- Firebase (FCM): o `google-services.json` vai para o EAS como variável `GOOGLE_SERVICES_JSON`
  (tipo arquivo, ambientes preview e production). O gancho `eas-build-pre-install` copia o
  arquivo; `apps/mobile/.fingerprintignore` evita que ele mude o fingerprint. A chave da conta
  de serviço (FCM V1) é enviada pelo expo.dev → Credentials.
- Sem a variável, o APK funciona sem notificações.

### Exclusão de conta e limpeza de arquivos (2026-10-26)

Duas funções novas, publicadas do mesmo jeito (o acesso é conferido dentro delas):

````bash
pnpm exec supabase functions deploy delete-account --project-ref ityfhobhpjzhlkgvjhfb --no-verify-jwt --use-api
pnpm exec supabase functions deploy cleanup-orphans --project-ref ityfhobhpjzhlkgvjhfb --no-verify-jwt --use-api
```n
- `delete-account`: o botão **Excluir minha conta** do Perfil chama com o token da pessoa e a
  palavra `EXCLUIR`. Recusa (409, com a lista) enquanto ela for dona de campanhas com outros
  participantes. Sem a função publicada, o botão só mostra o aviso de erro.
- `cleanup-orphans`: precisa da migração `20261026110000_orphan_media.sql` e de um segredo
  compartilhado com o GitHub. Gere um valor aleatório e grave nos dois lugares:

  ```bash
  pnpm exec supabase secrets set CLEANUP_SECRET=<valor> --project-ref ityfhobhpjzhlkgvjhfb
  gh secret set CLEANUP_SECRET --body <valor>
  gh secret set SUPABASE_PROJECT_REF --body ityfhobhpjzhlkgvjhfb
  ```n
  O workflow `.github/workflows/cleanup-orphans.yml` roda toda segunda às 03:00 (Brasília) e
  pode ser disparado à mão em Actions, com a opção **Só contar** (`?dry=1`) para ver quantos
  arquivos seriam apagados. Sem os segredos, o workflow só avisa e não faz nada.

## Login com Google

Código pronto em 2026-10-21 (site: `components/auth/google-button.tsx`; app:
`lib/google-auth.ts` e `app/google.tsx`). Os botões só aparecem com a variável ligada. Para ativar:

1. **Google Cloud Console** (<https://console.cloud.google.com>), num projeto do Codexveil:
   - "Tela de permissão OAuth": tipo **Externo**, nome "Codexveil", e-mail de suporte e domínio
     `codexveil.vercel.app`; escopos `openid`, `email` e `profile`; publicar o app.
   - "Credenciais" → "Criar credenciais" → "ID do cliente OAuth" → **Aplicativo da Web**.
     URI de redirecionamento autorizado:
     `https://ityfhobhpjzhlkgvjhfb.supabase.co/auth/v1/callback`.
   - Guardar o **ID do cliente** e o **segredo do cliente** (o segredo não vai para arquivos).
2. **Supabase** (só o projeto `CODEXVEIL`): com as duas variáveis no terminal,
   `GOOGLE_OAUTH_CLIENT_ID=... GOOGLE_OAUTH_CLIENT_SECRET=... npx supabase config push --workdir deploy`.
   O `config.toml` só referencia as variáveis (`env(...)`).
3. **Vercel** (projeto `codexveil`): `NEXT_PUBLIC_AUTH_GOOGLE=on` e novo deploy.
4. **App** (ambiente `preview` do EAS): `EXPO_PUBLIC_AUTH_GOOGLE=on`; a próxima atualização OTA
   mostra o botão. No app, o login abre o navegador e volta por `codexveil://google` (já liberado
   em `additional_redirect_urls`), sem biblioteca nativa nova.

Contas criadas pelo Google recebem o nome do Google no perfil (migração
`20261021120000_google_signin_profile.sql`). Uma conta de e-mail e a do Google com o mesmo
endereço são unidas pelo Supabase quando o e-mail é confirmado.
````
