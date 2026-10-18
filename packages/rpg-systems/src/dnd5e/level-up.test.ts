import { describe, expect, it } from 'vitest';
import { applyAbilityImprovement, applyDnd5eLevelUp, findClassByName, hitPointsGained, planDnd5eLevelUp } from './level-up';
import { spellSlotResourceKey } from './resources';
import { parseDnd5eSheet } from './sheet';

function sheetFor(name: string, level: number, subclass = '', abilities: Partial<Record<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', number>> = {}) {
  return parseDnd5eSheet({
    identity: { classes: [{ name, subclass, level, hitDie: findClassByName(name)?.hitDie ?? 'd8' }] },
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
    expect(plan.resources.find((resource) => resource.key === spellSlotResourceKey(2))).toMatchObject({ max: 2 });
  });

  it('bruxo ganha invocações e espaços de pacto do novo nível', () => {
    const plan = planDnd5eLevelUp(sheetFor('Bruxo', 4, 'Patrono Ínfero'), 0);
    expect(plan.newInvocations).toBe(2);
    expect(plan.invocationOptions.every((invocation) => invocation.minLevel <= 5)).toBe(true);
    expect(plan.resources.find((resource) => resource.key === 'pact_slots')).toMatchObject({ max: 2, label: 'Espaços de pacto (3º círculo)' });
  });

  it('bárbaro recalcula os usos de Fúria', () => {
    const plan = planDnd5eLevelUp(sheetFor('Bárbaro', 2), 0);
    const rage = plan.resources.find((resource) => resource.label.includes('Fúria'));
    expect(rage?.max).toBe(3);
  });

  it('aplica o nível: classe, vida, atributos, magias e pendências', () => {
    const sheet = sheetFor('Mago', 3, 'Evocador', { int: 17, con: 13 });
    const plan = planDnd5eLevelUp(sheet, 0);
    const empty = { hitPoints: { method: 'average' } as const, improvement: null, cantrips: [], spells: [], invocations: [], metamagic: [] };
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
    expect(result.resources.find((resource) => resource.key === 'hit_dice_d6')).toMatchObject({ max: 4 });
    expect(result.summary).toContain('Mago 4');
  });

  it('aumento de atributo respeita o máximo', () => {
    const scores = { str: 19, dex: 14, con: 14, int: 10, wis: 10, cha: 10 };
    expect(applyAbilityImprovement(scores, { kind: 'plus_two', ability: 'str' }).str).toBe(20);
    expect(applyAbilityImprovement(scores, { kind: 'plus_one_each', abilities: ['dex', 'con'] })).toMatchObject({ dex: 15, con: 15 });
    expect(applyAbilityImprovement({ ...scores, str: 20 }, { kind: 'feat', featId: 'boon_of_fate', ability: 'str' }).str).toBe(21);
    expect(applyAbilityImprovement(scores, { kind: 'feat', featId: 'grappler', ability: 'int' }).int).toBe(10);
  });
});
