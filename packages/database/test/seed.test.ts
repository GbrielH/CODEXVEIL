import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TestDatabase, admin, type TestUser } from './support/pglite';

let db: TestDatabase;

const gm: TestUser = {
  kind: 'user',
  id: '00000000-0000-4000-8000-0000000000a1',
  email: 'mestre.demo@codexveil.dev',
  name: '[DEMO] Mestre',
};
const player: TestUser = {
  kind: 'user',
  id: '00000000-0000-4000-8000-0000000000a2',
  email: 'jogadora.demo@codexveil.dev',
  name: '[DEMO] Jogadora',
};

beforeAll(async () => {
  db = await TestDatabase.create({ seed: true });
});

afterAll(async () => {
  await db.close();
});

describe('seed de desenvolvimento', () => {
  it('aplica sobre as migrações e identifica todos os dados como demonstração', async () => {
    const names = await db.as(admin, (s) =>
      s.query<{ name: string }>(
        `select name from public.campaigns
         union all select name from public.characters
         union all select name from public.creatures
         union all select title from public.sessions`,
      ),
    );
    expect(names.length).toBeGreaterThan(0);
    for (const { name } of names) {
      expect(name).toMatch(/^\[DEMO\]/);
    }
  });

  it('respeita a privacidade do mestre também nos dados de demonstração', async () => {
    const blocksForPlayer = await db.as(player, (s) =>
      s.query<{ type: string }>(`select type from public.session_blocks order by position`),
    );
    expect(blocksForPlayer.map((b) => b.type)).toEqual(['heading', 'paragraph', 'npc_ref']);

    const blocksForGm = await db.as(gm, (s) => s.query(`select id from public.session_blocks`));
    expect(blocksForGm).toHaveLength(6);
  });
});
