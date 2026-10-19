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
tem RLS testado. Em 2026-10-17, `pnpm check` passou em 20 de 20 tarefas (366 testes) e
`pnpm build` passou em 2 de 2 tarefas (web e bundle Android).

**Publicado e validado na API.** O site está em <https://codexveil.vercel.app>, o backend no
projeto Supabase `CODEXVEIL` e o primeiro APK foi gerado pelo EAS. Um teste de integração com
as consultas reais dos apps passou em 10 de 10 contra o Supabase real (Auth, PostgREST, Storage
e Realtime) e revelou um defeito no Realtime, já corrigido. Em 2026-10-17 passou em 11 de 11, e
um percurso logado no navegador achou e corrigiu outra falha do Realtime (veja a seção 5).

**A lacuna agora é o uso real das telas.** Ninguém usou ainda o site no navegador nem o app
no aparelho com duas contas, e os e-mails em português dependem do SMTP próprio (adiado). Pela
regra da seção 22 ("não marque um item como concluído apenas porque existe uma tela para
ele"), os critérios "Validado na API" e "Falta validar ao vivo" só contam como concluídos
depois desse uso.

## 1. O que depende de você (configuração externa)

| Item                                          | Situação (2026-10-16)                                                                                             | Onde está documentado                              |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Projeto Supabase exclusivo                    | **Feito:** `CODEXVEIL` (`ityfhobhpjzhlkgvjhfb`), com as migrações aplicadas                                       | [DEPLOY](DEPLOY.md#1-supabase-projeto-e-migrações) |
| Site URL e URLs de redirecionamento           | **Feito:** `deploy/supabase/config.toml`                                                                          | [DEPLOY](DEPLOY.md#2-autenticação)                 |
| SMTP próprio (Brevo) e templates em português | **Parcial (2026-10-18):** SMTP salvo no painel e templates enviados; falta confirmar a entrega e o fluxo pelo app | [DEPLOY](DEPLOY.md#2-autenticação)                 |
| Hospedagem da web                             | **Feito:** <https://codexveil.vercel.app>, publicado sozinho a cada push em `main` (conferido em 2026-10-18)      | [DEPLOY](DEPLOY.md#4-site-nextjs)                  |
| Conta Expo e projeto EAS                      | **Feito:** `@gabriel.xxtth/codexveil`; o workflow roda a cada push (OTA; APK novo só com mudança nativa)          | [DEPLOY](DEPLOY.md#5-app-android-apk-e-aab)        |
| Firebase (notificações de sessão)             | **Pendente:** projeto Firebase e chave FCM V1 no Expo (passo 0c de PROXIMOS_PASSOS)                               | [PROXIMOS_PASSOS](PROXIMOS_PASSOS.md)              |
| Domínio próprio                               | Opcional                                                                                                          | [DEPLOY](DEPLOY.md#4-site-nextjs)                  |

## 2. Critérios de aceitação do MVP (seção 22)

| #   | Critério                                       | Status                | Como foi verificado / o que falta                                                                                                                                                                                                                                                                                                                       |
| --- | ---------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Criar conta e entrar                           | Falta validar ao vivo | Fluxos de cadastro, login, logout, recuperação e redefinição na web e no mobile; perfil criado por gatilho. Falta testar com e-mail de confirmação real.                                                                                                                                                                                                |
| 2   | Mestre cria campanha                           | Validado na API       | `test/rls/campaigns.test.ts`: o dono vira mestre por gatilho e o limite do plano é aplicado no banco. Ao vivo: criação e papel gm confirmados.                                                                                                                                                                                                          |
| 3   | Mestre convida jogador                         | Validado na API       | Convites por código ou link e convites pessoais por e-mail, com expiração, limite de usos e revogação (`test/rls/invites.test.ts`). O e-mail de convite **não é enviado** automaticamente: veja a seção 3. Ao vivo: convite criado e prévia válida.                                                                                                     |
| 4   | Jogador entra após validar o convite           | Validado na API       | `accept_campaign_invite` trava o convite (sem corrida em `max_uses`) e valida e-mail verificado, expiração e arquivamento. Ao vivo: aceite pelo código e participantes corretos.                                                                                                                                                                        |
| 5   | Papéis e permissões                            | Atendido              | Papel por campanha (`campaign_members`), RLS e testes de troca de UUID, campanha alheia e usuário anônimo.                                                                                                                                                                                                                                              |
| 6   | Criar personagem e associar à campanha         | Validado na API       | `create_character` com inventário e habilidades iniciais (web e mobile usam `buildDnd5eCharacterFromDraft`); o gatilho exige o mesmo sistema e a participação do dono, e o mestre não cria personagem na própria campanha. Ao vivo: criação completa; estranho não vê. No navegador (2026-10-17): criação pelo assistente, logado, contra o banco real. |
| 7   | Consultar e editar a ficha                     | Validado na API       | Ficha em abas na web e no mobile; autosave com versão otimista e conflito explícito (`autosave.test.ts`). Ao vivo: gravação com versão e conflito explícito.                                                                                                                                                                                            |
| 8   | Cálculos iniciais corretos                     | Atendido              | 74 testes em `@codexveil/rpg-systems` (modificadores, proficiência, perícias, CA, iniciativa, progressão e espaços de magia).                                                                                                                                                                                                                           |
| 9   | Gerenciar inventário                           | Falta validar ao vivo | Itens, categorias, peso, itens equipados e moedas como trilhas; `adjust_item_quantity` é atômico.                                                                                                                                                                                                                                                       |
| 10  | Organizar NPCs e monstros para a sessão        | Validado na API       | Biblioteca, cena com instâncias independentes e combate. **Somente na web.** Ao vivo: segredos só para o mestre; cena invisível ao jogador.                                                                                                                                                                                                             |
| 11  | Criar e organizar roteiro por blocos           | Validado na API       | Editor com 13 tipos de bloco, arrastar e soltar e botões de mover. **Somente na web**; o mobile só lê. Ao vivo: blocos públicos e privados; só o público chega ao jogador.                                                                                                                                                                              |
| 12  | Jogadores não leem conteúdo privado            | Atendido              | `test/rls/sessions.test.ts` e `test/rls/storage.test.ts`: blocos `gm`, sessões não publicadas, dados secretos de NPCs e imagens privadas. Ao vivo: os mesmos cenários passaram contra o Supabase real.                                                                                                                                                  |
| 13  | Dados persistem no banco                       | Validado na API       | Restrições, gatilhos e testes de migração no PGlite. Ao vivo: todos os fluxos acima persistiram no Supabase real.                                                                                                                                                                                                                                       |
| 14  | Telas no navegador e adaptadas ao celular      | Falta validar ao vivo | Layout responsivo (sidebar no desktop, navegação inferior no celular). Ninguém revisou as telas num navegador com dados reais.                                                                                                                                                                                                                          |
| 15  | Fluxos prioritários no mobile                  | Falta validar ao vivo | O bundle Android é gerado com `expo export`. Em 2026-10-17, o app aberto no navegador (Expo web, o mesmo código do APK) passou por um percurso automatizado logado contra o banco real: login, criação guiada e ficha ao vivo. Falta abrir o APK num aparelho.                                                                                          |
| 16  | Tipos, lint, testes e build passam             | Atendido              | `pnpm check` (20/20, 366 testes) e `pnpm build` (2/2) em 2026-10-17.                                                                                                                                                                                                                                                                                    |
| 17  | Configuração documentada                       | Atendido              | README, `.env.example` e os documentos em `docs/`.                                                                                                                                                                                                                                                                                                      |
| 18  | Nenhuma função central só com botão decorativo | Atendido              | Revisão de `href="#"`, handlers vazios e TODOs; a rota declarada sem página foi removida.                                                                                                                                                                                                                                                               |

## 3. Pedidos do responsável depois do prompt (2026-10-16)

| Pedido                                                                                            | Status                         | Onde está / o que falta                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Criação de personagem passo a passo, conforme o sistema, com todas as opções e as regras do livro | Migrado; falta publicar e usar | Assistente na web e no app com as regras do SRD 5.2.1 (o conteúdo oficial que a licença permite reproduzir): classe, subclasse (3º nível), antecedente, espécie, idiomas, perícias, atributos (3 métodos), talentos, magias, equipamento, alinhamento e detalhes. Testado em 108 testes de regras e percorrido no navegador, logado, contra o banco real; falta publicar o site e o APK e o uso por pessoas. |
| Nível inicial definido pelo mestre                                                                | Migrado; falta publicar        | Regras de criação na campanha (`campaigns.character_rules`): nível inicial, métodos de atributo e alinhamentos malignos, editáveis na criação e nas configurações (web) e na criação (app).                                                                                                                                                                                                                  |
| O mestre não cria personagens para a campanha, só NPCs e monstros                                 | Migrado; falta publicar        | Regra no banco (gatilho, `CVGMC`), com testes de RLS, e nas telas (botões e listas de campanhas).                                                                                                                                                                                                                                                                                                            |
| "Olho" para mostrar a senha                                                                       | Implementado                   | Todos os campos de senha da web (entrar, cadastro e redefinição) e do app (entrar e cadastro).                                                                                                                                                                                                                                                                                                               |
| Usuário sem foto de perfil                                                                        | Migrado; falta publicar        | Envio e exibição removidos da web; o banco passa a recusar novos avatares. A coluna `profiles.avatar_path` e o bucket `avatars` continuam, sem uso, para não apagar dados sem confirmação.                                                                                                                                                                                                                   |
| Reduzir o tamanho das imagens                                                                     | Implementado                   | O prompt pedia só validar tipo e tamanho (§15) e carregar imagens de forma otimizada (§17); não havia compressão. Agora o site reduz e regrava em WebP antes do envio, e o bucket aceita no máximo 2 MB (antes 5 MB).                                                                                                                                                                                        |
| Site e app atualizados automaticamente a cada commit                                              | Parcial: depende de você       | Workflow do EAS e `expo-updates` prontos e conferidos; falta ligar o GitHub `GbrielH` à Vercel e ao Expo, o que só o dono da conta pode autorizar no navegador ([PROXIMOS_PASSOS](PROXIMOS_PASSOS.md), etapa 1).                                                                                                                                                                                             |

| Mensagens de confirmação no visual do app | Implementado; falta publicar | O app usava o alerta nativo do Android em 4 lugares (sair da conta, sair da campanha, excluir item e descansar). Agora usa um diálogo com a identidade do Codexveil. O site já usava um diálogo próprio. |
| Condições com os efeitos e a duração (turnos) do D&D | Implementado e testado no banco real | As 15 condições do SRD 5.2.1 com as regras traduzidas e os efeitos aplicados na ficha (vantagem e desvantagem, falha automática, deslocamento, Exaustão, incapacitação); duração em rodadas que diminui no fim de cada turno (automática no combate do mestre ou pelo botão "Passar rodada"); condições impostas e as que ficam ao terminar; Exaustão cai 1 nível no descanso longo. Vale para personagens, NPCs e monstros. |
| Listas no visual do sistema, com busca | Implementado; falta publicar | Todas as listas de seleção do site trocaram o `<select>` nativo por um componente próprio com busca sem acentos, teclado e leitor de tela; listas longas do assistente ganharam busca; no app, a lista de condições abre em painel com busca. |
| Crônica com as cores certas e página na largura da tela | Implementado; falta publicar | O cartão escuro anulava o fundo do pergaminho e deixava os rótulos ilegíveis; agora a crônica é um pergaminho com tinta escura. A área logada ocupa toda a largura. Corrigido também o defeito antigo que espremia os nomes das perícias. |
| Confirmar que todo o conteúdo do livro de D&D está no sistema | Respondido | Não está, e nem pode estar todo: veja a cobertura abaixo. |

### Cobertura do conteúdo de D&D (SRD 5.2.1)

O sistema só pode trazer o **SRD 5.2.1**, a parte das regras de D&D 2024 que a Wizards of the
Coast liberou sob CC-BY-4.0. O restante dos livros comerciais (Livro do Jogador, Guia do
Mestre e Manual dos Monstros) é protegido por direitos autorais, e o prompt inicial proíbe
copiá-lo (§8): por exemplo, as outras três subclasses de cada classe (o SRD traz uma por
classe), 12 dos 16 antecedentes, a espécie Aasimar, a maior parte dos talentos e parte das
magias. O usuário pode cadastrar conteúdo próprio (criaturas na biblioteca, itens, habilidades
e magias na ficha).

| Parte do SRD 5.2.1                                                                            | No Codexveil | Observação                                                                                                                                                              |
| --------------------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Classes (12), com a subclasse do SRD de cada uma                                              | Completo     | Habilidades do 1º ao 20º nível e tabelas de cada classe.                                                                                                                |
| Espécies (9), antecedentes (4) e talentos (17)                                                | Completo     | Talentos de origem, gerais, de estilo de luta e dádivas épicas.                                                                                                         |
| Idiomas, alinhamentos, armas (38), armaduras (13), ferramentas, pacotes e equipamento inicial | Completo     | Medidas em metros e quilos.                                                                                                                                             |
| Invocações (28), metamagia (10) e opções do Círculo da Terra                                  | Completo     |                                                                                                                                                                         |
| Magias (339)                                                                                  | Completo     | Cabeçalho técnico em português; descrição no original em inglês, com dano, resistência e área resumidos em português.                                                   |
| Condições (15)                                                                                | Completo     | Regras traduzidas, efeitos na ficha e duração (segunda rodada de 2026-10-17).                                                                                           |
| Regras gerais e glossário                                                                     | Parcial      | A ficha calcula o que as regras definem (modificadores, proficiência, perícias, CA, iniciativa, espaços de magia, descansos); o texto do glossário não está no sistema. |
| Multiclasse e subida de nível                                                                 | Completo     | Subida de nível guiada no site, com multiclasse (pré-requisitos, treinamentos, espaços de magia somados) e talentos, no site e no app.                                  |
| Itens mágicos (258)                                                                           | Completo     | Catálogo para o mestre copiar à campanha; texto no original em inglês.                                                                                                  |
| Monstros e animais (330 blocos de estatísticas)                                               | Completo     | Bestiário para copiar à biblioteca; campos técnicos em português, ações e traços em inglês.                                                                             |
| Montarias, veículos, serviços, estilo de vida, fabricação e bugigangas                        | Não incluído |                                                                                                                                                                         |
| Caixa de ferramentas do mestre (armadilhas, venenos, maldições, ambiente e viagem)            | Não incluído |                                                                                                                                                                         |

**Coerência conferida por testes automáticos:** as 339 magias foram lidas do PDF oficial sem
nenhum problema de leitura; todas as classes montam personagens válidos nos níveis 1, 3, 5, 11
e 20; as referências entre classes, espécies, talentos, magias e equipamento são conferidas; e
as 15 condições foram conferidas contra o texto do glossário. Tudo o que está marcado como "não
incluído" pode ser acrescentado, porque a licença permite (veja a seção 6).

## 4. Pendências por seção do prompt

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

- **Parcial no mobile:** não é possível redefinir a senha dentro do app. (O avatar deixou de
  existir no produto em 2026-10-16.)
  O link de recuperação abre no site. O esquema `codexveil://` já está em
  `additional_redirect_urls`, então dá para tratar o link dentro do app depois.
- **Recomendado (não exigido pelo prompt):** permitir que o usuário exclua a própria conta,
  pensando na LGPD.

### §6 Campanhas

- **Feito (2026-10-18): imagem de capa.** O mestre envia na criação da campanha ou nas
  configurações (site); a capa aparece nos cartões do painel e da lista de campanhas, no site e
  no app. No app, o mestre envia ao criar a campanha e na central da campanha.
- **Pendente: envio de e-mail do convite pessoal.** O convite fica vinculado ao e-mail e
  aparece no painel do convidado (`get_my_pending_invites`), mas o mestre ainda precisa
  compartilhar o link. Enviar o e-mail exige uma Edge Function e um SMTP ou provedor de e-mail.
- **Mobile:** criar convites, editar configurações, arquivar, excluir e gerenciar
  participantes só funcionam na web. No app, o jogador pode aceitar convites e sair da
  campanha.

### §7 Fichas

- **Parcial: catálogos de conteúdo.** A criação de personagens já usa o SRD 5.2.1 (classes,
  espécies, antecedentes, talentos, equipamento e o cabeçalho das 339 magias). Depois da
  criação, magias, itens e talentos novos ainda são cadastrados manualmente na ficha, e a
  subida de nível não é guiada.
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

## 5. Problemas conhecidos

- **E-mails padrão do Supabase enquanto não houver SMTP próprio:** os templates em português
  são recusados no plano gratuito. Com os e-mails padrão, a confirmação e a recuperação de
  senha pelo site só funcionam no mesmo navegador em que foram pedidas, a **recuperação de
  senha pedida pelo app não funciona** e só membros da organização do Supabase recebem e-mails.
  Isso se resolve com o SMTP da Brevo e o envio dos templates (veja
  [DEPLOY](DEPLOY.md#2-autenticação)).
- **App no navegador sem estados de acessibilidade:** o react-native-web 0.21 não traduz
  `accessibilityState` (selecionado, marcado) em atributos `aria-*`. No Android isso funciona;
  só afeta a versão web do app, usada em desenvolvimento. Para corrigir, trocar por `aria-checked`
  e `aria-selected`, que o React Native também aceita.
- **Resolvido em 2026-10-17 — largura dos campos numéricos:** os campos numéricos sempre
  ocupavam a largura toda, mesmo quando a tela pedia outra (a classe `w-full` vencia pela ordem
  do CSS). Na aba Atributos isso espremia os nomes das perícias. Agora a largura padrão só
  entra quando nenhuma outra é pedida (`controlClasses` e `NumberInput`).
- **Resolvido em 2026-10-17 — tempo real no navegador e no app:** a ficha ficava
  "Reconectando…" porque o canal entrava antes de a sessão ser carregada, e o Realtime
  assinava com o papel anônimo, que não lê as tabelas. Corrigido em
  `packages/database/src/realtime.ts`, com testes, e confirmado no navegador.
- **Resolvidos em 2026-10-16:** os scripts `build:apk` e `build:aab` agora usam
  `npx eas-cli`, o perfil `development` (que dependia de `expo-dev-client`) foi removido e as
  chaves `channel` sem `expo-updates` saíram do `eas.json`.
- **README:** a resolução do conflito de merge de 2026-10-16 tinha removido a formatação
  Markdown (títulos, blocos de código, tabelas e links). A formatação foi restaurada sem
  alterar o texto revisado.

## 6. Próximos passos sugeridos (em ordem)

1. ~~**Confirmar a publicação automática**~~: conferida em 2026-10-18 (Vercel e OTA a cada push).
2. ~~**Publicar a criação guiada**~~: publicada; falta só instalar o APK atual (`e02e7079`, link
   no README) no celular.
3. **Usar o site publicado e o APK** com duas contas (mestre e jogador), seguindo as etapas de
   [PROXIMOS_PASSOS](PROXIMOS_PASSOS.md), inclusive a criação guiada, e corrigir o que
   aparecer.
4. ~~**Subida de nível guiada e multiclasse**~~: feitas no site e no app em 2026-10-18.
5. **Completar o conteúdo do SRD 5.2.1:** descrições das magias, monstros e animais como
   modelos na biblioteca do mestre, itens mágicos e o restante do equipamento (veja a
   cobertura na seção 3).
6. **SMTP próprio** (Brevo, com o e-mail exclusivo do sistema) e envio dos templates em
   português.
7. ~~**Capa da campanha**~~: feita em 2026-10-18 (site e app).
8. **Referências a sessões** na página de NPCs e monstros.
9. **Testes ponta a ponta** (Playwright) dos critérios 1 a 12, rodando contra o Supabase local
   na CI.
10. **Auditoria de acessibilidade e desempenho** e cabeçalho CSP.
11. **Rotinas de backend:** limite de armazenamento, limpeza de órfãos e e-mail de convite
    (Edge Functions).
12. **Mobile:** retrato do personagem (com a mesma redução de imagem da web), redefinição de
    senha no app e, se fizer sentido, a mesa do mestre em modo consulta.

## 7. Pedidos de 2026-10-17 (terceira rodada)

| Pedido                                              | Situação                                                                                                                                  |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Erro ao abrir campanhas e personagens no site local | Corrigido (faltava a migração das condições)                                                                                              |
| Jogador vê só as condições das próprias habilidades | Implementado (site e app)                                                                                                                 |
| Detalhes de magias e habilidades ao passar o mouse  | Implementado (site; no app, ao tocar)                                                                                                     |
| Monstros e itens do SRD                             | Implementado (Bestiário e Itens mágicos SRD)                                                                                              |
| Itens criados pelo mestre                           | Implementado, com entrega ao inventário                                                                                                   |
| Aba Links com fontes oficiais                       | Implementado (site e app)                                                                                                                 |
| Análise do espaço do Supabase                       | [`ARMAZENAMENTO.md`](ARMAZENAMENTO.md)                                                                                                    |
| Rolagem de dados com mural do mestre                | Implementado (site e app)                                                                                                                 |
| Turnos com modos e ordem definida pelo mestre       | Implementado (site e app)                                                                                                                 |
| Ocultar/liberar NPC e monstro direto no painel      | Implementado (site e app)                                                                                                                 |
| Notificação de sessão agendada com o app fechado    | Backend no ar; **falta o Firebase** (etapa 0c dos próximos passos)                                                                        |
| App faz tudo o que o site faz                       | Quase: no app ainda não há envio de imagens, blocos de imagem/referência no roteiro, troca de senha, transferência e exclusão de campanha |
| Telas pequenas no site e no app                     | **Revisão pendente** (precisa do percurso automatizado a 360 px)                                                                          |

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

### 2026-10-19 — pacotes dos livros de monstros

- Pacotes do Manual de Monstros (428 monstros) e do Monstros do Multiverso (261 monstros e 33
  raças) gerados a partir dos PDFs do responsável e validados com `parseBookPack` (0 erros).
  Ficam fora do Git; **falta importar** em Meus livros. Itens 6 e 9 da "Continuidade" avançam
  (raças do Multiverso e monstros); itens mágicos e Livro do Jogador continuam pendentes.
- "Selecionar todos" na escolha de livros da campanha (site e app).

### 2026-10-19 — livros de personagem na criação (site e app)

- Pacotes `phb-2014`, `xgte` e `tcoe` gerados e validados: raças com sub-raças, os 13
  antecedentes do Livro do Jogador, talentos, subclasses, magias e a classe Artífice. Marcados na
  campanha, aparecem na criação do personagem no site e, agora, também no app.
- Pendente: importar os pacotes; Domínio da Sepultura (Xanathar); subclasses do Livro do Jogador
  fora do SRD; teste no aparelho.
