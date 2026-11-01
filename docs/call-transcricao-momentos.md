# Call, transcrição da sessão e Melhores Momentos

Funcionalidade pedida em 2026-11-01. Regra do responsável: **só opções gratuitas**, sem gasto
direto. Onde um serviço seria pago (imagens), o Codexveil entrega o prompt pronto para a IA de
preferência de cada um.

| Fase | O quê | Situação |
| ---- | ----- | -------- |
| 1 | Call de voz e vídeo (LiveKit) | feita (2026-11-01) |
| 2 | Transcrição ao vivo por personagem | a fazer |
| 3 | Melhores Momentos (análise por IA e prompts de imagem) | a fazer |

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
