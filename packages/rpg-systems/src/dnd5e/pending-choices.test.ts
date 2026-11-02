import { describe, expect, it } from 'vitest';
import {
  applyDnd5eChoice,
  dnd5eChoiceEntries,
  dnd5eChoiceOptions,
  listDnd5ePendingChoices,
} from './pending-choices';
import { createDefaultDnd5eSheet } from './sheet';

describe('escolhas pendentes do D&D 5e', () => {
  const entries = [
    {
      name: 'Erudito do Livro',
      kind: 'feat',
      description:
        'Você ganha proficiência em duas perícias à sua escolha e aprende um idioma à sua escolha.',
    },
    {
      name: 'Herança Feérica',
      kind: 'species_trait',
      description:
        'Você conhece um truque à sua escolha da lista de mago e uma magia de 1º círculo à sua escolha.',
    },
    {
      name: 'Talento Extra',
      kind: 'background_feature',
      description: 'Ganha um talento de origem à sua escolha.',
    },
    // Já resolvidos: traço do SRD tratado pelo assistente e texto que registra o que foi escolhido.
    {
      name: 'Hábil',
      kind: 'species_trait',
      description: 'Proficiência em uma perícia à sua escolha.',
    },
    {
      name: 'Habilidoso',
      kind: 'feat',
      description: 'Três perícias à sua escolha. Proficiências: Arcanismo, História.',
    },
  ];

  it('acha as escolhas que ficaram no texto', () => {
    const choices = listDnd5ePendingChoices(createDefaultDnd5eSheet(), entries);
    expect(choices.map((choice) => [choice.source, choice.kind, choice.count])).toEqual([
      ['Erudito do Livro', 'skill', 2],
      ['Erudito do Livro', 'language', 1],
      ['Herança Feérica', 'cantrip', 1],
      ['Herança Feérica', 'spell', 1],
      ['Talento Extra', 'feat', 1],
    ]);
    expect(choices[3]!.spellLevel).toBe(1);
    expect(choices[4]!.featCategory).toBe('origem');
  });

  it('aplica perícia e idioma e some da lista', () => {
    let sheet = createDefaultDnd5eSheet();
    const [skill, language] = listDnd5ePendingChoices(sheet, entries);
    sheet = applyDnd5eChoice(sheet, skill!, ['arcana', 'history']);
    sheet = applyDnd5eChoice(sheet, language!, ['Dracônico']);
    expect(sheet.skills.arcana.proficiency).toBe('proficient');
    expect(sheet.proficiencies.languages).toContain('Dracônico');
    expect(listDnd5ePendingChoices(sheet, entries).map((choice) => choice.kind)).toEqual([
      'cantrip',
      'spell',
      'feat',
    ]);
  });

  it('oferece opções e monta talentos e magias', () => {
    const sheet = createDefaultDnd5eSheet();
    const choices = listDnd5ePendingChoices(sheet, entries);
    const cantrips = dnd5eChoiceOptions(choices[2]!, sheet);
    expect(cantrips.length).toBeGreaterThan(5);
    const feats = dnd5eChoiceOptions(choices[4]!, sheet);
    expect(feats.length).toBeGreaterThan(0);
    expect(dnd5eChoiceEntries(choices[2]!, [cantrips[0]!.value])[0]?.kind).toBe('spell');
    expect(dnd5eChoiceEntries(choices[4]!, [feats[0]!.value])[0]?.kind).toBe('feat');
  });
});
