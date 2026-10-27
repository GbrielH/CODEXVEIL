import { describe, expect, it } from 'vitest';
import { buildT20Content, t20AbilityChoiceNames } from './content';
import { createT20Draft, t20CreationFeatureChoices, t20FinalAttributes } from './creation';
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
          abilities: [
            {
              name: 'Bênção da Justiça',
              text: 'No 5º nível, escolha entre égide sagrada e montaria sagrada. Uma vez feita, esta escolha não pode ser mudada.',
              level: 5,
            },
          ],
          table: { '4': 'Poder de paladino', '5': 'Bênção da justiça, poder de paladino' },
        },
      },
      {
        kind: 'class',
        key: 'cacador',
        name: 'Caçador',
        data: {
          pvInitial: 16,
          pvPerLevel: 4,
          pmPerLevel: 4,
          abilities: [
            {
              name: 'Explorador',
              text: 'No 3º nível, escolha um tipo de terreno entre aquático, floresta ou urbano. A cada quatro níveis, escolha outro.',
              level: 3,
            },
          ],
          table: { '3': 'Explorador, poder de caçador', '7': 'Explorador, poder de caçador' },
        },
      },
      {
        kind: 'feat',
        key: 'aumento',
        name: 'Aumento de Atributo',
        data: { group: 'classe', owners: ['Paladino'], text: 'Você recebe +1 em um atributo.' },
      },
      {
        kind: 'feat',
        key: 'treino',
        name: 'Treinamento em Perícia',
        data: {
          group: 'destino',
          text: 'Você se torna treinado em uma perícia a sua escolha. Você pode escolher este poder outras vezes para perícias diferentes.',
        },
      },
      {
        kind: 'feat',
        key: 'egide',
        name: 'Égide Sagrada',
        data: { group: 'classe', owners: ['Paladino'], text: 'Escudo sagrado.' },
      },
      {
        kind: 'feat',
        key: 'montaria',
        name: 'Montaria Sagrada',
        data: { group: 'classe', owners: ['Paladino'], text: 'Montaria.' },
      },
    ],
  },
]);

function paladin(level: number) {
  const base = createDefaultT20Sheet();
  return parseT20Sheet({
    ...base,
    identity: {
      ...base.identity,
      classes: [{ key: content.classes[0]?.id ?? '', name: 'Paladino', level }],
    },
    attributes: { ...base.attributes, con: 2 },
  });
}

