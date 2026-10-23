import { describe, expect, it } from 'vitest';
import { computeDnd5eDerived } from './derived';
import { computeDnd5eCombat, findSrdArmorByName, magicBonus } from './equipment-effects';
import { parseDnd5eSheet } from './sheet';

const sheet = (classes: { name: string; level: number; subclass?: string }[], abilities: Record<string, number>, species = 'Humano') =>
  parseDnd5eSheet({
    identity: { species, classes: classes.map((entry) => ({ hitDie: 'd8', subclass: '', ...entry })) },
    abilities,
    combat: { speed: 9, speedUnit: 'm', armorClass: 13 },
  });
const item = (name: string, isEquipped = true) => ({ name, category: 'armor', isEquipped });

describe('combate automático (SRD 5.2.1)', () => {
  const fighter = sheet([{ name: 'Guerreiro', level: 3 }], { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 8 });

  it('sem armadura: 10 + Des; armadura e escudo equipados mudam a CA', () => {
    expect(computeDnd5eCombat(fighter, []).armorClass).toBe(12);
    expect(computeDnd5eCombat(fighter, [item('Armadura de couro')]).armorClass).toBe(13);
    expect(computeDnd5eCombat(fighter, [item('Camisão de malha'), item('Escudo')]).armorClass).toBe(17);
    expect(computeDnd5eCombat(fighter, [item('Cota de malha'), item('Escudo', false)]).armorClass).toBe(16);
    expect(computeDnd5eCombat(fighter, [item('Armadura de placas +1')]).armorClass).toBe(19);
  });

  it('Defesa sem Armadura do bárbaro e do monge; Estilo de Luta Defesa', () => {
    const barbarian = sheet([{ name: 'Bárbaro', level: 1 }], { str: 16, dex: 14, con: 16, int: 8, wis: 10, cha: 10 });
    expect(computeDnd5eCombat(barbarian, [item('Escudo')]).armorClass).toBe(17);
    const monk = sheet([{ name: 'Monge', level: 6 }], { str: 10, dex: 16, con: 12, int: 10, wis: 16, cha: 8 });
    const monkCombat = computeDnd5eCombat(monk, []);
    expect(monkCombat.armorClass).toBe(16);
    expect(monkCombat.speed).toBe(13.5);
    expect(computeDnd5eCombat(fighter, [item('Cota de malha')], ['Defesa']).armorClass).toBe(17);
  });

  it('armadura pesada sem a Força exigida reduz o deslocamento; itens mudam atributos', () => {
    const weak = sheet([{ name: 'Clérigo', level: 1 }], { str: 10, dex: 10, con: 12, int: 10, wis: 16, cha: 10 });
    const combat = computeDnd5eCombat(weak, [item('Cota de malha')]);
    expect(combat.speed).toBe(6);
    expect(combat.warnings[0]).toMatch(/Força 13/);
    const derived = computeDnd5eDerived(weak, { items: [item('Manoplas de Força do Ogro')] });
    expect(derived.abilities.str).toBe(19);
    expect(derived.abilityModifiers.str).toBe(4);
  });

  it('acha armaduras pelo nome e lê o bônus mágico', () => {
    expect(findSrdArmorByName('Cota de malha +2')?.id).toBe('chain_mail');
    expect(magicBonus('Escudo +1')).toBe(1);
    expect(magicBonus('Espada longa')).toBe(0);
  });
});
