import { describe, expect, it } from 'vitest';
import {
  applyAbilityImprovement,
  applyDnd5eLevelUp,
  dnd5eMulticlassOptions,
  findClassByName,
  hitPointsGained,
  planDnd5eLevelUp,
} from './level-up';
import { spellSlotResourceKey } from './resources';
import { parseDnd5eSheet } from './sheet';

function sheetFor(
  name: string,
  level: number,
  subclass = '',
  abilities: Partial<Record<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', number>> = {},
) {
  return parseDnd5eSheet({
    identity: {
      classes: [{ name, subclass, level, hitDie: findClassByName(name)?.hitDie ?? 'd8' }],
    },
    abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10, ...abilities },
  });
}

describe('subida de nível', () => {
  it('acha a classe pelo nome, sem diferenciar acentos', () => {
    expect(findClassByName('barbaro')?.id).toBe('barbarian');
    expect(findClassByName('Mago')?.id).toBe('wizard');
    expect(findClassByName('Artífice')).toBeUndefined();
  });

  it('vida média usa o dado da classe e a Constituição', () => {
    const plan = planDnd5eLevelUp(sheetFor('Bárbaro', 1), 0);
    expect(plan.hitDieSides).toBe(12);
    expect(plan.averageHp).toBe(7 + 2);
    expect(hitPointsGained(1, -3)).toBe(1);
  });

  it('no 3º nível entra a subclasse e o 4º traz Aumento no Valor de Atributo', () => {
    const third = planDnd5eLevelUp(sheetFor('Guerreiro', 2), 0);
    expect(third.subclass?.name).toBe('Campeão');
    expect(third.features.map((feature) => feature.name)).toContain('Crítico Aprimorado');

    const fourth = planDnd5eLevelUp(sheetFor('Guerreiro', 3, 'Campeão'), 0);
    expect(fourth.subclass).toBeNull();
    expect(fourth.abilityScoreImprovement).toBe(true);
    expect(fourth.feats.map((feat) => feat.id)).toContain('ability_score_improvement');
    // Agarrador exige Força ou Destreza 13.
    expect(fourth.feats.map((feat) => feat.id)).not.toContain('grappler');
  });

  it('19º nível oferece as dádivas épicas', () => {
    const plan = planDnd5eLevelUp(sheetFor('Mago', 18, 'Evocador'), 0);
    expect(plan.epicBoon).toBe(true);
    expect(plan.feats.some((feat) => feat.category === 'epic')).toBe(true);
  });

  it('mago ganha 2 magias no grimório, até o maior círculo disponível', () => {
    const plan = planDnd5eLevelUp(sheetFor('Mago', 2, '', { int: 16 }), 0, ['Magic Missile']);
    expect(plan.newClassLevel).toBe(3);
    expect(plan.newSpells).toBe(2);
    expect(plan.maxSpellCircle).toBe(2);
    expect(plan.spellOptions.every((spell) => spell.level >= 1 && spell.level <= 2)).toBe(true);
    expect(plan.spellOptions.some((spell) => spell.name === 'Magic Missile')).toBe(false);
    expect(
      plan.resources.find((resource) => resource.key === spellSlotResourceKey(2)),
    ).toMatchObject({ max: 2 });
  });

  it('bruxo ganha invocações e espaços de pacto do novo nível', () => {
    const plan = planDnd5eLevelUp(sheetFor('Bruxo', 4, 'Patrono Ínfero'), 0);
    expect(plan.newInvocations).toBe(2);
    expect(plan.invocationOptions.every((invocation) => invocation.minLevel <= 5)).toBe(true);
    expect(plan.resources.find((resource) => resource.key === 'pact_slots')).toMatchObject({
      max: 2,
      label: 'Espaços de pacto (3º círculo)',
    });
  });

  it('bárbaro recalcula os usos de Fúria', () => {
    const plan = planDnd5eLevelUp(sheetFor('Bárbaro', 2), 0);
    const rage = plan.resources.find((resource) => resource.label.includes('Fúria'));
    expect(rage?.max).toBe(3);
  });

  it('aplica o nível: classe, vida, atributos, magias e pendências', () => {
    const sheet = sheetFor('Mago', 3, 'Evocador', { int: 17, con: 13 });
    const plan = planDnd5eLevelUp(sheet, 0);
    const empty = {
      hitPoints: { method: 'average' } as const,
      improvement: null,
      cantrips: [],
      spells: [],
      invocations: [],
      metamagic: [],
    };
    expect(applyDnd5eLevelUp(sheet, plan, empty).issues.length).toBeGreaterThan(0);

    const [first, second] = plan.spellOptions;
    const [cantrip] = plan.cantripOptions;
    const result = applyDnd5eLevelUp(sheet, plan, {
      ...empty,
      improvement: { kind: 'plus_one_each', abilities: ['int', 'con'] },
      cantrips: cantrip ? [cantrip.name] : [],
      spells: [first?.name ?? '', second?.name ?? ''],
    });
    expect(result.issues).toEqual([]);
    expect(result.sheet.identity.classes[0]?.level).toBe(4);
    expect(result.sheet.abilities).toMatchObject({ int: 18, con: 14 });
    // d6: média 4 + CON (+2) e mais 1 retroativo em cada um dos 3 níveis anteriores.
    expect(result.hitPointsGained).toBe(4 + 2 + 3);
    expect(result.abilities.filter((entry) => entry.kind === 'spell')).toHaveLength(3);
    expect(result.resources.find((resource) => resource.key === 'hit_dice_d6')).toMatchObject({
      max: 4,
    });
    expect(result.summary).toContain('Mago 4');
  });

  it('aumento de atributo respeita o máximo', () => {
    const scores = { str: 19, dex: 14, con: 14, int: 10, wis: 10, cha: 10 };
    expect(applyAbilityImprovement(scores, { kind: 'plus_two', ability: 'str' }).str).toBe(20);
    expect(
      applyAbilityImprovement(scores, { kind: 'plus_one_each', abilities: ['dex', 'con'] }),
    ).toMatchObject({ dex: 15, con: 15 });
    expect(
      applyAbilityImprovement(
        { ...scores, str: 20 },
        { kind: 'feat', featId: 'boon_of_fate', ability: 'str' },
      ).str,
    ).toBe(21);
    expect(
      applyAbilityImprovement(scores, { kind: 'feat', featId: 'grappler', ability: 'int' }).int,
    ).toBe(10);
  });
});

