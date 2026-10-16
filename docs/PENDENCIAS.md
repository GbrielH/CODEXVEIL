# Pendências em relação ao prompt inicial

> Auditoria feita em 2026-10-16 comparando o código do repositório com o "Prompt Master de
> desenvolvimento" do Codexveil. Para o estado geral do projeto, veja
> [`PROGRESS.md`](PROGRESS.md).

**Legenda de status**

- **Atendido**: implementado e coberto por testes automatizados.
- **Validado na API**: as consultas reais dos apps passaram contra o Supabase real (teste ao vivo,
  2026-10-16), mas a tela ainda não foi usada por uma pessoa no navegador ou no aparelho.
- **Falta validar ao vivo**: implementado e testado no banco (PGlite), mas ainda não exercitado
  contra um Supabase real, num navegador ou num aparelho Android.
- **Parcial**: parte do requisito existe; o que falta está descrito.
- **Pendente**: não implementado.
- **Fora do MVP**: adiado de propósito, conforme a seção 19 do prompt.

## Resumo

O código do MVP está completo na web, o app mobile cobre os fluxos prioritários e o banco
tem RLS testado. Em 2026-10-16, `pnpm check` passou em 20 de 20 tarefas (318 testes) e
`pnpm build` passou em 2 de 2 tarefas (web e bundle Android).

**Publicado e validado na API.** O site está em <https://codexveil.vercel.app>, o backend no
projeto Supabase `CODEXVEIL` e o primeiro APK foi gerado pelo EAS. Um teste de integração com
as consultas reais dos apps passou em 10 de 10 contra o Supabase real (Auth, PostgREST, Storage
e Realtime) e revelou um defeito no Realtime, já corrigido.

