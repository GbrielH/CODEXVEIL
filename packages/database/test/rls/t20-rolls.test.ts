import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TestDatabase, expectSqlError } from '../support/pglite';

let db: TestDatabase;
beforeAll(async () => {
  db = await TestDatabase.create();
});
afterAll(async () => {
  await db.close();
});

const attribute = (total: number) => (total <= 7 ? -2 : total <= 9 ? -1 : total <= 11 ? 0 : total <= 13 ? 1 : total <= 15 ? 2 : total <= 17 ? 3 : 4);
const total = (dice: number[]) => dice.reduce((sum, value) => sum + value, 0) - Math.min(...dice);

describe('rolagem de atributos do Tormenta20 no servidor', () => {
  it('sorteia uma vez, repete o mesmo resultado e só rola de novo depois de consumir', async () => {
    const player = await db.createUser('rolagem-t20@example.com');
    const other = await db.createUser('outro-rolagem-t20@example.com');
    const first = await db.as(player, (s) => s.one<{ dice: number[][] }>(`select public.t20_attribute_dice() as dice`));
    expect(first.dice).toHaveLength(6);
    for (const roll of first.dice) {
      expect(roll).toHaveLength(4);
      for (const die of roll) {
        expect(die).toBeGreaterThanOrEqual(1);
        expect(die).toBeLessThanOrEqual(6);
      }
    }
    // Regra do livro: a soma dos atributos é pelo menos 6.
    expect(first.dice.reduce((sum, roll) => sum + attribute(total(roll)), 0)).toBeGreaterThanOrEqual(6);

    const again = await db.as(player, (s) => s.one<{ dice: number[][] }>(`select public.t20_attribute_dice() as dice`));
    expect(again.dice).toEqual(first.dice);

    // Ninguém escreve direto na tabela, nem lê a rolagem de outra pessoa.
    await expectSqlError(db.as(player, (s) => s.query(`delete from public.t20_attribute_rolls`)), '42501');
    expect(await db.as(other, (s) => s.query(`select 1 from public.t20_attribute_rolls`))).toEqual([]);

    await db.as(player, (s) => s.query(`select public.consume_t20_attribute_dice()`));
    expect(await db.as(player, (s) => s.query(`select 1 from public.t20_attribute_rolls`))).toEqual([]);
  });
});
