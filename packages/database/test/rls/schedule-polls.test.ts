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

describe('agenda da campanha', () => {
  it('o mestre propõe, os membros votam e o mestre confirma a data da sessão', async () => {
    const { gm, player, outsider, campaign } = await createTable(db);
    const sessionId = await createSession(db, gm, campaign.id);
    const dates = ['2026-11-10T22:00:00Z', '2026-11-12T22:00:00Z'];

    await expectSqlError(
      db.as(player, (s) =>
        s.query(`select public.create_schedule_poll($1, null, 'x', $2::timestamptz[])`, [
          campaign.id,
          dates,
        ]),
      ),
      '42501',
    );
    const poll = await db.as(gm, (s) =>
      s.one<{ create_schedule_poll: string }>(
        `select public.create_schedule_poll($1, $2, 'Próxima', $3::timestamptz[])`,
        [campaign.id, sessionId, dates],
      ),
    );
    const pollId = poll.create_schedule_poll;
    const options = await db.as(player, (s) =>
      s.query<{ id: string; starts_at: string }>(
        `select id, starts_at from public.schedule_options where poll_id = $1 order by starts_at`,
        [pollId],
      ),
    );
    expect(options).toHaveLength(2);
    const first = options[0]!;
    const second = options[1]!;

    await db.as(player, (s) => s.query(`select public.vote_schedule($1, 'yes')`, [first.id]));
    await db.as(player, (s) => s.query(`select public.vote_schedule($1, 'maybe')`, [first.id]));
    await expectSqlError(
      db.as(outsider, (s) => s.query(`select public.vote_schedule($1, 'yes')`, [first.id])),
      '42501',
    );
    const outsiderView = await db.as(outsider, (s) =>
      s.query(`select id from public.schedule_polls where id = $1`, [pollId]),
    );
    expect(outsiderView).toEqual([]);
    const votes = await db.as(gm, (s) =>
      s.query<{ answer: string }>(`select answer from public.schedule_votes where option_id = $1`, [
        first.id,
      ]),
    );
    expect(votes).toEqual([{ answer: 'maybe' }]);

    await expectSqlError(
      db.as(player, (s) => s.query(`select public.confirm_schedule($1, $2)`, [pollId, second.id])),
      '42501',
    );
    await db.as(gm, (s) => s.query(`select public.confirm_schedule($1, $2)`, [pollId, second.id]));
    const session = await db.as(gm, (s) =>
      s.one<{ scheduled_at: Date }>(`select scheduled_at from public.sessions where id = $1`, [
        sessionId,
      ]),
    );
    expect(new Date(session.scheduled_at).toISOString()).toBe('2026-11-12T22:00:00.000Z');
    await expectSqlError(
      db.as(player, (s) => s.query(`select public.vote_schedule($1, 'yes')`, [first.id])),
      '42501',
    );
  });
});
