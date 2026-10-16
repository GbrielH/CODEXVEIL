# Licenças de conteúdo

O Codexveil só usa conteúdo cuja reprodução é permitida. Nenhum texto, aventura, ilustração ou
catálogo de livros comerciais foi copiado para o código ou para o banco. As atribuições também
aparecem para os usuários na página `/licencas` do site.

## Regras de jogo: D&D 5e (SRD 5.2)

| Campo               | Valor                                                               |
| ------------------- | ------------------------------------------------------------------- |
| Obra                | System Reference Document 5.2 ("SRD 5.2"), Wizards of the Coast LLC |
| Licença             | Creative Commons Attribution 4.0 International (CC-BY-4.0)          |
| Texto da licença    | <https://creativecommons.org/licenses/by/4.0/legalcode>             |
| Fonte               | <https://www.dndbeyond.com/srd>                                     |
| Onde fica no código | `packages/rpg-systems/src/dnd5e/` (atribuição em `license.ts`)      |

**O que foi usado:** apenas mecânicas, que são os seis atributos e a fórmula do modificador, o
bônus de proficiência por nível, as perícias e os atributos de cada uma, as salvaguardas, os
dados de vida, a tabela de XP por nível, a tabela de espaços de magia e os nomes das
condições.

**O que foi escrito pelo projeto:** todos os textos de interface e os resumos das condições
(`conditions.ts`), redigidos em português para consulta rápida. Eles não substituem o texto
das regras.

**O que não está no projeto:** descrições de magias, monstros, itens, classes ou espécies
copiadas do SRD ou de livros. O usuário cadastra o próprio conteúdo.

Atribuição exigida pela licença (exibida em `/licencas`):

> This work includes material from the System Reference Document 5.2 ("SRD 5.2") by Wizards
> of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under
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
