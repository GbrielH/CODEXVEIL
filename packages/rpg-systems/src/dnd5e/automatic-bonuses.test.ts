import { describe, expect, it } from 'vitest';
import { listDnd5eAutomaticBonuses } from './automatic-bonuses';
import { computeDnd5eDerived } from './derived';
import { createDefaultDnd5eSheet } from './sheet';

function sheetWith(patch: (sheet: ReturnType<typeof createDefaultDnd5eSheet>) => void) {
  const sheet = createDefaultDnd5eSheet();
  patch(sheet);
  return sheet;
}

describe('bônus automáticos do D&D 5e', () => {
  it('explica CA, deslocamento, iniciativa e PV com a origem', () => {
    const sheet = sheetWith((draft) => {
      draft.identity.species = 'Anão';
      draft.identity.classes = [{ name: 'Monge', level: 6, subclass: '', hitDie: 'd8' } as never];
      draft.abilities.dex = 16;
      draft.abilities.wis = 14;
    });
    const features = ['Alerta', 'Robusto'];
    const derived = computeDnd5eDerived(sheet, { items: [], features });
    const bonuses = listDnd5eAutomaticBonuses(sheet, derived, features);
    const sources = bonuses.map((bonus) => bonus.source);
    expect(sources).toEqual(
      expect.arrayContaining([
        'Defesa sem Armadura (Monge)',
        'Movimento sem Armadura',
        'Alerta (talento)',
        'Robusto (talento)',
        'Tenacidade Anã (espécie)',
      ]),
    );
    expect(bonuses.find((bonus) => bonus.source === 'Alerta (talento)')?.effect).toBe(
      `+${derived.proficiencyBonus} (proficiência)`,
    );
  });

  it('Patrulheiro 6º ganha o Errante no deslocamento da ficha', () => {
    const sheet = sheetWith((draft) => {
      draft.identity.classes = [
        { name: 'Patrulheiro', level: 6, subclass: '', hitDie: 'd10' } as never,
      ];
    });
    const derived = computeDnd5eDerived(sheet, { items: [] });
    expect(derived.speedNotes.some((note) => note.startsWith('Errante (Patrulheiro)'))).toBe(true);
    expect(
      listDnd5eAutomaticBonuses(sheet, derived).some(
        (bonus) => bonus.source === 'Errante (Patrulheiro)',
      ),
    ).toBe(true);
  });
});
