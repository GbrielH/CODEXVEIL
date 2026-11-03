# Triangle Agency — implantação no Codexveil

Quarto sistema completo do Codexveil. A implantação segue a infraestrutura comum da plataforma,
mas as regras e a ficha foram modeladas diretamente de _Triangle Agency: O Jogo de Interpretação_
(primeira edição), sem reaproveitar mecânicas de D&D, Tormenta20 ou Assimilação.

## Direitos e pacote privado

O livro informa “todos os direitos reservados”. O repositório guarda apenas mecânicas, números,
nomes curtos necessários à ficha e código de extração. O PDF e o texto integral não são
versionados. `scripts/books/triangle_agency.py` gera, a partir do exemplar do usuário, o pacote
`codexveil.triangle-agency.book`, importável em **Meus livros**.

Em 2026-11-03, o PDF de 308 páginas gerou um pacote privado externo com 446 entradas (1.186.885
bytes): 308 páginas do livro, 9 Anomalias, 9 Realidades, 9 Competências, 4 páginas de Requisições
e 107 páginas de Documentos com Bloqueio Lúdico. Não houve chaves duplicadas. Quarenta e cinco
páginas gráficas ou em branco não têm corpo textual selecionável e permanecem no índice.

## Regras próprias implementadas

- 6d4, contagem de resultados 3, sucesso/falha, Caos, gasto de Garantias de Qualidade, Burnout,
  Triscendência e Estabilidade;
- as nove Qualidades e suas GQs atuais/máximas, recarregadas nas intermissões;
- ARC completo: Anomalia, Realidade, Competência, 3 Habilidades Anômalas e 3 Relacionamentos;
- Méritos (inclusive Dívida), Pontas Soltas, ressurreições e Apólice de Seguro de Vida;
- 30 unidades de Tempo nas trilhas de Anomalia, Realidade e Competência;
- Requisições, Documentos Bloqueados liberados e Relatório de Missão;
- conflito direto por 6d4 cumulativos até alguém alcançar pelo menos seis 3s e liderar sozinho;
- regras de campanha para Tempo por missão, método de conflitos e Pontos de Veto;
- bloco de Anomalia para a biblioteca do Diretor (codinome, Foco, Domínio, Comportamento, Caos e
  Ferimento).

## Site e app

Site e Android permitem criar o Agente pelo ARC, distribuir as 9 GQs entre exatamente três
Qualidades, registrar habilidades e relacionamentos, abrir a ficha e jogar 6d4. A ficha acompanha
GQs, Burnout, Caos, Méritos, Pontas Soltas, ARC, Relacionamentos, Tempo e Relatório de Missão. O
site também importa e lê o pacote privado; o Diretor libera o livro na campanha e consulta ARC e
Requisições na biblioteca.

## Verificação

- `@codexveil/rpg-systems`: 275 testes aprovados, incluindo 6 novos testes de Triangle Agency;
- `pnpm check`: 20/20 tarefas, 699 testes aprovados, 11 ao vivo pulados e 3 avisos de lint
  preexistentes;
- `pnpm build`: 2/2 tarefas, com Next.js e export Android/Hermes aprovados;
- `supabase db push --dry-run`: somente `20261103150000_triangle_agency.sql`, sem aplicar em
  produção;
- pacote privado: 446 entradas, zero chaves repetidas;
- sem teste manual no navegador ou aparelho nesta rodada.
