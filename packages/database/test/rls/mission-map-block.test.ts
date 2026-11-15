import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createSession, createTable } from '../support/fixtures';
import { TestDatabase, expectSqlError } from '../support/pglite';

let db: TestDatabase;

beforeAll(async () => {
  db = await TestDatabase.create();
});

afterAll(async () => {
  await db.close();
});

/**
 * Missão pronta: o mapa da mesa fica em maps/, mas o bloco de imagem do roteiro precisa de uma
 * cópia na pasta da sessão (era a causa do "Alguns dados não são válidos").
 */
describe('missão pronta: mapa no roteiro', () => {
  it('o roteiro aceita a imagem da pasta da sessão e recusa a de maps/', async () => {
    const { gm, campaign } = await createTable(db);
    const session = await createSession(db, gm, campaign.id);
    const insert = (path: string) =>
      db.as(gm, (s) =>
        s.query<{ id: string }>(
          `insert into public.session_blocks (session_id, campaign_id, type, position, visibility, data, revealable)
           values ($1, $2, 'image', 1, 'gm', $3::jsonb, true) returning id`,
          [session, campaign.id, JSON.stringify({ path, alt: 'Mapa', caption: null })],
        ),
      );
    expect(await insert(`campaigns/${campaign.id}/sessions/${session}/mapa.webp`)).toHaveLength(1);
    await expectSqlError(insert(`campaigns/${campaign.id}/maps/mapa.webp`), '23514');
  });
});