**A lacuna agora é o uso real das telas.** Ninguém usou ainda o site no navegador nem o app
no aparelho com duas contas, e os e-mails em português dependem do SMTP próprio (adiado). Pela
regra da seção 22 ("não marque um item como concluído apenas porque existe uma tela para
ele"), os critérios "Validado na API" e "Falta validar ao vivo" só contam como concluídos
depois desse uso.

## 1. O que depende de você (configuração externa)

| Item                                          | Situação (2026-10-16)                                                                                               | Onde está documentado                              |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Projeto Supabase exclusivo                    | **Feito:** `CODEXVEIL` (`ityfhobhpjzhlkgvjhfb`), com as migrações aplicadas                                         | [DEPLOY](DEPLOY.md#1-supabase-projeto-e-migrações) |
| Site URL e URLs de redirecionamento           | **Feito:** `deploy/supabase/config.toml`                                                                            | [DEPLOY](DEPLOY.md#2-autenticação)                 |
| SMTP próprio (Brevo) e templates em português | **Pendente:** conta Brevo e SMTP no painel do Supabase; depois, `config push` dos templates                         | [DEPLOY](DEPLOY.md#2-autenticação)                 |
| Hospedagem da web                             | **Feito:** <https://codexveil.vercel.app>; falta o deploy automático pelo GitHub (app da Vercel na conta `GbrielH`) | [DEPLOY](DEPLOY.md#4-site-nextjs)                  |
| Conta Expo e projeto EAS                      | **Feito:** `@gabriel.xxtth/codexveil`                                                                               | [DEPLOY](DEPLOY.md#5-app-android-apk-e-aab)        |
| Domínio próprio                               | Opcional                                                                                                            | [DEPLOY](DEPLOY.md#4-site-nextjs)                  |

## 2. Critérios de aceitação do MVP (seção 22)

| #   | Critério                                       | Status                | Como foi verificado / o que falta                                                                                                                                                                                                                   |
| --- | ---------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Criar conta e entrar                           | Falta validar ao vivo | Fluxos de cadastro, login, logout, recuperação e redefinição na web e no mobile; perfil criado por gatilho. Falta testar com e-mail de confirmação real.                                                                                            |
| 2   | Mestre cria campanha                           | Validado na API       | `test/rls/campaigns.test.ts`: o dono vira mestre por gatilho e o limite do plano é aplicado no banco. Ao vivo: criação e papel gm confirmados.                                                                                                      |
| 3   | Mestre convida jogador                         | Validado na API       | Convites por código ou link e convites pessoais por e-mail, com expiração, limite de usos e revogação (`test/rls/invites.test.ts`). O e-mail de convite **não é enviado** automaticamente: veja a seção 3. Ao vivo: convite criado e prévia válida. |
| 4   | Jogador entra após validar o convite           | Validado na API       | `accept_campaign_invite` trava o convite (sem corrida em `max_uses`) e valida e-mail verificado, expiração e arquivamento. Ao vivo: aceite pelo código e participantes corretos.                                                                    |
| 5   | Papéis e permissões                            | Atendido              | Papel por campanha (`campaign_members`), RLS e testes de troca de UUID, campanha alheia e usuário anônimo.                                                                                                                                          |
| 6   | Criar personagem e associar à campanha         | Validado na API       | `create_character` (web e mobile usam `buildDnd5eCharacter`); o gatilho exige o mesmo sistema e a participação do dono. Ao vivo: criação com trilha de vida; estranho não vê.                                                                       |
| 7   | Consultar e editar a ficha                     | Validado na API       | Ficha em abas na web e no mobile; autosave com versão otimista e conflito explícito (`autosave.test.ts`). Ao vivo: gravação com versão e conflito explícito.                                                                                        |
| 8   | Cálculos iniciais corretos                     | Atendido              | 74 testes em `@codexveil/rpg-systems` (modificadores, proficiência, perícias, CA, iniciativa, progressão e espaços de magia).                                                                                                                       |
| 9   | Gerenciar inventário                           | Falta validar ao vivo | Itens, categorias, peso, itens equipados e moedas como trilhas; `adjust_item_quantity` é atômico.                                                                                                                                                   |
| 10  | Organizar NPCs e monstros para a sessão        | Validado na API       | Biblioteca, cena com instâncias independentes e combate. **Somente na web.** Ao vivo: segredos só para o mestre; cena invisível ao jogador.                                                                                                         |
| 11  | Criar e organizar roteiro por blocos           | Validado na API       | Editor com 13 tipos de bloco, arrastar e soltar e botões de mover. **Somente na web**; o mobile só lê. Ao vivo: blocos públicos e privados; só o público chega ao jogador.                                                                          |
| 12  | Jogadores não leem conteúdo privado            | Atendido              | `test/rls/sessions.test.ts` e `test/rls/storage.test.ts`: blocos `gm`, sessões não publicadas, dados secretos de NPCs e imagens privadas. Ao vivo: os mesmos cenários passaram contra o Supabase real.                                              |
| 13  | Dados persistem no banco                       | Validado na API       | Restrições, gatilhos e testes de migração no PGlite. Ao vivo: todos os fluxos acima persistiram no Supabase real.                                                                                                                                   |
| 14  | Telas no navegador e adaptadas ao celular      | Falta validar ao vivo | Layout responsivo (sidebar no desktop, navegação inferior no celular). Ninguém revisou as telas num navegador com dados reais.                                                                                                                      |
| 15  | Fluxos prioritários no mobile                  | Falta validar ao vivo | O bundle Android é gerado com `expo export`, mas o app nunca foi aberto num emulador ou aparelho.                                                                                                                                                   |
| 16  | Tipos, lint, testes e build passam             | Atendido              | `pnpm check` (20/20) e `pnpm build` (2/2) em 2026-10-16.                                                                                                                                                                                            |
| 17  | Configuração documentada                       | Atendido              | README, `.env.example` e os documentos em `docs/`.                                                                                                                                                                                                  |
| 18  | Nenhuma função central só com botão decorativo | Atendido              | Revisão de `href="#"`, handlers vazios e TODOs; a rota declarada sem página foi removida.                                                                                                                                                           |

## 3. Pendências por seção do prompt

Esta seção lista só o que falta ou está parcial. O que já foi atendido está em
[`PROGRESS.md`](PROGRESS.md).

### §3 Plataformas e arquitetura

- **Parcial: PWA.** O site é instalável (manifesto e ícones), mas não há service worker nem
  modo offline.
- **Decisão: Edge Functions.** Nenhuma foi criada até agora. Toda operação privilegiada roda
  em funções SQL com RLS. Elas passam a ser necessárias para enviar e-mails de convite e para
  as rotinas de limpeza descritas abaixo.

### §4 Identidade visual

- **Pendente: revisão visual com dados reais.** A paleta, o emblema, os ícones, as fontes e os
  componentes existem, e há uma vitrine em `/design`. As telas, porém, nunca foram vistas num
  navegador ou aparelho com dados vindos do backend.

### §5 Usuários, autenticação e permissões

- **Parcial no mobile:** não é possível trocar o avatar nem redefinir a senha dentro do app.
  O link de recuperação abre no site. O esquema `codexveil://` já está em
  `additional_redirect_urls`, então dá para tratar o link dentro do app depois.
- **Recomendado (não exigido pelo prompt):** permitir que o usuário exclua a própria conta,
  pensando na LGPD.

### §6 Campanhas

- **Pendente: imagem de capa.** O banco (`campaigns.cover_path`), as policies do Storage
  (`campaigns/{id}/cover/`) e a consulta `setCampaignCover` estão prontos, mas **não há tela de
  envio** nem exibição da capa nos cartões, na web ou no mobile.
- **Pendente: envio de e-mail do convite pessoal.** O convite fica vinculado ao e-mail e
  aparece no painel do convidado (`get_my_pending_invites`), mas o mestre ainda precisa
  compartilhar o link. Enviar o e-mail exige uma Edge Function e um SMTP ou provedor de e-mail.
- **Mobile:** criar convites, editar configurações, arquivar, excluir e gerenciar
  participantes só funcionam na web. No app, o jogador pode aceitar convites e sair da
  campanha.

### §7 Fichas

- **Parcial: catálogos de conteúdo.** Magias, itens e talentos são cadastrados manualmente.
  Nenhum catálogo do SRD 5.2 foi importado. A importação é possível com atribuição CC-BY-4.0
  (veja [CONTENT_LICENSES](CONTENT_LICENSES.md)), mas não foi priorizada.
- **Mobile:** o app não exibe nem envia o retrato do personagem. Isso só é possível na web.

### §9 Painel do mestre

- **Parcial: "objetivos e acontecimentos".** Não existe uma estrutura própria para isso. Hoje
  o mestre usa anotações fixadas e blocos de roteiro (checklist, por exemplo).
- **Mobile:** a mesa do mestre (cena, combate e estado do grupo) só existe na web.

### §10 Editor de roteiros

- Todos os blocos e funções pedidos existem. Colaboração simultânea no mesmo roteiro e
  áudio ou vídeo ficaram fora do MVP, conforme o prompt.

### §11 NPCs, monstros e biblioteca

- **Pendente: "referências a sessões".** A página de um NPC ou monstro não lista as sessões
  em que ele aparece, seja em blocos `npc_ref`/`monster_ref` ou na cena.
- **Futuro:** a biblioteca é por campanha. Ainda não é possível reaproveitar registros entre
  campanhas do mesmo mestre.

### §13 Experiência de uso

- **Parcial: paginação.** As listas usam limites fixos (anotações: 200, convites: 50, histórico
  da ficha: 50, cópias de segurança: 30), sem botão "carregar mais". Isso basta para o MVP, mas campanhas grandes vão precisar de
  paginação.

### §15 Armazenamento

- **Pendente: limite de armazenamento por plano.** A coluna `plans.max_storage_mb` existe, mas
  nenhuma policy ou gatilho a aplica. Os limites de campanhas, personagens e participantes já
  são aplicados no banco.
- **Pendente: limpeza de arquivos órfãos.** A exclusão de uma campanha remove a mídia dela.
  Imagens de blocos removidos, de NPCs excluídos e de personagens excluídos continuam no bucket.
  Elas continuam privadas, mas ocupam espaço. Falta uma rotina agendada (Edge Function com
  cron).

### §16 Testes

- **Pendente: testes ponta a ponta** dos fluxos críticos (por exemplo, Playwright) contra um
  Supabase local ou de homologação.
- **Atendido em parte: integração com o Supabase real.** `test/live/supabase.live.test.ts`
  passa pelos serviços reais (10/10 em 2026-10-16), mas só roda manualmente, com
  credenciais. Falta rodá-lo na CI contra um projeto de homologação e cobrir inventário,
  combate, reordenação e e-mails.
- **Pendente: testes do app mobile.** Hoje o mobile só passa por typecheck, lint e bundle.

### §17 Desempenho e acessibilidade

- **Pendente: auditoria de acessibilidade** (axe ou Lighthouse e navegação só pelo teclado) e
  **auditoria de desempenho** (Lighthouse e Web Vitals). O contraste da paleta é testado
  automaticamente (`packages/ui/src/contrast.test.ts`).
- **Pendente: Content-Security-Policy.** Os outros cabeçalhos de segurança já são enviados
  (`apps/web/next.config.ts`).

### §18 Planos

- A estrutura existe. Falta só aplicar `max_storage_mb`, como descrito na §15.

### §19 Funcionalidades futuras (fora do MVP)

Mesa virtual, mapas, tokens, neblina de guerra, rolagem de dados integrada e histórico de
rolagens, voz, vídeo, áudio, marketplace, integrações e outros sistemas de RPG não foram
implementados, conforme o prompt. Nenhuma tela promete essas funções.

### §20 Fase 8 (qualidade e preparação para uso)

- **Atendido:** revisão de permissões, testes, documentação de deploy, do APK, das migrações e
  dos backups.
- **Pendente:** validação ao vivo, auditorias de acessibilidade e desempenho e revisão da
  configuração de produção num projeto real.

## 4. Problemas conhecidos

- **E-mails padrão do Supabase enquanto não houver SMTP próprio:** os templates em português
  são recusados no plano gratuito. Com os e-mails padrão, a confirmação e a recuperação de
  senha pelo site só funcionam no mesmo navegador em que foram pedidas, a **recuperação de
  senha pedida pelo app não funciona** e só membros da organização do Supabase recebem e-mails.
  Isso se resolve com o SMTP da Brevo e o envio dos templates (veja
  [DEPLOY](DEPLOY.md#2-autenticação)).
- **Deploy da web não é automático:** o projeto da Vercel não está ligado ao GitHub. Cada
  publicação hoje é feita com `npx vercel@latest deploy --prod` (veja
  [DEPLOY](DEPLOY.md#4-site-nextjs)).
- **Resolvidos em 2026-10-16:** os scripts `build:apk` e `build:aab` agora usam
  `npx eas-cli`, o perfil `development` (que dependia de `expo-dev-client`) foi removido e as
  chaves `channel` sem `expo-updates` saíram do `eas.json`.
- **README:** a resolução do conflito de merge de 2026-10-16 tinha removido a formatação
  Markdown (títulos, blocos de código, tabelas e links). A formatação foi restaurada sem
  alterar o texto revisado.

## 5. Próximos passos sugeridos (em ordem)

1. **Usar o site publicado e o APK** com duas contas (mestre e jogador), seguindo as etapas 4
   e 6 de [PROXIMOS_PASSOS](PROXIMOS_PASSOS.md), e corrigir o que aparecer. Gere antes um APK
   novo, para incluir a correção do Realtime.
2. **SMTP próprio** (Brevo, com o e-mail exclusivo do sistema) e envio dos templates em
   português.
3. **Capa da campanha**: tela de envio e exibição (o backend está pronto).
4. **Referências a sessões** na página de NPCs e monstros.
5. **Testes ponta a ponta** (Playwright) dos critérios 1 a 12, rodando contra o Supabase local
   na CI.
6. **Auditoria de acessibilidade e desempenho** e cabeçalho CSP.
7. **Rotinas de backend:** limite de armazenamento, limpeza de órfãos e e-mail de convite
   (Edge Functions).
8. **Mobile:** avatar, retrato do personagem, redefinição de senha no app e, se fizer sentido,
   a mesa do mestre em modo consulta.
