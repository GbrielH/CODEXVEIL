# Segurança e autorização

## Princípios

1. **O banco é a barreira de segurança.** Toda leitura e escrita passa pelo RLS do Postgres.
   Esconder botões na interface é só conveniência.
2. **Os clientes só usam a publishable key.** Web e mobile recusam iniciar se receberem uma
   chave secreta (`service_role` ou `sb_secret_…`), conforme
   `packages/database/src/config.ts` (com testes). Nenhum fluxo do app precisa da chave
   secreta.
3. **Não confiar em IDs do cliente.** O dono, o autor e o criador vêm de `auth.uid()` (defaults
   e gatilhos). Colunas de controle não têm GRANT de escrita. Trocar um UUID na URL ou na
   requisição só devolve "não encontrado".
4. **O papel pertence à participação na campanha** (`campaign_members.role`), nunca ao perfil.
5. **Segredos ficam em linhas ou tabelas que o jogador não pode ler**, em vez de colunas
   escondidas: `creature_gm_data`, blocos com `visibility = 'gm'`, sessões não publicadas.

## Funções de autorização (`private`)

| Função                         | Verdadeira quando o usuário atual…                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| `is_campaign_member(c)`        | participa da campanha `c`                                                                   |
| `is_campaign_gm(c)`            | é mestre de `c` (mesmo arquivada, para leitura)                                             |
| `can_manage_campaign(c)`       | é mestre de `c` **e** `c` está ativa                                                        |
| `can_participate(c)`           | participa de `c` **e** `c` está ativa                                                       |
| `can_view_character(id)`       | é dono, ou é mestre da campanha, ou a campanha tem `party_sheets_visible`                   |
| `can_edit_character_sheet(id)` | é dono (se `players_can_edit_sheets`) ou mestre, em campanha ativa; sem campanha, só o dono |
| `can_edit_character_play(id)`  | é dono ou mestre, em campanha ativa (vida, recursos, condições, inventário)                 |

Elas são `SECURITY DEFINER` com `search_path = ''`, o que evita recursão de RLS e
sequestro de `search_path`. O esquema `private` não é exposto pela API.

## Matriz de acesso

| Recurso                             | Ler                                                                     | Criar / alterar / remover                                                                                                                                                    |
| ----------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Perfil                              | O próprio e o de quem divide campanha com você                          | Só o próprio (nome, bio e preferências; o avatar foi removido do produto)                                                                                                    |
| Campanha                            | Participantes                                                           | Criar: qualquer usuário (como dono). Alterar (inclusive as regras de criação): mestres, se ativa. Excluir, arquivar e transferir: só o dono                                  |
| Participantes                       | Participantes                                                           | Só por RPC: aceitar convite, remover (mestre; só o dono remove mestres), sair, alterar papel (dono)                                                                          |
| Convites                            | Mestres                                                                 | Mestres, em campanha ativa. Código, papel, usos e criador são definidos pelo banco                                                                                           |
| Personagem                          | Dono, mestres e o grupo (se `party_sheets_visible`)                     | Criar: o dono, que precisa ser **jogador** da campanha (mestres não criam nem vinculam personagens às próprias mesas). Ficha: `can_edit_character_sheet`. Excluir: só o dono |
| Vida, recursos, condições, itens    | Quem vê o personagem                                                    | `can_edit_character_play`                                                                                                                                                    |
| Habilidades e magias                | Quem vê o personagem                                                    | `can_edit_character_sheet`, ou o dono dentro da transação que cria o personagem (`is_character_being_created`)                                                               |
| Histórico                           | Quem vê o personagem                                                    | Inserir: `can_edit_character_play`, sempre em nome próprio. Imutável                                                                                                         |
| Cópias de segurança                 | Quem edita a ficha                                                      | Só por gatilho                                                                                                                                                               |
| NPCs e monstros (`creatures`)       | Mestres; jogadores só os revelados (`members`)                          | Mestres, em campanha ativa                                                                                                                                                   |
| Dados secretos (`creature_gm_data`) | **Só mestres**                                                          | Só mestres                                                                                                                                                                   |
| Sessões                             | Mestres; jogadores só as publicadas                                     | Mestres, em campanha ativa                                                                                                                                                   |
| Blocos de roteiro                   | Mestres; jogadores só os blocos `members` de sessões publicadas         | Mestres                                                                                                                                                                      |
| Cena, encontros e combatentes       | **Só mestres**                                                          | Só mestres                                                                                                                                                                   |
| Anotações                           | `members`: participantes. `gm`: mestres e o autor. `author`: só o autor | Criar e editar: o autor. Remover: o autor, ou um mestre se a nota for `members`                                                                                              |
| Planos                              | Usuários autenticados (o próprio plano)                                 | Só `service_role`                                                                                                                                                            |

