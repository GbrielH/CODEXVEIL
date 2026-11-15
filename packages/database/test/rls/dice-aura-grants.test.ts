import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TestDatabase, admin, expectSqlError } from '../support/pglite';

let db: TestDatabase;
beforeAll(async () => {
  db = await TestDatabase.create();
});
afterAll(async () => {
  await db.close();
});

type User = Awaited<ReturnType<TestDatabase['createUser']>>;

async function befriend(a: User, b: User) {
  const { friend_code } = await db.as(b, (s) =>
    s.one<{ friend_code: string }>(`select friend_code from public.profiles where id = $1`, [b.id]),
  );
  await db.as(a, (s) => s.query(`select public.request_friend($1)`, [friend_code]));
  const { id } = await db.as(b, (s) =>
    s.one<{ id: string }>(`select id from public.friendships where requester_id = $1`, [a.id]),
  );
  await db.as(b, (s) => s.query(`select public.accept_friend($1)`, [id]));
}

const grant = (who: User, to: User, aura: string) =>
  db.as(who, (s) =>
    s.query(`insert into public.dice_aura_grants (user_id, aura) values ($1, $2)`, [to.id, aura]),
  );

describe('liberação de auras para amigos', () => {
  it('o criador libera auras para amigos; o amigo usa só as liberadas; retirar limpa', async () => {
    const creator = await db.createUser('criador-grants');
    const friend = await db.createUser('amigo-grants');
    const stranger = await db.createUser('estranho-grants');
    const other = await db.createUser('outro-grants');
    await db.as(admin, (s) =>
      s.query(`update public.profiles set creator_features = true where id = $1`, [creator.id]),
    );
    await befriend(creator, friend);
    await befriend(other, friend);

    // Sem liberação, o amigo não grava aura.
    await expectSqlError(
      db.as(friend, (s) =>
        s.query(`insert into public.user_dice (name, aura) values ('X', 'fire')`),
      ),
      '42501',
    );

    // Só o criador libera, e só para amigos; o próprio amigo não se libera.
    await grant(creator, friend, 'fire');
    await expectSqlError(grant(creator, stranger, 'fire'), '42501');
    await expectSqlError(grant(other, friend, 'storm'), '42501');
    await expectSqlError(grant(friend, friend, 'storm'), '42501');

    // O amigo vê as próprias liberações; terceiros não.
    expect(await db.as(friend, (s) => s.query(`select aura from public.dice_aura_grants`))).toEqual(
      [{ aura: 'fire' }],
    );
    expect(
      await db.as(stranger, (s) => s.query(`select aura from public.dice_aura_grants`)),
    ).toEqual([]);

    // Usa a liberada; a não liberada continua recusada.
    await db.as(friend, (s) =>
      s.query(`insert into public.user_dice (name, aura) values ('Chama', 'fire')`),
    );
    await expectSqlError(
      db.as(friend, (s) =>
        s.query(`insert into public.user_dice (name, aura) values ('X', 'storm')`),
      ),
      '42501',
    );
    const kept = await db.as(friend, (s) =>
      s.one<{ aura: string | null }>(
        `update public.profiles set preferences = $2::jsonb where id = $1 returning preferences #>> '{dice,aura}' as aura`,
        [friend.id, JSON.stringify({ dice: { aura: 'fire' } })],
      ),
    );
    expect(kept.aura).toBe('fire');

    // Só quem liberou retira; ao retirar, a aura some dos dados do amigo.
    await db.as(friend, (s) => s.query(`delete from public.dice_aura_grants`));
    expect(
      await db.as(creator, (s) => s.query(`select aura from public.dice_aura_grants`)),
    ).toHaveLength(1);
    await db.as(creator, (s) =>
      s.query(`delete from public.dice_aura_grants where user_id = $1`, [friend.id]),
    );
    expect(await db.as(friend, (s) => s.query(`select aura from public.user_dice`))).toEqual([
      { aura: null },
    ]);
    const cleared = await db.as(friend, (s) =>
      s.one<{ aura: string | null }>(
        `select preferences #>> '{dice,aura}' as aura from public.profiles where id = $1`,
        [friend.id],
      ),
    );
    expect(cleared.aura).toBeNull();
  });
});