describe('talentos no aumento de atributo', () => {
  const base = {
    hitPoints: { method: 'average' as const },
    cantrips: [],
    spells: [],
    invocations: [],
    metamagic: [],
  };

  it('oferece os talentos gerais, de origem e, para quem tem Estilo de Luta, os de estilo', () => {
    const rogue = planDnd5eLevelUp(sheetFor('Ladino', 3, 'Ladrão', { dex: 16 }), 0, ['Alerta']);
    const ids = rogue.feats.map((feat) => feat.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'ability_score_improvement',
        'grappler',
        'savage_attacker',
        'skilled',
        'magic_initiate',
      ]),
    );
    expect(ids).not.toContain('alert');
    expect(ids).not.toContain('archery');
    expect(
      planDnd5eLevelUp(sheetFor('Guerreiro', 3, 'Campeão'), 0).feats.map((feat) => feat.id),
    ).toContain('archery');
  });

  it('Habilidoso pede 3 perícias e Iniciado em Magia pede lista, truques e magia', () => {
    const sheet = sheetFor('Ladino', 3, 'Ladrão', { dex: 16 });
    const plan = planDnd5eLevelUp(sheet, 0);
    const skilled = applyDnd5eLevelUp(sheet, plan, {
      ...base,
      improvement: { kind: 'feat', featId: 'skilled' },
      featSkills: ['history', 'nature'],
    });
    expect(skilled.issues).toContain('Escolha as 3 perícias do talento Habilidoso.');
    const done = applyDnd5eLevelUp(sheet, plan, {
      ...base,
      improvement: { kind: 'feat', featId: 'skilled' },
      featSkills: ['history', 'nature', 'religion'],
    });
    expect(done.issues).toEqual([]);
    expect(done.sheet.skills.religion.proficiency).toBe('proficient');

    const initiate = applyDnd5eLevelUp(sheet, plan, {
      ...base,
      improvement: { kind: 'feat', featId: 'magic_initiate' },
      magicInitiate: {
        list: 'wizard',
        cantrips: ['Fire Bolt', 'Light'],
        spell: 'Magic Missile',
        ability: 'int',
      },
    });
    expect(initiate.issues).toEqual([]);
    expect(initiate.abilities.map((entry) => entry.name)).toEqual(
      expect.arrayContaining(['Iniciado em Magia (Mago)', 'Fire Bolt', 'Light', 'Magic Missile']),
    );
    expect(initiate.abilities.find((entry) => entry.name === 'Magic Missile')?.resourceKey).toBe(
      'feat_magic_initiate_wizard',
    );
    expect(
      initiate.resources.find((resource) => resource.key === 'feat_magic_initiate_wizard'),
    ).toMatchObject({ max: 1, recovery: 'long_rest' });
  });
});