Usuários anônimos (`anon`) só leem `rpg_systems`. Nenhuma outra tabela tem GRANT para `anon`.

## Convites

- O código tem 12 caracteres de um alfabeto de 32 símbolos (60 bits de aleatoriedade
  criptográfica). É gerado e regenerado pelo banco, e o cliente nunca o escolhe.
- A validade é de no máximo 30 dias, com limite de 1 a 50 usos ou ilimitado. Convites pessoais
  (`invited_email`) são sempre de uso único.
- `accept_campaign_invite` trava a linha do convite (`for update`), o que serializa aceites
  simultâneos e impede ultrapassar `max_uses`. Convites pessoais só valem para o **e-mail
  confirmado** da conta.
- A prévia só revela detalhes da campanha quando o convite é utilizável. Arquivar a campanha
  revoga os convites pendentes.

## Conteúdo secreto do mestre

- `gm_note` é obrigatoriamente `visibility = 'gm'` (restrição `CHECK`).
- Sessões não publicadas são invisíveis aos jogadores, incluindo os blocos públicos delas.
- O Realtime (Postgres Changes) aplica as mesmas policies a cada assinante. Os segredos não são
  publicados: `creature_gm_data` e `session_blocks` nem fazem parte da publicação, e a cena e o
  combate só chegam aos mestres. Uma assinatura sem o token do usuário cai no papel anônimo,
  que não tem acesso às tabelas: o Realtime recusa a assinatura (confirmado em produção em
  2026-10-17).
- As imagens de roteiro e de NPCs só podem ser lidas quando o registro que as referencia pode
  ser lido (veja Storage abaixo).

## Livros importados

O conteúdo de livros comerciais nunca vai para o código. Cada usuário importa os próprios livros
para `book_packs`/`book_entries`. O RLS (`private.can_read_book_pack`) libera a leitura só ao
dono e aos participantes das campanhas **do dono** que liberaram o livro nas regras de criação;
livros com importação incompleta (`is_ready = false`) ficam só para o dono. Só o dono grava ou
apaga (`private.owns_book_pack`). Testado em `packages/database/test/rls/books.test.ts`.

## Storage

| Bucket                               | Acesso                                                                                                                                     | Caminhos                                                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `avatars` (público, desativado)      | Leitura pública e remoção na própria pasta. **Envio e troca bloqueados** desde a migração de 2026-10-16 (o produto não tem foto de perfil) | `{user_id}/{arquivo}`                                                                                             |
| `campaign-media` (privado, até 2 MB) | URLs assinadas de curta duração                                                                                                            | `campaigns/{id}/cover/…`, `campaigns/{id}/creatures/…`, `campaigns/{id}/sessions/{sessão}/…`, `characters/{id}/…` |

- Só PNG, JPEG e WebP são aceitos, verificando o MIME no bucket e a extensão do nome. SVG é
  recusado porque pode conter scripts. Os nomes de arquivo seguem um padrão restrito.
- **Tamanho:** o site reduz as imagens no navegador antes do envio (lado maior de 768 px para
  retratos, 1024 px para NPCs e monstros e 1600 px para roteiros, regravadas em WebP;
  `IMAGE_PRESETS` em `@codexveil/validation`). O limite de 2 MB do bucket vale no servidor
  mesmo para quem chamar a API diretamente.
- **Leitura da mídia privada:** mestres leem toda a mídia da campanha. Os demais participantes
  leem a capa, imagens de NPCs revelados e imagens de blocos públicos de sessões publicadas.
  Retratos seguem `can_view_character`.
- **Capa na criação da campanha (site):** a imagem vai junto com o formulário (Server Action,
  limite de 3 MB em `next.config.ts`), é conferida (tipo e 2 MB) e enviada com a sessão do
  próprio usuário, então as policies do Storage valem igual ao envio pelo navegador.
- **Escrita:** quem pode editar o registro de destino. As colunas `cover_path`, `image_path` e
  `portrait_path` têm `CHECK` exigindo que o caminho esteja na pasta do próprio registro.

## Autenticação

- Supabase Auth com confirmação de e-mail obrigatória (`enable_confirmations = true`), senha
  mínima de 8 caracteres e `secure_password_change`.
- Web: sessão em cookies via `@supabase/ssr`, renovada pelo `proxy.ts` a cada requisição. As
  rotas privadas redirecionam para `/entrar` com o motivo (sessão expirada ou não autenticado),
  e esses redirecionamentos são enviados com `Cache-Control: private, no-store`.
