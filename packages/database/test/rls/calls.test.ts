import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCharacter, createSession, createTable } from '../support/fixtures';
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

  it('transcrição: só com a gravação ligada, com o rótulo do personagem ou "Mestre"', async () => {
    const { gm, player, outsider, campaign } = await createTable(db);
    await createCharacter(db, player, campaign.id, 'Gambiarra');
    const room = await createRoom(gm, 'open', campaign.id);
    await join(gm, room.id);
    await join(player, room.id);
    const say = (actor: Actor, text: string) =>
      db.as(actor, (s) =>
        s.query(
          `insert into public.transcript_segments (room_id, text, started_at, ended_at) values ($1, $2, now(), now())`,
          [room.id, text],
        ),
      );
    await expectSqlError(say(player, 'Antes de ligar'), '42501');
    await db.as(gm, (s) =>
      s.query(`update public.call_rooms set transcription_enabled = true where id = $1`, [room.id]),
    );
    await say(player, 'Eu golpeio o ogro!');
    await say(gm, 'O ogro ri.');
    await expectSqlError(say(outsider, 'Não estou na sala'), '42501');
    const rows = await db.as(player, (s) =>
      s.query<{ speaker_label: string; speaker_type: string }>(
        `select speaker_label, speaker_type from public.transcript_segments where room_id = $1 order by created_at`,
        [room.id],
      ),
    );
    expect(rows).toEqual([
      { speaker_label: 'Gambiarra', speaker_type: 'player' },
      { speaker_label: 'Mestre', speaker_type: 'master' },
    ]);
    // Só o mestre corrige o texto.
    const changed = await db.as(player, (s) =>
      s.query(`update public.transcript_segments set text = 'x' where room_id = $1 returning id`, [
        room.id,
      ]),
    );
    expect(changed).toEqual([]);
  });

  it('melhores momentos: o mestre cria e edita; a mesa vê; jogador e estranho não mexem', async () => {
    const { gm, player, outsider, campaign } = await createTable(db);
    const sessionId = await createSession(db, gm, campaign.id);
    const add = (actor: Actor) =>
      db.as(actor, (s) =>
        s.query(
          `insert into public.session_highlights (session_id, title, summary) values ($1, 'O ogro cai', 'Golpe final.') returning id`,
          [sessionId],
        ),
      );
    await add(gm);
    await expectSqlError(add(player), '42501');
    const seen = await db.as(player, (s) =>
      s.query<{ campaign_id: string }>(
        `select campaign_id from public.session_highlights where session_id = $1`,
        [sessionId],
      ),
    );
    expect(seen).toEqual([{ campaign_id: campaign.id }]);
    const hidden = await db.as(outsider, (s) =>
      s.query(`select id from public.session_highlights where session_id = $1`, [sessionId]),
    );
    expect(hidden).toEqual([]);
  });
});
