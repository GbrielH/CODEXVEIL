# Pendências em relação ao prompt inicial

## 2026-11-17 — Seis novas auras

- [x] Adicionar Homem-Aranha, Akatsuki, Hisoka, Valorant, League of Legends e Mario Bros. à
      cadeia completa de validação, seletor, aura do dado, crítico, falha, som, banco e teste RLS.
- [x] Manter críticos épicos e falhas como referência ou meme do tema.
- [x] Usar arte raster gerada nas cinco cenas em que ela melhora a leitura e canvas responsivo no
      tema Mario.
- [x] Validar `20261117110000_dice_auras_six_more.sql` em dry-run e aplicá-la no CODEXVEIL.
- [x] Rodar a suíte completa e os builds.
- [ ] Conferir as animações e sons manualmente no navegador.
- [x] Publicar em produção após o pedido explícito de 2026-11-17 (`260a0fb`).

## 2026-11-17 — Auras com arte gerada e Sans

- [x] Substituir a leitura visual genérica do Deus do Sol por Gear 5 reconhecível.
- [x] Substituir o desenho manual fraco do Tarrasque por uma criatura completa e ameaçadora.
- [x] Adicionar Sans à validação, seletor, aura no dado, crítico, falha, som, banco e teste RLS.
- [x] Adicionar Hollow Knight e Doutor Destino à mesma cadeia completa.
- [x] Adicionar Zoro e Buraco Negro à mesma cadeia completa.
- [x] Adicionar Fullmetal Alchemist à mesma cadeia completa.
- [x] Adicionar Tung Tung Tung Sahur à mesma cadeia completa.
- [x] Aplicar `20261117100000_dice_aura_sans.sql` em produção.
- [ ] Conferir todas as animações e sons novos no navegador; a automação visual ficou
      indisponível nesta rodada.

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

**2026-11-16 (auras novas):** seis temas: Cerejeira, Fênix, Kitsune, Espelho Partido, Aurora Boreal e Horda Zumbi. Cada um tem partículas no dado, cena de crítico, falha cômica, som e ícone. A migração `20261116130000_dice_auras_six.sql` foi aplicada em produção depois do dry-run. `pnpm check` passou nas 20 tarefas; falta ver no navegador.

**2026-11-16 (auras):** Tarrasque e Deus do Sol (Gear 5) refeitos no crítico; corrigida a falha do Vazio Roxo, que mostrava dois "CRÍTICO!" em vez de um cortado ao meio. Typecheck e lint passaram; falta conferir no navegador.

**2026-11-12 (Ordem Paranormal RPG 2):** novo sistema `ordem2`, a partir dos dois PDFs dos playtests (Alpha e Beta). O que foi feito:

- **Regras no código:** motor de testes (dois dados, passos, críticos, pavor, RA/RB, dano, lesões, traumas, equilíbrio, fechaduras, relações e armadura).
- **Ficha e criação:** no site e no app, com PV, PD e armadura em trilhas e rolagens no mural da mesa.
- **Livros:** dois pacotes privados com tudo que há nos PDFs: regras, 10 ferramentas, 4 missões em 10 cenas, 70 pontos de interesse estruturados, 3 criaturas com ficha e arte, 4 mapas e 13 imagens.
- **Banco:** bucket privado `book-assets` para as imagens do livro.
- **Missões:** o botão "Usar esta missão na campanha" monta a sessão com o roteiro, as criaturas e os mapas.

Verificações: `pnpm check` passou nas 20 tarefas (rpg-systems com 295 testes, sendo 19 novos do Ordem; banco com 251 aprovados e 11 ao vivo pulados, incluindo 5 novos de RLS do Ordem; web com 26). `pnpm build` passou nas 2 tarefas. Os pacotes validam sem nenhum problema.

Falta:

- a migração `20261112120000_ordem2.sql` já foi aplicada em produção e os dois livros já estão na conta do responsável, com as 13 imagens; Meus livros ganhou o botão **Baixar JSON**;
- testar no navegador e no Android a ficha, a criação, a importação com imagens e a montagem de uma missão.

Detalhes e limitações em [`ORDEM2.md`](ORDEM2.md).

**2026-11-12 (mesinha de dados):** a caixinha flutuante "Dados da mesa" não aparece mais nas abas Jogo e Dados do site, que já têm a mesa grande e o mural (`DiceProvider` ganhou `tray={false}`). Nas demais telas (ficha, mapa, Mesa do mestre) ela continua. Verificado com `pnpm check` e `pnpm build`; falta conferir no navegador.

**Atualização de 2026-11-11 — central Jogo: parcial.** O site ganhou a composição de jogo para os
dois papéis, e o app ganhou a central de jogador sem controles de mestre. No app, o mapa permanece
na rota dedicada (aberta por atalho) para conservar a implementação de gestos/tela cheia; no site,
“Próximo turno” leva ao controle correspondente da Mesa do mestre, ainda não atua diretamente na
central. Na revisão, a iniciativa do site passou a usar o `TurnStatus` ao vivo (antes era uma foto do carregamento) e o layout salvo deixou de ser sobrescrito pelos valores padrão ao abrir a página. Lint, typecheck, 26 testes web, 246 testes de banco (11 ao vivo pulados) e as 2 tarefas de
build passaram. Falta validação manual nos dois clientes e quatro sistemas.

**Atualização de 2026-11-03 — Triangle Agency:** implementação funcional no site e app concluída,
com motor próprio, ARC, criação, ficha, regras de campanha e pacote privado do livro. Testes
automatizados, typechecks e builds passaram (`pnpm check`: 20/20, 699 aprovados e 11 ao vivo
pulados; `pnpm build`: 2/2). O dry-run listou somente a nova migração. Status: **falta validar ao
vivo**, porque ainda não houve uso manual no navegador/aparelho nem aplicação da migração
`20261103150000_triangle_agency.sql` em produção.
Em 2026-11-03, a migração foi corrigida para liberar os tipos próprios das entradas do livro; o
pacote real passou na conferência estrutural e o teste de importação/RLS passou no PGlite.

O código do MVP está completo na web, o app mobile cobre os fluxos prioritários e o banco
tem RLS testado. Em 2026-10-17, `pnpm check` passou em 20 de 20 tarefas (366 testes) e
`pnpm build` passou em 2 de 2 tarefas (web e bundle Android).

**Publicado e validado na API.** O site está em <https://codexveil.vercel.app>, o backend no
projeto Supabase `CODEXVEIL` e o primeiro APK foi gerado pelo EAS. Um teste de integração com
as consultas reais dos apps passou em 10 de 10 contra o Supabase real (Auth, PostgREST, Storage
e Realtime) e revelou um defeito no Realtime, já corrigido. Em 2026-10-17 passou em 11 de 11, e
um percurso logado no navegador achou e corrigiu outra falha do Realtime (veja a seção 5).

**Atualização de 2026-10-26:** o responsável usou o site com mestre e jogador e confirmou que ele
funciona, e que os e-mails do SMTP próprio chegam. **A lacuna agora é o app**, ainda não usado a
fundo no aparelho.

