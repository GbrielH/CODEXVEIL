import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCharacter, createTable } from '../support/fixtures';
import { TestDatabase, expectSqlError } from '../support/pglite';

let db: TestDatabase;

beforeAll(async () => {
  db = await TestDatabase.create();
});

afterAll(async () => {
  await db.close();
});

type Actor = Awaited<ReturnType<typeof createTable>>['gm'];

async function createRoom(actor: Actor, mode: string, campaignId: string | null = null) {
  return db.as(actor, (s) =>
    s.one<{ id: string; slug: string; code: string }>(
      `select * from public.create_call_room('Sessão', $1, $2, null)`,
      [mode, campaignId],
    ),
  );
}
const join = (actor: Actor, roomId: string) =>
  db.as(actor, (s) =>
    s.one<{ join_call_room: string }>(`select public.join_call_room($1)`, [roomId]),
  );

describe('call', () => {
  it('cria a sala com link e código e acha pelos dois', async () => {
    const { gm } = await createTable(db);
    const room = await createRoom(gm, 'open');
    expect(room.slug).toMatch(/^[a-z0-9]{10}$/);
    expect(room.code).toMatch(/^[A-Z]{4}-[0-9]{4}$/);
    const byCode = await db.as(gm, (s) =>
      s.one<{ id: string }>(`select id from public.find_call_room($1)`, [room.code.toLowerCase()]),
    );
    expect(byCode.id).toBe(room.id);
  });

  it('na campanha, o mestre entra como mestre e o jogador com o personagem dele', async () => {
    const { gm, player, campaign } = await createTable(db);
    const character = await createCharacter(db, player, campaign.id, 'Gambiarra');
    const room = await createRoom(gm, 'open', campaign.id);
    expect((await join(gm, room.id)).join_call_room).toBe('approved');
    expect((await join(player, room.id)).join_call_room).toBe('approved');
    const rows = await db.as(gm, (s) =>
      s.query<{ user_id: string; role: string; character_id: string | null }>(
        `select user_id, role, character_id from public.call_participants where room_id = $1`,
        [room.id],
      ),
    );
    expect(rows.find((row) => row.user_id === gm.id)?.role).toBe('master');
    expect(rows.find((row) => row.user_id === player.id)).toMatchObject({
      role: 'player',
      character_id: character,
    });
  });

  it('só convidados: sem convite não entra; com convite entra', async () => {
    const { gm, outsider } = await createTable(db);
    const room = await createRoom(gm, 'invite');
    await expectSqlError(join(outsider, room.id), '42501');
    await db.as(gm, (s) => s.query(`select public.invite_to_call($1, $2)`, [room.id, outsider.id]));
    expect((await join(outsider, room.id)).join_call_room).toBe('approved');
  });

  it('sala de espera: aguarda até o dono aprovar; só o dono decide', async () => {
    const { gm, player, outsider } = await createTable(db);
    const room = await createRoom(gm, 'lobby');
    expect((await join(outsider, room.id)).join_call_room).toBe('waiting');
    await expectSqlError(
      db.as(player, (s) =>
        s.query(`select public.decide_call_participant($1, $2, true)`, [room.id, outsider.id]),
      ),
      '42501',
    );
    await db.as(gm, (s) =>
      s.query(`select public.decide_call_participant($1, $2, true)`, [room.id, outsider.id]),
    );
    expect((await join(outsider, room.id)).join_call_room).toBe('approved');
  });

  it('quem não está na sala não vê os participantes', async () => {
    const { gm, outsider } = await createTable(db);
    const room = await createRoom(gm, 'open');
    await join(gm, room.id);
    const rows = await db.as(outsider, (s) =>
      s.query(`select * from public.call_participants where room_id = $1`, [room.id]),
    );
    expect(rows).toEqual([]);
  });
});
