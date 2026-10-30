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

describe('objetivos de Conflito', () => {
  it('o mestre cria e ajusta; o grupo vê só os visíveis e não altera', async () => {
    const gm = await db.createUser('mestre-conflito@example.com');
    const player = await db.createUser('jogador-conflito@example.com');
    const outsider = await db.createUser('fora-conflito@example.com');
    const campaign = await createCampaign(db, gm);
    await addMember(db, campaign.id, player);

    const shown = await db.as(gm, (s) =>
      s.one<{ id: string }>(
        `insert into public.conflict_objectives (campaign_id, name, kind, needed) values ($1, 'Fugir dos Condores', 'principal', 8) returning id`,
        [campaign.id],
      ),
    );
    await db.as(gm, (s) =>
      s.query(
        `insert into public.conflict_objectives (campaign_id, name, needed, visible) values ($1, 'Plano secreto', 4, false)`,
        [campaign.id],
      ),
    );
    const read = (who: typeof player) =>
      db.as(who, (s) => s.query(`select name from public.conflict_objectives order by name`));
    expect(await read(gm)).toHaveLength(2);
    expect(await read(player)).toEqual([{ name: 'Fugir dos Condores' }]);
    expect(await read(outsider)).toEqual([]);

    const moved = await db.as(gm, (s) =>
      s.one<{ progress: number }>(
        `update public.conflict_objectives set progress = 3 where id = $1 returning progress`,
        [shown.id],
      ),
    );
    expect(moved.progress).toBe(3);
    const changed = await db.as(player, (s) =>
      s.query(`update public.conflict_objectives set progress = 8 where id = $1 returning id`, [
        shown.id,
      ]),
    );
    expect(changed).toEqual([]);
    await expectSqlError(
      db.as(player, (s) =>
        s.query(`insert into public.conflict_objectives (campaign_id, name) values ($1, 'Meu')`, [
          campaign.id,
        ]),
      ),
      '42501',
    );
    await expectSqlError(
      db.as(gm, (s) =>
        s.query(`update public.conflict_objectives set kind = 'outro' where id = $1`, [shown.id]),
      ),
      '23514',
    );
  });
});

describe('baralhos do Assimilador', () => {
  it('só o mestre lê o monte; o grupo vê só a carta mostrada', async () => {
    const gm = await db.createUser('mestre-baralho@example.com');
    const player = await db.createUser('jogador-baralho@example.com');
    const outsider = await db.createUser('fora-baralho@example.com');
    const campaign = await createCampaign(db, gm);
    await addMember(db, campaign.id, player);
    await db.as(gm, (s) =>
      s.query(
        `insert into public.card_decks (campaign_id, deck, pile, drawn, shown) values ($1, 'assimilation', '{2:F,3:F}', '{A:F}', '{"card":"A:F","name":"Assimilação Sensitiva","text":""}'::jsonb)`,
        [campaign.id],
      ),
    );
    expect(await db.as(player, (s) => s.query(`select pile from public.card_decks`))).toEqual([]);
    expect(await db.as(gm, (s) => s.query(`select pile from public.card_decks`))).toHaveLength(1);
    expect(
      await db.as(player, (s) =>
        s.query(`select deck, shown from public.campaign_shown_cards($1)`, [campaign.id]),
      ),
    ).toEqual([
      { deck: 'assimilation', shown: { card: 'A:F', name: 'Assimilação Sensitiva', text: '' } },
    ]);
    expect(
      await db.as(outsider, (s) =>
        s.query(`select deck from public.campaign_shown_cards($1)`, [campaign.id]),
      ),
    ).toEqual([]);
    await expectSqlError(
      db.as(player, (s) =>
        s.query(`insert into public.card_decks (campaign_id, deck) values ($1, 'event')`, [
          campaign.id,
        ]),
      ),
      '42501',
    );
  });
});
