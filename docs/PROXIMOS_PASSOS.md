# Próximos passos

> Relatório atualizado em **2026-10-18**. Mantenha este arquivo em dia a cada etapa concluída
> (veja [Como manter a documentação](#como-manter-a-documentação)). O inventário completo do
> que falta em relação ao escopo inicial está em [`PENDENCIAS.md`](PENDENCIAS.md), e os
> procedimentos de publicação em [`DEPLOY.md`](DEPLOY.md).

## Onde estamos

| Área        | Situação                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Site        | **No ar** em <https://codexveil.vercel.app> (Vercel, projeto `codexveil`), **publicado sozinho a cada push em `main`** pela integração com o GitHub. Conferido em 2026-10-18: os quatro commits do dia aparecem como "Deployment has completed" no GitHub.                                                                                                                                                                                                                                                                              |
| Backend     | **No ar:** Supabase `CODEXVEIL` (`ityfhobhpjzhlkgvjhfb`, us-east-2), com as **15 migrações aplicadas** (a `20261018140000_book_packs.sql` em 2026-10-18), Site URL e Redirect URLs (`deploy/supabase/config.toml`).                                                                                                                                                                                                                                                                                                                     |
| App Android | **APK atual:** [download](https://expo.dev/artifacts/eas/m0Px-_WnwK0q8a6BOSANOEa1oIJUvajr8DDOeJ279Sk.apk) ([build `e02e7079`](https://expo.dev/accounts/gabriel.xxtth/projects/codexveil/builds/e02e7079-2f5c-4da6-b225-2e78522d084a), 2026-10-17, com notificações e imagens). Cada push publica uma **atualização OTA** pelo workflow do EAS (conferido em 2026-10-18); APKs anteriores (`420f6c37`, `de6ceb5c`) não recebem mais atualizações. Todos os builds: <https://expo.dev/accounts/gabriel.xxtth/projects/codexveil/builds>. |
| Validação   | Teste ao vivo da API contra o banco real: **11/11 em 2026-10-18** (também 10/10 em 2026-10-16 e 11/11 em 2026-10-17). `pnpm check` 20/20 e `pnpm build` 2/2 em 2026-10-18. **Ninguém usou ainda as telas com duas contas**, e as telas de 2026-10-18 (capa, multiclasse, talentos, livros, dados por sessão) não foram abertas no navegador nem no celular.                                                                                                                                                                             |
| E-mail      | **SMTP próprio ligado em 2026-10-18:** Brevo, remetente `codexveil@gmail.com`, templates em português enviados. Um e-mail de recuperação de senha foi aceito pelo Supabase; falta confirmar a chegada na caixa de entrada e testar o cadastro com uma conta de fora da organização e a recuperação pelo app.                                                                                                                                                                                                                            |

### Limitações do período sem SMTP próprio (até 2026-10-18; confirmar se sumiram)

- Os e-mails de confirmação e de recuperação só chegam a **membros da organização CODEXVEIL**
  no Supabase. Para testar com duas contas, convide o segundo e-mail para a organização ou use
  e-mails que já sejam membros.
- No site, a confirmação e a recuperação de senha só funcionam se o link for aberto **no mesmo
  navegador** em que o pedido foi feito.
- A **recuperação de senha pedida pelo app não funciona**.

## Continuidade Tormenta20 (parada em 2026-10-19 à noite, retomar em outra máquina)

Pedido do responsável: implantar o **Tormenta20 completo** (Edição Jogo do Ano), a partir do PDF
`T20.pdf` que ele tem (estava em `C:\Users\JULIO\Videos\T20.pdf`), em 7 marcos, cada um subindo
para a `main`. Regra mantida: o código tem só as regras; o conteúdo do livro vai num pacote
importado em Meus livros (fora do Git), como nos livros de D&D.

### Estado dos marcos

| #   | Marco                                           | Situação                                                                                                                    |
| --- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 1   | Extração do livro + núcleo de regras + migração | **Feito** (`8076641`). Migração `20261019120000_tormenta20.sql` aplicada em produção.                                       |
| 2   | Campanha T20 + leitor dos livros T20            | **Feito** (`780275a`).                                                                                                      |
| 3   | Criação de personagem T20 (site)                | **Em andamento**: motor pronto e testado (`tormenta20/content.ts` e `creation.ts`); **falta a tela** do assistente no site. |
| 4   | Ficha e jogo T20 (site)                         | Não iniciado.                                                                                                               |
| 5   | Subida de nível T20                             | Não iniciado.                                                                                                               |
| 6   | App (criação, ficha, subida de nível)           | Não iniciado.                                                                                                               |
| 7   | Mestre: ameaças no escudo e combate             | Não iniciado.                                                                                                               |

### Como retomar

1. **Arquivos de trabalho (fora do Git):** copie `C:\Users\JULIO\Documents\Codexveil\livros-trabalho\`
   (PDFs, `venv` com PyMuPDF, `layout/T20.jsonl`, `out/t20.json`, `out/t20-jda.book.json`). Sem a
   pasta, gere de novo pelo [`scripts/books/README.md`](../scripts/books/README.md) (item 9).
2. **Pacote T20:** `out/t20-jda.book.json` (raças 17, classes 14, origens 33, deuses 20, poderes
   431, magias 196, equipamento 211, itens mágicos 191, ameaças 80); valida com `parseT20BookPack`
   (0 erros). O responsável importa em Meus livros e libera na campanha T20.
3. **Marco 3, próximo passo exato:** criar `apps/web/src/components/characters/t20-wizard/` no
   molde do assistente de D&D (`dnd5e-wizard/`), usando `@codexveil/rpg-systems/tormenta20`:
   `buildT20Content` (conteúdo dos pacotes da campanha/usuário via `loadBookSources`),
   `createT20Draft`, `t20DraftIssues`, `buildT20Character` e os auxiliares (`t20EquipmentOptions`,
   `t20AvailableSpells`, `t20PowerLevels`, `t20PowerOptions`, `t20EligibleDeities`,
   `t20GrantedPowers`, `rollT20Attributes`, `t20Lineages`). Etapas: `T20_STEPS`. A página
   `/personagens/novo` precisa escolher o assistente pelo sistema da campanha (hoje só lista
   campanhas `dnd5e`), e a ação do servidor deve validar com `t20DraftIssues` e criar com
   `createCharacter` (sistema `tormenta20`).
4. **Depois:** ficha T20 em `components/sheets/` (ramo `tormenta20` em `character-sheet.tsx`, usando
   `computeT20Derived`), subida de nível, app e mestre.

### Pendências conhecidas da extração

- Poderes de classe: itens de quadros (familiares do arcanista) são separados por título de quadro;
  conferir no leitor se algum poder ficou faltando em alguma classe.
- Feiticeiro aprende magias só em níveis ímpares (tratado no motor); linhagens vêm da seção
  "Linhagens Sobrenaturais".

### Observação sobre o app (Expo)

O plano gratuito do EAS esgotou os 60 minutos de CI/CD do mês (volta em 2026-11-01): o workflow
"Atualizar app" falha ao começar. Até lá, para o app receber atualizações, publique a OTA
manualmente na máquina (não usa minutos de CI): `cd apps/mobile && npx eas-cli update --branch preview --message "..."`.

## Continuidade (parada em 2026-10-19, retomar em outra máquina)

Lista pedida pelo responsável em 2026-10-18, **a terminar antes da IA**. Estado de cada item:

| #   | Pedido                                                                                                                           | Situação                                                                                                                                                                                                                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Calendário da criação de sessão no visual do app                                                                                 | **Feito** (site): `components/ui/date-time-field.tsx`, na criação e no editor da sessão. Não aberto no navegador.                                                                                                                                |
| 2   | Nomes e descrições de monstros/itens em português, com o nome em inglês pequeno embaixo (busca nas duas línguas)                 | **Não iniciado.** Os 330 monstros e 258 itens do SRD estão em inglês (`srd/data/*.json`); falta traduzir nomes e textos e ajustar listas e busca (site e app). Os monstros dos livros importados já vêm em português.                            |
| 3   | "Muitos e-mails enviados" na recuperação; envio pela Brevo com `codexveil@gmail.com`                                             | **Feito:** SMTP da Brevo ativo e templates em português na produção; o aviso é o limite de 1 min por endereço (mensagem nova). Falta confirmar a chegada e testar pelo app; o limite de 30/h só sobe pelo painel (Authentication → Rate Limits). |
| 4   | Raças, classes etc. dos livros liberados aparecendo na criação                                                                   | **Infra pronta e publicada** (Meus livros, leitor, aba Livros, conteúdo na criação e na subida de nível, migração `20261018140000_book_packs.sql` aplicada). **Falta gerar e importar os pacotes** (abaixo) e levar o conteúdo à criação no app. |
| 5   | Todos os antecedentes dos livros                                                                                                 | Depende da extração (Livro do Jogador 2014: 13 antecedentes).                                                                                                                                                                                    |
| 6   | Todas as raças dos livros                                                                                                        | Depende da extração (Monstros do Multiverso: 33 raças no capítulo 1; Livro do Jogador: raças e sub-raças).                                                                                                                                       |
| 7   | Combate: rolagem de acerto e depois de dano, dano aplicado sozinho, reações do alvo (bloquear, esquivar…) com cálculo automático | **Não iniciado.**                                                                                                                                                                                                                                |
| 8   | Imagens em monstros e NPCs                                                                                                       | **Feito:** prévia no editor do site; envio, troca e remoção no app (tela do registro). Não testado no aparelho.                                                                                                                                  |
| 9   | Conferir se todos os monstros e itens dos livros estão no site                                                                   | Extração dos monstros feita (abaixo); itens mágicos dos livros ainda não extraídos.                                                                                                                                                              |

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
