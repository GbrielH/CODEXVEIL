import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addMember, createCampaign } from '../support/fixtures';
import { TestDatabase, expectSqlError } from '../support/pglite';

let db: TestDatabase;
beforeAll(async () => {
  db = await TestDatabase.create();
});
afterAll(async () => {
  await db.close();
});

describe('quadros livres da campanha', () => {
  it('só o mestre vê e edita; jogadores e quem é de fora não veem', async () => {
    const gm = await db.createUser('mestre-quadro@example.com');
    const player = await db.createUser('jogador-quadro@example.com');
    const outsider = await db.createUser('fora-quadro@example.com');
    const campaign = await createCampaign(db, gm);
    await addMember(db, campaign.id, player);

    const board = await db.as(gm, (s) =>
      s.one<{ id: string }>(
        `insert into public.campaign_boards (campaign_id, title, items) values ($1, 'Sessão 1', '[{"id":"a","type":"note","x":0,"y":0}]'::jsonb) returning id`,
        [campaign.id],
      ),
    );
    const read = (who: typeof player) => db.as(who, (s) => s.query(`select id from public.campaign_boards where id = $1`, [board.id]));

    expect(await read(gm)).toHaveLength(1);
    expect(await read(player)).toEqual([]);
    expect(await read(outsider)).toEqual([]);

    // Imagens do quadro: o mestre envia na pasta `boards`; o jogador não.
    const path = `campaigns/${campaign.id}/boards/a.png`;
    const canWrite = (who: typeof player) =>
      db.as(who, (s) => s.one<{ ok: boolean }>(`select private.can_write_campaign_media($1) as ok`, [path]));
    expect((await canWrite(gm)).ok).toBe(true);
    expect((await canWrite(player)).ok).toBe(false);

    // Jogador não altera nem cria.
    const changed = await db.as(player, (s) => s.query(`update public.campaign_boards set title = 'x' where id = $1 returning id`, [board.id]));
    expect(changed).toEqual([]);
    await expectSqlError(
      db.as(player, (s) => s.query(`insert into public.campaign_boards (campaign_id, title) values ($1, 'Meu')`, [campaign.id])),
      '42501',
    );
    // Conteúdo precisa ser uma lista.
    await expectSqlError(db.as(gm, (s) => s.query(`update public.campaign_boards set items = '{}'::jsonb where id = $1`, [board.id])), '23514');
  });
});
