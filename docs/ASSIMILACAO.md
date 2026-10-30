# Assimilação RPG — implantação

Terceiro sistema do Codexveil, depois do D&D 5e e do Tormenta20. Fonte: o livro de regras em PDF do
responsável (não fica no repositório).

## Direitos do conteúdo

O livro não traz licença aberta (nada como a OGL do Tormenta20 ou a CC-BY do SRD). Por isso o
código guarda só **mecânicas e números** (dados, contas, estrutura da ficha, nomes curtos das
Aptidões) e **não reproduz textos do livro**: descrições de Aptidões, Características,
Assimilações, Artefatos, cenário e cartas. O jogador escreve na ficha o nome e as anotações do que
tem. Se quisermos esses textos depois, eles entram como pacote importado do exemplar do usuário, no
mesmo modelo dos livros do Tormenta20 (Meus livros).

## Regras implementadas (`packages/rpg-systems/src/assimilacao`)

- **Dados** (`dice.ts`): d6, d10 e d12 com faces de Sucesso, Adaptação e Pressão, conforme a
  Tabela de Conversão de Dados. Rolagem da pilha, soma das faces, sugestão de dados a manter e
  rolagem de dano (cada símbolo vale 1).
  - As faces foram conferidas pelas coordenadas dos símbolos na tabela (página 43): a face 11 do
    d12 é Sucesso + 2 Adaptações + Pressão, e a 12 é 2 Pressões.
- **Ficha** (`sheet.ts`): Geração, Origens (Evento Marcante e Ocupação, com uso por sessão),
  Propósitos (2 pessoais e 2 coletivos, com marca de Inerte), 6 Instintos (1 a 5), 6
  Conhecimentos e 6 Práticas (0 a 5), Cabo de Guerra, dano de Saúde, Experiência,
  Características, Assimilações (tipo e Pressões ativas) e anotações.
- **Regras** (`rules.ts`):
  - Pilha do teste: d6 por Instinto e d10 por Conhecimento ou Prática. A Rolagem Assimilada troca
    tudo por d12 e mantém +1 dado. Origens e Empenho também dão +1 dado mantido, até 4.
  - Cabo de Guerra: os Níveis somam 10. Com a reserva zerada, cada perda derruba um Nível de
    Determinação, sobe um de Assimilação e ganha 1 ponto de Assimilação.
  - Saúde: 6 Níveis de 1 + Potência + Resolução pontos, com penalidade de Sucessos, custo de
    Determinação nos Níveis 2 e 1 e tempo de Recuperação.
  - Criação: 3 pontos livres em Instintos (máximo 3), 7 em Conhecimentos/Práticas (máximo 2) e 7
    de Experiência (subir Conhecimento ou Prática custa o dobro do nível).
- Testes em `rules.test.ts`.

## Livro completo (pacote do exemplar)

`scripts/books/assimilacao.py` lê o PDF (texto selecionável, duas colunas) e `assimilacao_pack.py`
gera `codexveil.assimilacao.book` (fora do Git), importado em **Meus livros**:

```bash
W=C:/Users/JULIO/Documents/Codexveil/livros-trabalho
$W/venv/Scripts/python -X utf8 -I scripts/books/assimilacao.py "<livro.pdf>" $W/out/assimilacao.json
$W/venv/Scripts/python -X utf8 -I scripts/books/assimilacao_pack.py $W/out/assimilacao.json $W/out/assimilacao-rpg.book.json
```

Resultado em 2026-10-30: 417 entradas, todas válidas no `parseAssimilacaoBookPack`:

- 246 seções de texto (livro inteiro, com créditos, tabelas em Markdown e capítulos);
- 49 Características (custo 1 a 5 e requisito);
- 52 cartas de Assimilação (39 com 6 níveis e 13 Singulares com 3);
- 18 Artefatos;
- 52 cartas de Eventos.

