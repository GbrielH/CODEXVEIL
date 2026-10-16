import { describe, expect, it } from 'vitest';
import { abilityModifier, formatModifier } from './abilities';
import {
  experienceForChallenge,
  experienceForNextLevel,
  levelForExperience,
  proficiencyBonusForChallenge,
  proficiencyBonusForLevel,
  suggestedSpellSlots,
} from './progression';
import { proficiencyContribution } from './skills';

describe('modificadores de atributo', () => {
  it.each([
    [1, -5],
    [3, -4],
    [8, -1],
    [9, -1],
    [10, 0],
    [11, 0],
    [12, 1],
    [15, 2],
    [20, 5],
    [30, 10],
  ])('valor %i → modificador %i', (score, modifier) => {
    expect(abilityModifier(score)).toBe(modifier);
  });

  it('formata com sinal explícito', () => {
    expect(formatModifier(3)).toBe('+3');
    expect(formatModifier(0)).toBe('+0');
    expect(formatModifier(-2)).toBe('−2');
  });
});

describe('bônus de proficiência', () => {
  it.each([
    [1, 2],
    [4, 2],
    [5, 3],
    [8, 3],
    [9, 4],
    [12, 4],
    [13, 5],
    [16, 5],
    [17, 6],
    [20, 6],
  ])('nível %i → +%i', (level, bonus) => {
    expect(proficiencyBonusForLevel(level)).toBe(bonus);
  });

  it('limita níveis fora da faixa 1–20', () => {
    expect(proficiencyBonusForLevel(0)).toBe(2);
    expect(proficiencyBonusForLevel(25)).toBe(6);
  });

  it('meia proficiência arredonda para baixo e especialização dobra', () => {
    expect(proficiencyContribution('half', 3)).toBe(1);
    expect(proficiencyContribution('expertise', 3)).toBe(6);
    expect(proficiencyContribution('none', 3)).toBe(0);
  });
});

describe('experiência', () => {
  it.each([
    [0, 1],
    [299, 1],
    [300, 2],
    [6500, 5],
    [354999, 19],
    [355000, 20],
    [999999, 20],
  ])('%i XP → nível %i', (xp, level) => {
    expect(levelForExperience(xp)).toBe(level);
  });

  it('informa a experiência do próximo nível', () => {
    expect(experienceForNextLevel(1)).toBe(300);
    expect(experienceForNextLevel(19)).toBe(355000);
    expect(experienceForNextLevel(20)).toBeNull();
  });
});

describe('nível de desafio', () => {
  it.each([
    ['0', 2, 10],
    ['1/4', 2, 50],
    ['4', 2, 1100],
    ['5', 3, 1800],
    ['9', 4, 5000],
    ['13', 5, 10000],
    ['17', 6, 18000],
    ['21', 7, 33000],
    ['25', 8, 75000],
    ['30', 9, 155000],
  ] as const)('ND %s → proficiência +%i, %i XP', (rating, bonus, xp) => {
    expect(proficiencyBonusForChallenge(rating)).toBe(bonus);
    expect(experienceForChallenge(rating)).toBe(xp);
  });

  it('rejeita níveis de desafio inexistentes', () => {
    expect(proficiencyBonusForChallenge('31')).toBeNull();
    expect(experienceForChallenge('1/3')).toBeNull();
  });
});

describe('espaços de magia sugeridos', () => {
  it('segue a tabela de conjurador completo', () => {
    expect(suggestedSpellSlots(1)).toEqual([2]);
    expect(suggestedSpellSlots(5)).toEqual([4, 3, 2]);
    expect(suggestedSpellSlots(20)).toEqual([4, 3, 3, 3, 3, 2, 2, 1, 1]);
    expect(suggestedSpellSlots(0)).toEqual([]);
  });
});
