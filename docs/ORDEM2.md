# Ordem Paranormal RPG 2 (playtests)

Sistema `ordem2`, implantado em 2026-11-12 a partir dos dois PDFs do responsável: _Playtest Alpha
(agentes)_ e _Playtest Beta — Missões 1 e 2_ (Arquivos Secretos, Jambô). Os dois são do mesmo
sistema; o Alpha se passa no mundo moderno e o Beta na Idade Média.

## O que está no código (sem texto do livro)

`packages/rpg-systems/src/ordem2/`:

- `sheet.ts`: ficha. Atributos (Físico, Mente, Emoção) e perícias são dados (d4 a d12; d20 só com
  efeito paranormal). Cenário `moderno` ou `medieval`: cada um tem 20 perícias (16 em comum).
  Pesquisar/Inspecionar e Ocultismo/Bruxaria usam a mesma chave nos dois cenários. Campos de
  Aptidão com dado próprio, perfil (Executor, Analista, Vigilante), vocação, nível 1–10, patamar,
  PV/PD máximos, habilidades, equipamento (dano "RA+3", pontos de armadura), relações (graus 1–3),
  lesões e traumas permanentes, dado de pavor, dano não letal e contadores de testes na cena.
- `rules.ts`: testes de dois dados (até 4 dados, somam os 3 maiores), aumento/redução de passo,
  crítico (dois dados iguais ≥ 6) e falha crítica (todos 1), RA/RB, dado de pavor (anula
  resultados menores; 1 encerra), dano, DT 7 + 3 por teste repetido, ajuda, tabelas de falha
  crítica, lesões e traumas (resumos próprios), equilíbrio, fechaduras (dicas baixo/alto/exato
  conforme o exemplo do livro), benefícios de relação, armadura e fases do combate.
- `system.ts`: licença, regras de campanha (cenário, DT padrão, livros liberados), bloco de
  criatura (PV, atributos, perícias, ações, habilidades), trilhas PV/PD/Armadura e condições.
- `books/pack.ts` e `books/mission.ts`: formato do pacote e a conversão de uma missão em roteiro.

## Livro privado (fora do Git)

`scripts/books/ordem2.py` gera um pacote por PDF (`codexveil.ordem2.book`), com o texto e as
imagens:

```sh
<venv>/python -X utf8 -I scripts/books/ordem2.py alpha "<Alpha.pdf>" <saida>/ordem2-alpha.book.json <senha do PDF>
<venv>/python -X utf8 -I scripts/books/ordem2.py beta  "<Beta.pdf>"  <saida>/ordem2-beta.book.json
```

Resultado em 2026-11-12:

- **Alpha:** 26 páginas de regras, 10 ferramentas, 2 missões (Ídolo de Pedra, atos I e II), 4 cenas,
  54 pontos de interesse, 2 mapas e 8 imagens, num arquivo de 1,9 MB.
- **Beta:** 24 páginas, 2 missões (Pântano dos Afogados, Caverna de Cruachan), 6 cenas, 16 pontos de
  interesse, 3 criaturas com ficha e arte, 2 mapas e 5 imagens, num arquivo de 1,8 MB.

Os dois pacotes validam sem nenhum problema no esquema TypeScript. A senha do PDF Alpha não vai
para arquivos.

Jogadores leem as regras e as ferramentas; missões, cenas, pontos de interesse, criaturas, mapas e
imagens ficam com o dono do livro e os mestres.

## Imagens do livro

Bucket privado `book-assets`, caminho `ordem2/{livro}/{hash}-{ext}` (hash SHA-256 do conteúdo,
conferido no navegador na importação). Só se insere, nunca se sobrescreve; quem importa o mesmo
livro reaproveita as mesmas imagens. Leem o dono de um exemplar e os mestres das campanhas dele
que liberaram o livro. As imagens sobem pelo importador do site (Meus livros) ou por `scripts/books/import_books.mjs`. O botão **Baixar JSON**, em Meus livros, devolve o pacote com as imagens.

## Missões prontas para mestrar

No leitor da campanha, numa missão, o mestre usa **Usar esta missão na campanha**, que:

- cria uma sessão em rascunho com o roteiro completo, todo só do mestre:
  - resumo;
  - cada cena com narração em "Leia em voz alta" e as regras;
  - os pontos de interesse com perícia, DT e informação, e o contexto em nota privada;
- copia as criaturas para a biblioteca, ocultas, com ficha e arte;
- cria os mapas da sessão com a imagem do livro.

## Limitações conhecidas

- **Extras do Beta (2026-11-12):** `scripts/books/ordem2.py ... --extras "<pasta>=<missão>"` inclui as
  pastas Handouts/, Mapas/ e Tokens/ dos zips de extras como entradas `handout` e `map` ligadas à
  missão (imagens reduzidas: handout 1600 px, mapa 3000 px, token 512 px; músicas e wallpapers
  ficam de fora). Pacote Beta regerado com as Missões 1 e 2: 60 handouts/tokens, 8 mapas, 59
  imagens únicas, 36,2 MB, validado por `parseOrdem2BookPack` sem problemas. **Falta importar** o
  novo pacote em Meus livros (substitui o anterior).
- **Fichas prontas do Alpha:** o zip "Elite + Recrutas" traz um PDF e os extras dos Atos I e II do
  Alpha; ainda não processados.
- **Beta 1.1:** existe um PDF mais novo (79 páginas, 9/11/2026) com Recrutas e Elite. O pacote
  continua gerado do PDF de 76 páginas, porque o script localiza missões e cenas por página;
  usar o 1.1 exige remapear as páginas em `BOOKS['beta']`.
- **Criação de personagem:** o playtest não traz regras de criação, só personagens prontos. A
  criação é livre: o jogador copia a ficha pronta, e PV/PD vêm dela.
- **Mural de rolagens:** a ficha rola os dados no servidor (mural da mesa) e calcula o resultado
  do Ordem. O mural mostra a soma de todos os dados, que só difere do resultado com 4 dados ou
  dado de pavor; o resultado certo aparece na ficha.
- **Combate em fases:** não há iniciativa. As fases estão descritas no código, mas o controle de
  turnos da Mesa do mestre ainda usa a ordem comum.
- **Desafios de acesso:** as regras (fechaduras, equilíbrio) estão no motor, mas sem tela própria.
- **Extração:** heurística sobre o layout do PDF. Números de mapa podem faltar em alguns pontos de
  interesse, e textos com caixas laterais podem sair fora de ordem.

## Auditoria do pacote (2026-11-12)

`scripts/books/ordem2_audit.py` compara o PDF com o pacote e mostra só métricas. Resultado do Beta
(PDF de 76 páginas, com os extras das duas missões):

- **Cobertura de palavras:** 18.495 de 18.535 palavras do PDF estão no pacote (99,8%); nenhuma
  página com cobertura abaixo de 60%.
- **Entradas:** 24 seções, 2 missões, 6 cenas, 16 pontos de interesse, 3 criaturas, 8 mapas e 60
  imagens (handouts e tokens); zero chaves repetidas.
- **Completude:** todas as cenas com roteiro e narração, todas as missões com resumo, todos os
  pontos de interesse com perícia/DT e número no mapa, todas as criaturas com ficha e arte, e todas
  as imagens citadas presentes no pacote.
- **Ligações:** nenhuma referência quebrada entre cenas, pontos de interesse, criaturas e mapas;
  nenhuma entrada ligada a missão inexistente.
- **Não conferido:** o texto corrido linha a linha (só as verificações automáticas) e o pacote
  Alpha, cujo PDF e extras pedem senha.
