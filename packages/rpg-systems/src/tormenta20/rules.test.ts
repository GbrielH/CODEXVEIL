import { describe, expect, it } from 'vitest';
import { findSystem } from '../registry';
import { t20AttributeFromRoll, t20PointsSpent } from './attributes';
import { expandT20Conditions, t20ConditionEffects } from './conditions';
import { computeT20Derived, t20HitPointsFor, t20ManaPointsFor } from './derived';
import { t20LevelForXp, t20Tier } from './progression';
import { createDefaultT20Sheet, parseT20Sheet } from './sheet';
import { t20SkillFromName, t20TrainingBonus } from './skills';

describe('Tormenta20 — regras', () => {
  it('está registrado como sistema', () => {
    expect(findSystem('tormenta20')?.shortName).toBe('T20');
  });

  it('compra de atributos por pontos e conversão de rolagens', () => {
    expect(t20PointsSpent({ for: 4, des: 2, con: 1, int: 0, sab: 0, car: -1 })).toBe(7 + 2 + 1 + 0 + 0 - 1);
    expect(t20AttributeFromRoll(13)).toBe(1);
    expect(t20AttributeFromRoll(18)).toBe(4);
    expect(t20AttributeFromRoll(7)).toBe(-2);
  });

  it('bônus de treinamento e nível por XP', () => {
    expect([1, 6, 7, 14, 15, 20].map(t20TrainingBonus)).toEqual([2, 2, 4, 4, 6, 6]);
    expect(t20LevelForXp(0)).toBe(1);
    expect(t20LevelForXp(10000)).toBe(5);
    expect(t20LevelForXp(189999)).toBe(19);
    expect(t20Tier(11)).toBe('campeao');
  });

  it('valor de perícia = metade do nível + atributo + treino + bônus', () => {
    const sheet = parseT20Sheet({
      identity: { classes: [{ key: 'b:guerreiro', name: 'Guerreiro', level: 3 }] },
      attributes: { for: 4, des: 1, con: 2, int: 0, sab: 0, car: -1 },
      skills: { trained: ['luta', 'fortitude'], bonuses: { luta: 1 } },
      defense: { armor: 4, shield: 1 },
    });
    const derived = computeT20Derived(sheet);
    expect(derived.skills.luta.total).toBe(1 + 4 + 2 + 1);
    expect(derived.skills.atletismo.total).toBe(1 + 4);
    expect(derived.skills.atletismo.trained).toBe(false);
    expect(derived.defense).toBe(10 + 1 + 4 + 1);
    expect(derived.carryCapacity).toBe(18);
  });

  it('perícias apenas treinadas e armadura pesada', () => {
    const sheet = parseT20Sheet({ attributes: { des: 3 }, defense: { armor: 8, useDexterity: false, armorPenalty: -4 } });
    const derived = computeT20Derived(sheet);
    expect(derived.skills.ladinagem.usable).toBe(false);
    expect(derived.defense).toBe(18);
    expect(derived.skills.furtividade.total).toBe(3 - 4);
  });

  it('condições incluem outras e somam efeitos', () => {
    expect(expandT20Conditions(['exausto']).map((c) => c.key)).toEqual(['exausto', 'debilitado', 'lento', 'vulneravel']);
    const effects = t20ConditionEffects(['fatigado', 'abalado']);
    expect(effects.physical).toBe(-2);
    expect(effects.skills).toBe(-2);
    expect(effects.defense).toBe(-2);
    const derived = computeT20Derived(createDefaultT20Sheet(), ['desprevenido']);
    expect(derived.defense).toBe(5);
    expect(derived.skills.reflexos.total).toBe(-5);
  });

  it('PV e PM por classe (multiclasse ganha PV de nível seguinte)', () => {
    expect(t20HitPointsFor([{ pvInitial: 20, pvPerLevel: 5, level: 3 }], 2)).toBe(22 + 7 + 7);
    expect(t20HitPointsFor([{ pvInitial: 8, pvPerLevel: 2, level: 3 }, { pvInitial: 20, pvPerLevel: 5, level: 1 }], 1)).toBe(9 + 3 + 3 + 6);
    expect(t20HitPointsFor([{ pvInitial: 8, pvPerLevel: 2, level: 2 }], -3)).toBe(5 + 1);
    expect(t20ManaPointsFor([{ pmPerLevel: 6, level: 3 }, { pmPerLevel: 3, level: 1 }], 2)).toBe(23);
  });

  it('nome de perícia em português vira o id', () => {
    expect(t20SkillFromName('Ofício (alquimista)')).toBe('oficio');
    expect(t20SkillFromName('Intimidação')).toBe('intimidacao');
    expect(t20SkillFromName('Nada')).toBeUndefined();
  });
});
