import { describe, expect, it } from 'vitest';
import { hitPointBonusPerLevel } from './build';

describe('PV extras por nível', () => {
  it('soma anão da colina, Robusto e feiticeiro dracônico', () => {
    expect(
      hitPointBonusPerLevel({
        speciesId: 'phb_anao',
        speciesName: 'Anão Anão da Colina',
        featNames: [],
        sorcererLevel: 0,
      }),
    ).toBe(1);
    expect(
      hitPointBonusPerLevel({
        speciesId: 'human',
        speciesName: 'Humano',
        featNames: ['tough Robusto'],
        sorcererLevel: 0,
      }),
    ).toBe(2);
    expect(
      hitPointBonusPerLevel({
        speciesId: 'dwarf',
        speciesName: 'Anão',
        featNames: [],
        sorcererLevel: 3,
      }),
    ).toBe(2);
    expect(
      hitPointBonusPerLevel({
        speciesId: 'elf',
        speciesName: 'Elfo',
        featNames: ['alert Alerta'],
        sorcererLevel: 2,
      }),
    ).toBe(0);
  });
});
