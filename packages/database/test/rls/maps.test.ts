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

/** Mesa com uma sessão, um mapa e tokens: Lyra (jogadora), Bram (outro jogador), Goblin oculto. */
async function setupMap(options: { active?: boolean } = {}) {
  const table = await createTable(db);
  const { gm, player, otherPlayer, campaign } = table;
  const session = await db.as(gm, (s) =>
    s.one<{ id: string }>(`insert into public.sessions (campaign_id, title, is_published) values ($1, 'Noite 1', true) returning id`, [campaign.id]),
  );
  const map = await db.as(gm, (s) =>
    s.one<{ id: string }>(
      `insert into public.session_maps (campaign_id, session_id, name, cols, rows, is_active) values ($1, $2, 'Taverna', 10, 8, $3) returning id`,
      [campaign.id, session.id, options.active !== false],
    ),
  );
  const lyra = await createCharacter(db, player, campaign.id, 'Lyra');
  const bram = await createCharacter(db, otherPlayer, campaign.id, 'Bram');
  const goblin = await db.as(gm, (s) =>
    s.one<{ id: string }>(`insert into public.creatures (campaign_id, kind, name, size) values ($1, 'monster', 'Goblin', 'small') returning id`, [campaign.id]),
  );
  const tokens = await db.as(gm, (s) =>
    s.query<{ id: string; label: string }>(
      `insert into public.map_tokens (map_id, campaign_id, kind, character_id, creature_id, label, x, y, size, is_hidden) values
         ($1, $2, 'character', $3, null, 'Lyra', 1, 1, 'medium', false),
         ($1, $2, 'character', $4, null, 'Bram', 2, 1, 'medium', false),
         ($1, $2, 'creature', null, $5, 'Goblin', 5, 5, 'small', true),
         ($1, $2, 'marker', null, null, 'Baú', 7, 2, 'medium', false)
       returning id, label`,
      [map.id, campaign.id, lyra, bram, goblin.id],
    ),
  );
  const byLabel = Object.fromEntries(tokens.map((token) => [token.label, token.id]));
  return { ...table, session: session.id, map: map.id, lyraToken: byLabel.Lyra!, bramToken: byLabel.Bram!, goblinToken: byLabel.Goblin! };
}

describe('grade da sessão', () => {
  it('jogadores veem só o mapa ativo e nunca os tokens ocultos', async () => {
    const { player, gm, map } = await setupMap();
    const maps = await db.as(player, (s) => s.query<{ id: string }>(`select id from public.session_maps`));
    expect(maps.map((row) => row.id)).toEqual([map]);
    const seen = await db.as(player, (s) => s.query<{ label: string }>(`select label from public.map_tokens where map_id = $1 order by label`, [map]));
    expect(seen.map((row) => row.label)).toEqual(['Baú', 'Bram', 'Lyra']);
    const all = await db.as(gm, (s) => s.query<{ label: string }>(`select label from public.map_tokens where map_id = $1`, [map]));
    expect(all).toHaveLength(4);
  });

  it('mapa inativo não chega aos jogadores', async () => {
    const { player } = await setupMap({ active: false });
    const maps = await db.as(player, (s) => s.query(`select id from public.session_maps`));
    expect(maps).toEqual([]);
  });

  it('jogador move só o próprio token, dentro do mapa; o mestre move qualquer um', async () => {
    const { player, gm, outsider, lyraToken, bramToken, goblinToken } = await setupMap();
    await db.as(player, (s) => s.query(`select public.move_my_token($1, 4, 3)`, [lyraToken]));
    const moved = await db.as(gm, (s) => s.one<{ x: number; y: number }>(`select x, y from public.map_tokens where id = $1`, [lyraToken]));
    expect(moved).toEqual({ x: 4, y: 3 });
    await expectSqlError(db.as(player, (s) => s.query(`select public.move_my_token($1, 4, 4)`, [bramToken])), '42501');
    await expectSqlError(db.as(player, (s) => s.query(`select public.move_my_token($1, 10, 0)`, [lyraToken])), '22023');
    await expectSqlError(db.as(outsider, (s) => s.query(`select public.move_my_token($1, 1, 1)`, [lyraToken])), '42501');
    // Atualização direta: jogador não altera tokens (nem o próprio) fora da função.
    const direct = await db.as(player, (s) => s.query(`update public.map_tokens set x = 0 where id = $1 returning id`, [lyraToken]));
    expect(direct).toEqual([]);
    await db.as(gm, (s) => s.query(`update public.map_tokens set x = 6, is_hidden = false where id = $1`, [goblinToken]));
  });

  it('só um mapa ativo por campanha, e só o mestre cria mapas', async () => {
    const { gm, player, campaign, session } = await setupMap();
    await expectSqlError(
      db.as(gm, (s) => s.query(`insert into public.session_maps (campaign_id, session_id, name, is_active) values ($1, $2, 'Outro', true)`, [campaign.id, session])),
      '23505',
    );
    await expectSqlError(
      db.as(player, (s) => s.query(`insert into public.session_maps (campaign_id, session_id, name) values ($1, $2, 'Meu')`, [campaign.id, session])),
      '42501',
    );
  });
});