describe('multiclasse', () => {
  const noChoices = {
    hitPoints: { method: 'average' as const },
    improvement: null,
    cantrips: [],
    spells: [],
    invocations: [],
    metamagic: [],
  };

  it('exige 13 no atributo principal da classe nova e das atuais', () => {
    const blocked = (sheet: ReturnType<typeof sheetFor>, id: string) =>
      dnd5eMulticlassOptions(sheet).find((option) => option.classDef.id === id)?.blocked;
    const fighter = sheetFor('Guerreiro', 3, 'Campeão', { str: 15, int: 12 });
    expect(dnd5eMulticlassOptions(fighter).map((option) => option.classDef.id)).not.toContain(
      'fighter',
    );
    expect(blocked(fighter, 'wizard')).toEqual(['Exige Inteligência 13 (tem 12).']);
    expect(blocked(sheetFor('Guerreiro', 3, 'Campeão', { str: 15, int: 13 }), 'wizard')).toEqual(
      [],
    );
    // Monge: Destreza e Sabedoria; Guerreiro: Força ou Destreza (basta um).
    expect(blocked(sheetFor('Guerreiro', 3, '', { dex: 14, wis: 12 }), 'monk')).toEqual([
      'Exige Sabedoria 13 (tem 12).',
    ]);
    expect(blocked(sheetFor('Guerreiro', 3, '', { int: 14 }), 'wizard')).toEqual([
      'Para sair de Guerreiro: Força 13 (tem 10) ou Destreza 13 (tem 10).',
    ]);
  });

  it('o 1º nível de mago num guerreiro traz o dado de vida, magias e espaços da classe nova', () => {
    const sheet = sheetFor('Guerreiro', 3, 'Campeão', { str: 15, int: 14 });
    const plan = planDnd5eLevelUp(sheet, 0, [], 'wizard');
    expect(plan).toMatchObject({
      className: 'Mago',
      newClassLevel: 1,
      newTotalLevel: 4,
      hitDieSides: 6,
      newCantrips: 3,
      newSpells: 6,
    });
    expect(plan.multiclass).toMatchObject({ blocked: [], skillOptions: [], instrumentOptions: [] });
    expect(
      plan.resources.find((resource) => resource.key === spellSlotResourceKey(1)),
    ).toMatchObject({ max: 2 });
    const result = applyDnd5eLevelUp(sheet, plan, {
      ...noChoices,
      cantrips: ['Fire Bolt', 'Light', 'Mage Hand'],
      spells: ['Magic Missile', 'Shield', 'Sleep', 'Detect Magic', 'Mage Armor', 'Burning Hands'],
    });
    expect(result.issues).toEqual([]);
    expect(result.sheet.identity.classes).toEqual([
      { name: 'Guerreiro', subclass: 'Campeão', level: 3, hitDie: 'd10' },
      { name: 'Mago', subclass: '', level: 1, hitDie: 'd6' },
    ]);
    expect(result.resources.find((resource) => resource.key === 'hit_dice_d6')).toMatchObject({
      max: 1,
    });
    expect(result.summary).toContain('multiclasse em Mago');
  });

  it('espaços de magia somam os níveis de conjurador das classes', () => {
    const sheet = sheetFor('Mago', 3, 'Evocador', { int: 15, wis: 13 });
    const plan = planDnd5eLevelUp(sheet, 0, [], 'cleric');
    // Mago 3 + Clérigo 1 = conjurador de 4º nível: 4 espaços de 1º e 3 de 2º círculo.
    expect(
      plan.resources.find((resource) => resource.key === spellSlotResourceKey(2)),
    ).toMatchObject({ max: 3 });
  });

  it('a classe nova pede a perícia e acrescenta os treinamentos', () => {
    const sheet = sheetFor('Guerreiro', 2, '', { str: 15, dex: 14 });
    const plan = planDnd5eLevelUp(sheet, 0, [], 'rogue');
    expect(plan.multiclass?.skillOptions).toContain('stealth');
    expect(applyDnd5eLevelUp(sheet, plan, noChoices).issues).toContain(
      'Escolha a perícia que a nova classe dá.',
    );
    const result = applyDnd5eLevelUp(sheet, plan, { ...noChoices, multiclassSkill: 'stealth' });
    expect(result.issues).toEqual([]);
    expect(result.sheet.skills.stealth.proficiency).toBe('proficient');
    expect(result.sheet.proficiencies).toMatchObject({
      armor: 'Armaduras leves',
      tools: 'Ferramentas de ladrão',
    });
  });
});

describe('ataques e armas equipadas', () => {
  it('ataque de arma do inventário só vale equipada; os outros valem sempre', async () => {
    const { isAttackAvailable } = await import('./weapon-attacks');
    expect(
      isAttackAvailable('Machado grande', [{ name: 'Machado grande', isEquipped: false }]),
    ).toBe(false);
    expect(
      isAttackAvailable('Machado grande', [{ name: 'Machado grande', isEquipped: true }]),
    ).toBe(true);
    expect(isAttackAvailable('Adaga', [{ name: 'Adagas (2)', isEquipped: true }])).toBe(true);
    expect(isAttackAvailable('Ataque desarmado', [{ name: 'Adaga', isEquipped: false }])).toBe(
      true,
    );
  });
});
