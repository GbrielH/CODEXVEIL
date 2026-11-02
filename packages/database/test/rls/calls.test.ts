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

async function createRoom(actor: Actor, mode: string, campaignId: string) {
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
    const { gm, campaign } = await createTable(db);
    const room = await createRoom(gm, 'open', campaign.id);
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
    const { gm, outsider, campaign } = await createTable(db);
    const room = await createRoom(gm, 'invite', campaign.id);
    await expectSqlError(join(outsider, room.id), '42501');
    await db.as(gm, (s) => s.query(`select public.invite_to_call($1, $2)`, [room.id, outsider.id]));
    expect((await join(outsider, room.id)).join_call_room).toBe('approved');
  });

  it('convidado que ainda não entrou não vê a lista nem convida terceiros', async () => {
    const { gm, player, outsider, campaign } = await createTable(db);
    const room = await createRoom(gm, 'invite', campaign.id);
    await db.as(gm, (s) => s.query(`select public.invite_to_call($1, $2)`, [room.id, player.id]));
    const participants = await db.as(player, (s) =>
      s.query(`select user_id from public.call_participants where room_id = $1`, [room.id]),
    );
    expect(participants).toEqual([]);
    await expectSqlError(
      db.as(player, (s) => s.query(`select public.invite_to_call($1, $2)`, [room.id, outsider.id])),
      '42501',
    );
  });

  it('sala de espera: aguarda até o dono aprovar; só o dono decide', async () => {
    const { gm, player, outsider, campaign } = await createTable(db);
    const room = await createRoom(gm, 'lobby', campaign.id);
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

  it('quem espera ou foi recusado vê apenas a própria entrada, sem transcrição', async () => {
    const { gm, outsider, campaign } = await createTable(db);
    const room = await createRoom(gm, 'lobby', campaign.id);
    await join(gm, room.id);
    expect((await join(outsider, room.id)).join_call_room).toBe('waiting');
    const own = await db.as(outsider, (s) =>
      s.query<{ user_id: string }>(
        `select user_id from public.call_participants where room_id = $1`,
        [room.id],
      ),
    );
    expect(own).toEqual([{ user_id: outsider.id }]);
    await db.as(gm, (s) =>
      s.query(`select public.decide_call_participant($1, $2, false)`, [room.id, outsider.id]),
    );
    const transcript = await db.as(outsider, (s) =>
      s.query(`select id from public.transcript_segments where room_id = $1`, [room.id]),
    );
    expect(transcript).toEqual([]);
  });

  it('quem não está na sala não vê os participantes', async () => {
    const { gm, outsider, campaign } = await createTable(db);
    const room = await createRoom(gm, 'open', campaign.id);
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

  it('uso dos momentos deriva a campanha da sessão e não aceita sessão alheia', async () => {
    const table = await createTable(db);
    const other = await createTable(db);
    const sessionId = await createSession(db, table.gm, table.campaign.id);
    const foreignSessionId = await createSession(db, other.gm, other.campaign.id);
    const inserted = await db.as(table.gm, (s) =>
      s.one<{ campaign_id: string }>(
        `insert into public.highlight_runs (session_id, campaign_id, status)
         values ($1, $2, 'done') returning campaign_id`,
        [sessionId, other.campaign.id],
      ),
    );
    expect(inserted.campaign_id).toBe(table.campaign.id);
    await expectSqlError(
      db.as(table.gm, (s) =>
        s.query(
          `insert into public.highlight_runs (session_id, campaign_id, status)
           values ($1, $2, 'done')`,
          [foreignSessionId, table.campaign.id],
        ),
      ),
      '42501',
    );
  });

  it('permite só uma geração de momentos por sessão e libera depois de finalizar', async () => {
    const { gm, outsider, campaign } = await createTable(db);
    const sessionId = await createSession(db, gm, campaign.id);
    const first = await db.as(gm, (s) =>
      s.one<{ start_highlight_run: string }>(`select public.start_highlight_run($1)`, [sessionId]),
    );

    const message = await expectSqlError(
      db.as(gm, (s) => s.query(`select public.start_highlight_run($1)`, [sessionId])),
      '55P03',
    );
    expect(message).toContain('Já existe uma geração em andamento para esta sessão.');
    await expectSqlError(
      db.as(outsider, (s) => s.query(`select public.start_highlight_run($1)`, [sessionId])),
      '42501',
    );

    await db.as(gm, (s) =>
      s.query(`select public.finish_highlight_run($1, 'done', 'teste', 10, 5, 3, '')`, [
        first.start_highlight_run,
      ]),
    );
    const second = await db.as(gm, (s) =>
      s.one<{ start_highlight_run: string }>(`select public.start_highlight_run($1)`, [sessionId]),
    );
    expect(second.start_highlight_run).not.toBe(first.start_highlight_run);
  });

  it('expira uma geração abandonada depois de três minutos', async () => {
    const { gm, campaign } = await createTable(db);
    const sessionId = await createSession(db, gm, campaign.id);
    const first = await db.as(gm, (s) =>
      s.one<{ start_highlight_run: string }>(`select public.start_highlight_run($1)`, [sessionId]),
    );
    await db.as({ kind: 'admin' }, (s) =>
      s.query(
        `update public.highlight_runs set created_at = now() - interval '4 minutes' where id = $1`,
        [first.start_highlight_run],
      ),
    );
    await db.as(gm, (s) => s.query(`select public.start_highlight_run($1)`, [sessionId]));
    const old = await db.as(gm, (s) =>
      s.one<{ status: string; error: string }>(
        `select status, error from public.highlight_runs where id = $1`,
        [first.start_highlight_run],
      ),
    );
    expect(old).toEqual({
      status: 'failed',
      error: 'Geração interrompida antes de terminar.',
    });
  });

  it('recusa call sem campanha', async () => {
    const { gm } = await createTable(db);
    await expectSqlError(
      db.as(gm, (s) =>
        s.query(`select * from public.create_call_room('Sessão', 'open', null, null)`),
      ),
      '22023',
    );
  });

  it('o mestre escolhe quem está falando e o jogador fala como o personagem', async () => {
    const { gm, player, campaign } = await createTable(db);
    const second = await createCharacter(db, player, campaign.id, 'Segundo');
    const room = await createRoom(gm, 'open', campaign.id);
    await join(gm, room.id);
    await join(player, room.id);

    await expectSqlError(
      db.as(player, (s) => s.query(`select public.set_call_speaker($1, 'NPC')`, [room.id])),
      '42501',
    );
    await db.as(gm, (s) => s.query(`select public.set_call_speaker($1, 'Narração')`, [room.id]));
    await db.as(gm, (s) =>
      s.query(`update public.call_rooms set transcription_enabled = true where id = $1`, [room.id]),
    );
    const say = (actor: Actor, text: string) =>
      db.as(actor, (s) =>
        s.one<{ speaker_label: string; character_id: string | null }>(
          `insert into public.transcript_segments (room_id, text, started_at, ended_at)
           values ($1, $2, now(), now()) returning speaker_label, character_id`,
          [room.id, text],
        ),
      );
    expect(await say(gm, 'A porta range.')).toMatchObject({
      speaker_label: 'Narração',
      character_id: null,
    });
    expect(await say(player, 'Eu entro.')).toMatchObject({
      speaker_label: 'Segundo',
      character_id: second,
    });
    await db.as(gm, (s) => s.query(`select public.set_call_speaker($1, null)`, [room.id]));
    expect((await say(gm, 'Rolem iniciativa.')).speaker_label).toBe('Mestre');
  });

  it('encerra a sala esquecida há mais de 6 horas e mantém a recente', async () => {
    const { gm, campaign } = await createTable(db);
    const old = await createRoom(gm, 'open', campaign.id);
    const fresh = await createRoom(gm, 'open', campaign.id);
    await db.as({ kind: 'admin' }, (s) =>
      s.query(
        `update public.call_rooms set created_at = now() - interval '7 hours' where id = $1`,
        [old.id],
      ),
    );
    await db.as(gm, (s) => s.query(`select public.close_idle_call_rooms()`));
    const rows = await db.as(gm, (s) =>
      s.query<{ id: string; status: string }>(
        `select id, status from public.call_rooms where id in ($1, $2)`,
        [old.id, fresh.id],
      ),
    );
    expect(rows.find((row) => row.id === old.id)?.status).toBe('ended');
    expect(rows.find((row) => row.id === fresh.id)?.status).toBe('active');
  });
});
