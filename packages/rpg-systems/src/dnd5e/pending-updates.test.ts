import { describe, expect, it } from 'vitest';
import { listDnd5ePendingUpdates, listSubclasses, findClassByName } from './index';
import { createDefaultDnd5eSheet } from './sheet';

describe('pendências da ficha', () => {
  it('aponta as magias sempre preparadas da subclasse que faltam na ficha', () => {
    const cleric = findClassByName('Clérigo')!;
    const subclass = listSubclasses(cleric).find((entry) => entry.alwaysPrepared?.length)!;
    const sheet = createDefaultDnd5eSheet();
    sheet.identity.classes = [
      { name: cleric.name, subclass: subclass.name, level: 3, hitDie: 'd8' },
    ];
    const [update] = listDnd5ePendingUpdates(sheet, []);
    expect(update?.abilities.length).toBeGreaterThan(0);
    const complete = listDnd5ePendingUpdates(
      sheet,
      update!.abilities.map((entry) => entry.name),
    );
    expect(complete).toEqual([]);
  });
});
