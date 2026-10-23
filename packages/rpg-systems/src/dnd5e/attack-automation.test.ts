import { describe, expect, it } from 'vitest';
import { canRage, rageDamageBonus, resolveDnd5eAttack } from './attack-automation';
import { computeDnd5eDerived } from './derived';
import { dnd5eAttackDataSchema } from './entries';
import { createDefaultDnd5eSheet, parseDnd5eSheet } from './sheet';

function sheet(classes: { name: string; subclass?: string; level: number }[], abilities: Partial<Record<'str' | 'dex', number>> = {}, weapons = 'Armas simples e marciais') {
  const base = createDefaultDnd5eSheet();
  return parseDnd5eSheet({
    ...base,
    identity: { ...base.identity, classes: classes.map((entry) => ({ hitDie: 'd10', subclass: '', ...entry })) },
    abilities: { ...base.abilities, str: abilities.str ?? 16, dex: abilities.dex ?? 12 },
    proficiencies: { ...base.proficiencies, weapons },
  });
}

const greataxe = dnd5eAttackDataSchema.parse({ damage: '1d12', ability: 'str' });

describe('ataques automáticos do D&D', () => {
  it('arma do SRD: Força, proficiência e arma mágica +1 do item equipado', () => {
    const s = sheet([{ name: 'Guerreiro', level: 1 }]);
    const derived = computeDnd5eDerived(s);
    const items = [{ name: 'Machado grande +1', category: 'weapon', isEquipped: true }];
    const attack = resolveDnd5eAttack('Machado grande', greataxe, { sheet: s, derived, items, features: [], effects: { rage: false } });
    expect(attack.toHit).toBe(3 + 2 + 1);
    expect(attack.damage).toBe('1d12+4');
    expect(attack.critical).toBe('2d12+4');
  });

  it('sem proficiência não soma o bônus', () => {
    const s = sheet([{ name: 'Mago', level: 1 }], {}, 'Adagas, bordões');
    const attack = resolveDnd5eAttack('Machado grande', greataxe, { sheet: s, derived: computeDnd5eDerived(s), items: [], features: [], effects: { rage: false } });
    expect(attack.toHit).toBe(3);
  });

  it('Fúria soma no dano com Força corpo a corpo e cresce com o nível', () => {
    expect(rageDamageBonus(1)).toBe(2);
    expect(rageDamageBonus(9)).toBe(3);
    expect(rageDamageBonus(16)).toBe(4);
    const s = sheet([{ name: 'Bárbaro', level: 1 }]);
    expect(canRage(s)).toBe(true);
    const attack = resolveDnd5eAttack('Machado grande', greataxe, { sheet: s, derived: computeDnd5eDerived(s), items: [], features: [], effects: { rage: true } });
    expect(attack.damage).toBe('1d12+5');
  });

  it('Campeão: crítico em 19–20 no 3º nível e 18–20 no 15º', () => {
    const at3 = sheet([{ name: 'Guerreiro', subclass: 'Campeão', level: 3 }]);
    const at15 = sheet([{ name: 'Guerreiro', subclass: 'Campeão', level: 15 }]);
    const context = (s: ReturnType<typeof sheet>) => ({ sheet: s, derived: computeDnd5eDerived(s), items: [], features: [], effects: { rage: false } });
    expect(resolveDnd5eAttack('Machado grande', greataxe, context(at3)).critRange).toBe(19);
    expect(resolveDnd5eAttack('Machado grande', greataxe, context(at15)).critRange).toBe(18);
  });

  it('Arquearia: +2 no acerto com arma à distância (Destreza)', () => {
    const s = sheet([{ name: 'Guerreiro', level: 1 }], { dex: 16 });
    const bow = dnd5eAttackDataSchema.parse({ damage: '1d8', ability: 'dex' });
    const attack = resolveDnd5eAttack('Arco longo', bow, { sheet: s, derived: computeDnd5eDerived(s), items: [], features: ['Estilo de Luta: Arquearia'], effects: { rage: false } });
    expect(attack.toHit).toBe(3 + 2 + 2);
    expect(attack.damage).toBe('1d8+3');
  });
});
