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

describe('rascunhos de personagem', () => {
  it('só o dono vê e altera; só em campanha de que participa', async () => {
    const gm = await db.createUser('mestre-rascunho@example.com');
    const player = await db.createUser('jogador-rascunho@example.com');
    const other = await db.createUser('outro-rascunho@example.com');
    const campaign = await createCampaign(db, gm);
    await addMember(db, campaign.id, player);
    const draft = await db.as(player, (s) =>
      s.one<{ id: string }>(
        `insert into public.character_drafts (system_id, campaign_id, name, payload) values ('dnd5e', $1, 'Meio pronto', '{"step":"class"}') returning id`,
        [campaign.id],
      ),
    );
    expect(await db.as(other, (s) => s.query(`select 1 from public.character_drafts`))).toEqual([]);
    expect(await db.as(gm, (s) => s.query(`select 1 from public.character_drafts`))).toEqual([]);
    await db.as(player, (s) =>
      s.query(`update public.character_drafts set name = 'Quase' where id = $1`, [draft.id]),
    );
    await expectSqlError(
      db.as(other, (s) =>
        s.query(
          `insert into public.character_drafts (system_id, campaign_id) values ('dnd5e', $1)`,
          [campaign.id],
        ),
      ),
      '42501',
    );
  });
});
