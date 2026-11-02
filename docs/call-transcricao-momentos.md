# Call, transcrição da sessão e Melhores Momentos

Funcionalidade pedida em 2026-11-01. Regra do responsável: **só opções gratuitas**, sem gasto
direto. Onde um serviço seria pago (imagens), o Codexveil entrega o prompt pronto para a IA de
preferência de cada um.

| Fase | O quê                                                  | Situação                                       |
| ---- | ------------------------------------------------------ | ---------------------------------------------- |
| 1    | Call de voz e vídeo (LiveKit)                          | código feito; migração aplicada; **escondida** |
| 2    | Transcrição ao vivo por personagem                     | código feito; migração aplicada; **escondida** |
| 3    | Melhores Momentos (análise por IA e prompts de imagem) | código feito; migração aplicada; **escondida** |

## Onde parou (atualizado em 2026-11-02)

Pedido do responsável: parar aqui e **não liberar em produção** enquanto não estiver testado.

- **Escondido por chave**: `CALLS_ENABLED=1` foi ligado **somente em Preview** na Vercel em
  2026-11-02. Production continua desligada. O app continua desligado até ligar
  `EXPO_PUBLIC_CALLS_ENABLED=1` num APK novo. Sem as chaves do LiveKit e sem um novo deploy de
  Preview, ainda não há uma sala utilizável.
- **Chaves**: em Production tudo fica fora do site e do app até ligar `CALLS_ENABLED=1` (Vercel)
  e `EXPO_PUBLIC_CALLS_ENABLED=1` (app; vai no próximo build/OTA). Desligado, somem a aba Call, o
  aviso de convite, a aba Momentos, a galeria da sessão, a aba Transcrição do editor e as rotas
  `/api/call/token` e `/api/sessoes/momentos` respondem 404.
- **Banco**: as três migrações das fases e as correções `20261102110000`–`20261102120000` estão
  aplicadas em produção. O `db push` de 2026-11-02 aplicou somente essas duas correções.
- **APK**: o de 2026-11-01 19:15 UTC (`f6EiER5f…apk`) já tem o LiveKit; **não** tem o módulo de
  transcrição do celular (`expo-speech-recognition`), que exige o próximo APK.
  A preparação de 2026-11-02 deixou plugin e permissões conferidos, `expo-doctor` 21/21 e
  fingerprint Android local `25c309628a10712c7d7e692cb90398c97749e5b6`; **nenhum build foi
  executado**. Entram nesse fingerprint o módulo de fala, suas permissões e os patches `expo`
  57.0.31, `expo-notifications` 57.0.24 e `expo-router` 57.0.29.
- **Revisão antes do teste**: `20261102110000_call_security_hardening.sql` restringe
  participantes/transcrição a quem foi
  aprovado, impede convidados/recusados de convidar terceiros, protege a troca de sessão da sala e
  deriva a campanha dos registros de uso dos Momentos. O app agora distingue o dono real de outro
  mestre. `20261102120000_highlight_generation_lock.sql` garante uma geração por sessão e libera
  locks abandonados após três minutos. A regeneração preserva cartões anteriores se uma gravação
  falhar e nunca apaga cartões da IA que receberam imagem ou edição do mestre.
- **Nada foi testado ao vivo** (sem as chaves do LiveKit). Para continuar:
  1. Criar o projeto grátis no LiveKit Cloud e pôr `LIVEKIT_URL`, `LIVEKIT_API_KEY` e
     `LIVEKIT_API_SECRET` na Vercel.
  2. ~~Aplicar as duas migrações pendentes~~ (feito; ver acima).
  3. ~~Aplicar as migrações de endurecimento e lock~~ (feito em 2026-11-02).
  4. Conferir as três chaves do LiveKit em Preview e criar um novo deploy de Preview.
  5. Executar o roteiro abaixo.
  6. Gerar o APK com a transcrição do celular e testar o conflito de microfone com a call.
  7. Com tudo certo, ligar as chaves em produção.

## Roteiro do teste em Preview

Use duas contas de teste e apague as salas/dados criados ao terminar. A Preview usa o mesmo projeto
Supabase configurado no site; portanto, o recurso fica escondido dos usuários de Production, mas os
registros de teste ainda são gravados no banco real.

1. Confirmar no painel da Vercel que `CALLS_ENABLED=1`, `LIVEKIT_URL`, `LIVEKIT_API_KEY` e
   `LIVEKIT_API_SECRET` estão marcadas apenas para **Preview**; criar um novo deploy de Preview.
2. Criar uma sala **aberta** vinculada a campanha e sessão; entrar com a segunda conta por link e
   por código; conferir mestre, personagem, áudio, câmera, troca de câmera e saída/reentrada.
3. Criar uma sala **só para convidados**; confirmar que a segunda conta não entra antes do convite,
   entra depois dele e que uma pessoa apenas convidada não vê participantes nem convida terceiros.
