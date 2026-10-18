# Próximos passos

> Relatório atualizado em **2026-10-18**. Mantenha este arquivo em dia a cada etapa concluída
> (veja [Como manter a documentação](#como-manter-a-documentação)). O inventário completo do
> que falta em relação ao escopo inicial está em [`PENDENCIAS.md`](PENDENCIAS.md), e os
> procedimentos de publicação em [`DEPLOY.md`](DEPLOY.md).

## Onde estamos

| Área        | Situação                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Site        | **No ar** em <https://codexveil.vercel.app> (Vercel, projeto `codexveil`). Publicado pela CLI até 2026-10-16, **ainda sem as mudanças de 2026-10-17**. O próximo deploy depende do passo 1 (a CLI desta máquina está sem login).                                                                                                                                                                                                                                                                                                                                                  |
| Backend     | **No ar:** Supabase `CODEXVEIL` (`ityfhobhpjzhlkgvjhfb`, us-east-2), com as 8 migrações (a da criação guiada e a da duração das condições aplicadas em 2026-10-17), Site URL e Redirect URLs (`deploy/supabase/config.toml`).                                                                                                                                                                                                                                                                                                                                                     |
| App Android | **APK novo com a criação guiada e atualização automática (OTA):** [download](https://expo.dev/artifacts/eas/DaQ2lqX7sC0dDD5e5VEViyyqP5EzX9RADKaF8Cv21rk.apk) ([build `420f6c37`](https://expo.dev/accounts/gabriel.xxtth/projects/codexveil/builds/420f6c37-279c-4e92-b865-de9bdcb0b7f4), gerado pelo workflow em 2026-10-17). As mudanças de 2026-10-17 alteraram o fingerprint nativo, então os APKs anteriores (inclusive o `de6ceb5c`) **não** recebem mais atualizações: instale este. Todos os builds: <https://expo.dev/accounts/gabriel.xxtth/projects/codexveil/builds>. |
| Validação   | API validada ao vivo (10/10 em 2026-10-16; 11/11 em 2026-10-17). Em 2026-10-17, `pnpm check` passa 20/20 (388 testes) e `pnpm build` passa 2/2, e um percurso automatizado logado no site local criou personagens pelo assistente contra o banco real e confirmou o tempo real na ficha. **Ninguém usou ainda as telas com duas contas.**                                                                                                                                                                                                                                         |
| E-mail      | **Adiado:** o SMTP próprio (Brevo) será configurado com um e-mail exclusivo do sistema. Até lá, valem os e-mails padrão do Supabase, em inglês, com as limitações abaixo.                                                                                                                                                                                                                                                                                                                                                                                                         |

### Limitações enquanto não houver SMTP próprio

- Os e-mails de confirmação e de recuperação só chegam a **membros da organização CODEXVEIL**
  no Supabase. Para testar com duas contas, convide o segundo e-mail para a organização ou use
  e-mails que já sejam membros.
- No site, a confirmação e a recuperação de senha só funcionam se o link for aberto **no mesmo
  navegador** em que o pedido foi feito.
- A **recuperação de senha pedida pelo app não funciona**.

## Próximos passos (em ordem)

### 0c. Notificações de sessão agendada — você e Claude

- [ ] **Você:** Firebase → criar projeto `Codexveil` → app Android `app.codexveil.mobile` →
      baixar o `google-services.json` para `apps/mobile/` (ignorado pelo Git).
- [ ] **Você:** Firebase → Configurações do projeto → Contas de serviço → Gerar nova chave
      privada; no expo.dev → Credentials → Android → FCM V1 service account key → enviar.
- [ ] **Claude:** `eas env:create --name GOOGLE_SERVICES_JSON --type file` (preview e
      production) e push: o workflow gera o APK com notificações.
- [x] **Claude:** tabelas `push_tokens` e `session_notifications`, Edge Function
      `notify-session` publicada, registro do aparelho no app e opção no Perfil.

### 0. Publicar a criação guiada — em andamento

Implementado em 2026-10-17 (veja o histórico): assistente de criação com as regras do SRD 5.2.1,
regras de criação do mestre em cada campanha, mestres sem personagens nas próprias campanhas,
"olho" nas senhas, fim da foto de perfil e imagens reduzidas antes do envio.

- [x] **Claude:** `supabase db push --dry-run` e `supabase db push`, só com a migração
      `20261016130000_character_creation_rules.sql` (aplicada em 2026-10-17).
- [x] **Claude:** teste ao vivo (11/11) e percurso logado no site local contra o banco real
      (veja [`PROGRESS.md`](PROGRESS.md#testes-e-verificações-executados)). O percurso achou
      e corrigiu uma falha do tempo real no navegador.
- [x] **Você:** autorizou o commit e o push em `main` ("Pode subir").
- [ ] **Site:** publicar o `main` na Vercel. Depende do passo 1 (ou de um login na CLI da
      Vercel nesta máquina).
- [x] **Claude:** APK novo gerado pelo workflow do EAS ([execução](https://expo.dev/accounts/gabriel.xxtth/projects/codexveil/workflows/01a148df-de0f-7af9-a35a-8c24798df51d), build
      `420f6c37`). O app também foi percorrido no navegador (Expo web), logado, contra o banco
      real.
- [ ] **Você:** instalar o APK novo no celular (link no README).

**Pronto quando:** um jogador criar um personagem completo pelo assistente numa campanha cujo
mestre definiu o nível inicial, e o mestre não conseguir criar personagem nessa campanha. No
site local isso já foi confirmado pelo percurso automatizado; falta no site publicado e no app.

### 0b. Condições, listas e diálogos — você autoriza, Claude executa

Implementado em 2026-10-17, segunda rodada (veja o histórico): condições com as regras e os
efeitos do SRD 5.2.1 e duração em rodadas, listas com a identidade visual e busca, diálogos do
app no visual do Codexveil, crônica em pergaminho e a área logada na largura toda.

- [x] **Claude:** `supabase db push --dry-run` e `supabase db push` (só a migração
      `20261017120000_condition_durations.sql`, aplicada em 2026-10-17).
- [x] **Claude:** condição aplicada com duração, "Passar rodada" e turno passado no combate
      contra o banco real, com contas temporárias (10 → 9 → 8 rodadas).
- [x] **Você:** autorizou o commit e o push ("Suba para main tudo que você fez"). O app não
      muda o código nativo, então recebe uma atualização OTA (sem APK novo).

**Pronto quando:** uma condição aplicada com duração mostrar os efeitos na ficha e terminar
sozinha ao passar os turnos no combate do mestre.

### 1. Atualização automática do site e do app a cada commit — você e Claude

Objetivo: um push em `main` publica o site e atualiza o app sozinho.

- **Feito (Claude):** `expo-updates` instalado; runtime por fingerprint e canais `preview` e
  `production` configurados; workflow `apps/mobile/.eas/workflows/atualizar-app.yml` validado.
  Ele gera um APK novo quando o código nativo muda e, nos outros casos, publica uma atualização
  OTA. A primeira execução foi disparada daqui para gerar o APK-base com atualização
  automática.
- **Conferido em 2026-10-17 (Claude):** as duas integrações ainda não estão ligadas. O EAS só
  tem uma execução do workflow, manual (o push de 2026-10-16 não disparou nada), e o
  repositório não tem nenhum deploy da Vercel. A ligação exige instalar os apps da Vercel e da
  Expo no GitHub `GbrielH`, o que só o dono da conta pode autorizar no navegador.
- **Você (uma vez):**
  1. Vercel: <https://vercel.com/henrique0limah-6628/codexveil/settings/git> → **Connect Git
     Repository** → GitHub → instale o app da Vercel na conta `GbrielH` (se ela não aparecer,
     use **Add GitHub Account**) → escolha `GbrielH/CODEXVEIL`.
  2. Expo: <https://expo.dev/accounts/gabriel.xxtth/projects/codexveil/github> → instale o app
     da Expo no GitHub `GbrielH` → conecte `GbrielH/CODEXVEIL` → **Base directory =
     `apps/mobile`**.
  3. Instale no celular o APK gerado pelo workflow (link no README). Os anteriores não recebem
     atualizações automáticas.
- **Claude (depois):** faz um push de teste e confirma que o site foi publicado e que o app
  recebeu a atualização.

**Pronto quando:** um push em `main` publicar o site e a atualização aparecer no app sem
reinstalar.

### 2. Usar o site e o app com duas contas — você

Mestre e jogador, em navegadores diferentes, no site publicado:

- [ ] Cadastro, e-mail de confirmação, login e logout.
- [ ] O mestre cria uma campanha e um convite; o jogador aceita pelo link.
- [ ] O jogador cria um personagem na campanha e edita a ficha (o status "salvo" aparece).
- [ ] O mestre abre a mesa, adiciona um NPC à cena e altera a vida do personagem; a ficha do
      jogador atualiza sozinha.
- [ ] O mestre cria uma sessão com uma nota privada e publica a sessão; o jogador **não** vê a
      nota.
- [ ] Criação guiada: classe, antecedente, espécie, perícias, atributos, magias e equipamento,
      com o nível definido pelo mestre.
- [ ] Upload de retrato do personagem (a imagem é reduzida antes do envio).
- [ ] O layout funciona no navegador do celular.

No APK, instalado num Android:

- [ ] O app abre na tela de login, sem aviso de configuração ausente.
- [ ] Entra com a conta do jogador; painel, campanhas e personagens aparecem.
- [ ] A ficha abre; alterar a vida salva e aparece no site (e o contrário).
- [ ] A leitura de sessão mostra só o conteúdo público.
- [ ] A sessão continua depois de fechar e abrir o app.

Envie aqui os erros com print ou mensagem. **Pronto quando:** todos os itens estiverem
marcados e os critérios "Validado na API" e "Falta validar ao vivo" de
[`PENDENCIAS.md`](PENDENCIAS.md#2-critérios-de-aceitação-do-mvp-seção-22) puderem virar
"Atendido".

### 3. SMTP próprio e e-mails em português — você e Claude

1. **Você:** crie o e-mail exclusivo do sistema, a conta na Brevo, confirme o remetente, gere
   uma chave SMTP e preencha o SMTP no painel do Supabase (valores em
   [`DEPLOY.md`](DEPLOY.md#2-autenticação)).
2. **Claude:** envia os templates em português
   (`pnpm exec supabase config push --workdir deploy --project-ref ityfhobhpjzhlkgvjhfb`) e testa
   cadastro e recuperação de senha pelo site e pelo app.

**Pronto quando:** um e-mail de fora da organização receber a confirmação em português e a
recuperação de senha funcionar a partir do app.

### 4. Funcionalidades e qualidade pendentes — Claude

A ordem detalhada está em
[`PENDENCIAS.md`](PENDENCIAS.md#6-próximos-passos-sugeridos-em-ordem):

1. ~~Capa da campanha~~: feita em 2026-10-18 (envio na criação e nas configurações, exibida nos cartões).
2. Referências a sessões na página de NPCs e monstros.
3. Testes ponta a ponta (Playwright) e o teste ao vivo rodando na CI contra um projeto de
   homologação.
4. Auditoria de acessibilidade e desempenho e cabeçalho CSP.
5. Rotinas de backend: limite de armazenamento, limpeza de arquivos órfãos e e-mail de convite.
6. Mobile: retrato do personagem, redefinição de senha no app e mesa do mestre em modo
   consulta.
7. ~~Subida de nível guiada com as mesmas regras do SRD~~: feita no site e no app, com multiclasse (2026-10-18).

Antes de abrir para outras pessoas, siga o checklist de
[`DEPLOY.md`](DEPLOY.md#7-checklist-antes-de-abrir-para-usuários) (SMTP próprio, backup e revisão
de segurança).

## Riscos e observações

| Item                       | Efeito                                                | O que fazer                                                                                                                   |
| -------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Plano Hobby da Vercel      | Os termos não permitem uso comercial                  | Migrar para o plano Pro antes de ter usuários pagantes                                                                        |
| Cota gratuita do EAS       | Número limitado de builds por mês e fila de espera    | Juntar correções antes de gerar um APK novo                                                                                   |
| Supabase no plano gratuito | Sem backup baixável; o projeto pausa após inatividade | Fazer backups manuais ([`DEPLOY.md`](DEPLOY.md#6-migrações-e-backups-em-produção)) e avaliar o plano pago antes do lançamento |
| Domínio `*.vercel.app`     | Os links de e-mail e convite dependem dele            | Ao trocar de domínio, seguir [`DEPLOY.md`](DEPLOY.md#4-site-nextjs) (variáveis, `deploy/supabase/config.toml` e novos builds) |
| Remetente @gmail na Brevo  | E-mails podem cair no spam                            | Usar um domínio próprio quando possível                                                                                       |

## Histórico

### 2026-10-17 — condições, listas, diálogos e cobertura do SRD (segunda rodada)

- Condições: as 15 do glossário do SRD 5.2.1 com regras traduzidas, condições impostas
  (Paralisado → Incapacitado) e as que ficam ao terminar (Inconsciente → Caído); efeitos
  aplicados na ficha (vantagem e desvantagem, falha automática, deslocamento, penalidade de
  Exaustão, incapacitação, valores passivos); duração em rodadas para personagens, NPCs e
  monstros, que diminui no fim do turno (no combate, ao passar o turno; fora dele, pelo botão
  "Passar rodada"); Exaustão cai 1 nível no descanso longo. Migração
  `20261017120000_condition_durations.sql`, aplicada e testada contra o banco real.
- GitHub ligado à Vercel (projeto `codexveil`) e ao Expo (base `apps/mobile`) pelo
  responsável.
- Site: seletor próprio com busca no lugar do `<select>` nativo em todas as listas; listas
  longas do assistente com busca; crônica do personagem em pergaminho legível; área logada na
  largura toda; campos numéricos respeitam a largura pedida (antes espremiam as perícias).
- App: confirmações (sair da conta, sair da campanha, excluir item, descanso) num diálogo com
  a identidade visual, no lugar do alerta do Android; lista de condições em painel com busca;
  listas longas do assistente com busca.
- Atribuição corrigida para "SRD 5.2.1", a versão de onde os dados vieram.
- Resposta sobre o conteúdo de D&D: só o SRD 5.2.1 pode estar no sistema; o que falta dele
  está em [`PENDENCIAS.md`](PENDENCIAS.md#cobertura-do-conteúdo-de-dd-srd-521).
- `pnpm check` 20/20 (388 testes). Vitrine temporária e contas temporárias no navegador (veja
  [`PROGRESS.md`](PROGRESS.md)).

### 2026-10-17 — criação guiada e correções pedidas pelo responsável

- Dados do SRD 5.2.1 conferidos no PDF oficial e adicionados ao módulo D&D 5e: 12 classes
  (habilidades do 1º ao 20º nível e subclasse do SRD), 9 espécies, 4 antecedentes, talentos,
  idiomas, armas, armaduras, ferramentas, equipamento inicial, invocações, metamagia e as 339
  magias (nome e cabeçalho técnico; sem o texto das descrições).
- Motor da criação guiada compartilhado por web, app e servidor (`listDnd5eChoices`,
  `validateDnd5eDraft`, `buildDnd5eCharacterFromDraft`) e assistente em 10 passos na web e no
  app.
- Regras de criação por campanha (`campaigns.character_rules`): nível inicial, métodos de
  atributo e alinhamentos malignos.
- Mestres não criam nem vinculam personagens nas próprias campanhas (banco e telas).
- "Olho" nos campos de senha (web e app), fim da foto de perfil, imagens reduzidas no navegador
  e limite de 2 MB no bucket de mídia. O prompt inicial só pedia validar tipo e tamanho.
- Máquina local: Node 24.20 e pnpm 12.14 instalados; site local em `localhost:3000` e o app no
  navegador em `localhost:8081` (`react-native-web`).
- `pnpm check` 20/20 (366 testes) e `pnpm build` 2/2.
- Migração `20261016130000_character_creation_rules.sql` aplicada em produção, sem backup (o
  plano gratuito não oferece, e a máquina não tem Docker nem `pg_dump`). Teste ao vivo: 11/11.
- Percurso logado no site local contra o banco real: criação guiada (ficha pessoal e campanha
  com nível 3), regras do mestre e mestre sem botão de criar personagem. Ele revelou que o
  tempo real não funcionava no navegador (assinatura com o papel anônimo); a correção em
  `realtime.ts` vale para o site e o app.
- O fingerprint nativo mudou: o `react-native-web` alterou os caminhos do pnpm de `expo`,
  `expo-router` e `expo-system-ui`, e o Expo gera o `apps/mobile/.gitignore`, agora versionado.
  O app precisa de um APK novo.
- Deploy automático conferido: a Vercel e o Expo ainda não estão ligados ao GitHub, e a CLI da
  Vercel desta máquina está sem login.
- Push `4efd615` em `main`; nenhuma integração disparou. O workflow do EAS rodou manualmente:
  fingerprint novo, nenhum APK compatível, APK novo gerado (build `420f6c37`).
- Percurso logado no app (Expo web, mesmo código do APK) contra o banco real: criação guiada
  pessoal e em campanha com nível travado, fichas "Ao vivo".

### 2026-10-16 — publicação

- Repositório preparado para builds remotos: `eas.json` com Node e pnpm fixos e ambientes por
  perfil, `projectId` no `app.config.ts`, scripts do APK via `npx eas-cli` e `.vercelignore`. Um
  clone limpo instala e compila, e os 779 imports batem com a grafia dos arquivos.
- Supabase: migrações aplicadas, regras de senha e URLs do Auth configuradas. Os templates em
  português foram recusados sem SMTP próprio.
- Vercel: projeto criado pela API e publicado pela CLI. A Vercel usou o pnpm 12.14 sem
  ajustes.
- EAS: projeto criado, variáveis cadastradas, keystore gerada e primeiro APK pronto.
- Teste ao vivo da API criado (10/10). Ele revelou que o Realtime perdia eventos logo após a
  inscrição; a correção está em `packages/database/src/realtime.ts`, e o site foi republicado
  com ela.

### 2026-10-16 — atualização automática (em andamento)

- `expo-updates` instalado, runtime por fingerprint, canais `preview` e `production` e versionCode 2.
- Workflow do EAS `apps/mobile/.eas/workflows/atualizar-app.yml` validado e executado pela primeira vez daqui: o fingerprint não tinha APK compatível, então o workflow gerou o APK-base com OTA.
- APK reserva gerado antes do `expo-updates` (com a correção do Realtime, sem OTA).
- Pendente: ligar o GitHub `GbrielH` à Vercel e ao Expo (passo 1) e testar com um push.

## Como manter a documentação

A regra do projeto (também em [`AGENTS.md`](../AGENTS.md)): **toda mudança atualiza a
documentação no mesmo commit.**

- `docs/PROXIMOS_PASSOS.md`: marque o que foi concluído, ajuste a ordem e registre no
  histórico.
- `docs/PROGRESS.md`: estado atual, testes executados e o próximo passo exato.
- `docs/PENDENCIAS.md`: status dos critérios e das pendências em relação ao escopo inicial.
- `docs/DEPLOY.md`, `DATABASE.md`, `SECURITY.md`, `ARCHITECTURE.md`: sempre que mudar a forma
  de publicar, o esquema, as regras de acesso ou uma decisão de arquitetura.

### 2026-10-17 — terceira rodada (itens, SRD, dados, turnos, notificações e app completo)

- Biblioteca: itens da campanha, Bestiário SRD (330), Itens mágicos SRD (258), ocultar/liberar
  direto na lista. Detalhes de magias e habilidades ao passar o mouse (site) e ao tocar (app).
- Condições: o jogador vê só as que o personagem pode se aplicar; o mestre vê todas.
- Dados rolados no servidor, mural ao vivo do mestre e rolagens secretas; rolar tocando nos
  bônus da ficha (com vantagem/desvantagem das condições).
- Turnos com modos, ordem manual, ocultos, economia de ações e a vez visível aos jogadores;
  padrões nas configurações da campanha.
- Aviso de sessão agendada (backend publicado; falta o Firebase).
- App: mesa do mestre, sessões e roteiro, biblioteca, SRD, convites, anotações,
  configurações, habilidades, classes/níveis, recursos.
- Migrações `20261017140000`–`20261017140300` aplicadas; análise de espaço em
  [`ARMAZENAMENTO.md`](ARMAZENAMENTO.md).

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
