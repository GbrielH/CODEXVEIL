import { describe, expect, it } from 'vitest';
import { buildT20Content } from './content';
import { applyT20LevelUp, planT20LevelUp } from './level-up';
import { createDefaultT20Sheet, parseT20Sheet } from './sheet';

const content = buildT20Content([
  {
    book: { id: 't20', name: 'Tormenta20' },
    entries: [
      {
        kind: 'class',
        key: 'paladino',
        name: 'Paladino',
        data: {
          pvInitial: 20,
          pvPerLevel: 5,
          pmPerLevel: 3,
          abilities: [{ name: 'Bênção da Justiça', text: 'No 5º nível, escolha entre égide sagrada e montaria sagrada. Uma vez feita, esta escolha não pode ser mudada.', level: 5 }],
          table: { '4': 'Poder de paladino', '5': 'Bênção da justiça, poder de paladino' },
        },
      },
      { kind: 'feat', key: 'aumento', name: 'Aumento de Atributo', data: { group: 'classe', owners: ['Paladino'], text: 'Você recebe +1 em um atributo.' } },
      { kind: 'feat', key: 'egide', name: 'Égide Sagrada', data: { group: 'classe', owners: ['Paladino'], text: 'Escudo sagrado.' } },
      { kind: 'feat', key: 'montaria', name: 'Montaria Sagrada', data: { group: 'classe', owners: ['Paladino'], text: 'Montaria.' } },
    ],
  },
]);

function paladin(level: number) {
  const base = createDefaultT20Sheet();
  return parseT20Sheet({ ...base, identity: { ...base.identity, classes: [{ key: content.classes[0]?.id ?? '', name: 'Paladino', level }] }, attributes: { ...base.attributes, con: 2 } });
}

describe('Tormenta20 — subida de nível', () => {
  it('Aumento de Atributo pede o atributo, aplica +1 e soma PV retroativos de Constituição', () => {
    const sheet = paladin(3);
    const plan = planT20LevelUp(content, sheet);
    const power = plan.powerOptions.find((option) => option.name === 'Aumento de Atributo');
    expect(power).toBeDefined();
    expect(plan.powerOptions.some((option) => option.name === 'Égide Sagrada')).toBe(false);
    expect(applyT20LevelUp(sheet, plan, { powerId: power!.id, spellIds: [] }).issues).toContain('Escolha o atributo que vai aumentar.');
    const result = applyT20LevelUp(sheet, plan, { powerId: power!.id, spellIds: [], attribute: 'con' });
    expect(result.issues).toEqual([]);
    expect(result.sheet.attributes.con).toBe(3);
    expect(result.sheet.hitPoints.max).toBe(sheet.hitPoints.max + plan.hitPointsGained + 4);
    expect(result.sheet.powers.at(-1)?.name).toBe('Aumento de Atributo (Constituição)');
  });

  it('habilidade com escolha oferece as opções e grava a escolhida', () => {
    const sheet = paladin(4);
    const plan = planT20LevelUp(content, sheet);
    expect(plan.featureChoices[0]?.options.map((option) => option.name)).toEqual(['Égide Sagrada', 'Montaria Sagrada']);
    const egide = plan.featureChoices[0]!.options[0]!;
    const power = plan.powerOptions[0]!;
    const result = applyT20LevelUp(sheet, plan, { powerId: power.id, spellIds: [], attribute: 'for', featureChoices: { 'Bênção da Justiça': egide.id } });
    expect(result.issues).toEqual([]);
    expect(result.abilities.some((ability) => ability.name === 'Égide Sagrada')).toBe(true);
  });
});
