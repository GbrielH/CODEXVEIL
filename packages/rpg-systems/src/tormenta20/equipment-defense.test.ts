import { describe, expect, it } from 'vitest';
import { t20DefenseFromItems } from './equipment-defense';

const armor = (name: string, description: string, isEquipped = true) => ({
  name,
  category: 'armor',
  description,
  isEquipped,
});

describe('Defesa do Tormenta20 pelo equipamento', () => {
  it('soma armadura e escudo equipados e segue o equipar/desequipar', () => {
    const items = [
      armor('Couro batido', 'Defesa +3, penalidade -1'),
      armor('Escudo leve', 'Defesa +1, penalidade -1'),
    ];
    expect(t20DefenseFromItems(items)).toEqual({
      armor: 3,
      shield: 1,
      other: 0,
      useDexterity: true,
      armorPenalty: -2,
    });
    const unequipped = [
      armor('Couro batido', 'Defesa +3, penalidade -1', false),
      armor('Escudo leve', 'Defesa +1, penalidade -1'),
    ];
    expect(t20DefenseFromItems(unequipped)).toMatchObject({
      armor: 0,
      shield: 1,
      armorPenalty: -1,
    });
  });

  it('armadura pesada não soma a Destreza; sem armaduras no inventário, mantém a ficha', () => {
    expect(t20DefenseFromItems([armor('Brunea', 'Defesa +5, penalidade -2')])?.useDexterity).toBe(
      false,
    );
    expect(
      t20DefenseFromItems([{ name: 'Corda', category: 'gear', description: '', isEquipped: true }]),
    ).toBeNull();
  });
});
