import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addMember, createCampaign, createSession } from '../support/fixtures';
import { TestDatabase, expectSqlError } from '../support/pglite';

let db: TestDatabase;
beforeAll(async () => {
  db = await TestDatabase.create();
});
afterAll(async () => {
  await db.close();
});

describe('anotações secretas do mapa', () => {
  it('o mestre cria e depois atualiza só os desenhos; o jogador não lê', async () => {
    const gm = await db.createUser('mestre-segredo@example.com');
    const player = await db.createUser('jogador-segredo@example.com');
    const campaign = await createCampaign(db, gm);
    await addMember(db, campaign.id, player);
    const sessionId = await createSession(db, gm, campaign.id);
    const map = await db.as(gm, (s) =>
      s.one<{ id: string }>(
        `insert into public.session_maps (campaign_id, session_id, name) values ($1, $2, 'Cripta') returning id`,
        [campaign.id, sessionId],
      ),
    );
    const note = (text: string) =>
      JSON.stringify([{ type: 'note', x: 1, y: 1, text, color: '#e04040' }]);

    // Mesmo caminho de `saveMapSecrets`: atualizar; sem linha, inserir.
    const updated = await db.as(gm, (s) =>
      s.query(
        `update public.session_map_secrets set drawings = $2::jsonb where map_id = $1 returning map_id`,
        [map.id, note('1. Altar')],
      ),
    );
    expect(updated).toEqual([]);
    await db.as(gm, (s) =>
      s.query(
        `insert into public.session_map_secrets (map_id, campaign_id, drawings) values ($1, $2, $3::jsonb)`,
        [map.id, campaign.id, note('1. Altar')],
      ),
    );
    const again = await db.as(gm, (s) =>
      s.query(
        `update public.session_map_secrets set drawings = $2::jsonb where map_id = $1 returning map_id`,
        [map.id, note('1. Altar profanado')],
      ),
    );
    expect(again).toHaveLength(1);

    // O upsert do PostgREST reescreve map_id e campaign_id: o banco recusa (por isso não é usado).
    await expectSqlError(
      db.as(gm, (s) =>
        s.query(
          `insert into public.session_map_secrets (map_id, campaign_id, drawings) values ($1, $2, '[]'::jsonb)
           on conflict (map_id) do update set map_id = excluded.map_id, campaign_id = excluded.campaign_id, drawings = excluded.drawings`,
          [map.id, campaign.id],
        ),
      ),
      '42501',
    );

    expect(
      await db.as(player, (s) =>
        s.query(`select drawings from public.session_map_secrets where map_id = $1`, [map.id]),
      ),
    ).toEqual([]);
  });
});