describe('Tormenta20 — subida de nível', () => {
  it('Aumento de Atributo pede o atributo, aplica +1 e soma PV retroativos de Constituição', () => {
    const sheet = paladin(3);
    const plan = planT20LevelUp(content, sheet);
    const power = plan.powerOptions.find((option) => option.name === 'Aumento de Atributo');
    expect(power).toBeDefined();
    expect(plan.powerOptions.some((option) => option.name === 'Égide Sagrada')).toBe(false);
    expect(applyT20LevelUp(sheet, plan, { powerId: power!.id, spellIds: [] }).issues).toContain(
      'Escolha o atributo que vai aumentar.',
    );
    const result = applyT20LevelUp(sheet, plan, {
      powerId: power!.id,
      spellIds: [],
      attribute: 'con',
    });
    expect(result.issues).toEqual([]);
    expect(result.sheet.attributes.con).toBe(3);
    expect(result.sheet.hitPoints.max).toBe(sheet.hitPoints.max + plan.hitPointsGained + 4);
    expect(result.sheet.powers.at(-1)?.name).toBe('Aumento de Atributo (Constituição)');
  });

  it('habilidade com escolha oferece as opções e grava a escolhida', () => {
    const sheet = paladin(4);
    const plan = planT20LevelUp(content, sheet);
    expect(plan.featureChoices[0]?.options.map((option) => option.name)).toEqual([
      'Égide Sagrada',
      'Montaria Sagrada',
    ]);
    const egide = plan.featureChoices[0]!.options[0]!;
    const power = plan.powerOptions[0]!;
    const result = applyT20LevelUp(sheet, plan, {
      powerId: power.id,
      spellIds: [],
      attribute: 'for',
      featureChoices: { 'Bênção da Justiça': egide.id },
    });
    expect(result.issues).toEqual([]);
    expect(result.abilities.some((ability) => ability.name === 'Égide Sagrada')).toBe(true);
  });

  it('opções que não são poderes (terreno do Explorador) e repetição pela tabela', () => {
    const cacador = content.classes.find((klass) => klass.name === 'Caçador')!;
    const base = createDefaultT20Sheet();
    const sheet = parseT20Sheet({
      ...base,
      identity: { ...base.identity, classes: [{ key: cacador.id, name: 'Caçador', level: 6 }] },
    });
    const plan = planT20LevelUp(content, sheet);
    expect(plan.featureChoices[0]?.options.map((option) => option.name)).toEqual([
      'Explorador (Aquático)',
      'Explorador (Floresta)',
      'Explorador (Urbano)',
    ]);
    const result = applyT20LevelUp(sheet, plan, {
      powerId: '',
      spellIds: [],
      featureChoices: { Explorador: plan.featureChoices[0]!.options[1]!.id },
    });
    expect(result.abilities.map((ability) => ability.name)).toContain('Explorador (Floresta)');
    expect(result.sheet.powers.some((power) => power.name.startsWith('Explorador'))).toBe(false);
  });

  it('criação acima do 1º nível pede as escolhas de habilidade e soma o Aumento de Atributo', () => {
    const paladino = content.classes.find((klass) => klass.name === 'Paladino')!;
    const aumento = content.powers.find((power) => power.name === 'Aumento de Atributo')!;
    const draft = {
      ...createT20Draft(5),
      classId: paladino.id,
      levelPowers: { '4': aumento.id },
      levelPowerAttributes: { '4': 'car' as const },
    };
    expect(t20CreationFeatureChoices(content, draft).map((choice) => choice.key)).toEqual([
      '5:Bênção da Justiça',
    ]);
    expect(t20FinalAttributes(content, draft).car).toBe(
      t20FinalAttributes(content, { ...draft, levelPowerAttributes: {} }).car + 1,
    );
  });

  it('habilidade "com X, ou com Y" (Protótipo do Inventor) vira escolha já na criação', () => {
    expect(
      t20AbilityChoiceNames({
        text: 'Você começa o jogo com um item superior, ou com 10 itens alquímicos, com preço total',
      }),
    ).toEqual(['item superior', '10 itens alquímicos']);
    // Texto sem alternativas não vira escolha.
    expect(t20AbilityChoiceNames({ text: 'Você recebe +2 na Defesa com escudo.' })).toEqual([]);
  });

  it('Treinamento em Perícia pede a perícia e a torna treinada (pode repetir)', () => {
    const sheet = paladin(3);
    const plan = planT20LevelUp(content, sheet);
    const power = plan.powerOptions.find((option) => option.name === 'Treinamento em Perícia')!;
    expect(
      applyT20LevelUp(sheet, plan, { powerId: power.id, spellIds: [] }).issues.join(' '),
    ).toContain('Escolha 1 perícia');
    const result = applyT20LevelUp(sheet, plan, {
      powerId: power.id,
      spellIds: [],
      skills: ['luta'],
    });
    expect(result.issues).toEqual([]);
    expect(result.sheet.skills.trained).toContain('luta');
    expect(result.sheet.powers.at(-1)?.name).toBe('Treinamento em Perícia (Luta)');
    const next = planT20LevelUp(
      content,
      parseT20Sheet({
        ...result.sheet,
        identity: {
          ...result.sheet.identity,
          classes: [{ ...result.sheet.identity.classes[0]!, level: 3 }],
        },
      }),
    );
    expect(next.powerOptions.some((option) => option.name === 'Treinamento em Perícia')).toBe(true);
  });
});
