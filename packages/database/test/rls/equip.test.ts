import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCharacter, createTable } from '../support/fixtures';
import { TestDatabase } from '../support/pglite';

let db: TestDatabase;

beforeAll(async () => {
  db = await TestDatabase.create();
});

afterAll(async () => {
  await db.close();
});

describe('equipar itens', () => {
  it('o dono equipa e desequipa itens do personagem na campanha', async () => {
    const { player, campaign } = await createTable(db);
    const character = await createCharacter(db, player, campaign.id, 'Rodolfo');
    const item = await db.as(player, (s) =>
      s.one<{ id: string }>(
        `insert into public.character_items (character_id, name, category) values ($1, 'Machado Grande', 'weapon') returning id`,
        [character],
      ),
    );
    const on = await db.as(player, (s) =>
      s.query<{ id: string }>(
        `update public.character_items set is_equipped = true where id = $1 returning id`,
        [item.id],
      ),
    );
    expect(on).toHaveLength(1);
    const off = await db.as(player, (s) =>
      s.query<{ id: string }>(
        `update public.character_items set is_equipped = false where id = $1 returning id`,
        [item.id],
      ),
    );
    expect(off).toHaveLength(1);
  });
});
