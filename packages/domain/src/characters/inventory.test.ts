import { describe, expect, it } from 'vitest';
import { adjustQuantity, groupByCategory, totalWeight } from './inventory';

describe('inventário', () => {
  it('soma o peso considerando quantidades e ignorando itens sem peso', () => {
    expect(
      totalWeight([
        { quantity: 2, weight: 1.5 },
        { quantity: 10, weight: 0.1 },
        { quantity: 1, weight: null },
      ]),
    ).toBe(4);
  });

  it('ajusta quantidades sem permitir valores negativos', () => {
    expect(adjustQuantity(3, -1)).toBe(2);
    expect(adjustQuantity(1, -5)).toBe(0);
    expect(() => adjustQuantity(1, 0.5)).toThrow(RangeError);
  });

  it('agrupa por categoria na ordem padrão e ordena os itens', () => {
    const groups = groupByCategory([
      { category: 'consumable', sortOrder: 2, name: 'Poção de cura' },
      { category: 'weapon', sortOrder: 1, name: 'Espada longa' },
      { category: 'consumable', sortOrder: 1, name: 'Ração' },
    ]);
    expect(groups.map((g) => g.category)).toEqual(['weapon', 'consumable']);
    expect(groups[1]?.items.map((i) => i.name)).toEqual(['Ração', 'Poção de cura']);
  });
});
