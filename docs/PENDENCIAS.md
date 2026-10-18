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

| Item                                          | Situação (2026-10-16)                                                                                               | Onde está documentado                              |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Projeto Supabase exclusivo                    | **Feito:** `CODEXVEIL` (`ityfhobhpjzhlkgvjhfb`), com as migrações aplicadas                                         | [DEPLOY](DEPLOY.md#1-supabase-projeto-e-migrações) |
| Site URL e URLs de redirecionamento           | **Feito:** `deploy/supabase/config.toml`                                                                            | [DEPLOY](DEPLOY.md#2-autenticação)                 |
| SMTP próprio (Brevo) e templates em português | **Pendente:** conta Brevo e SMTP no painel do Supabase; depois, `config push` dos templates                         | [DEPLOY](DEPLOY.md#2-autenticação)                 |
| Hospedagem da web                             | **Feito:** <https://codexveil.vercel.app>; falta o deploy automático pelo GitHub (app da Vercel na conta `GbrielH`) | [DEPLOY](DEPLOY.md#4-site-nextjs)                  |
| Conta Expo e projeto EAS                      | **Feito:** `@gabriel.xxtth/codexveil`; falta ligar o GitHub para o workflow rodar a cada push                       | [DEPLOY](DEPLOY.md#5-app-android-apk-e-aab)        |
| Domínio próprio                               | Opcional                                                                                                            | [DEPLOY](DEPLOY.md#4-site-nextjs)                  |

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
| Multiclasse e subida de nível                                                                 | Parcial      | A ficha aceita até 4 classes, mas sem pré-requisitos de multiclasse e sem assistente de subida de nível.                                                                |
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
- **Deploy automático ainda não ligado:** o workflow do EAS (`atualizar-app.yml`) e o
  `expo-updates` estão prontos, mas falta ligar o GitHub `GbrielH` à Vercel e ao Expo (veja
  [DEPLOY](DEPLOY.md#4-site-nextjs) e [PROXIMOS_PASSOS](PROXIMOS_PASSOS.md)). Até lá, o site é
  publicado com `npx vercel@latest deploy --prod` (exige login na CLI da Vercel, hoje ausente
  nesta máquina) e o app com `eas workflow:run`.
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

1. **Confirmar a publicação automática** do push de 2026-10-17 (site e app).
2. **Publicar a criação guiada:** a migração já está aplicada (2026-10-17); falta ligar o
   GitHub à Vercel e ao Expo para o deploy automático e instalar o APK novo (veja
   [PROXIMOS_PASSOS](PROXIMOS_PASSOS.md)).
3. **Usar o site publicado e o APK** com duas contas (mestre e jogador), seguindo as etapas de
   [PROXIMOS_PASSOS](PROXIMOS_PASSOS.md), inclusive a criação guiada, e corrigir o que
   aparecer.
4. **Subida de nível guiada e multiclasse**, com as mesmas regras do SRD usadas na criação.
5. **Completar o conteúdo do SRD 5.2.1:** descrições das magias, monstros e animais como
   modelos na biblioteca do mestre, itens mágicos e o restante do equipamento (veja a
   cobertura na seção 3).
6. **SMTP próprio** (Brevo, com o e-mail exclusivo do sistema) e envio dos templates em
   português.
7. **Capa da campanha**: tela de envio e exibição (o backend está pronto).
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