Os ícones viram marcadores (`{A}` Sucesso, `{B}` Adaptação, `{C}` Pressão, `{d}`/`{e}`/`{s}` pontos,
`{D}`/`{E}`/`{S}` níveis, `{6}`/`{1}`/`{2}` dados, `{F}`–`{I}` naipes Copas/Ouros/Espadas/Paus,
`{P}` penalidade), desenhados como selos no site.

**Revisão da extração (o que foi conferido e corrigido):**

- Palavras do PDF × texto extraído: 97,3% das palavras batem direto. A diferença restante é de
  pedaços de palavras hifenizadas que foram juntadas ("presenta" → "representa"); a única página
  com texto ausente era a de créditos, que agora entra como seção.
- Corrigidos: hifenização no fim da linha e dentro de tabelas; ligaduras (fi, fl); custos das
  Características de 4 e 5 pontos (lado a lado na página); títulos de nível quebrados em duas
  linhas; níveis cuja linha usa a fonte de símbolos; requisito vazio ("Pulso Sombrio:"); marcador de
  lista confundido com o símbolo de Sucesso; aviso grudado no título de uma carta; última carta de
  Eventos absorvendo a seção seguinte; caixas de atributos de Regiões com rótulos colados.
- Não conferido à mão linha a linha: o texto corrido das 246 seções (só as verificações automáticas).

## Integração no Codexveil (site)

- Sistema registrado (`registry.ts`) e migração `20261030140000_assimilacao.sql`: linha em
  `rpg_systems`, tipos de entrada `characteristic`, `assimilation`, `artifact`, `event` e leitura
  para jogadores (Eventos só para o mestre).
- Campanha: regras de criação (Cabo de Guerra inicial, Experiência, teto de Escassez, livros).
- Meus livros: importação, selo, contagem e leitor com páginas próprias para cada tipo.
- Criação guiada em 5 passos (Concepção, Origens e Propósitos, Aptidões, Características com
  requisitos do livro, Revisão), validada de novo no servidor.
- Ficha: Cabo de Guerra (perda de Determinação derruba Nível, Clareza de Propósito, bloqueio até a
  Assimilação), Saúde em 6 Níveis com penalidades, teste com dados especiais rolados pelo servidor
  (histórico da mesa) e escolha dos dados mantidos, Empenho, Rolagem Assimilada, Origens por
  sessão, Aptidões, Características, Assimilações com os níveis da carta, história e retrato.
- Trilhas `saude`, `determinacao` e `assimilacao` (painel do mestre e combate as mostram).

## App, Ameaças, Conflitos e baralhos

- **App:** criação em 5 passos (com as Características do livro e requisitos), ficha com Cabo de
  Guerra, Saúde, teste com dados especiais (rolados pelo servidor na campanha, com escolha dos dados
  mantidos), Origens, Aptidões, Características, Assimilações com os níveis da carta e história.
  Vínculo de ficha pronta a uma campanha também confere as regras do Assimilação. Só JavaScript: vai
  por atualização OTA, sem APK novo.
- **Ameaças de Conflito** (biblioteca do mestre): pilha de dados, Sucessos para neutralizar, Saúde,
  ativações com custo em símbolos e rolagem da pilha; o mestre escolhe o que revelar aos jogadores.
- **Conflitos:** a Ameaça colocada na cena entra no rastreador com a contagem de Sucessos para
  neutralizá-la no lugar dos PV (cada Sucesso investido desconta). Objetivos Principais e Secundários
  podem ser criados do mesmo jeito (uma "Ameaça" com os Sucessos necessários).
- **Baralhos do Assimilador** (mesa do mestre): cartas de Assimilação e de Eventos com o texto do
  livro liberado, comprar e embaralhar; o monte fica no navegador do mestre.

## Próximas etapas

1. Testar tudo no navegador e no celular com o livro importado (nada disso foi visto em tela ainda).
2. Contadores de Objetivos próprios no Conflito (hoje reaproveitam o rastreador de combate).
3. Mostrar os símbolos também na caixinha de dados 3D e no histórico de rolagens (hoje aparecem os
   números; os símbolos aparecem na ficha).
