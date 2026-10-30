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

## Próximas etapas

1. **Registro do sistema:** `RpgSystem` completo (resumo, trilhas de Determinação, Assimilação e
   Saúde, condições, links oficiais, ficha de ameaça), entrada em `registry.ts` e migração em
   `rpg_systems`. Só entra junto com a etapa 2, para ninguém criar campanha sem ficha.
2. **Ficha no site e no app:** criação guiada (Concepção, Origens, Geração, Propósitos, Aptidões,
   Cabo de Guerra, Saúde, Características) e ficha com Cabo de Guerra, trilha de Saúde e
   Origens/Propósitos.
3. **Rolador de dados especiais:** montar a pilha (Instinto + Aptidão), Rolagem Assimilada,
   escolher os dados mantidos e registrar no histórico de rolagens; mostrar os símbolos nos dados
   3D.
4. **Conflitos:** objetivos com contadores de Sucessos, Ameaças e o turno do Assimilador.
5. **Baralhos (Assimilação e Eventos)** e Refúgio, se o grupo quiser usar.
