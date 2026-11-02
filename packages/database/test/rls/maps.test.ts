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
    s.one<{ id: string }>(
      `insert into public.sessions (campaign_id, title, is_published) values ($1, 'Noite 1', true) returning id`,
      [campaign.id],
    ),
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
    s.one<{ id: string }>(
      `insert into public.creatures (campaign_id, kind, name, size) values ($1, 'monster', 'Goblin', 'small') returning id`,
      [campaign.id],
    ),
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
  return {
    ...table,
    session: session.id,
    map: map.id,
    lyraToken: byLabel.Lyra!,
    bramToken: byLabel.Bram!,
    goblinToken: byLabel.Goblin!,
  };
}

describe('grade da sessão', () => {
  it('jogadores veem só o mapa ativo e nunca os tokens ocultos', async () => {
    const { player, gm, map } = await setupMap();
    const maps = await db.as(player, (s) =>
      s.query<{ id: string }>(`select id from public.session_maps`),
    );
    expect(maps.map((row) => row.id)).toEqual([map]);
    const seen = await db.as(player, (s) =>
      s.query<{ label: string }>(
        `select label from public.map_tokens where map_id = $1 order by label`,
        [map],
      ),
    );
    expect(seen.map((row) => row.label)).toEqual(['Baú', 'Bram', 'Lyra']);
    const all = await db.as(gm, (s) =>
      s.query<{ label: string }>(`select label from public.map_tokens where map_id = $1`, [map]),
    );
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
    const moved = await db.as(gm, (s) =>
      s.one<{ x: number; y: number }>(`select x, y from public.map_tokens where id = $1`, [
        lyraToken,
      ]),
    );
    expect(moved).toEqual({ x: 4, y: 3 });
    await expectSqlError(
      db.as(player, (s) => s.query(`select public.move_my_token($1, 4, 4)`, [bramToken])),
      '42501',
    );
    await expectSqlError(
      db.as(player, (s) => s.query(`select public.move_my_token($1, 10, 0)`, [lyraToken])),
      '22023',
    );
    await expectSqlError(
      db.as(outsider, (s) => s.query(`select public.move_my_token($1, 1, 1)`, [lyraToken])),
      '42501',
    );
    // Atualização direta: jogador não altera tokens (nem o próprio) fora da função.
    const direct = await db.as(player, (s) =>
      s.query(`update public.map_tokens set x = 0 where id = $1 returning id`, [lyraToken]),
    );
    expect(direct).toEqual([]);
    await db.as(gm, (s) =>
      s.query(`update public.map_tokens set x = 6, is_hidden = false where id = $1`, [goblinToken]),
    );
  });

  it('só um mapa ativo por campanha, e só o mestre cria mapas', async () => {
    const { gm, player, campaign, session } = await setupMap();
    await expectSqlError(
      db.as(gm, (s) =>
        s.query(
          `insert into public.session_maps (campaign_id, session_id, name, is_active) values ($1, $2, 'Outro', true)`,
          [campaign.id, session],
        ),
      ),
      '23505',
    );
    await expectSqlError(
      db.as(player, (s) =>
        s.query(
          `insert into public.session_maps (campaign_id, session_id, name) values ($1, $2, 'Meu')`,
          [campaign.id, session],
        ),
      ),
      '42501',
    );
  });
});

