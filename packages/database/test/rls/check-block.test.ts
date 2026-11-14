import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createSession, createTable } from '../support/fixtures';
import { TestDatabase, expectSqlError } from '../support/pglite';

let db: TestDatabase;

beforeAll(async () => {
  db = await TestDatabase.create();
});

afterAll(async () => {
  await db.close();
});

describe('bloco de Teste no roteiro', () => {
  it('aceita perícia, DT, rolagem e achado; recusa formatos errados e nota escondida', async () => {
    const { gm, player, campaign } = await createTable(db);
    const session = await createSession(db, gm, campaign.id, { published: true });
    const insert = (data: unknown, visibility = 'gm') =>
      db.as(gm, (s) =>
        s.one<{ id: string }>(
          `insert into public.session_blocks (session_id, campaign_id, type, position, visibility, data, revealable)
           values ($1, $2, 'check', 1, $3, $4::jsonb, true) returning id`,
          [session, campaign.id, visibility, JSON.stringify(data)],
        ),
      );

    const block = await insert({ skill: 'Percepção', dc: 15, expression: '1d20', result: 'Há uma porta escondida.' });
    await insert({ skill: 'Intuição', dc: null, expression: null, result: 'Ele mente.' });
    // Formatos errados.
    await expectSqlError(insert({ skill: 'Percepção', dc: 'quinze', expression: null, result: 'x' }), '23514');
    await expectSqlError(insert({ skill: 'Percepção', dc: 10, expression: null }), '23514');
    // Sem nota: liberado, o bloco inteiro vai aos jogadores.
    await expectSqlError(insert({ skill: 'Percepção', dc: 10, expression: null, result: 'x', note: 'segredo' }), '23514');

    // Oculto até o mestre liberar; liberado, o jogador lê o achado.
    const before = await db.as(player, (s) => s.query(`select id from public.session_blocks where id = $1`, [block.id]));
    expect(before).toHaveLength(0);
    await db.as(gm, (s) => s.query(`update public.session_blocks set visibility = 'members' where id = $1`, [block.id]));
    const after = await db.as(player, (s) =>
      s.one<{ data: { result: string } }>(`select data from public.session_blocks where id = $1`, [block.id]),
    );
    expect(after.data.result).toBe('Há uma porta escondida.');
  });
});
