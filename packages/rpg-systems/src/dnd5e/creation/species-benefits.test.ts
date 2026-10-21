import { describe, expect, it } from 'vitest';
import { hasSpeciesBenefits, parseSpeciesBenefits } from './species-benefits';

describe('benefícios das raças de livro (2014)', () => {
  it('Humano variante: dois atributos à escolha, uma perícia e um talento', () => {
    const benefits = parseSpeciesBenefits(
      'Aumento no Valor de Habilidade. Dois valores de habilidade, à sua escolha, aumentam em 1. Perícia. Você ganha proficiência em uma perícia à sua escolha. Talento. Você adquire um talento de sua escolha.',
    );
    expect(benefits).toEqual({ fixed: {}, choiceCount: 2, choiceAmount: 1, skillChoices: 1, featChoice: true });
  });

  it('Humano padrão: todos os atributos +1', () => {
    const benefits = parseSpeciesBenefits('Todos os seus valores de habilidade aumentam em 1.');
    expect(benefits.fixed).toEqual({ str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 });
    expect(benefits.choiceCount).toBe(0);
  });

  it('aumentos fixos citando o atributo', () => {
    expect(parseSpeciesBenefits('Aumento no Valor de Habilidade. Seu valor de Força aumenta em 2 e seu valor de Constituição aumenta em 1.').fixed).toEqual({ str: 2, con: 1 });
    expect(parseSpeciesBenefits('Seus valores de Destreza e Carisma aumentam em 1.').fixed).toEqual({ dex: 1, cha: 1 });
  });

  it('texto sem benefícios não gera escolhas', () => {
    const benefits = parseSpeciesBenefits('Visão no escuro. Você enxerga na penumbra a até 18 metros.');
    expect(hasSpeciesBenefits(benefits)).toBe(false);
  });
});

describe('Humano variante na criação (livro importado)', () => {
  it('oferece as escolhas e aplica atributos, perícia e talento', async () => {
    const { buildDnd5eBookContent, bookEntityId } = await import('../books/content');
    const { withDnd5eBookContent } = await import('../books/active');
    const { createDnd5eDraft } = await import('./draft');
    const { listDnd5eChoices, finalAbilityScores, skillGrants, draftFeats } = await import('./choices');
    const content = buildDnd5eBookContent([
      {
        book: { id: 'phb-2014', name: 'Livro do Jogador' },
        entries: [
          {
            kind: 'species',
            key: 'humano',
            name: 'Humano',
            data: {
              summary: 'Humanos.',
              sizes: ['medium'],
              speed: 30,
              traits: [{ name: 'Idiomas', description: 'Você fala Comum e um idioma à escolha.' }],
              lineage: {
                label: 'Tipo de humano',
                options: [
                  { id: 'padrao', name: 'Humano padrão', description: 'Todos os seus valores de habilidade aumentam em 1.' },
                  {
                    id: 'variante',
                    name: 'Humano variante',
                    description: 'Dois valores de habilidade, à sua escolha, aumentam em 1. Você ganha proficiência em uma perícia à sua escolha. Você adquire um talento de sua escolha.',
                  },
                ],
              },
            },
          },
        ],
      },
    ]);
    withDnd5eBookContent(content, () => {
      const speciesId = bookEntityId('phb-2014', 'humano');
      const base = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };
      const variant = createDnd5eDraft({
        speciesId,
        baseScores: base,
        selections: { 'species.lineage': 'variante', 'species.book_abilities': ['str', 'cha'], 'species.book_skills': ['perception'], 'species.book_feat': 'alert' },
      });
      const ids = listDnd5eChoices(variant).map((spec) => spec.id);
      expect(ids).toEqual(expect.arrayContaining(['species.book_abilities', 'species.book_skills', 'species.book_feat']));
      expect(finalAbilityScores(variant)).toMatchObject({ str: 16, dex: 14, cha: 9 });
      expect(skillGrants(variant).some((grant) => grant.id === 'perception')).toBe(true);
      expect(draftFeats(variant).some((feat) => feat.specId === 'species.book_feat' && feat.featId === 'alert')).toBe(true);

      const standard = createDnd5eDraft({ speciesId, baseScores: base, selections: { 'species.lineage': 'padrao' } });
      expect(listDnd5eChoices(standard).some((spec) => spec.id === 'species.book_abilities')).toBe(false);
      expect(finalAbilityScores(standard)).toMatchObject({ str: 16, dex: 15, con: 14, int: 13, wis: 11, cha: 9 });
    });
  });
});
