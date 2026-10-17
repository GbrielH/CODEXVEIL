# Licenças de conteúdo

O Codexveil só usa conteúdo cuja reprodução é permitida. Nenhum texto, aventura, ilustração ou
catálogo de livros comerciais foi copiado para o código ou para o banco. As atribuições também
aparecem para os usuários na página `/licencas` do site.

## Regras de jogo: D&D 5e (SRD 5.2.1)

| Campo               | Valor                                                                   |
| ------------------- | ----------------------------------------------------------------------- |
| Obra                | System Reference Document 5.2.1 ("SRD 5.2.1"), Wizards of the Coast LLC |
| Licença             | Creative Commons Attribution 4.0 International (CC-BY-4.0)              |
| Texto da licença    | <https://creativecommons.org/licenses/by/4.0/legalcode>                 |
| Fonte               | <https://www.dndbeyond.com/srd>                                         |
| Onde fica no código | `packages/rpg-systems/src/dnd5e/` (atribuição em `license.ts`)          |

**O que foi usado (SRD 5.2.1):**

- Mecânicas: os seis atributos e a fórmula do modificador, o bônus de proficiência, as
  perícias, as salvaguardas, os dados de vida, a tabela de XP e as tabelas de espaços de magia.
- Condições (`packages/rpg-systems/src/dnd5e/conditions.ts`): as 15 condições do glossário de
  regras, com o texto traduzido e adaptado e os efeitos transformados em dados para a ficha.
- Criação de personagens (`packages/rpg-systems/src/dnd5e/srd/`): as 12 classes com as
  características básicas, as habilidades do 1º ao 20º nível e a subclasse do SRD de cada uma;
  as 9 espécies e seus traços; os 4 antecedentes; os talentos de origem, gerais, de estilo de
  luta e as dádivas épicas; idiomas e alinhamentos; armas, armaduras, ferramentas, pacotes e o
  equipamento inicial; invocações místicas e opções de metamagia; os métodos de geração de
  atributos.
- Magias (`srd/spells.ts`): nome, círculo, escola, listas de classe e o cabeçalho técnico
  (tempo de conjuração, alcance, componentes e duração) das 339 magias. **O texto das
  descrições não é reproduzido.**

**Alterações feitas pelo Codexveil (exigidas pela licença):** os nomes de classes, espécies,
antecedentes, talentos, habilidades, armas e itens foram traduzidos para o português; as
descrições das habilidades são resumos escritos pelo projeto, não o texto do SRD; distâncias
foram convertidas para metros (5 pés = 1,5 m) e pesos para quilos (1 lb = 0,5 kg); tempo de
conjuração, alcance e duração das magias foram traduzidos e os componentes materiais foram
resumidos para "M"; o texto das regras das condições foi traduzido para o português, com
distâncias em metros. Os nomes das magias seguem o original em inglês.

**O que foi escrito pelo projeto:** todos os textos de interface, os resumos curtos das
condições (`conditions.ts`) e os resumos das habilidades, traços e talentos. Eles não substituem o texto
das regras.

**O que não está no projeto:** conteúdo de livros comerciais (subclasses, antecedentes,
espécies ou magias que não estão no SRD), descrições completas de magias e monstros e
qualquer ilustração. O usuário pode registrar o próprio conteúdo na ficha.

Atribuição exigida pela licença (exibida em `/licencas`):

> This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards
> of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under
> the Creative Commons Attribution 4.0 International License, available at
> https://creativecommons.org/licenses/by/4.0/legalcode.

"Dungeons & Dragons" e "D&D" são marcas da Wizards of the Coast. O Codexveil não é afiliado,
endossado nem patrocinado por ela. Os nomes são usados apenas para identificar o sistema
compatível.

### Se um catálogo do SRD for importado no futuro

A CC-BY-4.0 permite reproduzir e adaptar o conteúdo do SRD 5.2 (por exemplo, a lista de magias)
desde que a atribuição acima seja mantida e as alterações sejam indicadas. Antes de importar:

1. Use só material que esteja **no SRD 5.2**, nunca o dos livros completos.
2. Registre a origem em cada registro importado (por exemplo, `source = 'SRD 5.2'`).
3. Atualize esta página e a página `/licencas`.

## Conteúdo dos usuários

Campanhas, fichas, roteiros, NPCs, monstros, anotações e imagens enviados pelos usuários são de
responsabilidade de quem os publica. O Codexveil não distribui esse conteúdo publicamente: ele
fica restrito aos participantes de cada campanha, conforme descrito em
[`SECURITY.md`](SECURITY.md).

## Identidade visual

O nome, o emblema, o logotipo, os glifos e os ícones do app são originais, desenhados em SVG
para o Codexveil (`packages/ui/src/brand.ts` e `glyphs.ts`). Os ícones em PNG são gerados a partir
deles por `pnpm brand:assets`. Nenhuma imagem externa é usada.

## Bibliotecas e fontes de terceiros

| Item                                         | Licença                   |
| -------------------------------------------- | ------------------------- |
| Cinzel, Alegreya e Inter (fontes)            | SIL Open Font License 1.1 |
| Lucide (ícones de interface, web e mobile)   | ISC                       |
| Next.js, React, Expo, React Native           | MIT                       |
| Supabase JS / SSR                            | MIT                       |
| zod, Tailwind CSS, Turborepo, Vitest         | MIT                       |
| PGlite (só nos testes e na geração de tipos) | Apache-2.0                |

As licenças completas das dependências estão nos pacotes instalados (`node_modules/*/LICENSE`).

## Textos do SRD incluídos (2026-10-17)

Desde a terceira rodada, o Codexveil inclui o texto das 339 magias, os 330 blocos de
estatísticas de monstros e animais e os 258 itens mágicos do SRD 5.2.1 (CC-BY-4.0), no
original em inglês. Alterações do Codexveil: campos técnicos traduzidos para o português e
distâncias convertidas para metros. A atribuição exigida pela licença aparece nas telas do
catálogo e em `/licencas`.
