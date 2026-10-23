import { describe, expect, it } from 'vitest';
import { parseT20Critical, resolveT20Attack, t20RageMaxBonus, t20WeaponStats } from './attacks';
import { computeT20Derived } from './derived';
import { createDefaultT20Sheet, parseT20Sheet } from './sheet';

function sheetWith(overrides: { for?: number; des?: number; barbarian?: number; powers?: string[] } = {}) {
  const base = createDefaultT20Sheet();
  return parseT20Sheet({
    ...base,
    identity: { ...base.identity, classes: overrides.barbarian ? [{ key: 'barbaro', name: 'Bárbaro', level: overrides.barbarian }] : [] },
    attributes: { ...base.attributes, for: overrides.for ?? 0, des: overrides.des ?? 0 },
    powers: (overrides.powers ?? []).map((name) => ({ key: name, name })),
  });
}

describe('ataques do Tormenta20', () => {
  it('lê margem e multiplicador da coluna Crítico', () => {
    expect(parseT20Critical('19')).toEqual({ margin: 19, multiplier: 2 });
    expect(parseT20Critical('x3')).toEqual({ margin: 20, multiplier: 3 });
    expect(parseT20Critical('19/x3')).toEqual({ margin: 19, multiplier: 3 });
    expect(parseT20Critical('—')).toEqual({ margin: 20, multiplier: 2 });
  });

  it('lê a arma pela descrição do catálogo quando não há livro', () => {
    const stats = t20WeaponStats('Machado de batalha', 'Dano 1d8 · Crítico x3 · Corte · T$ 10', null);
    expect(stats).toMatchObject({ damage: '1d8', critMargin: 20, critMultiplier: 3, kind: 'melee' });
    expect(t20WeaponStats('Arco curto', 'Dano 1d6 · Crítico x3 · Alcance Médio', null)?.kind).toBe('ranged');
    expect(t20WeaponStats('Azagaia', 'Dano 1d6 · Crítico x2 · Alcance Médio', null)?.kind).toBe('thrown');
  });

  it('corpo a corpo: Luta no acerto, Força no dano e só os dados multiplicados no crítico', () => {
    const sheet = sheetWith({ for: 3 });
    const derived = computeT20Derived(sheet);
    const attack = resolveT20Attack({ damage: '1d8', damageType: 'Corte', critMargin: 20, critMultiplier: 3, kind: 'melee', range: '' }, sheet, derived, { rage: 0 });
    expect(attack.skill).toBe('luta');
    expect(attack.toHit).toBe(derived.skills.luta.total);
    expect(attack.damage).toBe('1d8+3');
    expect(attack.critical).toBe('3d8+3');
  });

  it('disparo não soma Força; Estilo de Disparo soma Destreza', () => {
    const plainSheet = sheetWith({ for: 3, des: 2 });
    const bow = { damage: '1d6', damageType: '', critMargin: 20, critMultiplier: 3, kind: 'ranged' as const, range: 'Médio' };
    expect(resolveT20Attack(bow, plainSheet, computeT20Derived(plainSheet), { rage: 0 }).damage).toBe('1d6');
    const archer = sheetWith({ for: 3, des: 2, powers: ['Estilo de Disparo'] });
    const attack = resolveT20Attack(bow, archer, computeT20Derived(archer), { rage: 0 });
    expect(attack.skill).toBe('pontaria');
    expect(attack.damage).toBe('1d6+2');
  });

  it('Fúria: +2 no ataque e no dano corpo a corpo, +1 a cada cinco níveis', () => {
    expect(t20RageMaxBonus(sheetWith({ barbarian: 1 }))).toBe(2);
    expect(t20RageMaxBonus(sheetWith({ barbarian: 5 }))).toBe(3);
    expect(t20RageMaxBonus(sheetWith({ barbarian: 20 }))).toBe(6);
    expect(t20RageMaxBonus(sheetWith())).toBe(0);
    const sheet = sheetWith({ for: 2, barbarian: 1 });
    const derived = computeT20Derived(sheet);
    const attack = resolveT20Attack({ damage: '1d12', damageType: '', critMargin: 20, critMultiplier: 3, kind: 'melee', range: '' }, sheet, derived, { rage: 2 });
    expect(attack.toHit).toBe(derived.skills.luta.total + 2);
    expect(attack.damage).toBe('1d12+4');
  });
});