4. Criar uma sala com **sala de espera**; aprovar e recusar entradas; confirmar que só o dono vê os
   controles e que a pessoa recusada não recebe token nem lê participantes/transcrição.
5. No Chrome e no Edge, ligar **Gravar transcrição**, pausar/retomar a própria voz, conferir rótulos
   de personagem/Mestre, correção pelo mestre e atualização em tempo real. Confirmar a mensagem de
   incompatibilidade no Firefox/Safari.
6. Exportar por **Copiar**, `.md` e `.txt`; conferir cabeçalho, horário relativo e UTF-8.
7. Com pelo menos três falas, gerar de 3 a 8 **Melhores Momentos**, conferir citações, personagens,
   prompt em inglês, retratos de referência, criação manual, edição, exclusão e envio/troca de imagem.
8. Forçar uma falha de gravação em ambiente controlado e confirmar que a geração anterior de
   Momentos continua visível.
9. No APK novo, repetir áudio/câmera/transcrição em cada aparelho do grupo. Se Android/WebRTC negar
   a segunda captura, a transcrição deve parar com aviso em português e a call deve continuar.
10. Registrar navegador/aparelho, resultado e evidências; manter Production e a chave do app
    desligadas até a aprovação do dono.

## Fase 1: call de voz e vídeo

### Arquitetura

- **LiveKit Cloud, plano gratuito ("Build")**: a mídia passa pelo servidor do LiveKit. A cota
  gratuita mensal cobre algumas sessões por mês de um grupo pequeno; passar dela exige plano
  pago, então acompanhe o uso no painel do LiveKit. Trocar por um servidor próprio (LiveKit
  self-hosted) é só mudar as três variáveis abaixo.
- **Token no servidor**: `POST /api/call/token` (Next.js, `apps/web/src/app/api/call/token`).
  Aceita a sessão do site (cookies) ou do app (`Authorization: Bearer`). Chama
  `join_call_room` no banco, que aplica o modo de acesso, e só então assina o token com a chave
  do LiveKit. A identidade no LiveKit é o id do usuário; os metadados levam o papel (mestre ou
  jogador) e o personagem.
- **Banco** (`supabase/migrations/20261101100000_call_rooms.sql`, com RLS e testes em
  `packages/database/test/rls/calls.test.ts`):
  - `call_rooms`: link (`slug`), código (`RUNA-4821`), dono, campanha e sessão opcionais, modo
    (`open`, `invite`, `lobby`), status.
  - `call_invites`: convites (em tempo real para quem foi convidado).
  - `call_participants`: quem entrou, papel, personagem e aprovação da sala de espera.
  - Funções: `create_call_room`, `find_call_room` (pelo link ou código), `join_call_room`
    (papel: dono ou mestre da campanha = mestre; personagem do jogador na campanha),
    `decide_call_participant` (sala de espera), `invite_to_call`, `leave_call_room`.
- **Site**: aba **Call** no menu (`/call` para criar e entrar; `/call/<slug>` é a sala, com
  `@livekit/components-react`: vídeo, microfone, câmera, compartilhar tela, quem está falando).
  Ao lado: quem está na mesa (personagem de cada um), sala de espera e convite de amigos. Aviso
  de convite em qualquer página (`call-invite-listener`).
- **App**: aba **Call** e a tela da sala (`/call/[slug]`, também pelo link
  `codexveil://call/<slug>`), com `@livekit/react-native`: microfone, câmera, trocar câmera
  frontal/traseira e o quadro de quem fala aceso. Exige o APK com os módulos nativos (o Expo Go
  não tem WebRTC; o Codexveil já usa APK próprio pelo EAS).
- **Qualidade**: Opus com cancelamento de eco, supressão de ruído e controle de ganho; simulcast,
  `adaptiveStream` e `dynacast`; sem limite de duração.

### Configuração (uma vez)

1. Crie uma conta grátis em <https://cloud.livekit.io> e um projeto.
2. Em **Settings → Keys**, copie a URL (`wss://…livekit.cloud`), a API key e o secret.
3. Na Vercel (projeto do site), em **Settings → Environment Variables**, crie
   `LIVEKIT_URL`, `LIVEKIT_API_KEY` e `LIVEKIT_API_SECRET` e faça um novo deploy.
4. Instale o APK mais recente no celular (o da call).

Sem as variáveis, a sala abre e avisa "A call ainda não foi configurada no servidor".

### Limitações conhecidas

- **Push com o app fechado**: depende do Firebase (pendência antiga). Com o app aberto, o convite
  chega pelo Realtime; no site, aparece em qualquer página.
- **Compartilhar tela**: só no site.
- **Reconexão**: o LiveKit reconecta sozinho em quedas curtas; se a sala cair, a pessoa volta à
  aba Call e entra de novo pelo mesmo link (quem já foi aprovado não volta para a espera).

## Fase 2: transcrição (grátis, no aparelho)