**Situação anterior (2026-10-17):** ninguém tinha usado ainda o site no navegador nem o app
no aparelho com duas contas, e os e-mails em português dependiam do SMTP próprio. Pela
regra da seção 22 ("não marque um item como concluído apenas porque existe uma tela para
ele"), os critérios "Validado na API" e "Falta validar ao vivo" só contam como concluídos
depois desse uso.

## 0. App em paridade com o site (levantado em 2026-10-27)

Conferido no código em 2026-10-27. Tudo abaixo pode ir por atualização OTA (sem mudança nativa, sem
gastar build). Quadros, ações do mestre e perguntas na campanha ficam só no site (o app é só para
jogar).

| Funcionalidade                                         | Site  | App                           |
| ------------------------------------------------------ | ----- | ----------------------------- |
| Responder às perguntas do mestre na criação            | feito | feito                         |
| Idade na criação                                       | feito | feito                         |
| Convites pendentes (inclusive convite direto de amigo) | feito | feito                         |
| Ver as respostas das perguntas na ficha                | feito | **falta**                     |
| Altura e idade na ficha                                | feito | **falta**                     |
| Amigos (código, pedidos, lista)                        | feito | **falta**                     |
| Fichas compartilhadas comigo                           | feito | **falta**                     |
| Compartilhar minha ficha com amigos                    | feito | **falta**                     |
| Tomo (chat, ditado, ações)                             | feito | feito; APK novo para o ditado |
| Prompts de retrato e de token na ficha                 | feito | **falta**                     |
| "?" do custo de pontos na criação T20                  | feito | **falta**                     |

Ordem proposta: (1) amigos e "Compartilhados comigo"; (2) ficha: altura, idade, respostas, prompts,
compartilhar; (3) "?" dos pontos do T20; (4) Tomo no app (chat e ditado).

### Outras pendências abertas (2026-10-27)

- Lição de 2026-10-27: mudanças de ficha feitas só no site não chegam ao app (telas próprias).
  Toda mudança de ficha/campanha para jogadores deve ser feita nos dois (`apps/web` e `apps/mobile`).

- D&D 5e, automação das habilidades (melhoria futura): repetir a verificação feita no T20 (levantar
  todas as habilidades com bônus, escolha, magia ou proficiência e automatizar em três etapas).
  Detalhe em PROXIMOS_PASSOS, seção B0g.

- T20, automação das habilidades: etapas 1, 2 e 3 feitas (bônus fixos, de situação e
  escolhas) e os restos (Osteon, Totem, Familiar, Etiqueta, lembretes nos ataques, Anão, app),
  em 2026-10-27. Falta conferir no navegador e no aparelho.

- T20, escolhas concedidas que ainda faltam: Osteon (Memória Póstuma: perícia ou poder), Foco em
  Magia (marcar a magia), escolas do Bardo/Druida nas magias concedidas; conferir no livro o preço
  total do Protótipo (usado T$ 500 para os alquímicos).

- Perguntas do mestre: editar as respostas depois de criado o personagem.
- Quadros: copiar/colar blocos, seleção múltipla.
- Tomo: ficha de estatísticas da criatura, encontro no mapa, mapas, editar blocos do roteiro;
  personagem completo (hoje cria rascunho para terminar no assistente).
- Login com Google (2026-10-27): Supabase configurado e modelo de recuperação por código enviado;
  app publicado no Google e botões ligados no site e no app. Falta testar o login de verdade e
  trocar a chave secreta (apareceu num print).
- APK novo: `expo-speech-recognition`, ícones, splash e dados 3D no app (gasta build da cota EAS;
  preparado, mas não gerado nesta rodada).
- Redesign da ficha do app e da tela de sessão.
- Behind the Magic: aguardando as respostas do Will.
- Nada desta rodada foi verificado no navegador ou no aparelho (exige login).

### 2026-11-01 — Call, transcrição e Melhores Momentos (em andamento, escondidos)

Três fases feitas no código, só com opções grátis (LiveKit no plano gratuito, transcrição no
próprio aparelho, Gemini gratuito e prompts de imagem no lugar de gerar imagens). **Não liberado
em produção** a pedido do responsável: fica atrás de `CALLS_ENABLED` / `EXPO_PUBLIC_CALLS_ENABLED`
(Production e app desligados; Preview do site ligado em 2026-11-02). As migrações de segurança e
lock da geração (`20261102110000`–`20261102120000`) estão aplicadas. Faltam conferir as chaves do
LiveKit em Preview, deploy de Preview, teste ao vivo e APK novo autorizado. Onde parou e o roteiro:
[call-transcricao-momentos.md](call-transcricao-momentos.md#onde-parou-atualizado-em-2026-11-03).

No app, a call é somente do jogador: entrar por convite/código/link, usar microfone/câmera, sair,
ver o aviso de transcrição e pausar a própria voz. Criar/encerrar sala, convidar, decidir a sala de
espera e ligar/desligar a gravação são responsabilidades do mestre no site.

Correção de 2026-11-03 pronta no código: quando o dono liga, cada participante aprovado inicia
automaticamente a própria captura; erros temporários reiniciam com backoff; site/app têm redução
de ruído WebRTC individual. Sem migração ou mudança nativa. Pendente: validar com duas contas e
dois aparelhos, inclusive concorrência entre WebRTC e reconhecimento de fala no Android.

Medição de consumo de 2026-11-03 pronta no código: sessões `call_presence`, heartbeat, soma mensal
agregada, barra exclusiva do mestre, aviso do jogador, câmeras ativas e cronômetro. A migração
`20261103100000_call_presence_usage.sql` apareceu depois no histórico remoto, sem aplicação feita
por esta rodada. Pendente: validar com duas contas, inclusive fechar aba/app sem Sair e comparar a
estimativa com o painel LiveKit.

Retenção de 24 h pronta no site: lista/download de calls encerradas, purge seletivo e aviso nos
Melhores Momentos. A migração `20261103110000` também apareceu no histórico remoto durante o
dry-run. Pendente: publicar Edge Function/workflow, testar com duas contas e fazer a lista/download
no app em um APK futuro (`expo-sharing` exige dependência nativa; nenhuma foi adicionada agora).

Também em 2026-11-01: app com aba Tomo (no lugar de Sistemas), Taverna com menu lateral, limpar
conversa do Tomo (site e app), dados 3D caindo pela tela no app (APK novo), painel do app enxuto,
abas só com ícones, montanha no carregamento, imagens das anotações, aba Itens corrigida.

### 2026-10-31 e 2026-11-01 — regras, app em paridade e ferramentas do mestre

Feito (site e app, verificado por tipos, lint, testes, pacote do app e CI; não conferido no aparelho):

- Regras: escolas do Bardo e do Druida guardadas na ficha T20 (subida de nível e magias concedidas
  respeitam; fichas antigas escolhem em "Escolhas pendentes"); Protótipo conferido no livro (pág. 67,
  T$ 500 para os alquímicos); D&D com lembretes de Ataque Furtivo, Armas Grandes e Duas Armas;
  respostas às perguntas do mestre editáveis pelo dono. Osteon e Foco em Magia já estavam prontos.
- App: aba Personagem com respostas, prompts de retrato/token, dado do personagem, compartilhar com
  amigos; "Compartilhados comigo"; altura e idade no D&D; "?" dos pontos no T20; Assimilação com
  Cabo de Guerra em laços, Saúde em faixas, Características do livro (XP) e Nível das cartas.
- Mestre: "Aparece nas sessões" na página de NPC/monstro; quadros com seleção múltipla, Ctrl+A/C/V/D
  (cola até em outro quadro); Tomo cria criatura com ficha de estatísticas do sistema, monta
  encontros (criaturas, tokens ocultos no mapa ativo e citação no roteiro) e acrescenta blocos ao
  roteiro.
- Também: aba WORLD (Conflitos e Refúgios, Assimilação), coleção de dados e dado do personagem,
  fantasminhas de personagem morto, Tomo com Assimilação e escolha da ação certa.

Ainda aberto: Tomo criando o personagem completo (hoje abre a criação já preenchida; no
Assimilação, sem rascunho); Tomo como chat próprio no app (hoje é pela Taverna com "@tomo"); dados
3D com a skin no app; conferência no aparelho e no navegador.

## 1. O que depende de você (configuração externa)

| Item                                          | Situação (2026-10-16)                                                                                        | Onde está documentado                              |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| Projeto Supabase exclusivo                    | **Feito:** `CODEXVEIL` (`ityfhobhpjzhlkgvjhfb`), com as migrações aplicadas                                  | [DEPLOY](DEPLOY.md#1-supabase-projeto-e-migrações) |
| Site URL e URLs de redirecionamento           | **Feito:** `deploy/supabase/config.toml`                                                                     | [DEPLOY](DEPLOY.md#2-autenticação)                 |
| SMTP próprio (Brevo) e templates em português | **Feito:** SMTP ligado em 2026-10-18; entrega confirmada pelo responsável em 2026-10-26                      | [DEPLOY](DEPLOY.md#2-autenticação)                 |
| Hospedagem da web                             | **Feito:** <https://codexveil.vercel.app>, publicado sozinho a cada push em `main` (conferido em 2026-10-18) | [DEPLOY](DEPLOY.md#4-site-nextjs)                  |
| Conta Expo e projeto EAS                      | **Feito:** `@gabriel.xxtth/codexveil`; o workflow roda a cada push (OTA; APK novo só com mudança nativa)     | [DEPLOY](DEPLOY.md#5-app-android-apk-e-aab)        |
| Firebase (notificações de sessão)             | **Descartado** pelo responsável em 2026-11-02 (sem notificações por Firebase)                                | [PROXIMOS_PASSOS](PROXIMOS_PASSOS.md)              |
| Domínio próprio                               | Opcional                                                                                                     | [DEPLOY](DEPLOY.md#4-site-nextjs)                  |

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
| Combate roleplay (pedido de 2026-10-20) | Implementado (sem teste no navegador) | O jogador não escolhe alvo; rola o ataque, o mestre diz se acertou e o dano é rolado só no mural, sem aplicar em PV. Site e app. |
| Aba Sessão (pedido de 2026-10-20) | Implementado e migração aplicada | Lore oculta por padrão; o mestre libera trechos na mesa; jogadores veem na aba Sessão em tempo real. App: leitura atualiza sozinha. |
| Dados realistas (pedido de 2026-10-20) | Implementado (sem teste visual) | Dados grandes caindo e girando no meio da tela, sem caixa, até 6 por vez. Site e app. |
| Pedidos 6 a 10 de 2026-10-20 | Implementado (sem teste visual) | Selo do sistema, ícones de raça, "+1 nos três", abas por papel e prompt de imagem. |
| Assistente de IA (card no menu, 2026-10-23) | Funcionando em produção | Card "Tomo, o Mestre" (mascote) acima do perfil/"Sair", personalidade de mestre de RPG, Google Gemini 3.1 Flash-Lite (plano gratuito, ~1 s para começar), contexto pelo RLS, sem limite por pessoa. |
| Grade da sessão (docs/GRID.md) | Implementado em 2026-10-21 (site e app; sem teste com duas contas) | Mapas com imagem ajustável, quadrados de 1,5 m, tokens por porte, névoa de guerra, linha de visão opcional; jogador move só o próprio token. |
| QA Tormenta20 (2026-10-20) | Implementado (sem teste visual) | Os 8 itens: origem, Aumento de Atributo, habilidades com escolha, condições com rodadas, rolagem em 3 estados, usar poder/magia, inventário e poderes fora de nível. |
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

- **Feito (2026-10-26): senha no app.** "Alterar senha" no Perfil; "Recuperar senha" manda um código
  de 6 números no e-mail e a senha nova é definida no próprio app. O código depende do modelo de
  e-mail novo (`deploy/supabase/templates/recovery.html`), ainda **não enviado** à produção: o
  `config push` também ligaria o login com Google sem credenciais. (O avatar deixou de
  existir no produto em 2026-10-16.)
  O link de recuperação abre no site. O esquema `codexveil://` já está em
  `additional_redirect_urls`, então dá para tratar o link dentro do app depois.
- **Feito (2026-10-26): excluir a própria conta** (Perfil, no site), pela Edge Function
  `delete-account`. Recusa enquanto a pessoa for dona de campanhas com outros participantes.
  Falta no app.

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
- **Feito (2026-10-27): amigos, convite direto e ficha compartilhada** (site). Migração
  `20261027120000`.
- **Feito (2026-10-27): Tomo com ações para o mestre** (criar NPC/monstro, anotação, nota na
  sessão), sempre com prévia e confirmação antes de gravar.
- **Feito (2026-10-27): quadros livres da campanha** (estilo Miro), só do mestre, para planejar
  sessões: notas, textos, imagens, molduras e setas arrastáveis, com Ctrl+Z. Migrações
  `20261027100000` e `20261027110000`.
- **Feito (2026-10-26): perguntas do mestre na criação de personagem.** Na criação e nas
  configurações da campanha o mestre escreve perguntas (até 20). Todas são obrigatórias para criar
  ou vincular um personagem na campanha (site e app), conferidas no banco. As respostas aparecem na
  ficha só para o jogador e o mestre. Migração `20261026140000`.
- **Feito (2026-10-26): ficha da criatura liberada por partes.** A biblioteca é da campanha (não
  da sessão) e os jogadores só veem o que o mestre revela. Além disso, o mestre escolhe quais partes
  da ficha da criatura o grupo vê (CA, PV, atributos, ações…) e libera ou oculta quando quiser
  (`creatures.revealed_stats` e `creature_revealed_stats()`, migração `20261026130000`). A cópia de
  registros entre campanhas foi desfeita a pedido do responsável.
- **Feito (2026-10-26): paginação** no site, com **Carregar mais**: anotações (60 por página),
  convites (25), histórico da ficha (30) e cópias de segurança (15). As páginas do servidor usam
  `?pagina=N`. O app continua com os limites antigos.

### §15 Armazenamento

- **Pendente: limite de armazenamento por plano.** A coluna `plans.max_storage_mb` existe, mas
  nenhuma policy ou gatilho a aplica. Os limites de campanhas, personagens e participantes já
  são aplicados no banco.
- **Feito (2026-10-26): limpeza de arquivos órfãos.** `list_orphan_media` acha o que nenhuma
  linha usa (24 h de folga) e a Edge Function `cleanup-orphans` apaga, toda segunda-feira, pelo
  workflow `cleanup-orphans.yml`. Publicado em 2026-10-26 (migração, funções e segredos).

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
11. **Rotinas de backend:** limite de armazenamento e e-mail de convite (Edge Functions). A
    limpeza de órfãos foi feita em 2026-10-26.
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

### 2026-10-19 — pendências dos livros resolvidas

- Feitos: subclasses do Livro do Jogador (41), Domínio da Sepultura, classes de todas as magias
  do Xanathar, itens comuns do Xanathar e resumos das raças. Falta importar os pacotes e testar no
  aparelho.

### 2026-10-19 — ajustes dos livros na criação, subida de nível e prompt de livros

- Sem repetição: a versão do livro substitui a do SRD de mesmo nome (com os sinônimos de tradução,
  ex.: Halfling/Pequenino, Caminho do Furioso/Berserker) e, entre livros, vale a do primeiro.
- Classes e raças dos livros com ícone (o da raça/classe parecida) e resumo curto no cartão.
- Equipamento das classes e antecedentes dos livros vira itens do catálogo (opção A) ou ouro
  (opção B); antes vinha só o ouro. Equipamento dos antecedentes do Livro do Jogador completo.
- Subida de nível: o dado de vida só pode ser rolado uma vez (site e app).
- Aba Personagem: removida a escolha de livros da ficha.
- App: a ficha e a subida de nível usam os livros liberados (antes só a criação). Ficha pessoal no
  site valida com todos os livros do usuário, como o assistente mostra.
- Novo [`PROMPT_LIVRO_JSON.md`](PROMPT_LIVRO_JSON.md): prompt para converter um livro comprado em
  pacote, com aviso quando o sistema não existe no app.
- `pnpm check` passou; não testado no navegador nem no aparelho.

### 2026-10-19 — nomes em inglês e busca nos dois idiomas

- Criação de personagem (site e app): classes e raças com o nome em português em destaque e o
  original em inglês pequeno ao lado (Golias · Goliath, Tiferino · Tiefling); busca nas etapas
  Classe e Espécie aceita os dois idiomas, sem acento (`names-en.ts`, com teste).
- `pnpm check` passou; não aberto no navegador nem no aparelho.

### 2026-10-19 — ícones dos antecedentes e resumos corrigidos

- Antecedentes com ícone (game-icons.net, CC BY 3.0) no site e no app; antecedentes sem ícone
  próprio usam um genérico.
- Resumos de Herói do Povo e Nobre (Livro do Jogador) corrigidos: começam no título do
  antecedente, sem a tabela do anterior. É preciso reimportar `phb-2014.book.json`.
- Classes: com os 5 livros, a única classe nova é o Artífice (as demais são as 12 do SRD); os
  livros acrescentam subclasses.

### 2026-10-19 — idiomas das raças e antecedentes dos livros de 2014

- Raças com o traço "Idiomas" (Livro do Jogador 2014) dão os próprios idiomas no lugar dos dois
  padrão da origem (Anão: Comum e Anão; Meio-Elfo e Humano: mais um à escolha; Alto Elfo: mais um
  pela sub-raça). Antecedentes com "Um/Dois à sua escolha" dão escolhas extras, inclusive idiomas
  raros (menos Druídico e Gíria de Ladrão). Raças sem esse traço (SRD, Multiverso) seguem a regra
  de 2024. Lido do texto já importado (`languages-text.ts`, com teste); não precisa reimportar.
- Conferido com o pacote real: Anão+Acólito, Alto Elfo+Soldado, Humano+Sábio e Golias+Nobre.
  `pnpm check` passou; não aberto no navegador nem no aparelho.

### 2026-10-19 — Tormenta20: extração do livro e núcleo do sistema (marco 1 de 7)

- Extração completa do Tormenta20 Jogo do Ano (`scripts/books/t20.py`): 17 raças, 14 classes
  (com tabela, habilidades e 241 poderes), 33 origens, 20 deuses, 29 perícias, 162 poderes gerais,
  196 magias, 47 armas, 12 armaduras/escudos, 121 itens, 31 melhorias, 76 ameaças e 4 perigos,
  35 condições e 191 itens mágicos. Pacote `t20-jda.book.json` (`t20_pack.py`) com 1.219
  entradas e 0 erros no validador. Fica fora do Git.
- Núcleo `tormenta20` em `@codexveil/rpg-systems` (regras, ficha, derivados, condições,
  recursos, ameaça, regras de campanha, formato do pacote) com 8 testes; registrado como sistema.
- Migração `20261019120000_tormenta20.sql` aplicada em produção (dry-run conferido antes).
- Meus livros importa pacotes de D&D e de Tormenta20 (o sistema vai em `book_packs.system_id`).
- Próximos marcos: campanha T20 e leitor do livro; criação de personagem; ficha e jogo; subida de
  nível; app; mestre (ameaças e combate).

### 2026-10-19 — Tormenta20: campanha e leitor do livro (marco 2 de 7)

- Nova campanha: o sistema Tormenta20 aparece na escolha; regras da campanha T20 (nível inicial,
  métodos de atributos e livros T20 importados a liberar).
- Meus livros e o leitor mostram livros de Tormenta20: abas por tipo (raças, classes, origens,
  divindades, poderes, magias, equipamento, itens mágicos, ameaças) com busca e uma tela própria
  para cada tipo (`t20-entry-view.tsx`); jogadores leem o conteúdo de personagem, o mestre lê tudo.
- `pnpm check` passou; não aberto no navegador.

### 2026-10-25 e 2026-10-26 — mesa, mapa e manutenção

Pedidos do responsável nesta rodada, todos publicados em `main`. Verificações: typecheck, lint e
testes dos pacotes afetados a cada entrega (banco no PGlite, com as migrações novas); o
responsável usou o site com mestre e jogador. Telas desta rodada ainda não vistas no app.

| Pedido                                                           | Situação                                                                                                                                                                   |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Painel "Rolar dados" mais organizado                             | Feito: perícias em grade com bônus, dados em grade, vantagem como seletor, botão em largura total                                                                          |
| "Rolando…" infinito e dados sumindo com várias rolagens          | Corrigido: limite de 6 s para os dados pararem, todas as rolagens novas entram na fila, as atrasadas mostram o resultado sem animação                                      |
| Aba Mapa separada da Sessão, antes dela, com a caixinha de dados | Feito (`/campanhas/[id]/mapa`)                                                                                                                                             |
| Tela cheia do mapa e zoom pela roda do mouse                     | Feito (centralizado, ajusta à tela)                                                                                                                                        |
| Imagem do mapa não aparecia para os jogadores                    | Corrigido (faltavam as URLs das camadas na tela do jogador)                                                                                                                |
| Girar a imagem do mapa (mestre)                                  | Feito (90° por clique)                                                                                                                                                     |
| Círculo de área no quadrado do personagem                        | Feito (começar no meio do quadrado centra a área)                                                                                                                          |
| Áreas de magia dos jogadores visíveis para todos                 | Feito; migração `20261026100000_player_map_areas.sql` aplicada em produção                                                                                                 |
| Movimentação livre fora de combate                               | Feito (sem linha, metros nem rastros sem combate ativo)                                                                                                                    |
| Não atravessar paredes; dois tokens no mesmo quadrado            | Feito (paredes só para jogadores; ocupação para todos)                                                                                                                     |
| Nome ao clicar no token; mover anotações                         | Feito                                                                                                                                                                      |
| Bônus temporários na ficha                                       | Feito (atributos, CA, iniciativa, deslocamento, percepção; ficam no navegador, como a Fúria, e não alteram a ficha salva)                                                  |
| Características separadas por tipo e recolhíveis                 | Feito                                                                                                                                                                      |
| Botão "Usar" nas magias                                          | Feito: gasta o espaço (com escolha de círculo maior) e rola ataque, dano ou cura pelo texto do SRD, com aumento por círculo e evolução de truques; avisa CD e concentração |
| Livros: só os livros, sem separar                                | Feito: só os importados em "Meus livros", numa lista única (site e app); escolhas antigas sem conteúdo continuam visíveis para desmarcar                                   |
| Paginação, limpeza de órfãos e excluir conta                     | Feito; falta publicar a migração `20261026110000`, as funções `delete-account` e `cleanup-orphans` e os segredos (veja PROXIMOS_PASSOS)                                    |

### 2026-11-10 — revelações, retrato no grupo, ruído da call e mapa

- **Revelações** (aba nova no site e atalho no app): o mestre entrega textos e imagens fora do
  roteiro, para todos ou para personagens escolhidos; pode preparar e revelar na hora. Tabela
  `campaign_handouts` com RLS (jogadores só leem o que foi revelado para eles), imagens em
  `campaigns/{campanha}/handouts/{id}/` com a mesma regra, tempo real.
- **Retrato no grupo:** `characters.share_portrait` (ligado por padrão). Card "Retrato no grupo"
  na ficha (D&D, Tormenta20, Assimilação). Sem retrato, o grupo vê o token do mapa.
- **Redução de ruído da call (site):** o botão usava `applyConstraints`, que não religava a
  supressão num microfone aberto; agora usa o RNNoise (AudioWorklet + WASM em
  `public/audio/rnnoise`, MIT/BSD) e, sem suporte, reabre o microfone com `restartTrack`.
- **Mapa:** no app o mestre move qualquer token (antes só o próprio, pela função de jogador);
  no site o mapa ajusta o zoom à área ao abrir e a aba do jogador usa a largura toda.

Migração `20261110100000_handouts_and_portraits.sql` **ainda não aplicada** (CLI do Supabase sem
login nesta sessão). Verificações: `pnpm check` (20 tarefas) e `pnpm build` passaram; testes novos
`handouts.test.ts` (3) e publicação do Realtime atualizada. Não verificado no navegador, no
celular, nem o áudio da call.

- Botão do retrato também no card **Grupo** da Visão geral da campanha (o jogador vê o próprio
  personagem com "Mostrar meu retrato"); `PartyCharacter.sharePortrait` exposto.

### 2026-11-11 — fotos e tokens do grupo com fichas ocultas (correção)

- **Causa:** as políticas de leitura das imagens de personagem no Storage consultavam
  `public.characters` com as permissões de quem lê; com as fichas do grupo ocultas (e com as
  fichas de NPC, privadas do mestre) o RLS escondia a linha e a imagem nunca era liberada. O
  mapa também buscava a imagem lendo `characters`. Resultado: grupo e mapa só com as iniciais.
- **Correção:** `private.can_read_character_image` (security definer) na política única
  "Retratos e tokens: participantes da campanha leem" (migração
  `20261111110000_character_image_read_fix.sql`) e `public.list_character_token_images`
  (migração `20261111100000_party_token_images.sql`), usada por `tokenImagePaths` no site e no
  app. NPCs: imagem só enquanto visíveis num mapa ativo. Ambas aplicadas em produção.
- Testes novos: `test/rls/token-images.test.ts` (2). `pnpm check` (20 tarefas) passou. Não
  verificado no navegador.

- Fotos do card **Grupo** clicáveis (abrem em tela cheia), a sua e as dos outros jogadores.

### 2026-11-12 — aba Jogo: vida/mana, painel de dados, layout e chat do Tomo

- Card Personagem: − e + de 1 em 1 na vida e na mana (`ResourceStepper`, operação atômica
  `adjust_character_resource`; a vida desce como dano). Moedas continuam só leitura.
- Painel de dados: clicar no dado só escolhe o dado (não rola); seleção de **atributo**
  (`characterAttributeBonuses`, D&D e Tormenta20) e perícia montam a expressão, que continua
  editável; modos na ordem Desvantagem · Normal · Vantagem.
- Layout: mural de rolagens abaixo do mapa, na mesma largura; Sessão abaixo do Combate; a
  mesinha de dados fica à direita. Cabeçalho dos cards quebra linha (o título "Combate" não fica
  mais coberto pelos selos).
- Chat avulso do Tomo: nunca foi para o banco (fica no `sessionStorage` da aba); agora some
  24 h depois da primeira mensagem, como a Taverna.

Verificações: `pnpm check` (20 tarefas) e `pnpm build` passaram. Não verificado no navegador.

- Aba Jogo: embaixo do mapa fica a **mesa de dados** (resultado grande); o mural de rolagens
  volta para a coluna da direita, abaixo dos dados.

- Painel de dados: perícia + outro atributo troca o atributo padrão da perícia pelo escolhido
  (ex.: Conhecimento com Constituição = bônus da perícia − Int + Con); o rótulo da rolagem mostra
  "Conhecimento (Constituição)". `characterSkillBonuses` agora informa o atributo de cada perícia.

### 2026-11-12 — extras do Ordem 2 (Beta)

- `scripts/books/ordem2.py` ganhou `--extras "<pasta>=<missão>"`: handouts, mapas e tokens dos
  zips de extras entram no pacote privado. Pacote Beta regerado (60 handouts/tokens, 8 mapas, 59
  imagens, 36,2 MB) e validado; fica fora do Git e **falta importar** em Meus livros. Pendentes:
  extras do Alpha (zip Elite + Recrutas) e remapear páginas para o PDF Beta 1.1. Detalhes em
  `ORDEM2.md`.

- Ordem 2 Beta com extras **importado** na conta do responsável (119 entradas, 59 imagens; conferido no banco). Alpha segue pendente da senha do PDF e dos extras.

- Ordem 2 Alpha com extras (Atos I e II, fichas e históricos) gerado, auditado e **importado** (166 entradas, 76 imagens; conferido no banco).

- Beta 1.1 do Ordem 2 investigado e **não processado**: páginas mapeadas, mas a diagramação nova (fontes) quebra a leitura de narração, pontos de interesse e criaturas. Detalhes e próximo passo em `ORDEM2.md`.

- **Retomar:** auras dos dados só para o criador — plano e mapa do código em `PROXIMOS_PASSOS.md` ("Continuidade: auras dos dados"). Nada implementado ainda.

### 2026-11-14 — mestrar a sessão: testes com achado, liberação e fichas no roteiro

Pedido do QA (Ordem Paranormal 2), feito para **todos os sistemas**:

- **Bloco novo "Teste"** (`check`: perícia, DT, rolagem do mestre, achado). No editor do roteiro
  entra como qualquer bloco. Na aba **Sessão**, o painel de liberação mostra **Rolar** (rola em
  segredo, só os mestres veem no mural, e diz se passou da DT) e **Liberar achado**. O jogador vê
  um quadro "Achado · Perícia · DT" com o que descobriu (site e app). Sem campo de nota: liberado,
  o bloco inteiro vai ao jogador; observações do mestre ficam em notas privadas.
- **Missão do Ordem pronta para mestrar:** narração ("Leia em voz alta"), descrição de cada ponto
  de interesse, mapas e cada achado saem marcados "para liberar na mesa"; cada linha "perícia ·
  DT" vira um bloco de Teste; o contexto continua em nota privada. Missões já montadas antes
  continuam no formato antigo: para o novo, usar "Usar esta missão na campanha" de novo.
- **Fichas no roteiro:** na leitura do roteiro, o mestre vê a ficha completa logo abaixo de cada
  NPC ou monstro (`CreatureSheet`: D&D, Tormenta20, Assimilação e Ordem 2).
- Migração `20261114100000_session_check_block.sql` (tipo `check`, validação no banco e
  `grant insert (revealable)` — a criação de blocos já marcados era recusada). Aplicada.

Verificações: `pnpm check` (20 tarefas; banco 252 testes, incluindo `check-block.test.ts`;
rpg-systems 295) e `pnpm build` passaram. Não verificado no navegador nem no celular.

### 2026-11-15 — correção: "Usar esta missão na campanha" falhava

- **Sintoma (QA):** "Alguns dados não são válidos" ao montar uma missão do Ordem 2.
- **Causa:** o bloco de imagem do mapa no roteiro apontava para `campaigns/<id>/maps/...`, mas
  `session_blocks` só aceita imagens de roteiro na pasta da sessão (`session_blocks_image_path`);
  o banco recusava e a montagem inteira falhava. Reproduzido em teste.
- **Correção:** o mapa da mesa continua em `maps/`; o bloco do roteiro usa uma cópia em
  `campaigns/<id>/sessions/<sessão>/` (`sessionImagePath`), que é a pasta que o "Liberar" mostra
  aos jogadores. Teste `test/rls/mission-map-block.test.ts`. Sem migração.

Verificações: `pnpm check` (20 tarefas; banco 253 testes) e `pnpm build` passaram. Não verificado no
navegador.

### 2026-11-15 — auras dos dados (somente criador)

- Seis auras em "Meus dados": Sangue, Tempestade, Gelo, Arcana, Sombra e Sagrada. O seletor só
  aparece para contas de criador; a prévia mostra a aura atrás do dado e, na mesa de dados, ela
  emana enquanto o dado de quem rolou está na mesa (CSS; parada com movimento reduzido).
- Banco (migração `20261115100000_dice_auras.sql`): `profiles.creator_features` (o usuário não
  altera; só a administração liga), `user_dice.aura` com gatilho que recusa para quem não é
  criador, e gatilho que remove `preferences.dice.aura` de quem não é criador.
- Flag ligada só na conta do responsável por comando avulso no banco (o e-mail não fica em
  arquivo). Conferido: 1 criador.
- Teste `test/rls/dice-auras.test.ts`. A seção "Continuidade: auras dos dados" foi concluída.

Verificações: `pnpm check` (20 tarefas; banco 254 testes) e `pnpm build` passaram. Não verificado no
navegador.

### 2026-11-15 — auras dos dados viram efeitos de partículas

- A aura em CSS atrás do dado (que não aparecia na caixinha de dados) foi trocada por partículas
  num canvas 2D (`components/dice/aura-fx.ts`) que **saem do próprio dado enquanto ele rola**,
  seguindo a posição dele na tela: mini raios (Tempestade), gotas (Sangue), flocos (Gelo),
  faíscas violeta (Arcana), fumaça (Sombra) e brilhos dourados (Sagrada).
- **Crítico (20 natural ou margem do ataque):** o tema toma a tela inteira por ~3 s — chuva de
  raios com clarões, chuva de sangue, nevasca, chuva arcana, sombra fechando pelas bordas e feixes
  de luz. Com a mesa grande aberta, o efeito sai só de lá (sem duplicar com a caixinha).
- Funciona na caixinha de dados e na mesa da aba Dados (`throwDice` recebe `aura` e `critical`).
  Com movimento reduzido, nada é desenhado.
- "Meus dados": layout refeito (área de desenho mais estreita, configurações ocupando o resto),
  prévia com as partículas ao vivo e botão "Testar crítico"; botões de aura sem sobreposição.
- Removidos `dice-aura.tsx` e as regras `.dice-aura` do `globals.css`. Sem migração.

Verificações: `pnpm check` (20 tarefas) e `pnpm build` passaram. Não verificado no navegador.

### 2026-11-15 — auras 2: emanando do dado, críticos com som, 4 temas novos e liberação para amigos

- A aura agora **emana da borda do dado**, como chakra: labaredas do tema sobem da borda e um
  halo acompanha o dado. A Arcana mostra um **anel de runas girando** em volta do dado; a Sagrada,
  uma auréola. Forte enquanto rola; mais fraca enquanto o dado fica na mesa.
- **Críticos refeitos**, com **"CRÍTICO!" no centro da tela**:
  - Tempestade: chuva de raios com clarões.
  - Sangue: jatos jorrando das bordas e respingos escorrendo na tela.
  - Gelo: a tela congela (vidro embaçado e gelo crescendo das bordas).
  - Arcana: círculos mágicos de runas girando.
  - Sombra: a sombra fecha a tela.
  - Sagrada: o céu se abre em raios de luz, com auréola e penas caindo.
- **Auras novas:** Engrenagens (engrenagens, faíscas e arcos elétricos; no crítico, engrenagens
  gigantes girando nos cantos), Floresta (folhas e vaga-lumes; cipós crescendo), Fogo (chamas e
  brasas; a tela pega fogo) e Dragão (chamas, escamas e fumaça; um dragão cruza a tela cuspindo
  fogo).
- **Som nos críticos**, sintetizado no navegador (`aura-sound.ts`, sem arquivos): trovão,
  coração e jorro, gelo trincando, arpejo arcano, grave sombrio, coro, engrenagens, vento e
  pássaros, labareda e rugido. Dá para desligar em "Meus dados" (vale para o navegador).
- Efeitos e som aparecem **para todos da mesa**: cada um desenha a rolagem dos outros com o dado
  de quem rolou. O "Crítico!" padrão some quando o dado tem aura (o efeito do tema substitui).
- "Meus dados": cartões sem limite de largura (a tela não fica mais cortada), botões **"Testar
  rolagem"** (o dado tomba pela prévia com a aura) e "Testar crítico".
- **Auras dos amigos** (só na conta de criador): lista de amigos; ao clicar em um, aparecem
  todas as auras para marcar as liberadas. O amigo passa a ver e usar só as liberadas.
- Banco: migração `20261115110000_dice_auras_more.sql` (aplicada), teste
  `test/rls/dice-aura-grants.test.ts`.

Verificações: `pnpm check` (20 tarefas; banco 255 testes) e `pnpm build` passaram;
`supabase db push --dry-run` conferido antes de aplicar. Os efeitos e sons não foram vistos no
navegador por mim.

### 2026-11-15 — auras: desempenho, aura na caixinha e na mesa, Dragão removido

- **Travava o PC ao testar a rolagem:** cada partícula recriava degradês e `shadowBlur` a cada quadro. Agora brilhos, chamas, fumaça e runas são desenhados uma vez em pequenos canvases e só copiados; o gelo e os cipós crescem numa camada desenhada uma vez por galho; os círculos de runas, as engrenagens gigantes e os raios da Sagrada viram camadas prontas. Também: no máximo ~60 quadros/s, resolução limitada (1x no crítico, 1,5x na aura) e menos partículas (limite 450).
- **Aura não aparecia na caixinha nem na mesa** com dado vinculado ao personagem: o carregamento do dado do personagem não lia a coluna `aura`. Corrigido em `dice-look.ts`.
- **Dragão removido** a pedido (efeito ruim): migração `20261115120000_dice_aura_no_dragon.sql` (aplicada) limpa quem a usava.

Verificações: `pnpm check` (20 tarefas; banco 255 testes) e `pnpm build` passaram. Desempenho e efeitos não medidos no navegador por mim.

### 2026-11-15 — aura Esqueleto

- Nova aura **Esqueleto**: no dado, chamas fantasmagóricas verde-pálidas, ossos girando para fora e caveirinhas-espírito subindo. No crítico, uma **caveira gigante gargalhando** no centro (o queixo bate, olhos verdes acesos), ossos chovendo e névoa verde; o "CRÍTICO!" desce para baixo da caveira. Som: gargalhada sintetizada ("ha-ha-ha" por formantes) com ossos chacoalhando.
- Migração `20261115130000_dice_aura_skeleton.sql` (aplicada); teste de auras cobre a nova.

Verificações: `pnpm check` (20 tarefas; banco 255 testes) e `pnpm build` passaram. Não visto nem ouvido no navegador por mim.

### 2026-11-15 — oito auras novas e ícones das auras

- **Olho Cósmico:** estrelas sugadas em espiral e disco girando no dado; no crítico a tela racha e um olho gigante abre, olha em volta e pisca.
- **Cartas do Destino:** cartas de tarô girando no dado; no crítico três cartas caem e viram (A Lua, O Crítico, O Sol).
- **Glitch:** pixels e 0/1 saindo do dado; no crítico a página "buga" (filtros rápidos), chuva de caracteres, faixas e chiado.
- **Tinta:** pinceladas girando e respingos; no crítico um pincel pinta um ensō que respinga e escorre.
- **Abissal:** bolhas e peixinhos luminosos; no crítico a tela enche de água, um tentáculo passa e a água esvazia.
- **Tempo:** mostrador com ponteiro em volta do dado; no crítico tudo fica sépia, um relógio gigante gira para trás e a cor volta num clarão.
- **Ouro:** moedas saltando; no crítico chove ouro e as moedas quicam e se empilham.
- **Sapo Rei:** moscas zumbindo; no crítico um sapo de coroa sobe, pega o "CRÍTICO!" com a língua e engole.
- Cada aura tem som próprio sintetizado e um **ícone** (`aura-icons.tsx`) usado no seletor e na liberação para amigos.
- Migração `20261115140000_dice_auras_eight.sql` (aplicada).

Verificações: `pnpm check` (20 tarefas; banco 255 testes) e `pnpm build` passaram. Efeitos e sons não vistos no navegador por mim.

### 2026-11-15 — mesa de teste em "Meus dados" e auras mais leves

- "Testar rolagem" agora rola um **d20 de verdade numa mesa 3D** (`dice-test-table.tsx`) com o dado como está no editor (desenho, cores, fonte e aura, mesmo sem salvar). "Rolar um 20" tira 20 e mostra o crítico completo da aura. O antigo "Testar crítico" (só o efeito) saiu.
- Auras em volta do dado com metade das partículas e do brilho (`AURA_INTENSITY`); os críticos seguem iguais.

Verificações: `pnpm check` (20 tarefas) e `pnpm build` passaram. Não visto no navegador por mim.

### 2026-11-15 — mesa de teste com vários dados

- A mesa de teste de "Meus dados" monta a rolagem: d4, d6, d8, d10, d12 e d20 (até 10 dados), com botão para voltar a 1d20. Mostra a soma e o valor de cada dado; o crítico (efeito da aura) dispara com 20 natural em qualquer d20, e "Rolar um 20" garante um.

Verificações: `pnpm check` (20 tarefas) e `pnpm build` passaram. Não visto no navegador por mim.

### 2026-11-15 — sete auras novas e correção do Glitch

- **Vampiro** (morcegos; lua de sangue e revoadas), **Bardo** (notas; holofotes, equalizador e fanfarra), **Arco-íris** (brilhos coloridos; arco-íris crescendo com nuvens), **Veneno** (bolhas e gotas; nuvens tóxicas e ☣), **Gato** (pegadas; patada que rasga a tela, pegadas e miau), **Meteoro** (brasas e pedras; chuva de meteoros e impacto com onda de choque) e **Festa** (confetes; canhões de confete e balões). Cada uma com som e ícone.
- **Glitch preso:** dois "sustos" sobrepostos guardavam o filtro bugado como "anterior" e a página ficava com cores invertidas. Agora o filtro sempre volta a vazio, com uma limpeza garantida no fim do crítico.
- Migração `20261115150000_dice_auras_seven.sql` (aplicada).

Verificações: `pnpm check` (20 tarefas; banco 255 testes) e `pnpm build` passaram. Não visto no navegador por mim.

### 2026-11-15 — críticos refeitos, Vento e Ritual

- **Sombra:** a escuridão fecha a tela até sobrar um círculo de luz no texto, com tentáculos de sombra e olhos no escuro; depois recua.
- **Abissal:** kraken — a água sobe, um olho gigante surge e quatro tentáculos esmagam a tela, rachando onde batem (tremor e destroços).
- **Bardo:** partituras ondulando com notas correndo, clave de sol e explosão de notas; som virou melodia de alaúde.
- **Gato:** um gato espia do rodapé e dá tapas no "CRÍTICO!" até jogá-lo para fora da tela; mia no fim.
- **Festa:** bola de espelhos com luzes varrendo a tela, fogos de artifício sincronizados com o som e confete.
- **Engrenagens:** trens de engrenagens engatadas no alto e embaixo, engrenagem enorme atrás do texto, vapor, faíscas e arcos elétricos.
- **Floresta:** árvores crescendo do chão com folhas e flores, pétalas caindo.
- **Veneno:** a fumaça tóxica sobe de baixo.
- **Tinta:** papel de arroz por trás, pincelada mais grossa e carimbo vermelho.
- **Esqueleto:** lápides sobem do chão e mãos de esqueleto saem da terra.
- **Gelo:** cobre a tela inteira e, no fim, se estilhaça em cacos (com som).
- **Sapo Rei:** a língua agora sai da boca (era desenhada por trás do sapo).
- **Glitch:** 10% de chance de a página ficar em negativo até recarregar (de propósito).
- **Olho Cósmico:** mais hostil (veias, íris em brasa, pupila em fenda, pálpebra franzida e olhar fixo).
- **Novas:** **Vento** (redemoinho no dado; tornado com detritos e uma vaca no crítico) e **Ritual** (pentagrama girando no dado; pentagrama demoníaco traçado com velas, runas e chamas no crítico).
- Momentos compartilhados entre cena e som em `AURA_TIMINGS` (`aura-sound.ts`). Migração `20261115160000_dice_aura_wind.sql` (aplicada).

Verificações: `pnpm check` (20 tarefas) e `pnpm build` passaram. Não visto nem ouvido no navegador por mim.

### 2026-11-15 — resultado só depois do dado cair

- O mural de rolagens e o cartão da última rolagem mostravam o número antes de os dados 3D pararem. Novo `components/dice/roll-reveal.ts`: a caixinha marca a rolagem como "rolando" ao começar e libera quando os dados param (ou quando a mesa grande avisa). O mural esconde a linha nova (e o total da ação ligada a ela) até lá, e `useDice().roll` só devolve o resultado depois disso. Sem dados 3D na página nada é segurado; há limites de 2 s (mural esperando a caixinha) e 9 s (animação).

Verificações: `pnpm check` (20 tarefas) e `pnpm build` passaram. Não visto no navegador por mim.

### 2026-11-15 — call que não cai, transcrição completa e na ordem, Garras

- **Call caía ao trocar de aba:** a página da call desmontava o LiveKit e o fim da conexão era tratado como "sair" (marcava a saída e redirecionava). A call agora vive no layout (`ActiveCallProvider`): continua ao navegar, com barrinha flutuante fora da página, e reconecta sozinha em quedas.
- **Transcrição incompleta:** depois de cada silêncio o navegador encerra a escuta e o código esperava cada vez mais para voltar (até 15 s), perdendo falas; agora volta em 150 ms (espera crescente só em falha de rede) e retoma quando a aba volta ao primeiro plano. Também continua ao trocar de página.
- **Transcrição fora de ordem:** o horário vinha do relógio de cada computador; o banco agora usa o próprio relógio. O início da fala é o primeiro resultado parcial (antes era o fim da fala anterior). Teste novo em `calls.test.ts`.
- **Garras** (pedido de um amigo): arranhões verdes no dado; no crítico dois golpes rasgam a tela com cortes verdes, tremor e rugido de urso.
- **Arco-íris:** pote de ouro na ponta, com moedas pulando. **Cartas do Destino:** três cartas sorteadas entre os 22 arcanos maiores.
- **Tremor dos críticos** (Abissal, Meteoro, Vento, Gato, Garras): mexia no `transform` do `<body>` e fazia a tela "bugar"; agora só o efeito treme.
- Migrações `20261115170000_transcript_server_clock.sql` e `20261115180000_dice_aura_claw.sql` (aplicadas).

Verificações: `pnpm check` (20 tarefas; banco 256 testes) e `pnpm build` passaram. A call e a transcrição não foram testadas ao vivo por mim (precisam de mais de uma pessoa).

### 2026-11-15 — falhas críticas das auras

- **1 natural com aura:** `criticalFailBurst` (em `aura-fx.ts`) mostra a versão fracassada da aura, para todos da mesa: "FALHA CRÍTICA" no centro, que balança e despenca, vinheta cinza e trombone triste (`playFailSound`). Uma cena para cada uma das 29 auras: gotinha de sangue, nuvenzinha chovendo, flocos derretendo, círculo arcano que explode em fumaça, escuridão piscando como lâmpada ruim, auréola torta que cai, engrenagem quicando e mola, mudinha que murcha, fósforo que apaga, caveira que desmonta, olho com sono (Zzz), cartas esparramadas com O Louco, tela azul do glitch, borrão de tinta, patinho de borracha, relógio que quebra, uma moeda só rolando, sapo que erra a língua e cai, morcego que se esborracha na tela, partitura que arrebenta, arco-íris cinza, bolha de veneno que deixa o texto verde, pata que empurra o texto para fora, pedrinha que bate no texto, balão murchando, redemoinho minúsculo, pentagrama torto com velas apagando e arranhão fraquinho com unha quebrada.
- `throwDice` recebe `fumble`; caixinha e mesa disparam no 1 natural (o aviso padrão de falha some quando há aura). Mesa de teste ganhou "Rolar um 1".

Verificações: `pnpm check` (20 tarefas) e `pnpm build` passaram. Não visto nem ouvido no navegador por mim.

### 2026-11-15 — Engrenagens reformuladas e dez auras novas

- **Engrenagens (de novo):** uma máquina se monta em volta do texto — engrenagens chegam voando e engatam na central, manômetro sobe até o vermelho, pistões bombeiam e, quando a pressão estoura, apito a vapor, jatos de vapor e tudo acelera. Som novo (clangs, catraca acelerando, apito e chiado).
- **Novas (crítico / falha):** Necromante (zumbis brotam e cambaleiam / só uma mão sai e cai), Pirata (navio disparando canhões e baú abrindo / barquinho de papel afundando), Samurai (corte que abre a tela, kanji 斬 e pétalas / katana quebra), Kaiju (pisada gigante com rachaduras e rugido / lagartixa), Cyberpunk (grade neon, sol sintético, letreiros e drone / letreiro queimando e caindo), Lobisomem (lua cheia, lobo uivando, olhos vermelhos / nuvem na lua e cachorrinho latindo), Sereia (canto em ondas coloridas e tela ondulando / canto desafinado que trinca o vidro), Alquimia (círculo de transmutação, frascos e clarão dourado; texto dourado / frasco explode e chamusca o texto), Fantasma (vidro embaça e "CRÍTICO!" é escrito com o dedo / escreve errado e apaga) e Abelhas (enxame forma a palavra "CRÍTICO!" / uma abelha pica e o texto incha). Cada uma com aura no dado, som e ícone; a Sombra passou a usar o ícone de lua.
- Migração `20261115190000_dice_auras_ten.sql` (aplicada).

Verificações: `pnpm check` (20 tarefas; banco 256 testes) e `pnpm build` passaram. Não visto nem ouvido no navegador por mim.

### 2026-11-16 — seis críticos refeitos

- Silhuetas desenhadas à mão (lobo, zumbis, pé, sereia) ficaram ruins; os críticos foram refeitos com clima, luz e olhares: **Kaiju** (escuridão, passos que tremem, olhos de réptil gigantes e rugido em ondas de choque), **Lobisomem** (lua cheia enorme, matilha de olhos vermelhos se aproximando, uivo em ondas e os olhos do alfa), **Sereia** (fundo do mar com raios de luz, águas-vivas e anéis perolados), **Fantasma** (tela fria, rosto avançando, neblina em volta do texto com "CRÍTICO!" escrito com o dedo e mão batendo no vidro — antes a tela só ficava branca), **Necromante** (círculo necromântico, braços de esqueleto rompendo do chão e almas em espiral) e **Samurai** (sol vermelho, pincelada de nanquim, quatro cortes e o corte final que parte o sol).
- Sons novos com eco (`withReverb`) e vozes por formantes (`voice`): uivo de dois lobos em harmonia, coro da sereia, coro dos mortos, rugido do kaiju, cortes e taiko do samurai, vulto e teremim do fantasma.

Verificações: `pnpm check` (20 tarefas) e `pnpm build` passaram. Não visto nem ouvido no navegador por mim.

### 2026-11-16 — Adestramento no painel de rolagem e pedidos de auras dos amigos

- **Adestramento sumia (Tormenta20):** o painel de rolagem (aba Jogo/Dados, site e app) só listava as perícias utilizáveis, então as que exigem treino (Adestramento, Atuação, Conhecimento, Misticismo…) sumiam para quem não era treinado. `characterSkillBonuses` agora lista todas (a aba Atributos já mostrava, com "*").
- **Cyberpunk:** crítico virou o **Sandevistan** (tela verde, HUD, chuva e cacos parados no ar, "CRÍTICO!" atravessando a tela com rastros coloridos e o tempo voltando de uma vez); falha virou **ciberpsicose** (tela vermelha instável, HUD de erro, humanidade caindo, texto tremendo).
- **Falhas novas:** Sombra = flashbang (granada quica e estoura num clarão com zumbido); Sagrada = diabinho que ri e cutuca o texto com o tridente; Olho Cósmico = dedo no olho (fecha, fica vermelho e lacrimeja). Sons extras de falha em `FAIL_EXTRAS` (`aura-sound.ts`).

Verificações: `pnpm check` (20 tarefas; rpg-systems 295 testes) e `pnpm build` passaram. Não visto no navegador por mim.

### 2026-11-16 — efeitos em qualquer página, Haki do Rei, Cthulhu e ajustes

- **Efeitos de crítico/falha em toda a campanha:** `CampaignRollEffects` (no layout da campanha) dispara o efeito da aura de quem rolou em páginas sem a caixinha de dados (Anotações, Biblioteca, Quadros…); onde há caixinha, ela continua disparando (sem duplicar).
- **Haki do Rei** (nova): raios pretos com brilho vermelho no dado; no crítico, ondas de pressão a cada batida, a página perde a cor por um instante e raios pretos rasgam a tela; falha com pressão fraquinha e uma mosca desmaiando.
- **Cthulhu** (nova): céu verde-podre, mar subindo, tentáculos esmagando e rachando a tela, o Grande Antigo surgindo do mar e abrindo os olhos, e a tela se estilhaçando no fim; falha com um polvinho que espirra tinta no texto.
- **Abelhas** removida a pedido (migração limpa quem usava).
- **Necromante:** os braços afundam de volta no círculo antes de ele apagar (antes ficavam sozinhos).
- **Bardo:** crítico virou cordas de alaúde gigantes vibrando cada vez mais forte até estourarem uma a uma, com notas e faíscas.
- **Lobisomem:** refeito com lua gigante e o lobo uivando no penhasco (silhueta com curvas), pulso da lua e clarão prateado; uivo mais natural.
- Migração `20261116100000_dice_aura_haki.sql` (aplicada).

Verificações: `pnpm check` (20 tarefas) e `pnpm build` passaram. Não visto nem ouvido no navegador por mim.

### 2026-11-16 — nove temas inspirados em animes, filmes e D&D

- Pedidos inspirados em obras conhecidas viraram temas próprios (sem desenhar os personagens nem usar o áudio original; sons sintetizados que lembram): **Deus do Sol** (desenho animado em preto e branco, sol gargalhando, tambores; falha: soberano oculto num trono), **Aceleração do Tempo** (dias e noites cada vez mais rápidos, estrelas riscando, relógio disparando; falha: relógio trava e passa um caracol), **Tarrasque** (do SRD de D&D: fenda de lava, dorso de espinhos, chifres e urro; falha: dormindo e roncando), **Vazio Roxo** (azul puxa, vermelho empurra, fundem no roxo que apaga uma faixa da tela; falha: "CRÍTICO!" cortado ao meio), **Roda da Adaptação** (roda de oito raios girando em estalos e luz dourada; falha: milhares de cortes), **Esfera de Captura** (captura o "CRÍTICO!" e balança três vezes; falha: estoura e ele foge), **Lorde Sombrio** (respiração mecânica, lâmina vermelha retalhando a tela; falha: lâmina engasga e desliga), **Caderno Sombrio** (caneta escreve "CRÍTICO" à mão e a palavra arde; falha: maçã mordida) e **Sete Esferas** (esferas formam um círculo e um dragão de luz sobe; falha: esferas racham).
- **Haki do Rei:** som refeito (pulso grave que infla e explode, estática e vento de choque) e falha mais visível (tela escurece, anel murcha, raiozinhos, suor e a mosca desmaiando). **Cthulhu:** falha mais caprichada (polvinho pula e solta uma nuvem enorme de tinta).
- Migração `20261116110000_dice_auras_nine.sql` (aplicada).

Verificações: `pnpm check` (20 tarefas) e `pnpm build` passaram. Não visto nem ouvido no navegador por mim.
