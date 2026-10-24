import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTable } from '../support/fixtures';
import { TestDatabase, expectSqlError } from '../support/pglite';

let db: TestDatabase;
beforeAll(async () => {
  db = await TestDatabase.create();
});
afterAll(async () => {
  await db.close();
});

describe('presença na sessão', () => {
  it('o jogador responde e muda a resposta; sessão iniciada não aceita', async () => {
    const { gm, player, outsider, campaign } = await createTable(db);
    const session = await db.as(gm, (s) =>
      s.one<{ id: string }>(
        `insert into public.sessions (campaign_id, title, is_published, status, scheduled_at) values ($1, 'Noite', true, 'planned', now() + interval '1 day') returning id`,
        [campaign.id],
      ),
    );
    await db.as(player, (s) => s.query(`select public.set_my_attendance($1, 'yes')`, [session.id]));
    await db.as(player, (s) => s.query(`select public.set_my_attendance($1, 'no')`, [session.id]));
    const row = await db.as(gm, (s) => s.one<{ status: string }>(`select status from public.session_attendance where session_id = $1 and user_id = $2`, [session.id, player.id]));
    expect(row.status).toBe('no');
    await expectSqlError(db.as(outsider, (s) => s.query(`select public.set_my_attendance($1, 'yes')`, [session.id])), '42501');
    await db.as(gm, (s) => s.query(`update public.sessions set status = 'in_progress' where id = $1`, [session.id]));
    await expectSqlError(db.as(player, (s) => s.query(`select public.set_my_attendance($1, 'yes')`, [session.id])), '42501');
  });
});