- **Motor plugável**: `TranscriptionProvider` (`packages/domain/src/calls/transcription.ts`).
  Hoje, dois motores grátis:
  - **Site**: Web Speech API do navegador (`apps/web/src/lib/browser-transcription.ts`). Funciona
    no **Chrome e no Edge** (no Firefox e no Safari, não: a pessoa ainda vê as falas dos outros).
    Usa o serviço de reconhecimento do próprio navegador, sem custo.
  - **App**: `expo-speech-recognition` (`apps/mobile/src/lib/device-transcription.ts`), no APK
    com a transcrição. O microfone também está na call (WebRTC): em alguns aparelhos os dois
    disputam o microfone. A alternativa gratuita escolhida preserva a função principal: a call
    continua e somente a transcrição para, com aviso em português. Alternar automaticamente o
    microfone da call foi descartado porque cortaria a voz enviada aos demais. Precisa ser testado
    e documentado em cada aparelho do grupo.
    O mesmo provedor passou a alimentar o ditado do Tomo. No APK anterior, sem o módulo nativo, o
    carregamento é protegido e o botão de microfone fica oculto; a atualização JavaScript não
    quebra o app instalado.
  - Um motor no servidor (agente do LiveKit transcrevendo cada faixa com um serviço de voz pago)
    pode entrar depois sem mudar o resto; não foi feito por ser pago.
- **Atribuição sem identificar voz**: cada pessoa transcreve a própria voz, e o banco
  (`transcript_segments`, gatilho `fill_transcript_segment`) põe o rótulo pela participação na
  sala: jogador → o personagem dele na campanha; mestre → **"Mestre"** (narração e NPCs; quem
  era cada NPC a IA deduz depois). O cliente não escolhe o rótulo.
- **Consentimento (LGPD)**: só grava com **"Gravar transcrição"** ligado pelo dono da sala; todos
  veem o aviso e cada um pode **pausar a própria voz**.
- **Onde ver**: painel "Transcrição" na call (ao vivo); aba **Transcrição** no editor da sessão
  (todas as calls vinculadas à sessão), onde o mestre corrige trechos (lápis, opcional).
- **Exportar**: **Copiar**, **.md** e **.txt**, com cabeçalho (campanha, sessão, data e
  personagens) e uma fala por linha: `[00:12:31] Gambiarra: Eu avanço e golpeio o ogro!`.

## Fase 3: Melhores Momentos

- **Análise**: `POST /api/sessoes/momentos` (só o mestre), com o **Gemini no plano gratuito** (a
  mesma chave `GEMINI_API_KEY` do Tomo; modelo em `GEMINI_MODEL`). Recebe a transcrição (até
  ~120 mil caracteres), os personagens, os NPCs e monstros citados no roteiro e o resumo da
  campanha. O prompt (`buildHighlightsPrompt`) manda deduzir pelo contexto quando o "Mestre"
  fala por um NPC ou monstro. A resposta é JSON validado com zod (`highlightsResponseSchema`), de
  3 a 8 momentos.
- **Imagens sem custo**: em vez de gerar (pago), cada momento traz o **prompt pronto** (em inglês,
  no estilo dark fantasy do Codexveil) e os links dos **retratos** dos personagens envolvidos para
  anexar como referência. O mestre gera na IA que preferir e **envia a imagem** no cartão.
- **Banco** (`20261101120000_session_highlights.sql`): `session_highlights` (a mesa vê; só o
  mestre cria, edita e apaga) e `highlight_runs` (uso registrado: modelo, tokens e quantos
  momentos; só o mestre vê). A limpeza de órfãos conta as imagens dos momentos.
- **Telas**: "Melhores Momentos" no fim da página de cada sessão (gerar, gerar de novo, criar à
  mão escolhendo falas da transcrição, editar, excluir, enviar imagem, copiar o prompt) e a aba
  **Momentos** da campanha, com a galeria de todas as sessões.
- **Controle de uso**: até 8 momentos por geração, só sob demanda (nunca durante a call), e cada
  geração registrada em `highlight_runs`. Um índice parcial e as RPCs `start_highlight_run` /
  `finish_highlight_run` permitem só uma geração por sessão; outra tentativa recebe 409. Um lock
  abandonado expira em três minutos. Gerar de novo troca somente cartões da IA sem imagem e nunca
  editados; cartões manuais, ilustrados ou curados pelo mestre são preservados.

## Variáveis de ambiente (Vercel)

| Variável                                                | Para quê                                        |
| ------------------------------------------------------- | ----------------------------------------------- |
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`  | Call (LiveKit Cloud grátis ou servidor próprio) |
| `GEMINI_API_KEY` (já existe), `GEMINI_MODEL` (opcional) | Melhores Momentos (e o Tomo)                    |

## Custos

Nenhum gasto direto: LiveKit no plano gratuito (com cota mensal), transcrição no próprio aparelho,
análise no plano gratuito do Gemini (com limite diário de pedidos) e imagens geradas fora, pelo
prompt.
