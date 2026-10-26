import { describe, expect, it } from 'vitest';
import {
  BTM_CLASSES,
  BTM_RACES,
  BTM_SKILLS,
  btmAttributeIssues,
  btmBlockedDamage,
  btmCanUseSkill,
  btmCheckExpression,
  btmCriticalDamage,
  btmLifeState,
  btmPointsSpent,
  btmResistMagicExpression,
  btmSkillBonus,
} from './rules';

const base = { for: 1, des: 1, con: 1, int: 1, sab: 1, car: 1 };

describe('Behind the Magic: regras do manual', () => {
  it('conteúdo transcrito: 34 perícias, 11 raças e 12 classes com 3 subclasses cada', () => {
    expect(BTM_SKILLS).toHaveLength(34);
    expect(BTM_RACES).toHaveLength(11);
    expect(BTM_CLASSES).toHaveLength(12);
    for (const klass of BTM_CLASSES) expect(klass.subclasses).toHaveLength(3);
    expect(new Set(BTM_SKILLS.map((skill) => skill.id)).size).toBe(34);
  });

  it('atributos: começam em 1, 8 pontos, máximo 5; baixar a 0 devolve 1 ponto', () => {
    expect(btmPointsSpent({ ...base, for: 5, des: 5 })).toBe(8);
    expect(btmAttributeIssues({ ...base, for: 5, des: 5 })).toEqual([]);
    expect(btmAttributeIssues({ ...base, for: 5, des: 5, con: 2 })).toHaveLength(1);
    // Car 0 devolve um ponto: 9 gastos em outros atributos cabem.
    expect(btmAttributeIssues({ ...base, for: 5, des: 5, con: 2, car: 0 })).toEqual([]);
    expect(btmAttributeIssues({ ...base, for: 6 })).toHaveLength(1);
  });

  it('atributo 0 rola 2d20 e fica com o pior', () => {
    expect(btmCheckExpression(0)).toEqual({ expression: '1d20', mode: 'disadvantage' });
    expect(btmCheckExpression(3)).toEqual({ expression: '1d20+3', mode: 'normal' });
  });

  it('perícias: atributo + treino (0/3/5/7), armadura e kit de ferramentas', () => {
    const stealth = BTM_SKILLS.find((skill) => skill.id === 'furtividade')!;
    expect(btmSkillBonus(stealth, { ...base, des: 3 }, 'treinado')).toBe(6);
    expect(btmSkillBonus(stealth, { ...base, des: 3 }, 'expert', { armor: 'pesada', shield: true })).toBe(3 + 7 - 5 - 2);
    const arts = BTM_SKILLS.find((skill) => skill.id === 'artes')!;
    expect(btmSkillBonus(arts, base, 'treinado', { hasTools: false })).toBe(1 + 3 - 5);
    const religion = BTM_SKILLS.find((skill) => skill.id === 'religiao')!;
    expect(btmCanUseSkill(religion, 'destreinado')).toBe(false);
    expect(btmCanUseSkill(religion, 'treinado')).toBe(true);
  });

  it('combate: resistir a magia, bloqueio, crítico máximo e morte', () => {
    expect(btmResistMagicExpression(2, 5)).toBe('1d20+4');
    expect(btmBlockedDamage(7)).toBe(3);
    expect(btmCriticalDamage('2d8+3')).toBe(19);
    expect(btmLifeState(5, 20)).toBe('ok');
    expect(btmLifeState(0, 20)).toBe('inconsciente');
    expect(btmLifeState(-10, 20)).toBe('morto');
  });
});