- Mobile: sessão no SQLite privado do app, com renovação pausada em segundo plano.

## Assistente de IA

- A chave `GEMINI_API_KEY` fica só no servidor (Vercel). A rota `/api/assistente` exige sessão.
- Provedor: Google Gemini no plano gratuito, em que o Google pode usar as perguntas para melhorar
  os modelos. O contexto não leva e-mails nem dados de outras pessoas; só campanha, papel e ficha.
- O contexto (campanha, papel, ficha aberta) é lido com o cliente do Supabase da própria pessoa:
  o RLS garante que segredos do mestre não chegam a jogadores.
- Sem cota por pessoa desde 2026-10-23 (uso só do responsável e amigos; o limite é o do plano gratuito do
  Gemini). A função `consume_assistant_question` continua no banco, sem uso. Pergunta de
  até 2.000 caracteres e contexto de até 12.000. Conversas não são gravadas.

## Cabeçalhos HTTP (web)

`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` restritiva (microfone só para o próprio site, desde 2026-10-26, para o ditado por voz no chat do Tomo) e
`Cross-Origin-Opener-Policy: same-origin` (`apps/web/next.config.ts`).

## Testes de segurança

Além dos testes abaixo, `packages/database/test/live/supabase.live.test.ts` repete os cenários
principais (anônimo, estranho com UUID, segredos de NPCs, blocos `gm`, cena, anotações e
Storage) contra o Supabase real, pelas mesmas consultas dos apps (veja
[`PROGRESS.md`](PROGRESS.md#teste-ao-vivo-contra-o-supabase-real)).

Os testes ficam em `packages/database/test/rls/` e rodam com PGlite, com o papel e o JWT
reais de cada usuário:

- `campaigns.test.ts`: perfis, acesso anônimo (nenhum dado privado nem RPC), campanha alheia
  por troca de UUID, edição sem ser mestre, arquivamento, gestão de participantes e papéis,
  transferência, limites de plano e isolamento entre campanhas do mesmo mestre.
- `characters.test.ts`: ficha de outro jogador (mesmo com o UUID correto), visibilidade do
  grupo, fichas travadas, versão e dono imutáveis, controle otimista, alterações simultâneas
  de mestre e jogador, histórico imutável, isolamento, mestre e co-mestre impedidos de criar ou
  vincular personagens na própria campanha, criação completa (inventário e habilidades) mesmo
  com a ficha travada, listas grandes demais recusadas e a duração das condições (quem pode
  passar rodadas e valores fora do intervalo).
- `invites.test.ts`: código gerado no servidor, validade máxima, uso único dos convites
  pessoais, limite de usos, convites expirados e revogados, prévia que não revela a campanha,
  campanha arquivada e e-mail não confirmado ou diferente.
- `sessions.test.ts`: blocos `gm`, sessões não publicadas, blocos malformados ou com HTML,
  bloco apontando para outra campanha, `creature_gm_data`, cena e combate exclusivos do mestre,
  anotações por visibilidade, referências de blocos públicos que não vazam segredos e o mapa
  de rodadas das condições da cena (formato inválido recusado; só o mestre passa rodadas).
- `storage.test.ts`: tipo e tamanho por bucket, envio de avatar recusado (inclusive na
  própria pasta e pelo perfil), capas, imagem de NPC oculto, imagem de roteiro, caminhos fora do
  padrão e retratos.

## Limitações conhecidas

- **Regras de jogo não são segurança.** O banco garante quem cria e edita cada personagem,
  mas não confere se a ficha segue o SRD ou as regras do mestre (nível inicial, método de
  atributos). O site valida no servidor; o app valida no aparelho. Quem chamar a API
  diretamente pode gravar uma ficha fora das regras, e o mestre continua vendo e podendo
  travar a edição das fichas da campanha.

- **Não há Content-Security-Policy.** Ela deve ser adicionada depois da validação ao vivo, para
  não bloquear as conexões com o Supabase e o Realtime.
- **Limite de tentativas em RPCs:** o Supabase limita as tentativas de Auth, mas não as chamadas
  a `get_invite_preview` e `accept_campaign_invite`. Com 60 bits de entropia, adivinhar um
  código por força bruta não é viável, mas um limite por IP (WAF ou Edge Function) é
  recomendado em produção.
- O que falta validar contra o Supabase real está em
  [`PENDENCIAS.md`](PENDENCIAS.md#16-testes).

## Como reportar uma vulnerabilidade

Não abra uma issue pública. Entre em contato com o mantenedor do repositório por um canal
privado (por exemplo, GitHub Security Advisories).

## Terceira rodada (2026-10-17)

- **Dados:** os clientes não gravam resultados. `roll_dice` (SECURITY DEFINER) confere a
  participação, o personagem (dono ou mestre) e os limites da expressão, sorteia e grava; não há
  policy de insert/update. Rolagens secretas só para quem rolou e mestres (RLS e Realtime).
- **Turnos:** os encontros seguem exclusivos do mestre; os jogadores leem `campaign_turns`, sem
  participantes ocultos e, se o mestre quiser, sem a ordem completa.
- **Itens da campanha:** mesmo modelo das criaturas (mestre vê tudo; jogadores, os revelados).
- **Notificações:** tokens de aparelho só são lidos pelo dono e pela Edge Function (chave
  secreta). A função confere o JWT, exige o papel de mestre e não repete a mesma data. O
  `google-services.json` fica no EAS (variável de ambiente), nunca no repositório público.

## Níveis liberados pelo mestre (2026-10-20)

Em campanha, só o mestre libera níveis (`grant_character_level`; a coluna `granted_level` não tem
permissão de escrita direta). O banco recusa (`CVLVL`) a ficha de um jogador cujo nível total passe
do liberado. Enquanto há nível liberado pendente, o dono pode salvar a ficha e criar habilidades
mesmo com a edição de fichas bloqueada pela campanha.

## Login com Google (2026-10-21)

- OAuth pelo Supabase; o retorno só segue para caminhos internos (`safeRedirectPath`). O segredo
  do cliente Google nunca vai para arquivos: o `config.toml` usa `env(...)`.
- App em PKCE: o código que volta por `codexveil://google` só vale com o verificador guardado no
  próprio aparelho.

## Grade da sessão (2026-10-21)

- **Anotações secretas do mestre** ficam em `session_map_secrets`, tabela separada sem nenhuma
  policy para jogadores (não vão junto com o mapa, que todos os membros leem).

- **Mapas:** o mestre vê e edita todos; jogadores recebem do banco só o mapa ativo da campanha
  (RLS), e a imagem em `campaigns/{id}/maps/` só é liberada para o mapa ativo.
- **Tokens ocultos** (`is_hidden`) nunca chegam aos jogadores (RLS, inclusive no Realtime).
- **Movimento:** jogadores não têm `update` em `map_tokens`; movem só o token do próprio
  personagem pela função `move_my_token` (SECURITY DEFINER), que confere o dono, o mapa ativo,
  a campanha ativa e os limites da grade.
- **Névoa e linha de visão são recursos visuais:** a imagem inteira do mapa ativo chega ao
  jogador; o que é realmente secreto deve ficar em tokens ocultos.

## Perguntas do mestre (2026-10-26)

As respostas às perguntas de criação (`character_answers`) só são lidas pelo dono do personagem e
pelos mestres da campanha (RLS). Só o dono grava, e só para a campanha em que o personagem está. A
obrigatoriedade fica no banco (verificação adiada no fim da transação), valendo para o site e o app.

## Quadros livres (2026-10-27)

`campaign_boards` é só do mestre: só quem é mestre da campanha lê, e só quem a gerencia cria,
altera e apaga (RLS, com teste). Jogadores e quem é de fora não leem nada. As imagens ficam em
`campaigns/<id>/boards/`, com envio permitido só a quem gerencia a campanha; o editor só aceita
caminhos dessa pasta. As colunas que o cliente grava são limitadas por `grant`.

## Ações do Tomo (2026-10-27)

O modelo só **propõe** ações (texto); quem grava é a Server Action `runTomoAction`, chamada quando a
pessoa confirma no cartão. Ela valida o conteúdo com zod, confere o papel (ações de mestre exigem ser
mestre de uma campanha ativa; inventário exige poder editar o personagem) e grava com o cliente da
própria pessoa, então o RLS decide no fim. O modelo só recebe as instruções das ações que a pessoa
pode usar na página aberta.

## Amigos e fichas compartilhadas (2026-10-27)

- O código de amigo só revela que a conta existe para quem o tem; pedir pelo id só funciona para
  quem já divide uma campanha. Perfis ficam visíveis só entre quem tem pedido ou amizade.
- Convite direto para amigo usa `invited_user_id`: o mestre não vê o e-mail do amigo, e só o amigo
  convidado consegue aceitar (os outros recebem a mesma recusa de convite pessoal).
- Ficha compartilhada é só leitura: as regras de edição não mudaram. O compartilhamento só pode ser
  criado pelo dono, só para amigos, e para de valer quando a amizade é desfeita.

## Anotações individuais (2026-10-30)

`campaign_notes` só é lida, editada e apagada pelo autor (nem o mestre lê as dos jogadores); a
restrição `campaign_notes_individual` impede criar anotação compartilhada.
