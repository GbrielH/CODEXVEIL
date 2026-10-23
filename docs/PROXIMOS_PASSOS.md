# Próximos passos

> Relatório atualizado em **2026-10-18**. Mantenha este arquivo em dia a cada etapa concluída
> (veja [Como manter a documentação](#como-manter-a-documentação)). O inventário completo do
> que falta em relação ao escopo inicial está em [`PENDENCIAS.md`](PENDENCIAS.md), e os
> procedimentos de publicação em [`DEPLOY.md`](DEPLOY.md).

## Onde estamos

| Área        | Situação                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Site        | **No ar** em <https://codexveil.vercel.app> (Vercel, projeto `codexveil`), **publicado sozinho a cada push em `main`** pela integração com o GitHub. Conferido em 2026-10-18: os quatro commits do dia aparecem como "Deployment has completed" no GitHub.                                                                                                                                                                                                                                                                                                                                |
| Backend     | **No ar:** Supabase `CODEXVEIL` (`ityfhobhpjzhlkgvjhfb`, us-east-2), com as **15 migrações aplicadas** (a `20261018140000_book_packs.sql` em 2026-10-18), Site URL e Redirect URLs (`deploy/supabase/config.toml`).                                                                                                                                                                                                                                                                                                                                                                       |
| App Android | **APK atual:** [download](https://expo.dev/artifacts/eas/m0Px-_WnwK0q8a6BOSANOEa1oIJUvajr8DDOeJ279Sk.apk) ([build `e02e7079`](https://expo.dev/accounts/gabriel.xxtth/projects/codexveil/builds/e02e7079-2f5c-4da6-b225-2e78522d084a), 2026-10-17, com notificações e imagens). Cada push publica uma **atualização OTA** pelo GitHub Actions (`.github/workflows/ci.yml`, desde 2026-10-19; exige o segredo `EXPO_TOKEN`); APKs anteriores (`420f6c37`, `de6ceb5c`) não recebem mais atualizações. Todos os builds: <https://expo.dev/accounts/gabriel.xxtth/projects/codexveil/builds>. |
| Validação   | Teste ao vivo da API contra o banco real: **11/11 em 2026-10-18** (também 10/10 em 2026-10-16 e 11/11 em 2026-10-17). `pnpm check` 20/20 e `pnpm build` 2/2 em 2026-10-18. **Ninguém usou ainda as telas com duas contas**, e as telas de 2026-10-18 (capa, multiclasse, talentos, livros, dados por sessão) não foram abertas no navegador nem no celular.                                                                                                                                                                                                                               |
| E-mail      | **SMTP próprio ligado em 2026-10-18:** Brevo, remetente `codexveil@gmail.com`, templates em português enviados. Um e-mail de recuperação de senha foi aceito pelo Supabase; falta confirmar a chegada na caixa de entrada e testar o cadastro com uma conta de fora da organização e a recuperação pelo app.                                                                                                                                                                                                                                                                              |

### Limitações do período sem SMTP próprio (até 2026-10-18; confirmar se sumiram)

- Os e-mails de confirmação e de recuperação só chegam a **membros da organização CODEXVEIL**
  no Supabase. Para testar com duas contas, convide o segundo e-mail para a organização ou use
  e-mails que já sejam membros.
- No site, a confirmação e a recuperação de senha só funcionam se o link for aberto **no mesmo
  navegador** em que o pedido foi feito.
- A **recuperação de senha pedida pelo app não funciona**.

## Pedidos do responsável em 2026-10-20 (a fazer, em ordem de importância)

Registrados sem implementar (pedido explícito: só documentar). Estado do que já existe no fim desta seção.

1. **[Feito em 2026-10-20]** **Livros: separação exata (EXTREMA IMPORTÂNCIA).** Ficha pessoal (D&D e
   T20, site e app) usa só os livros marcados; ficha e subida de nível usam os livros gravados na
   ficha (`identity.sourcebooks`); na campanha, os liberados pelo mestre. Texto original do pedido: A escolha de livros na campanha e na ficha
   serve para limitar o conteúdo. Hoje, depois de importar todos os livros, mesmo escolhendo só o
   D&D base aparecem espécies, raças, classes e antecedentes de todos os livros. Regra: um item que
   só existe no livro A só aparece se o livro A estiver selecionado; o mesmo para classes,
   subclasses, talentos, magias, monstros e itens. Vale na criação de personagem (site e app), na
   subida de nível, na campanha e para qualquer sistema (D&D, Tormenta20 e futuros), de forma
   automática pelo que foi selecionado. Pontos a revisar: ficha pessoal (`draft.sourcebooks` vs.
   `ownReadyBookPacks`), `personalPackIds` no assistente, `sheetBookSources`/`sheetT20Sources` e o
   app (`novo.tsx` usa todos os livros prontos do usuário).
2. **[Conferido em 2026-10-20]** **Regras de criação não mudam com mais livros.** As quantidades
   (magias, perícias, talentos, poderes) vêm da classe e do nível nos dois sistemas; livros só
   ampliam as opções, e escolhas extras só quando o conteúdo do livro as concede. Pedido: Número de magias, habilidades, perícias etc.
   seguem a classe/nível; mais livros liberados não dão mais escolhas, a não ser que um livro
   selecionado conceda isso explicitamente.
3. **[Feito em 2026-10-20] Combate mais roleplay (menos automação).** Manter rolagem de dados e, para o mestre, a ordem
   dos turnos. No D&D: o jogador escolhe o ataque, rola o acerto; o mestre/adversário diz se
   acertou; se acertou, o jogador clica no dado de dano, senão fecha. **Não** escolher o alvo nem
   aplicar dano automaticamente. (Substitui o item 7 antigo "reações automáticas".) Feito: a ficha
   de D&D (site e app) não tem mais o campo "Alvo"; depois de rolar o ataque aparece "Acertou:
   rolar dano" (registra o dano no mural como ação livre, sem mexer em PV) ou "Errou: fechar". O
   painel do mestre continua podendo mirar com ameaças.
4. **[Feito em 2026-10-20] Aba Sessão para mestre e jogadores.** Mestre: toda a lore da sessão, por padrão visível só para
   ele; durante a sessão ele libera trechos (texto, imagem de NPC, frase…) com um clique. Jogadores:
   aba Sessão onde os trechos liberados vão aparecendo. (Base existente: blocos de roteiro com
   `visibility` e sessões publicadas.) Feito: a lore nasce oculta; a Mesa do mestre tem o
   cartão "Lore da sessão" com "Liberar"/"Ocultar" por trecho (o primeiro liberado publica a
   sessão); nova aba "Sessão" no site mostra os trechos liberados em tempo real (a antiga
   "Sessões" virou "Roteiros" para jogadores); no app, a leitura da sessão atualiza sozinha.
   Migração `20261020120000_session_reveal.sql` aplicada em produção em 2026-10-20.
5. **[Feito em 2026-10-20] Dados realistas.** Ao rolar (site e app), o dado aparece grande no meio da tela, cai e gira
   (estilo app "Dice"), sem caixinha; com limite de dados simultâneos para não travar o aparelho.
   Opcional se for inviável. Feito: toda rolagem (site e app) mostra até 6 dados grandes caindo,
   quicando e girando no meio da tela, sem caixa, com o número trocando até parar; 20 natural fica
   verde e 1 natural vermelho; o total aparece embaixo e tudo some sozinho (no app, também com um
   toque). Movimento reduzido do sistema desliga a queda.
6. **[Feito em 2026-10-20] Meus livros:** marcador do sistema de cada livro (D&D 5e, Tormenta20…).
   Feito: selo "D&D 5e · regras de 2014/2024" ou "Tormenta20 · edição" em Meus livros, nos Livros da campanha e no leitor.
7. **[Feito em 2026-10-20] Imagens das raças:** muitas raças aparecem com imagem básica de humano; revisar todas.
   Feito: 29 ícones novos (game-icons.net, CC BY 3.0) para as raças de Monstros do Multiverso e de Tormenta20; teste garante que nenhuma raça dos livros cai no humano; ícones também na escolha de raça do T20 (site e app).
8. **[Feito em 2026-10-20] Botão "+1 nos três"** (aumento do antecedente) não responde ao clique; corrigir.
   Feito: os antecedentes dos livros oferecem os 6 atributos, e o botão tentava dar +1 em todos (inválido, parecia não responder). Agora o modo fica guardado e, com mais de 3 opções, pede a escolha de 3 atributos (site e app).
9. **[Feito em 2026-10-20] Abas do mestre x jogadores:** conferir se as abas visíveis a cada papel são coerentes.
   Conferido: mestre vê Mesa, Convites e Configurações (bloqueadas para jogadores); jogador vê Meu personagem (bloqueada para o mestre); as demais abas filtram pelo papel e pelo RLS. Nenhuma correção necessária.
10. **[Feito em 2026-10-20] Prompt de imagem do personagem:** ao terminar a criação, oferecer (opcional) um prompt pronto
    para gerar a imagem numa IA de preferência do jogador, com classe, raça, habilidades,
    personalidade, história, antecedente e demais dados; copiar ou ignorar.
    Feito: na revisão da criação (D&D e T20, site e app) aparece o cartão "Prompt para a imagem do personagem (opcional)" com Copiar e Ignorar; montado por `characterImagePrompt` (domínio, com teste).
11. Depois: tradução do SRD (item 2 antigo) e assistente de IA (pedido de 2026-10-18).
12. **[Adiado — ver [`MELHORIAS_FUTURAS.md`](MELHORIAS_FUTURAS.md)] Sistema da comunidade "Behind the Magic" (livro "Manual de Runas").** RPG de autoria de um
    amigo do responsável, **original e com uso autorizado** (pode usar todo o conteúdo do livro:
    regras, imagens, tudo). Diferente dos livros comerciais, ele vai **direto no Codexveil**, como
    um sistema na aba **Sistemas da comunidade**. Requisitos:
    - o sistema precisa ser **ativado** pelo usuário na aba Sistemas da comunidade; sem ativar, ele
      não aparece ao criar campanha nem personagem;
    - todas as regras, fichas, criação de personagem e imagens vêm do próprio livro;
    - seguir o modelo dos sistemas existentes (`packages/rpg-systems/src/<id>/`, registro em
      `registry.ts`, migração inserindo em `rpg_systems`, ficha e assistente no site e no app).
    - PDF do livro (65 MB), versionado com autorização do responsável: [`docs/sistemas/behind-the-magic/MANUAL DE RUNAS.pdf`](sistemas/behind-the-magic/MANUAL%20DE%20RUNAS.pdf).

## Pedidos de 2026-10-20 (depois da tradução do SRD, nesta ordem)

1. **[Feito em 2026-10-20] Sessão presencial ou online** na campanha. Presencial: o mestre escolhe dados físicos ou
   virtuais; com dados físicos, os dados virtuais somem e a ficha mostra que dado rolar em cada
   coisa (acerto do ataque, dano…). Online: dados virtuais ligados automaticamente (e, depois, o
   grid da sessão).
2. **Grid da sessão** (próxima grande etapa, para sessões online). Escopo definido em 2026-10-20 (com névoa de guerra e linha de visão opcional): ver [`GRID.md`](GRID.md). **Implementada em 2026-10-21** (site e app); falta a verificação real com duas contas.
3. **[Feito em 2026-10-20] Ação de combate personalizada** criada pelo mestre.
4. **[Feito em 2026-10-20]** Subida de nível: poder "Treinamento em Perícia" abre a escolha da perícia, como no Aumento de
   Atributo.
5. **[Feito em 2026-10-20]** Benefícios de origem: breve descrição de cada perícia/poder.
6. **[Feito em 2026-10-20]** Aba Sessão do mestre: mostrar a sessão montada e iniciada, com botão prático de liberar cada
   trecho aos jogadores ali mesmo.
7. **[Feito em 2026-10-20]** Perícias já treinadas nas listas de escolha: elemento visual (não só desabilitar).
8. **[Feito em 2026-10-20]** Tormenta20: tirar Bestiário SRD e Itens mágicos SRD (de D&D) da biblioteca; usar os do T20 se
   houver.
9. **[Feito em 2026-10-20]** Combate do mestre: só a definição dos turnos (sem registrar ação/rolagem/alvo pelo painel); os
   jogadores conferem a ficha e ajustam a vida.
10. **[Feito em 2026-10-20 no site; app em melhorias futuras]** Dado 3D numa caixinha no canto, com a cor escolhida por cada jogador (ver
    [`MELHORIAS_FUTURAS.md`](MELHORIAS_FUTURAS.md)).

## Correções do QA para Tormenta20 (2026-10-20, concluídas)

1. **[Feito]** Criação: o benefício de origem "um poder de combate à sua escolha" abre a escolha do poder ali
   mesmo, abaixo de Poderes únicos.
2. **[Feito]** Subida de nível: "Aumento de Atributo" abre a escolha do atributo e aplica o aumento.
3. **[Feito]** Subida de nível: habilidades com escolha (ex.: Bênção da Justiça: Égide Sagrada ou Montaria
   Sagrada) já permitem escolher a opção.
4. **[Feito]** Condições: duração em rodadas ao aplicar, para o efeito sair sozinho.
5. **[Feito]** Rolagem com seletor de três estados: desvantagem / normal / vantagem.
6. **[Feito]** Poderes e magias: botão para usar na jogada (registrar/rolar).
7. **[Feito]** Inventário mais parecido com o do D&D.
8. **[Feito]** Não mostrar habilidades de níveis ainda não alcançados.

Feito (1, 2, 3 e 8): benefício genérico da origem abre a lista de poderes do grupo (combate,
destino…); "Aumento de Atributo" pede o atributo (+1, um por patamar; Constituição soma +1 PV por
nível); habilidades com "escolha entre X e Y" pedem a opção; poderes que só vêm dessas escolhas
(Égide Sagrada, Montaria Sagrada) saíram da lista de poderes da criação e da subida de nível.
Site e app; testes em `tormenta20/level-up.test.ts`.

Feito (4 a 7): condições com duração em rodadas e botão "Passar rodada" (remove as que acabam);
seletor Desvantagem/Normal/Vantagem nas abas Jogo e Perícias (2d20, maior ou menor); botão
"Usar"/"Lançar" em poderes, habilidades e magias (gasta os PM do custo lido no texto); inventário
com carga em espaços, categorias, equipar, quantidade (+/−) e, no site, adicionar/editar/excluir.
Armas e armaduras novas gravam os espaços do livro. Site e app.

Auditoria em todas as classes e origens do livro (2026-10-20): as 5 origens com poder genérico
(Capanga, Gladiador, Guarda, Soldado: combate; Assistente de Laboratório: Tormenta) abrem a
escolha; "Aumento de Atributo" existe em todas as classes e níveis de poder; habilidades com
escolha cobertas: Paladino (Bênção da Justiça), Cavaleiro (Caminho do Cavaleiro: Bastião ou
Montaria) e Caçador (Explorador: terreno, de novo no 7º, 11º, 15º e 19º pela tabela). A subida de
nível mostra a linha da tabela do nível (Fúria +3, Inspiração +2…). A criação acima do 1º nível
também pede essas escolhas e o atributo de cada Aumento de Atributo. Especialista do Ladino:
a criação pede as perícias treinadas (quantidade = Inteligência, mínimo 1) e a ficha mostra
"Especialista (Atletismo, …)". App: inventário T20 também adiciona e exclui itens. D&D já tinha
"Passar rodada" nas condições (site e app).

### Estado em 2026-10-20 (feito e publicado)

- Tormenta20: marcos 1 a 7 em versão 1 (criação, ficha, subida de nível no site e no app, ameaças
  do livro na biblioteca e no combate). Pendências T20: multiclasse, ataques com armas na ficha,
  cópia de itens mágicos T20, testes no navegador e no aparelho.
- Novo personagem começa pela campanha (ou ficha pessoal com o sistema).
- Atualização OTA do app pelo GitHub Actions (`.github/workflows/ci.yml`) com o segredo
  `EXPO_TOKEN` configurado; funcionando (execuções de 2026-10-20 com sucesso).
- Pacotes dos livros gerados em `C:\Users\henri\Documents\Codexveil\livros-trabalho\out\`
  (fora do Git): `t20-jda`, `phb-2014`, `xgte`, `tcoe`, `mm-2014`, `mpmm`.
- Nada disso foi aberto no navegador nem no celular por Claude.

## Continuidade Tormenta20 (parada em 2026-10-19 à noite, retomar em outra máquina)

Pedido do responsável: implantar o **Tormenta20 completo** (Edição Jogo do Ano), a partir do PDF
`T20.pdf` que ele tem (estava em `C:\Users\JULIO\Videos\T20.pdf`), em 7 marcos, cada um subindo
para a `main`. Regra mantida: o código tem só as regras; o conteúdo do livro vai num pacote
importado em Meus livros (fora do Git), como nos livros de D&D.

### Estado dos marcos

| #   | Marco                                           | Situação                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Extração do livro + núcleo de regras + migração | **Feito** (`8076641`). Migração `20261019120000_tormenta20.sql` aplicada em produção.                                                                                                                                                                                                                                                                                                                                                                        |
| 2   | Campanha T20 + leitor dos livros T20            | **Feito** (`780275a`).                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 3   | Criação de personagem T20 (site)                | **Feito** (2026-10-19, máquina henri): assistente `components/characters/t20-wizard/`, ação `personagens/actions-t20.ts` (revalida com `parseT20Draft` + `t20DraftIssues`). Testado com o pacote real: 14 classes no 1º e no 5º nível sem pendências. Não aberto no navegador.                                                                                                                                                                               |
| 4   | Ficha e jogo T20 (site)                         | **Feito (versão 1)** em 2026-10-19: `components/sheets/t20/sheet-screen.tsx` (ramo `tormenta20` em `character-sheet.tsx`): PV e PM com dano, cura e gasto, descanso pela qualidade, condições T20 com efeitos na ficha, atributos e perícias com rolagem 1d20, poderes, magias (lançar gasta PM), inventário com equipar e história. Falta: turnos e rolagens no mural da sessão, ataques com armas e edição de atributos/perícias. Não aberto no navegador. |
| 5   | Subida de nível T20                             | **Feito** em 2026-10-20: `tormenta20/level-up.ts` (`planT20LevelUp`/`applyT20LevelUp`) e botão na ficha (`sheets/t20/level-up.tsx`): PV e PM do nível, habilidades novas, poder quando a tabela pede e magias novas. Testado com o pacote real (14 classes do 1º ao 6º). Sem multiclasse ainda.                                                                                                                                                              |
| 6   | App (criação, ficha, subida de nível)           | **Feito (versão 1)** em 2026-10-20: `apps/mobile/src/components/t20/` (assistente e ficha com subida de nível); em "Novo personagem" o app escolhe D&D 5e ou Tormenta20 e depois a campanha. O assistente de D&D do app passou a ignorar livros de T20. Não testado no aparelho.                                                                                                                                                                             |
| 7   | Mestre: ameaças no escudo e combate             | **Feito (versão 1)** em 2026-10-20: copiar ameaças T20 do livro para a biblioteca (aba Livros), ficha e editor de ameaça T20 no registro (`components/library/t20-threat.tsx`) e leitura no app. Cena e combate usam Defesa, PV e iniciativa pelo contrato do sistema. Conferido no pacote real: 80 ameaças. Não aberto no navegador.                                                                                                                        |

### Novo personagem: campanha primeiro (2026-10-19)

A página `/personagens/novo` agora começa perguntando **a campanha** (cartões das campanhas em que
a pessoa é jogadora, de D&D ou de Tormenta20) ou **ficha pessoal** com o sistema. Só depois abre o
assistente do sistema, com os livros daquela campanha (ou os importados pelo usuário).

### Como retomar

1. **Arquivos de trabalho (fora do Git):** copie `C:\Users\JULIO\Documents\Codexveil\livros-trabalho\`
   (PDFs, `venv` com PyMuPDF, `layout/T20.jsonl`, `out/t20.json`, `out/t20-jda.book.json`). Sem a
   pasta, gere de novo pelo [`scripts/books/README.md`](../scripts/books/README.md) (item 9).
2. **Pacote T20:** `out/t20-jda.book.json` (raças 17, classes 14, origens 33, deuses 20, poderes
   431, magias 196, equipamento 211, itens mágicos 191, ameaças 80); valida com `parseT20BookPack`
   (0 erros). O responsável importa em Meus livros e libera na campanha T20.
3. **Marco 3 (feito; referência):** criar `apps/web/src/components/characters/t20-wizard/` no
   molde do assistente de D&D (`dnd5e-wizard/`), usando `@codexveil/rpg-systems/tormenta20`:
   `buildT20Content` (conteúdo dos pacotes da campanha/usuário via `loadBookSources`),
   `createT20Draft`, `t20DraftIssues`, `buildT20Character` e os auxiliares (`t20EquipmentOptions`,
   `t20AvailableSpells`, `t20PowerLevels`, `t20PowerOptions`, `t20EligibleDeities`,
   `t20GrantedPowers`, `rollT20Attributes`, `t20Lineages`). Etapas: `T20_STEPS`. A página
   `/personagens/novo` precisa escolher o assistente pelo sistema da campanha (hoje só lista
   campanhas `dnd5e`), e a ação do servidor deve validar com `t20DraftIssues` e criar com
   `createCharacter` (sistema `tormenta20`).
4. **Próximo passo:** os 7 marcos do T20 estão feitos (versão 1). Pendências: multiclasse T20, ataques com armas na ficha, cópia de itens mágicos T20 e testes no navegador e no aparelho. Ficha T20 (feita) em `components/sheets/` (ramo `tormenta20` em `character-sheet.tsx`, usando
   `computeT20Derived`), subida de nível, app e mestre.

### Pendências conhecidas da extração

- Poderes de classe: itens de quadros (familiares do arcanista) são separados por título de quadro;
  conferir no leitor se algum poder ficou faltando em alguma classe.
- Feiticeiro aprende magias só em níveis ímpares (tratado no motor); linhagens vêm da seção
  "Linhagens Sobrenaturais".

### Observação sobre o app (Expo)

Desde 2026-10-19 a atualização OTA sai pelo **GitHub Actions** (`.github/workflows/ci.yml`, mesmo
modelo do FinFlow): `eas update` roda na máquina do GitHub e não usa os minutos de CI/CD do EAS
(que acabaram em outubro). **Falta o responsável criar o segredo `EXPO_TOKEN`** no repositório
(expo.dev → Account settings → Access tokens → criar; GitHub → Settings → Secrets and variables →
Actions → New repository secret `EXPO_TOKEN`). Até lá, o job "App — atualização OTA" falha
avisando, e a OTA pode ser publicada à mão:
`cd apps/mobile && npx eas-cli update --branch preview --platform android --environment preview --message "..."`.

## Continuidade (parada em 2026-10-19, retomar em outra máquina)

Lista pedida pelo responsável em 2026-10-18, **a terminar antes da IA**. Estado de cada item:

| #   | Pedido                                                                                                                           | Situação                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Calendário da criação de sessão no visual do app                                                                                 | **Feito** (site): `components/ui/date-time-field.tsx`, na criação e no editor da sessão. Não aberto no navegador.                                                                                                                                                                                                                                                                                                                                                     |
| 2   | Nomes e descrições de monstros/itens em português, com o nome em inglês pequeno embaixo (busca nas duas línguas)                 | **Feito em 2026-10-20.** Tradução completa (monstros 1.359/1.359 entradas, itens 1.094/1.094 parágrafos), nome em inglês pequeno ao lado, busca nos dois idiomas, cópia para a biblioteca com o nome em português. Descrições das magias seguem em inglês. Antes: Os 330 monstros e 258 itens do SRD estão em inglês (`srd/data/*.json`); falta traduzir nomes e textos e ajustar listas e busca (site e app). Os monstros dos livros importados já vêm em português. |
| 3   | "Muitos e-mails enviados" na recuperação; envio pela Brevo com `codexveil@gmail.com`                                             | **Feito:** SMTP da Brevo ativo e templates em português na produção; o aviso é o limite de 1 min por endereço (mensagem nova). Falta confirmar a chegada e testar pelo app; o limite de 30/h só sobe pelo painel (Authentication → Rate Limits).                                                                                                                                                                                                                      |
| 4   | Raças, classes etc. dos livros liberados aparecendo na criação                                                                   | **Infra pronta e publicada** (Meus livros, leitor, aba Livros, conteúdo na criação e na subida de nível, migração `20261018140000_book_packs.sql` aplicada). **Falta gerar e importar os pacotes** (abaixo) e levar o conteúdo à criação no app.                                                                                                                                                                                                                      |
| 5   | Todos os antecedentes dos livros                                                                                                 | Depende da extração (Livro do Jogador 2014: 13 antecedentes).                                                                                                                                                                                                                                                                                                                                                                                                         |
| 6   | Todas as raças dos livros                                                                                                        | Depende da extração (Monstros do Multiverso: 33 raças no capítulo 1; Livro do Jogador: raças e sub-raças).                                                                                                                                                                                                                                                                                                                                                            |
| 7   | Combate: rolagem de acerto e depois de dano, dano aplicado sozinho, reações do alvo (bloquear, esquivar…) com cálculo automático | **Não iniciado.**                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 8   | Imagens em monstros e NPCs                                                                                                       | **Feito:** prévia no editor do site; envio, troca e remoção no app (tela do registro). Não testado no aparelho.                                                                                                                                                                                                                                                                                                                                                       |
| 9   | Conferir se todos os monstros e itens dos livros estão no site                                                                   | Extração dos monstros feita (abaixo); itens mágicos dos livros ainda não extraídos.                                                                                                                                                                                                                                                                                                                                                                                   |

### Extração dos livros (itens 4, 5, 6 e 9)

Scripts em [`scripts/books/`](../scripts/books/README.md) (só a lógica; nenhum texto dos livros
vai para o repositório). Dados intermediários guardados **fora do Git** em
`C:\Users\henri\Documents\Codexveil\livros-trabalho\` (`layout/` = linhas de cada PDF,
`ddocr/` = OCR do Livro do Jogador, `out/` = monstros extraídos). Para continuar em outra
máquina, copie essa pasta e os PDFs, ou gere tudo de novo pelo README dos scripts.

Feito:

- Layout dos 5 PDFs com texto e OCR das 315 páginas do Livro do Jogador 2014 (`D&D.pdf`, escaneado).
- **Monstros (2026-10-19):** Manual de Monstros 428 blocos, Monstros do Multiverso 261, com nome,
  tipo, CA, PV, deslocamento, atributos, campos, traços, ações, reações, ações lendárias e
  ambientação. Só faltam dados que o próprio livro não tem (Cavalo Marinho e Sapo sem ações;
  Estátua Sagrada sem ND). Atributos ilegíveis no texto do PDF lidos por OCR
  (`ocr_abilities.py`) e o resto corrigido à mão em `out/correcoes.json` (fora do Git).
- **Raças do Multiverso:** 33 (`species.py`; Genasi em quatro variantes), com tipo, tamanho,
  deslocamento, traços e truques.
- **Pacotes montados e validados** (`build_pack.py`): `mm-2014.book.json` (428 monstros + 13
  seções de texto) e `mpmm.book.json` (261 monstros + 33 raças + 186 seções), ambos com 0 erros
  no `parseBookPack`. **Falta o responsável importar** os dois em Meus livros (arquivos em
  `livros-trabalho/out/`). Pendências conhecidas: o Manual de Monstros quase não tem texto fora
  dos blocos (a ambientação vai em cada monstro); resumo do Githyanki é só a frase de abertura;
  "Visão no Escuro" do Genasi da Terra leva texto a mais.

Próximos passos, em ordem:

1. ~~Montar o pacote do **Manual de Monstros** e do **Monstros do Multiverso** e validar com
   `parseBookPack`~~ (**feito em 2026-10-19**; falta o responsável importar em Meus livros).
2. ~~**Livro de Magias**~~ (feito em 2026-10-19: 440 magias; as do Livro do Jogador vão no `phb-2014`).
3. ~~**Xanathar** e **Tasha**~~ (feito em 2026-10-19).
4. ~~**Livro do Jogador 2014**~~: raças, antecedentes, talentos e subclasses feitos em 2026-10-19
   (falta só o texto corrido).
5. Conferir as contagens contra os sumários dos livros (item 9) e, no app, ligar o conteúdo dos
   livros à criação de personagem.
6. Depois: item 2 (tradução do SRD) e item 7 (combate com acerto, dano e reações).
7. Só então: **assistente de IA** (pedido completo na conversa de 2026-10-18: consultivo, sem
   escrita, contexto pelo RLS, proteção contra spoilers; exige chave do provedor no backend).

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
- [x] **Site:** publicado pela integração da Vercel com o GitHub (conferido em 2026-10-18).
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

### 1. Atualização automática do site e do app a cada commit — concluída

Conferido em 2026-10-18 (Claude): cada push em `main` gerou o deploy da Vercel e a atualização
OTA do workflow do EAS (status dos commits no GitHub). O registro abaixo fica como histórico.

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

1. [x] **Você:** e-mail do sistema (`codexveil@gmail.com`), conta na Brevo, remetente
       verificado, chave SMTP e SMTP salvo no painel do Supabase (2026-10-18).
2. [x] **Claude:** templates em português enviados
       (`pnpm exec supabase config push --workdir deploy --project-ref ityfhobhpjzhlkgvjhfb`,
       2026-10-18) e pedido de recuperação de senha aceito pela API.
3. [ ] **Você e Claude:** confirmar a chegada do e-mail, cadastrar uma conta de fora da
       organização e pedir a recuperação de senha pelo app.

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

### 2026-10-23 — assistente de IA (card no menu)

- [x] Card "Assistente" acima do perfil/"Sair" (site), painel de conversa por cima da página,
      streaming, botão copiar e aviso de que a regra do livro vale.
- [x] Rota `/api/assistente` (Google Gemini `gemini-flash-latest`, plano gratuito; trocado do Claude no mesmo dia porque a API da Anthropic não tem plano gratuito), contexto pela rota com o RLS da pessoa.
- [x] Cota de 30 perguntas/dia (migração `20261023120000_assistant_usage.sql`, aplicada); **retirada
      no mesmo dia** a pedido do responsável (só ele e amigos usam).
- [x] Personalidade de "Mestre" de RPG; modelo `gemini-3.1-flash-lite` (~1 s até a primeira palavra;
      o Flash levou 60 s), com `gemini-flash-lite-latest` de reserva. Testado em produção ("oi").
- [x] Mascote **Tomo, o Mestre** (grimório encapuzado, arte do responsável): ícone no card e no
      painel, pose feliz na abertura e pose "?" enquanto responde (`apps/web/public/mestre/*.webp`).
- [ ] Criar `GEMINI_API_KEY` na Vercel (o card só aparece com ela) (chave grátis em aistudio.google.com) e testar uma pergunta real.
- [x] QA: "Escolher do livro" ao adicionar item (site, D&D e T20): catálogo com busca e filtro por
      tipo, do SRD 5.2.1 (D&D, itens e itens mágicos) e dos livros ativos da ficha; preenche o
      formulário (`components/sheets/item-catalog.tsx`). Falta no app.
- [x] QA (loja): o catálogo virou tabela Item | Valor | Qtd. | Total, com filtro pela categoria do livro
      (armas, armaduras, alimentação, alquímicos…) e caixas "Itens disponíveis/indisponíveis" (cabe ou
      não no dinheiro da ficha: PO no D&D, T$ no T20). Preços: livros T20, armaduras e armas do SRD
      (`WEAPON_COST_GP`). Escolher preenche o item com a quantidade; não desconta o dinheiro.
- [x] Caixinha de dados presa à tela (portal no `body`; o `transform` da animação do `<main>` a
      levava para o fim da página) e maior (24rem × 14rem de área de rolagem).
- [x] QA: d100 3D mostrava um dado só (45 aparecia como "70"); agora dado percentual + d10 (40 + 5).
- [x] QA: animação de crítico (20 natural: clarão dourado e "Crítico!") e de falha (1 natural: "Falha
      crítica" tremendo), no site; desligada com movimento reduzido.
- [x] QA: painel do Tomo arrastável pelo cabeçalho.
- [x] Bônus automáticos no D&D (`dnd5e/attack-automation.ts`): ataques com armas do SRD tiram atributo
      (acuidade/distância), proficiência (texto da ficha) e arma mágica +N do item equipado; Estilo de
      Luta Arquearia (+2 acerto) e Duelismo (+2 dano); Crítico Aprimorado do Campeão (19 e 18); botão
      "Fúria" na aba Jogo (só Bárbaro; +2/+3/+4 no dano com Força corpo a corpo; guardado no navegador).
      Dano usa os atributos com itens. Perícias: Pau para Toda Obra (Bardo 2º) e talento Alerta na
      iniciativa. App usa o mesmo cálculo (sem o botão de Fúria). Testes em `attack-automation.test.ts`.
- [x] Dados: resultado (balão, cabeçalho e animação de crítico) só depois que os dados param; animação
      de crítico no acerto pela margem da arma (19–20…); caixinha de dados arrastável (duplo clique
      volta ao canto).
- [x] Ataques do Tormenta20 (`tormenta20/attacks.ts`, card "Ataques" na aba Jogo do site): armas
      equipadas com dano e crítico do livro (ou da descrição "Dano 1d8 · Crítico 19/x3"); Luta/Pontaria
      no acerto, Força no dano corpo a corpo e de arremesso, disparo sem Força; crítico multiplica só os
      dados; Fúria do Bárbaro (+2 ataque e dano corpo a corpo, +1 a cada 5 níveis); Estilo de Disparo
      soma Destreza. Regras conferidas no PDF do Jogo do Ano.
- [x] Limitações dos ataques T20 corrigidas: o pacote do livro grava a empunhadura e a seção da tabela
      de armas (`grip`: leve/uma/duas; `attack`: corpo/distancia; 47 armas). Estilo de Duas Mãos (+5
      dano), Uma Arma (+2 ataque, só com a outra mão livre: sem escudo nem segunda arma) e Arremesso
      (+2 dano) agora somam; arremesso puro usa Pontaria. **Reimportar** o `t20-jda.book.json`.
- [x] App: ataques do Tormenta20 (mesmo cálculo e Fúria) e botão de Fúria no D&D; o app carrega os
      livros T20 também para quem só joga. Vai por OTA.
- [x] Caixinha de dados e painel do Tomo não saem mais da tela ao arrastar (caixinha presa pela base).
- [x] Redesign visual "Grimório Arcano" (site e app; nenhuma aba mudou): paleta violeta/lavanda/
      marfim/quase-preto nos tokens (`packages/ui`, contraste AA/AAA testado: 34 testes), cantos mais
      redondos, botão primário com brilho, item ativo do menu em pílula violeta, estrela na marca.
      Site: painel com boas-vindas e arte do Tomo + cartões de resumo; login/cadastro com o Tomo à
      esquerda; página inicial com o Tomo. App: destaque violeta e banner do Tomo no painel (OTA).
      Ícones do site regenerados; ícone e splash nativos do app ficam para o próximo APK.
      Verificado com capturas do Chrome sem janela (página inicial e login).
- [x] Painel do assistente por cima de tudo (portal no `body`; antes ficava atrás dos cards).
- [x] Mãozinha (cursor) em tudo que é clicável no site: rolagens, abas, botões (`globals.css`).
- [x] Livro T20 exportado: faltam as origens Acólito e Amigo dos Animais, há poderes com " e"
      sobrando ou cortados e perigos classificados como ameaças; corrigido em `scripts/books/t20.py` e `t20_pack.py`
      (35 origens, 433 poderes; só "Golpe Pessoal" segue cortado antes da tabela de efeitos). Reimportar.

### 2026-10-23 — rodada de correções (fichas automáticas, sessão, presença, mapa)

- **Ataques:** acerto, dano e crítico lado a lado (site e app).
- **Aba Sessão:** só a sessão iniciada; sem sessão aberta, nada aparece. "Sessões anteriores"
  guarda para consulta só o que foi liberado (se o mestre ocultar depois, some).
- **Confirmar presença:** em sessões agendadas, o jogador responde "Vou/Não vou" (site e app);
  o mestre vê confirmados, recusas e sem resposta, com nomes. Migração
  `20261023100000_session_attendance.sql` (RLS: cada um só responde por si, só em sessão agendada).
- **Imagem de token do personagem** (Ajustes da ficha, D&D e T20); o mapa usa o token e, sem ele,
  o retrato. Migração `20261023110000_character_token_image.sql`.
- **Mapa:** a etiqueta do arrasto mostra "X m de Y m" e fica vermelha ao passar do deslocamento
  do token (ficha do personagem ou bloco da criatura), sem impedir o movimento. No app, o aviso
  de movimento diz o limite e avisa quando passou.
- **Ficha D&D automática** (`equipment-effects.ts`): CA pela armadura/escudo equipados (Destreza
  conforme o tipo, mágicos +N, Anel/Manto de Proteção, Estilo de Luta Defesa, Defesa sem Armadura
  do bárbaro e do monge, Resiliência Dracônica), deslocamento pela espécie e pela classe
  (Movimento sem Armadura, Movimento Rápido, −3 m em armadura pesada sem a Força exigida) e
  atributos por itens (Manoplas de Força do Ogro, Tiara do Intelecto, Amuleto da Saúde, Cintos de
  Força de Gigante). Combate só leitura, com a explicação de cada valor; a ficha grava a CA e o
  deslocamento calculados para o mestre, o grupo e o mapa verem os mesmos números.
  Proficiências só leitura (criação e subida de nível já gravam) e idiomas num painel de seleção.
- **Ficha T20:** a Defesa segue a armadura e o escudo equipados ("Defesa +N, penalidade P").
- **Auditoria:** teste que cria um personagem para cada classe × espécie × antecedente do SRD e
  confere deslocamento, resistências, perícias do antecedente, vida de 1º nível e CA (passou em
  todas). T20 não auditado assim: o conteúdo vem do livro importado, fora do repositório.
- **IA:** especificação (card no menu, acima do perfil) em `MELHORIAS_FUTURAS.md`.
- Verificado: `pnpm check` e `pnpm build`. Não conferido no navegador nem no aparelho.

### 2026-10-22 — ficha D&D: rolar atributos e crítico/dano das armas

- **Atributos:** clicar (ou tocar, no app) no modificador de um atributo rola o teste dele
  (d20 + modificador), com a penalidade de exaustão e vantagem/desvantagem das condições.
- **Armas:** em "Editar item" (categoria Armas, site) aparece a seção "Ataque", ligada ao ataque
  da ficha pelo nome (cria o ataque se não houver): atributo, proficiência, bônus no acerto, dano,
  tipo de dano, bônus no dano, dano adicional com tipo próprio, alcance, "Crítico com" (20, 19–20,
  18–20…) e dano extra no crítico. No app, os mesmos campos no editor do ataque.
- Em Jogo (e nos turnos), o dano soma o bônus e o adicional, e há o botão "Crítico" (dados
  dobrados + dano extra de crítico), com a faixa de crítico indicada. `attackDamageFormula`,
  `critRangeLabel` e `doubleDice` (rpg-systems, com teste).
- Verificado: `pnpm check` 20/20 e `pnpm build`. Não conferido no navegador.

### 2026-10-21 — criação D&D: comprar armadura e escudo com o ouro inicial (regra oficial)

- Pedido do QA (escolher a armadura). Regra oficial escolhida pelo responsável: no passo
  Equipamento, quando o pacote de classe não traz armadura (o pacote de ouro), aparecem "Comprar
  armadura" e "Comprar escudo" (com "Não comprar"), só com o que a classe tem treino, preço do
  SRD 5.2.1, CA e exigências; o que o ouro não paga fica indisponível. A compra entra no
  inventário e sai do ouro (`ARMOR_COST_GP`, `armorPurchases`). Site e app.
- O QA confirmou que a criação recusada era o que a mensagem detalhada mostrou ("era isso mesmo").
- Verificado: `pnpm check` 20/20 e `pnpm build`, com testes da compra (Paladino, pacote B).

### 2026-10-21 — QA: "tudo certo" na revisão, mas a criação é recusada

- O servidor revalida o rascunho e recusava com "Ainda há escolhas pendentes", sem dizer qual. A
  tela agora mostra cada pendência que o servidor apontou (passo e mensagem), para achar a causa.
  Causa ainda não identificada: o servidor monta o conteúdo dos livros do mesmo jeito que o
  assistente; aguardando a mensagem detalhada do QA.
- A CI falhou uma vez por tempo no teste "todas as classes em todos os níveis" (0,7 s aqui, mais de
  5 s na máquina do GitHub com tudo rodando junto); limite dele subiu para 30 s.

### 2026-10-21 — QA: Humano variante com "aumentam em I"

- O texto do livro importado trazia "aumentam em I" (o PDF trocou o 1 pela letra), e o aumento de
  atributo à escolha não era reconhecido. O leitor das raças passa a aceitar "I", "l" e "um/uma"
  como 1 (teste com o texto exato do QA). Se ainda aparecer "escolhas pendentes" sem campo para
  escolher, falta saber em qual passo (o QA pode ter testado antes da publicação anterior terminar).

### 2026-10-21 — criação D&D: treino em armaduras e escudos junto da maestria

- Na etapa de classe (site e app), cartão "Armaduras e escudos" logo depois de "Maestria em Armas"
  (ou no fim das escolhas, nas classes sem maestria) com o treino da classe e o efeito de usar sem
  treino. Só informativo: pelas regras (SRD 5.2.1), o treino é fixo por classe e não existe
  maestria de armaduras. Verificado: `pnpm check` 20/20 e `pnpm build`.

### 2026-10-21 — raças de livro (2014): bônus de atributo, perícia e talento (QA)

- **Bug do QA:** escolhendo "Humano variante" (livro importado) não apareciam as escolhas que ele
  dá. As raças de livro só traziam esses benefícios em texto, e a criação (regras 2024) não aplicava
  bônus de raça. Agora `parseSpeciesBenefits` lê o texto ("Todos os seus valores… aumentam em 1",
  "Dois valores de habilidade, à sua escolha, aumentam em 1", "Seu valor de Força aumenta em 2",
  "proficiência em uma perícia à sua escolha", "um talento à sua escolha") e a etapa Espécie
  ganha as escolhas (atributos, perícias, talento de origem ou geral), aplicadas na ficha. Vale a
  linhagem escolhida, se ela descreve benefícios; senão, as características da raça. Só para raças
  de livro (as do SRD 5.2.1 seguem com os aumentos do antecedente). Site e app.
- Observação: numa ficha com raça de livro e antecedente de 2024, os dois aumentos se somam.
- Verificado: `pnpm check` 20/20 e `pnpm build`, com testes do leitor e da criação do Humano
  padrão/variante.

### 2026-10-21 — mapa: tela cheia, posições iniciais, mapa segue o turno; ordinais dos livros

- **Ordinais dos livros importados:** a extração do PDF trocava "º" e o artigo "o" por "0" ("atingir
  0 30 nível", "magia de 20 nível"). Corrigido na leitura das entradas dos livros
  (`fixBookOrdinals`, domínio, com testes), o que conserta também os livros já importados, no site
  e no app.
- **Anotação** abre uma janela no estilo do sistema (antes, a caixa do navegador).
- **Tela cheia** do mapa (mestre e jogador) e mapa ocupando a altura da tela; a aba Sessão do
  mestre usa toda a largura.
- **"Entrar oculto"** ao adicionar qualquer token (ligado por padrão enquanto o mapa não está sendo
  mostrado). **Posições iniciais:** ao clicar em "Mostrar aos jogadores", os tokens de personagens
  preparados ocultos aparecem já no lugar marcado.
- **Mapa segue o turno no combate** (opção da campanha, ligada por padrão; migração
  `20261021160000_map_follows_turn.sql`): na vez de um personagem, o mapa onde está o token dele
  passa a ser o mostrado. A troca é feita pela tela do mestre, que precisa estar aberta.
- Proteção contra o mesmo token entrar duas vezes num clique só.
- Verificado: `pnpm check` 20/20 e `pnpm build`. Não testado no navegador com duas contas.

### 2026-10-21 — roteiro "para liberar", mapas por sessão e várias imagens no mapa

- Blocos do roteiro ganham "Para liberar na mesa": só os marcados aparecem em "Lore da sessão"; o
  resto é roteiro só do mestre. Blocos já existentes ficaram marcados (nada sumiu); os novos
  nascem como roteiro. (`session_blocks.revealable`)
- Mapa: ao criar, o mestre escolhe a sessão e o nome; a lista mostra todos os mapas da campanha
  ("Sessão N · título — mapa"), para conferir os cenários de qualquer sessão.
- Várias imagens por mapa (camadas): "Adicionar imagem", ferramenta "Imagem" para arrastar cada
  uma dentro da grade, largura em quadrados, "Trazer para a frente" e "Tirar imagem". A imagem
  antiga virou a primeira camada. (`session_maps.images`; leitura no Storage só das camadas do
  mapa ativo para jogadores.) No app as camadas aparecem com a proporção certa.
- Migração `20261021150000_reveal_flags_map_layers.sql` aplicada. Verificado: `pnpm check` 20/20,
  `pnpm build` e captura no Chrome headless com duas camadas.

### 2026-10-21 — mapa: régua, áreas de magia, névoa automática, desenho e anotações

- **Régua** (mestre e jogadores, site): arrastar de um quadrado a outro mostra metros e quadrados,
  com a regra de diagonal do sistema. Só quem mede vê.
- **Áreas de magia** (círculo, cone e linha; site): arrastar a partir de um canto (a linha, do
  centro do quadrado); o tamanho segue de 1,5 em 1,5 m e os quadrados atingidos (centro dentro
  da forma) ficam destacados. As do mestre ficam gravadas e todos veem (inclusive no app); as
  do jogador são prévia só dele. Cone com largura no fim igual ao comprimento.
- **Névoa que se revela sozinha** (opção do mapa): abre o que os tokens dos jogadores enxergam
  (paredes bloqueiam com a linha de visão ligada; sem ela e sem alcance, 6 quadrados). Calculado
  na tela do mestre, que precisa estar aberta.
- **Desenho livre e anotações** (mestre): cores, apagar, e opção "Só eu vejo" para armadilhas,
  guardada na tabela `session_map_secrets`, que o banco nunca envia aos jogadores. No app, os
  desenhos e anotações públicos aparecem.
- Migração `20261021140000_map_tools.sql` aplicada; teste novo de acesso aos segredos; geometria
  das áreas em `packages/domain/src/combat/map-areas.ts` com testes. Verificado: `pnpm check`
  20/20, `pnpm build` e captura no Chrome headless com as três áreas, desenho e anotações.

### 2026-10-21 — livros do Tormenta20 no app e distância percorrida no mapa

- **Bug: livro de Tormenta20 importado não aparecia no app.** O app lia os livros liberados de
  campanhas T20 com o leitor de regras do D&D, que devolvia "nenhum livro". Agora site e app usam
  `campaignSourcebooks` (pacote `rpg-systems`), que lê os dois sistemas (com teste). Observação:
  numa campanha valem os livros **do mestre** liberados nas regras; os livros do próprio jogador
  valem na ficha pessoal.
- **Distância no mapa:** ao arrastar, etiqueta com a distância até o quadrado de destino; depois de
  qualquer movimento (de qualquer pessoa, pelo tempo real), linha tracejada e "Nome: X m" por 6 s.
  No app, o mesmo rastro e o aviso "Você andou X m". Cálculo `gridDistance` (domínio, com testes):
  D&D 5e conta cada diagonal como 1 quadrado (SRD 5.2.1); Tormenta20 alterna diagonais (1,5 m,
  3 m, 1,5 m…). A distância é a do caminho mais curto entre a origem e o destino.
- Verificado: `pnpm check` 20/20, `pnpm build` e captura do rastro no Chrome headless
  ("Lyra: 7,5 m" para 3 diagonais + 1 reto no T20).

### 2026-10-21 — mapa: correção do "volta e vai de novo", imagem nos tokens e estilos de parede

- **Bug do QA (mudanças voltando):** no editor do mestre, cada mudança cancelava a gravação
  pendente da anterior (que então "voltava"), e respostas antigas da recarga em tempo real
  chegavam depois das novas e sobrescreviam a tela. Agora as mudanças seguidas se somam numa só
  gravação, só a resposta mais recente vale e as recargas esperam as gravações em andamento
  (`use-map-data.ts`: `track`; `map-manager.tsx`: `patchMap`). Não reproduzido no navegador
  (sem acesso a duas contas); a causa foi achada lendo o código.
- **Imagem nos tokens:** o token mostra a imagem enviada pelo mestre ("Imagem do token" no painel
  do token), senão a foto do personagem ou a imagem da criatura (jogador só vê a de criatura
  revelada), senão as iniciais. Migração `20261021130000_token_images.sql` (coluna
  `map_tokens.image_path` e leitura da imagem só de token visível do mapa ativo).
- **Estilos de parede:** pedra, tijolo, ruína, madeira, deserto (arenito), cerca viva, grade de
  ferro (não bloqueia a visão) e invisível (só bloqueia a visão; só o mestre vê). Guardado como
  5º item de cada parede (paredes antigas viram pedra). As paredes agora aparecem desenhadas
  para os jogadores também (no app, em versão simplificada de cores).
- Verificado: `pnpm check` 20/20, `pnpm build` e captura do tabuleiro real no Chrome headless com
  os 8 estilos e um token com imagem.

### 2026-10-21 — mapa: avisos de onde entram os tokens

- No cartão "Mapa da sessão", a área "Adicionar ao mapa" explica de onde vêm os tokens e avisa
  quando não há personagens de jogadores na campanha ou criaturas na biblioteca (antes só
  aparecia o marcador, sem explicação). O mestre não tem token próprio. Verificado: typecheck e lint.

### 2026-10-21 — login com Google (código pronto, aguardando as credenciais)

- Site: "Entrar com Google" e "Criar conta com Google" (retorno por `/auth/confirmar`). App: o
  mesmo botão abre o navegador e volta por `codexveil://google` (cliente em PKCE; tela
  `app/google.tsx`), sem biblioteca nativa nova. Botões escondidos até ligar
  `NEXT_PUBLIC_AUTH_GOOGLE` / `EXPO_PUBLIC_AUTH_GOOGLE`.
- Perfil de conta Google usa o nome do Google (migração `20261021120000_google_signin_profile.sql`,
  aplicada, com teste). `deploy/supabase/config.toml` tem o provedor lendo as chaves de variáveis.
- **Pendente (responsável):** criar o cliente OAuth no Google Cloud e enviar a configuração; passo
  a passo em [`DEPLOY.md`](DEPLOY.md#login-com-google). Até lá a config do Auth **não** foi enviada.
- Também: a tela "Mapa" do app passou a ficar na lista de telas protegidas (só logado).
- Verificado: `pnpm check` 20/20 e `pnpm build`. Fluxo do Google não testado (sem credenciais).

### 2026-10-21 — identidade da ficha D&D com listas de seleção

- Espécie, Antecedente e Alinhamento da ficha D&D deixaram de ser digitáveis: viram listas
  (espécies do SRD com cada linhagem, ex.: "Draconato (Preto (ácido))"; antecedentes do SRD; os 9
  alinhamentos). Uma escolha já gravada que não esteja na lista (ex.: espécie de livro) continua
  como opção. Site (`story-tab.tsx`) e app (`story-section.tsx`). Conferido o mesmo problema no
  resto: a ficha do Tormenta20 já usava listas; o alinhamento do bloco de estatísticas das
  criaturas (site, mestre) também virou lista (com "Sem alinhamento" e "Qualquer alinhamento").
- Verificado: `pnpm check` 20/20 (teste novo das opções). Não conferido no navegador.

### 2026-10-21 — grade, passo 6: mapa no app (jogador)

- Tela "Mapa" no painel da campanha do app (`app/(app)/campanha/[id]/mapa.tsx` e
  `components/map/map-board.tsx`): mapa ativo com imagem, grade, tokens na cor dos dados do dono,
  névoa e linha de visão. Mover: tocar no próprio token e depois no quadrado de destino (arrastar
  conflitaria com a rolagem da tela). Sem dependência nativa nova (`react-native-svg` já existia):
  vai por OTA, sem APK. Mestrar continua só no site.
- Verificado: typecheck e lint do app e `pnpm check`. Não verificado no aparelho.

### 2026-10-21 — grade, passos 3 a 5: mapa no site (mestre e jogador), névoa e linha de visão

- Aba Sessão do mestre: cartão "Mapa da sessão" (`components/map/map-manager.tsx`) para criar
  vários mapas, enviar a imagem (preset `map`, até 3000 px em WebP), ajustar tamanho e posição
  sob a grade de 1,5 m, colunas e linhas, mostrar/esconder as linhas, ativar para os jogadores,
  adicionar tokens (personagens, criaturas da biblioteca — entram ocultas — e marcadores),
  editar token (nome, porte, oculto, alcance da visão) e apagar. Ferramentas: mover, revelar e
  cobrir névoa (arrastando), desenhar e apagar paredes.
- Jogador: o mapa ativo aparece na aba Sessão (`map-view.tsx`), com a névoa opaca e, se o mestre
  ligar, a linha de visão do próprio token (paredes bloqueiam; tokens fora da visão nem aparecem).
  Arrasta só o próprio token (`move_my_token`). Tempo real; conferência a cada 20 s para quando o
  mestre esconde o mapa (o RLS não envia esse aviso).
- Geometria pura e testada em `packages/domain/src/combat/map-geometry.ts` (névoa por células,
  polígono de visão por raios, ponto no polígono).
- Verificado: `pnpm check` 20/20 e `pnpm build`; o tabuleiro real foi renderizado no Chrome
  headless com dados de exemplo (visão do mestre, do jogador com névoa e com linha de visão).
  Não verificado: uso no navegador logado com duas contas (envio de imagem, arrastar, tempo real).
- Teste `acha a arma pelo nome do item` (rpg-systems) ganhou limite de 20 s: falhava de vez em
  quando por tempo com todos os testes rodando juntos.

### 2026-10-21 — grade, passo 2: banco do mapa

- Migração `20261021110000_session_maps.sql` aplicada: `session_maps` (imagem, escala e
  deslocamento, colunas/linhas, linhas visíveis, névoa com áreas reveladas, paredes e linha de
  visão, um mapa ativo por campanha) e `map_tokens` (personagem, criatura ou marcador, posição,
  porte, oculto, alcance da visão). Jogador vê só o mapa ativo e os tokens não ocultos; move só
  o próprio token por `move_my_token` (confere dono, mapa ativo, campanha ativa e limites).
  Imagens em `campaigns/{id}/maps/` (bucket `campaign-media`; jogador lê só a do mapa ativo).
  Realtime nas duas tabelas. Consultas em `packages/database/src/queries/maps.ts`.
- Verificado: 4 testes novos de acesso (`test/rls/maps.test.ts`).

### 2026-10-21 — grade, passo 1: tamanho das criaturas

- `creatures.size` (porte = tamanho do token): obrigatório ao criar NPC/monstro no site, com os
  nomes de cada sistema (D&D: Miúdo…Imenso; T20: Minúsculo…Colossal). D&D edita o porte no bloco
  de estatísticas (gatilho sincroniza); T20 no perfil. Importações (SRD, livros D&D e T20) já
  gravam o porte. Registros antigos receberam o porte do bloco (D&D) ou do texto de tipo (T20).
- Migrações `20261021100000_creature_size.sql` e `20261021100100_creature_size_grants.sql`
  (a segunda libera a coluna nas permissões por coluna; achado pelo teste novo) aplicadas.
- Verificado: `pnpm check` 20/20 (banco 143 testes, com teste novo do porte) e `pnpm build`.

### 2026-10-20 — especificação da grade da sessão

- Decisões do responsável registradas em [`GRID.md`](GRID.md): quadrados de 1,5 m, imagem ajustada
  pelo mestre, vários mapas por sessão, tokens por porte (criação de criaturas passa a pedir o
  tamanho), jogador move só o próprio token (também no app), névoa de guerra e linha de visão
  opcional já na primeira versão. Implementação ainda não começou.

### 2026-10-20 — site e app alinhados (lado do jogador)

- Regra do responsável: **o app é só para jogar; mestrar é só no site.** Controles de sessão,
  liberar trechos, modo da sessão, criação de ações, mesa do mestre e biblioteca do SRD (que já
  é só do mestre no site) não vão para o app.
- App: as ações de combate criadas pelo mestre aparecem no turno do jogador (D&D na lista de
  ações; Tormenta20 como botões, com rolagem), como no site. Vai por OTA.
- Diferença que continua: dados 3D no app (precisa de APK; ver `MELHORIAS_FUTURAS.md`).
- Verificado: `pnpm check`. Não conferido no aparelho.

### 2026-10-20 — cor dos dados por sessão, convite refeito e caixinha de dados

- Cor dos dados vale só para a sessão: iniciar ou encerrar uma sessão apaga as cores (gatilho
  `sessions_reset_dice_colors`); a escolha só aparece com sessão em andamento e dados virtuais.
- 24 cores (lista única em `packages/domain`), e a paleta e o nome do personagem mostram um
  dado d20 desenhado na cor, no lugar da bolinha (site e app).
- Convite: centralizado na página; o próprio convite sai de dentro do envelope (camadas fundo →
  convite → frente), o envelope desce e o convite cresce. Conferido com o componente real
  renderizado no Chrome headless em cada etapa (fechado, aberto, saindo, final). Corrigido também
  o convite que ficava invisível se a medida não chegasse (ex.: "reduzir movimento").
- Caixinha de dados: resultado num balão logo acima dela (sai o aviso do topo), canvas 3D preso
  à área (esticava a caixinha e escondia a borda de baixo), rolagens dos outros em tempo real e
  marcador de cadeado nas rolagens "Apenas eu e o mestre" (o servidor já não as envia aos outros).
- Verificado: `pnpm check` 20/20 (banco 142 testes; um teste de condições falhou uma vez por
  tempo e passou ao repetir) e `pnpm build`. A caixinha não foi conferida no navegador real.

### 2026-10-20 — convite como carta que abre

- Ao abrir um convite (código ou link), um envelope com o selo do Codexveil aparece, a aba abre,
  a carta com as informações da campanha sobe e o envelope some (site: CSS em `globals.css`,
  página `convite/[codigo]`; app: `components/invite-letter.tsx`, por OTA). Com "reduzir
  movimento", a carta aparece direto.
- Correção no mesmo dia: a primeira versão do site ficava sobreposta e descentralizada. Refeita
  como componente com etapas (`convite/[codigo]/invite-letter.tsx`): envelope centralizado, selo
  some, aba abre, carta de pergaminho sai de dentro, envelope some e o convite aparece.
  Conferido por capturas no Chrome headless (envelope fechado, aberto, final e largura de 360 px).
  A versão do app não foi conferida no aparelho.

### 2026-10-20 — cor dos dados obrigatória e nome colorido

- Sem cor escolhida ninguém rola dado (gatilho `dice_rolls_require_color`, erro `CVCOR`); o
  mestre escolhe primeiro; cada cor é de uma só pessoa da mesa.
- Site: faixa obrigatória no topo da campanha, paleta com cores já usadas desativadas e nome do
  personagem com bolinha e sublinhado na cor do dono (grupo, mesa do mestre, combate, turnos).
- App (vai por OTA, sem APK): cartão de cor no painel da campanha e na tela de dados; bolinha da
  cor na ordem dos turnos.
- Os avisos de resultado subiram para o topo da tela para não cobrir a caixinha de dados 3D.
- Verificado: `pnpm check` 20/20 (banco 141 testes, com teste novo da regra); migração aplicada.
  Não verificado no navegador nem no aparelho.

### 2026-10-20 — dados 3D no site com cor por jogador

- Caixinha recolhível no canto com dados 3D (`components/dice/dice-tray.tsx`) no lugar da
  animação 2D do meio da tela; o dado para no valor sorteado pelo servidor; até 6 dados 3D por
  rolagem; respeita "reduzir movimento".
- Cada participante escolhe a cor dos dados na campanha (RPC `set_my_dice_color`); a mesa vê os
  dados de cada um na cor do dono, em tempo real.
- App: fica para um APK futuro (`MELHORIAS_FUTURAS.md`).
- Verificado: `pnpm check` 20/20; migração aplicada em produção. Não verificado no navegador
  com duas contas.

### 2026-10-20 — Ações de combate personalizadas

- Configurações da campanha: o mestre cria ações (nome, tipo, descrição, dado opcional). Elas
  aparecem na lista "O que fazer" do turno (D&D) e como botões no cartão de turno (T20), e ficam
  registradas nas ações do turno. Migração `20261020150000_custom_actions.sql` aplicada.
  `pnpm check` 20/20.

### 2026-10-20 — Aba Sessão do mestre, biblioteca por sistema e combate só com turnos

- Aba Sessão: o mestre vê a sessão em andamento (ou a próxima, mesmo não publicada) com o painel
  "Lore da sessão" e o botão Liberar/Ocultar por trecho, e abaixo o que os jogadores veem.
- Biblioteca: em campanhas que não são de D&D, as abas do SRD somem (e as páginas dão 404); entra
  o atalho "Ameaças e itens dos livros".
- Combate do mestre: sem registrar ação, alvo ou rolagem pelo painel; só modo, ordem e passar o
  turno. `pnpm check` 20/20.

### 2026-10-20 — Descrição dos benefícios de origem

- Cada benefício mostra uma linha: perícia com resumo de para que serve (escrito pelo projeto,
  `t20SkillSummaries`), poder com o texto do livro. Site e app. `pnpm check` 20/20.

### 2026-10-20 — Poderes com perícia à escolha e perícias já treinadas

- Regra geral pelo texto do poder: "treinado em uma/duas perícias a sua escolha" e "Escolha uma
  perícia" (Treinamento em Perícia, Foco em Perícia, Conhecimento Enciclopédico, Educação
  Privilegiada) pedem as perícias na subida de nível e na criação; poderes repetíveis aparecem de
  novo. Perícias já treinadas aparecem com "✓ … · já treinada" e destaque. Site e app; teste novo
  em `level-up.test.ts`. `pnpm check` 20/20.

### 2026-10-20 — Sessão presencial ou online

- Sessão (nova e editor): tipo Presencial (dados virtuais ou físicos) ou Online (dados virtuais
  sempre). Com dados físicos, a ficha (site) troca os botões de rolar por "🎲 1d20+5" e o painel de
  dados avisa para rolar na mesa; no T20, o clique diz que dado rolar. Migração
  `20261020140000_session_mode.sql` aplicada (CHECK: online nunca usa dados físicos).
  `pnpm check` 20/20. O app ainda não troca os botões pela indicação.

### 2026-10-20 — Tradução do SRD

- Monstros e itens mágicos do SRD 5.2.1 em português (motor de regras + dicionários em
  `scripts/srd/`), com o nome em inglês ao lado e busca nos dois idiomas. Testes em
  `srd/catalog.test.ts` garantem que nenhum texto ficou em inglês. `pnpm check` 20/20.

### 2026-10-20 — Excluir personagem

- Ficha T20 no site (aba Personagem) e app (D&D na aba Personagem, T20 na aba Evolução) ganham
  "Excluir personagem" para o dono, com confirmação. `pnpm check` 20/20.

### 2026-10-20 — Lacunas do Tormenta20

- Ficha T20 (site e app) com cartão de turno na campanha: vez, ordem e "Encerrar turno" (tira 1
  rodada das condições). "Usar"/"Lançar" rola o dado do texto (vai ao mural na campanha) e, na vez
  do personagem, registra nas ações do turno. App: editar item do inventário T20. `pnpm check` 20/20.

### 2026-10-20 — Subida de nível só na aba Evolução, liberada pelo mestre

- D&D e Tormenta20, site e app: o botão de subir de nível saiu da aba Personagem (e do cabeçalho
  do T20) e ficou só na aba Evolução (nova no app e no T20 do site). Na campanha, o mestre clica
  em "Liberar nível N" e o jogador escolhe as melhorias; fora de campanha, nada muda. Migração
  `20261020130000_level_grants.sql` aplicada em produção (dry-run conferido). `pnpm check` 20/20;
  3 testes de banco novos. Sem teste no navegador nem no aparelho.

### 2026-10-20 — Pendências da auditoria

- Especialista do Ladino na criação (site e app); adicionar/excluir itens do T20 no app.
  `pnpm check` 20/20.

### 2026-10-20 — QA do Tormenta20 (auditoria geral)

- Correções aplicadas a todas as classes e origens, não só ao Paladino: Cavaleiro e Caçador,
  repetição de habilidades pela tabela e escolhas na criação acima do 1º nível. `pnpm check` 20/20.

### 2026-10-20 — QA do Tormenta20 (parte 2)

- Itens 4 a 7 do QA (condições com rodadas, rolagem em 3 estados, usar poder/magia, inventário).
  `pnpm check` 20/20; sem teste no navegador nem no aparelho.

### 2026-10-20 — QA do Tormenta20 (parte 1)

- Itens 1, 2, 3 e 8 da lista do QA. Relatório [`MELHORIAS_FUTURAS.md`](MELHORIAS_FUTURAS.md) criado
  (dado 3D e Behind the Magic). `pnpm check` 20/20 (rpg-systems 179 testes).

### 2026-10-20 — Itens 6 a 10

- Selo do sistema nos livros, ícones das raças, "+1 nos três" consertado, abas conferidas e prompt
  de imagem do personagem. A ficha de Tormenta20 passou a usar o mesmo rolador (dado animado e,
  na campanha, mural). `pnpm check` 20/20; sem teste no navegador nem no aparelho.

### 2026-10-20 — Dados realistas

- Animação de dados na tela inteira (site: CSS; app: Reanimated + SVG, sem dependência nativa
  nova). Limite de 6 dados animados. `pnpm check` 20/20; sem teste visual.

### 2026-10-20 — Aba Sessão

- Lore oculta por padrão, liberação com um clique na mesa e aba Sessão em tempo real (site); app
  atualiza a leitura sozinho. Migração `20261020120000_session_reveal.sql` (dry-run conferido e
  aplicada em produção). `pnpm check` 20/20.

### 2026-10-20 — Combate roleplay

- Ficha de D&D (site e app): sem escolha de alvo; após o ataque, o mestre diz se acertou e o
  jogador rola o dano (só no mural) ou fecha. `pnpm check` passou (20/20 tarefas).

### 2026-10-19 — Tormenta20: campanha e leitor do livro (marco 2 de 7)

- Nova campanha: o sistema Tormenta20 aparece na escolha; regras da campanha T20 (nível inicial,
  métodos de atributos e livros T20 importados a liberar).
- Meus livros e o leitor mostram livros de Tormenta20: abas por tipo (raças, classes, origens,
  divindades, poderes, magias, equipamento, itens mágicos, ameaças) com busca e uma tela própria
  para cada tipo (`t20-entry-view.tsx`); jogadores leem o conteúdo de personagem, o mestre lê tudo.
- `pnpm check` passou; não aberto no navegador.

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

### 2026-10-19 — idiomas das raças e antecedentes dos livros de 2014

- Raças com o traço "Idiomas" (Livro do Jogador 2014) dão os próprios idiomas no lugar dos dois
  padrão da origem (Anão: Comum e Anão; Meio-Elfo e Humano: mais um à escolha; Alto Elfo: mais um
  pela sub-raça). Antecedentes com "Um/Dois à sua escolha" dão escolhas extras, inclusive idiomas
  raros (menos Druídico e Gíria de Ladrão). Raças sem esse traço (SRD, Multiverso) seguem a regra
  de 2024. Lido do texto já importado (`languages-text.ts`, com teste); não precisa reimportar.
- Conferido com o pacote real: Anão+Acólito, Alto Elfo+Soldado, Humano+Sábio e Golias+Nobre.
  `pnpm check` passou; não aberto no navegador nem no aparelho.

### 2026-10-19 — ícones dos antecedentes e resumos corrigidos

- Antecedentes com ícone (game-icons.net, CC BY 3.0) no site e no app; antecedentes sem ícone
  próprio usam um genérico.
- Resumos de Herói do Povo e Nobre (Livro do Jogador) corrigidos: começam no título do
  antecedente, sem a tabela do anterior. É preciso reimportar `phb-2014.book.json`.
- Classes: com os 5 livros, a única classe nova é o Artífice (as demais são as 12 do SRD); os
  livros acrescentam subclasses.

### 2026-10-19 — nomes em inglês e busca nos dois idiomas

- Criação de personagem (site e app): classes e raças com o nome em português em destaque e o
  original em inglês pequeno ao lado (Golias · Goliath, Tiferino · Tiefling); busca nas etapas
  Classe e Espécie aceita os dois idiomas, sem acento (`names-en.ts`, com teste).
- `pnpm check` passou; não aberto no navegador nem no aparelho.

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

### 2026-10-19 — pendências dos livros resolvidas

- Livro do Jogador: 41 subclasses fora do SRD (o OCR lê "3° nível" como "30 nível"; corrigido) e
  resumo das raças tirado da descrição, não do conto de abertura.
- Xanathar: Domínio da Sepultura (31 de 31 subclasses), classes das 85 magias pelas listas do
  capítulo 3 (todas com classe) e 47 itens mágicos comuns.
- Com os cinco livros, a criação lista 13 classes com 8 a 13 subclasses cada (Artífice, 4), 51
  raças e 17 antecedentes; todos os pacotes com 0 erros no `parseBookPack`.

### 2026-10-19 — livros de personagem e criação no app

- Pacotes por livro oficial (o id é o da campanha, então marcar o livro libera o conteúdo na
  criação): `phb-2014` (350 magias do compêndio "Livro de Magias", 9 raças com sub-raças, 13
  antecedentes, 42 talentos), `xgte` (30 subclasses, 85 magias, 15 talentos raciais), `tcoe`
  (classe Artífice com lista de magias, 30 subclasses, 21 magias, 15 talentos, 47 itens mágicos),
  além de `mm-2014` e `mpmm`. Todos com 0 erros no `parseBookPack`; com os cinco liberados, a
  criação lista 13 classes, 51 raças e 17 antecedentes (teste com o conteúdo real, fora do Git).
- App: a criação de personagem passou a usar os livros liberados na campanha (ou os do usuário,
  na ficha pessoal), como o site: classes, subclasses, raças, antecedentes, talentos e magias.
  Typecheck e `pnpm check` passaram; não testado no aparelho.
- Limitações: Xanathar é PDF escaneado (OCR): falta o Domínio da Sepultura e 46 magias do
  Xanathar sem par no compêndio ficaram sem lista de classe; resumos das raças do Livro do
  Jogador vêm do conto de abertura; o Livro do Jogador não traz as subclasses fora do SRD.

### 2026-10-19 — pacotes dos livros de monstros e "Selecionar todos"

- Pacotes do Manual de Monstros e do Monstros do Multiverso gerados e validados (veja
  "Continuidade"); scripts novos `species.py`, `ocr_abilities.py` e `build_pack.py`.
- Escolha de livros da campanha: opção "Selecionar todos" em cada grupo (site, caixa de seleção;
  app, botão "Selecionar todos"/"Desmarcar todos"). Lint e typecheck do site e do app passaram;
  não aberto no navegador nem no aparelho.

### 2026-10-18 — livros importados retomados (a pedido)

- **Decisão do responsável:** retomar a importação dos livros que ele tem para a conta dele
  (o trabalho guardado no `git stash` foi aplicado e combinado com a multiclasse e os livros da
  ficha feitos depois).
- **Banco:** migração `20261018140000_book_packs.sql` aplicada na produção (`book_packs` e
  `book_entries`, com RLS por dono e por campanha que liberou o livro).
- **Site:** página **Meus livros** (`/livros`: importar o pacote `.json`, ver e remover), leitor do
  livro (texto por capítulo e cada tipo de conteúdo, com busca), aba **Livros** na campanha (com
  cópia de monstros e itens para a biblioteca pelo mestre) e a escolha dos livros (campanha e ficha
  pessoal) mostrando primeiro os livros importados, com o que cada um traz.
- **Regras:** espécies, classes, subclasses, antecedentes, talentos e magias dos livros liberados
  aparecem na criação de personagem e na subida de nível (inclusive multiclasse em classe de livro).
- **Falta:** gerar os pacotes dos livros do responsável (extração dos PDFs) e o app (criação no
  celular ainda usa só o SRD).

### 2026-10-18 — calendário da sessão, imagens de NPCs e monstros e aviso de e-mail

- **Data da sessão** (criar sessão e editor): calendário próprio no visual do Codexveil
  (`components/ui/date-time-field.tsx`) no lugar do `datetime-local` do navegador; o valor continua
  no formato `AAAA-MM-DDTHH:mm`.
- **Imagens de NPCs e monstros:** no site, o editor do registro mostra a imagem atual ao lado do
  botão de envio; no app, o mestre envia, troca ou remove a imagem na tela do registro (mesmo
  componente da capa da campanha, preset `creature`).
- **"Muitos e-mails enviados":** é o intervalo de 1 minuto por endereço (e 30 e-mails por hora no
  projeto) do Supabase. A mensagem agora diz para aguardar 1 minuto e olhar o spam. O limite por
  hora não é gerenciado pelo `config push`; se precisar, aumente no painel (Authentication → Rate
  Limits). Recuperação de senha testada de novo pela API: envio aceito pela Brevo.

Verificações: `pnpm check` 20/20. Não aberto no navegador nem no celular.

### 2026-10-18 — SMTP próprio (Brevo) e e-mails em português

- SMTP salvo no painel do Supabase pelo responsável: Brevo (`smtp-relay.brevo.com:587`),
  remetente `Codexveil <codexveil@gmail.com>`. Conferido pelo `config diff`.
- Templates de confirmação, recuperação e troca de e-mail enviados à produção pelo `config push`.
  A CLI nova recusa `content_path` fora da pasta `deploy`, então os templates foram copiados para
  `deploy/supabase/templates/`.
- Teste: pedido de recuperação de senha pela API pública. A primeira tentativa falhou (senha do
  SMTP errada no painel); depois da correção, o Supabase aceitou o envio. Chegada na caixa de
  entrada ainda não confirmada.
- A importação dos livros do usuário para o banco foi interrompida e guardada num `git stash`
  ("livros importados no Supabase (descartado a pedido em 2026-10-18)"); nada dela foi publicado.

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

### 2026-10-18 — conferência da publicação e da documentação

- Banco de produção em dia: `supabase db push --dry-run` não lista nada pendente (14 migrações).
- Deploy automático funcionando: os quatro commits do dia publicaram o site (Vercel) e o app
  (OTA do workflow do EAS; nenhum APK novo, porque o código nativo não mudou).
- Teste ao vivo da API contra o banco real: 11/11.
- Documentação de estado corrigida: APK atual `e02e7079` no README e aqui, deploy automático
  dado como ligado (DEPLOY, PENDENCIAS, PROGRESS), decisões de livros, arte oficial e classes na
  ARCHITECTURE, `sourcebooks` e capa na DATABASE, envio da capa pela Server Action na SECURITY.