describe('ferramentas do mapa', () => {
  it('iluminação só é configurada pelo mestre e chega aos membros com mapa e token visíveis', async () => {
    const { gm, player, map, lyraToken } = await setupMap();
    await db.as(gm, (s) => s.query(`update public.session_maps set illumination = 'dark', lights = '[{"id":"tocha-1","kind":"torch","x":2.5,"y":2.5,"brightRadius":4,"dimRadius":8}]' where id = $1`, [map]));
    await db.as(gm, (s) => s.query(`update public.map_tokens set darkvision_radius = 8, light_bright_radius = 2, light_dim_radius = 4 where id = $1`, [lyraToken]));
    expect(await db.as(player, (s) => s.one<{ illumination: string; lights: unknown[] }>(`select illumination, lights from public.session_maps where id = $1`, [map]))).toMatchObject({ illumination: 'dark', lights: [{ kind: 'torch' }] });
    expect(await db.as(player, (s) => s.one<{ darkvision_radius: number; light_bright_radius: number; light_dim_radius: number }>(`select darkvision_radius, light_bright_radius, light_dim_radius from public.map_tokens where id = $1`, [lyraToken]))).toEqual({ darkvision_radius: 8, light_bright_radius: 2, light_dim_radius: 4 });
    expect(await db.as(player, (s) => s.query(`update public.session_maps set illumination = 'bright' where id = $1 returning id`, [map]))).toEqual([]);
    expect(await db.as(player, (s) => s.query(`update public.map_tokens set darkvision_radius = 200 where id = $1 returning id`, [lyraToken]))).toEqual([]);
  });

  it('condições dos tokens são visíveis com o token, só o mestre altera e a rodada reduz a duração', async () => {
    const { gm, player, campaign, session, lyraToken, goblinToken } = await setupMap();
    await db.as(gm, (s) =>
      s.query(`update public.map_tokens set conditions = '[{"key":"poisoned","rounds":2}]' where id in ($1, $2)`, [lyraToken, goblinToken]),
    );

    const visible = await db.as(player, (s) =>
      s.query<{ id: string; conditions: { key: string; rounds: number }[] }>(`select id, conditions from public.map_tokens where conditions <> '[]' order by id`),
    );
    expect(visible).toEqual([{ id: lyraToken, conditions: [{ key: 'poisoned', rounds: 2 }] }]);
    expect(await db.as(player, (s) => s.query(`update public.map_tokens set conditions = '[]' where id = $1 returning id`, [lyraToken]))).toEqual([]);

    const encounter = await db.as(gm, (s) =>
      s.one<{ id: string }>(`insert into public.encounters (session_id, campaign_id, name, status) values ($1, $2, 'Combate', 'preparing') returning id`, [session, campaign.id]),
    );
    await db.as(gm, (s) => s.query(`update public.encounters set status = 'active', round = 1 where id = $1`, [encounter.id]));
    await db.as(gm, (s) => s.query(`update public.encounters set round = 2 where id = $1`, [encounter.id]));
    const after = await db.as(gm, (s) => s.query<{ conditions: { rounds: number }[] }>(`select conditions from public.map_tokens where id in ($1, $2) order by id`, [lyraToken, goblinToken]));
    expect(after.every((row) => row.conditions[0]?.rounds === 1)).toBe(true);
    await db.as(gm, (s) => s.query(`update public.encounters set round = 3 where id = $1`, [encounter.id]));
    const ended = await db.as(gm, (s) => s.query<{ conditions: unknown[] }>(`select conditions from public.map_tokens where id in ($1, $2)`, [lyraToken, goblinToken]));
    expect(ended.every((row) => row.conditions.length === 0)).toBe(true);
  });

  it('desenhos secretos só chegam ao mestre; áreas e desenhos públicos chegam a todos', async () => {
    const { gm, player, campaign, map } = await setupMap();
    await db.as(gm, (s) =>
      s.query(
        `insert into public.session_map_secrets (map_id, campaign_id, drawings) values ($1, $2, '[{"type":"note","x":3,"y":3,"text":"Armadilha"}]')`,
        [map, campaign.id],
      ),
    );
    await db.as(gm, (s) =>
      s.query(
        `update public.session_maps set areas = '[{"kind":"circle","x":5,"y":5,"meters":6}]', drawings = '[{"type":"note","x":1,"y":1,"text":"Porta"}]', fog_auto_reveal = true where id = $1`,
        [map],
      ),
    );
    expect(await db.as(player, (s) => s.query(`select * from public.session_map_secrets`))).toEqual(
      [],
    );
    expect(
      await db.as(gm, (s) => s.query(`select map_id from public.session_map_secrets`)),
    ).toHaveLength(1);
    const seen = await db.as(player, (s) =>
      s.one<{ areas: unknown[]; drawings: unknown[] }>(
        `select areas, drawings from public.session_maps where id = $1`,
        [map],
      ),
    );
    expect(seen.areas).toHaveLength(1);
    expect(seen.drawings).toHaveLength(1);
    await expectSqlError(
      db.as(player, (s) =>
        s.query(`insert into public.session_map_secrets (map_id, campaign_id) values ($1, $2)`, [
          map,
          campaign.id,
        ]),
      ),
      '42501',
    );
  });
});
