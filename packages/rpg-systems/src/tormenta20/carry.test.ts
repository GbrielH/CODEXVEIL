import { describe, expect, it } from 'vitest';
import { t20Carry } from './carry';

const item = (name: string, weight: number, isEquipped = true, quantity = 1) => ({ name, weight, quantity, isEquipped });

describe('carga (T20)', () => {
  it('mochila vestida dá +2 espaços e não ocupa espaço', () => {
    expect(t20Carry([item('Mochila', 1), item('Corda', 1)], 10)).toEqual({ used: 1, capacity: 12, bonuses: [{ name: 'Mochila', bonus: 2 }] });
  });
  it('mochila guardada não aumenta e ocupa espaço', () => {
    expect(t20Carry([item('Mochila de aventureiro', 1, false)], 10)).toEqual({ used: 1, capacity: 10, bonuses: [] });
  });
  it('vale só a maior mochila vestida', () => {
    expect(t20Carry([item('Mochila', 1), item('Mochila de carga', 0)], 10)).toMatchObject({ used: 1, capacity: 20 });
  });
});
