import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TestDatabase, expectSqlError } from '../support/pglite';

let db: TestDatabase;
beforeAll(async () => {
  db = await TestDatabase.create();
});
afterAll(async () => {
  await db.close();
});

describe('histórico de moedas', () => {
  it('gasta e recebe com descrição; só quem joga a ficha registra; quem vê, lê', async () => {
    const owner = await db.createUser('dono-moedas@example.com');
    const stranger = await db.createUser('estranho-moedas@example.com');
    const { id } = await db.as(owner, (s) =>
      s.one<{ id: string }>(
        `select public.create_character('Tesoureiro', 'tormenta20', null, '{}'::jsonb, '[{"key":"tibar","label":"Tibares","current":10,"display":"pool"}]'::jsonb) as id`,
      ),
    );
    const record = (who: typeof owner, amount: number, description: string) =>
      db.as(who, (s) => s.one<{ current: number }>(`select (public.record_money($1, 'tibar', $2, $3)).current as current`, [id, amount, description]));

    expect((await record(owner, 25, 'Recompensa do prefeito')).current).toBe(35);
    expect((await record(owner, -15, 'Poção de cura')).current).toBe(20);
    await expectSqlError(record(owner, -100, 'Castelo'), '22023');
    await expectSqlError(record(owner, 5, '   '), '22023');
    await expectSqlError(record(stranger, 5, 'Roubo'), '42501');

    const log = await db.as(owner, (s) =>
      s.query<{ amount: number; balance: number; description: string }>(
        `select amount, balance, description from public.character_money_log where character_id = $1 order by created_at, amount desc`,
        [id],
      ),
    );
    expect(log).toEqual([
      { amount: 25, balance: 35, description: 'Recompensa do prefeito' },
      { amount: -15, balance: 20, description: 'Poção de cura' },
    ]);
    expect(await db.as(stranger, (s) => s.query(`select id from public.character_money_log where character_id = $1`, [id]))).toEqual([]);
    // Ninguém escreve direto na tabela.
    await expectSqlError(
      db.as(owner, (s) =>
        s.query(`insert into public.character_money_log (character_id, resource_key, amount, balance, description) values ($1, 'tibar', 1, 1, 'x')`, [id]),
      ),
      '42501',
    );
  });
});
