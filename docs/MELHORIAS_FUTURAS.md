# Melhorias futuras

Ideias aprovadas pelo responsável, mas **adiadas**. Antes de começar uma delas, mova-a para
[`PROXIMOS_PASSOS.md`](PROXIMOS_PASSOS.md).

## Assistente de IA (card no menu) — especificação de 2026-10-23, implementação em seguida

**Onde fica:** não é aba nem tela. É um **card fixo no menu lateral, logo acima do perfil e do
"Sair"**, que abre um painel de conversa sobre a tela atual. Assim o usuário consulta a IA sem sair
da ficha, do mapa ou do roteiro em que está. No celular (site), o mesmo card abre o painel por
cima da página. No app, fica para depois (o app é só para jogar; avaliar quando houver APK novo).

**Prompt de sistema (base):**

> Você é o assistente do Codexveil, uma plataforma de RPG de mesa (D&D 5e — SRD 5.2.1 — e
> Tormenta20). Responda em português do Brasil, de forma curta e prática. Você é **consultivo**:
> explica regras, sugere ideias, ajuda a montar cenas, encontros e personagens, e tira dúvidas
> sobre a ficha e a campanha. Você **não altera nada** no sistema (não salva, não rola dados, não
> muda fichas). Use só o contexto fornecido (a tela atual, a ficha, a campanha e as regras do
> sistema); se faltar informação, diga o que falta. Nunca revele segredos do mestre a jogadores:
> o contexto que você recebe já vem filtrado pelo que a pessoa pode ver. Cite a regra (livro e
> seção) quando souber; quando for uma sugestão sua, deixe claro que é sugestão. Para jogadores,
> não dê spoilers da história; para o mestre, pode sugerir ganchos, NPCs e desafios.

**Contexto enviado a cada pergunta (montado no servidor, pelo RLS da pessoa):**

- Página atual (rota) e o que está aberto: ficha (sistema, nível, classe, atributos, CA, perícias,
  itens equipados), campanha (nome, sistema, papel da pessoa), sessão em andamento e mapa ativo
  (sem tokens ocultos nem anotações secretas para jogadores).
- Nada de chaves, e-mails ou dados de outras pessoas além do que a tela já mostra.

**Regras técnicas:**

- Chamada só no servidor (rota do site), com a chave do provedor em variável de ambiente da
  Vercel (nunca no app nem no navegador). Modelo atual da Anthropic (Claude).
- Limite de uso por pessoa (ex.: 30 perguntas/dia) e tamanho máximo de pergunta e contexto.
- Respostas em streaming; histórico só na sessão do navegador (não grava conversas no banco
  nesta primeira versão).
- Botão "copiar" na resposta; aviso de que a IA pode errar e que a regra do livro vale.

(estilo app "Dice") — site feito em 2026-10-20; falta o app

**Feito no site (2026-10-20):** caixinha no canto inferior direito com dados 3D
(`@3d-dice/dice-box-threejs`, MIT, carregada sob demanda), cor escolhida por cada jogador na
campanha (`campaign_members.dice_color`) e rolagens dos outros em tempo real. **Pendente no app:**
exige componente nativo (WebView ou GL), ou seja, APK novo (gasta um build da cota); por isso
ficou como melhoria futura. No app continua a animação 2D.

**Pedido atualizado (2026-10-20):** os dados 3D giram numa **caixinha no canto da tela** (não no
meio), e **cada jogador escolhe uma cor**, que é a cor dos dados dele (todos na mesa veem os dados
de cada um na cor do dono). Precisa funcionar também no app.

- Hoje (2026-10-20): dados grandes em 2D caem, quicam e giram no meio da tela (site e app), até 6
  por vez (`components/dice/dice-throw.tsx`).
- Desejado: dados 3D com o número certo de lados, física real (rolam, batem e param na face
  sorteada pelo servidor).
- Caminho avaliado: biblioteca de dados 3D com física (por exemplo `@3d-dice/dice-box`) no site.
  No app exige componente nativo (WebView ou GL), ou seja, **APK novo** (gasta um build da cota e
  todos reinstalam uma vez).
- O resultado continua vindo do servidor (`roll_dice`); a animação só precisa parar na face certa.

## Sistema da comunidade "Behind the Magic" (Manual de Runas) — adiado em 2026-10-20

- RPG original de um amigo do responsável, com uso autorizado de todo o conteúdo (regras e
  imagens). Vai direto no Codexveil, na aba **Sistemas da comunidade**, e só aparece depois que o
  usuário ativar.
- Seguir o modelo dos sistemas existentes (`packages/rpg-systems/src/<id>/`, `registry.ts`,
  migração em `rpg_systems`, ficha e assistente no site e no app).
- PDF versionado: [`sistemas/behind-the-magic/MANUAL DE RUNAS.pdf`](sistemas/behind-the-magic/MANUAL%20DE%20RUNAS.pdf).
- Detalhes no item 12 dos pedidos de 2026-10-20 em [`PROXIMOS_PASSOS.md`](PROXIMOS_PASSOS.md).
