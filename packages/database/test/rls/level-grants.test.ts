import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCharacter, createTable } from '../support/fixtures';
import { TestDatabase, admin, expectSqlError, type TestUser } from '../support/pglite';

let db: TestDatabase;

beforeAll(async () => {
  db = await TestDatabase.create();
});

afterAll(async () => {
  await db.close();
});

const sheetAt = (level: number) =>
  JSON.stringify({
    schemaVersion: 1,
    identity: { classes: [{ key: 'fighter', name: 'Guerreiro', level }] },
  });

async function setSheet(user: TestUser, id: string, level: number) {
  return db.as(user, (s) =>
    s.query(`update public.characters set sheet = $1::jsonb where id = $2 returning id`, [
      sheetAt(level),
      id,
    ]),
  );
}

async function grant(user: TestUser, id: string) {
  return db.as(user, (s) =>
    s.one<{ level: number }>(`select public.grant_character_level($1) as level`, [id]),
  );
}

describe('níveis liberados pelo mestre', () => {
  it('o jogador só sobe de nível depois que o mestre libera', async () => {
    const { gm, player, campaign } = await createTable(db);
    const id = await createCharacter(db, player, campaign.id);
    await db.as(admin, (s) =>
      s.query(`update public.characters set sheet = $1::jsonb where id = $2`, [sheetAt(1), id]),
    );
    await expectSqlError(setSheet(player, id, 2), 'CVLVL');
    expect((await grant(gm, id)).level).toBe(2);
    expect(await setSheet(player, id, 2)).toHaveLength(1);
    await expectSqlError(setSheet(player, id, 3), 'CVLVL');
  });

  it('com edição de fichas bloqueada, o nível liberado ainda permite aplicar as melhorias', async () => {
    const { gm, player, campaign } = await createTable(db);
    const id = await createCharacter(db, player, campaign.id);
    await db.as(admin, (s) =>
      s.query(`update public.characters set sheet = $1::jsonb where id = $2`, [sheetAt(4), id]),
    );
    await db.as(admin, (s) =>
      s.query(`update public.campaigns set players_can_edit_sheets = false where id = $1`, [
        campaign.id,
      ]),
    );
    expect(await setSheet(player, id, 4)).toHaveLength(0);
    await grant(gm, id);
    await db.as(player, (s) =>
      s.query(
        `insert into public.character_abilities (character_id, kind, name, source, description) values ($1, 'class_feature', 'Nova', 'Guerreiro 5', '')`,
        [id],
      ),
    );
    expect(await setSheet(player, id, 5)).toHaveLength(1);
    expect(await setSheet(player, id, 5)).toHaveLength(0);
  });

  it('só o mestre libera níveis', async () => {
    const { player, otherPlayer, campaign } = await createTable(db);
    const id = await createCharacter(db, player, campaign.id);
    await expectSqlError(grant(player, id), '42501');
    await expectSqlError(grant(otherPlayer, id), '42501');
  });
});
