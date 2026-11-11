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

describe('revelações do mestre', () => {
  it('jogadores só leem depois de revelada e se forem do público', async () => {
    const { gm, player, otherPlayer, outsider, campaign } = await createTable(db);
    const lyra = await createCharacter(db, player, campaign.id, 'Lyra');
    await createCharacter(db, otherPlayer, campaign.id, 'Borin');

    const general = await db.as(gm, (s) =>
      s.one<{ id: string }>(`insert into public.campaign_handouts (campaign_id, title, body) values ($1, 'Carta do rei', 'Texto') returning id`, [
        campaign.id,
      ]),
    );
    const secret = await db.as(gm, (s) =>
      s.one<{ id: string }>(
        `insert into public.campaign_handouts (campaign_id, title, audience, character_ids, is_revealed) values ($1, 'Visão', 'characters', array[$2::uuid], true) returning id`,
        [campaign.id, lyra],
      ),
    );

    const titles = async (user: typeof gm) =>
      (await db.as(user, (s) => s.query<{ title: string }>(`select title from public.campaign_handouts order by title`))).map((row) => row.title);

    // Preparada (não revelada): só o mestre vê; a "Visão" só a dona de Lyra.
    expect(await titles(gm)).toEqual(['Carta do rei', 'Visão']);
    expect(await titles(player)).toEqual(['Visão']);
    expect(await titles(otherPlayer)).toEqual([]);
    expect(await titles(outsider)).toEqual([]);

    const revealed = await db.as(gm, (s) =>
      s.one<{ revealed_at: string | null }>(`update public.campaign_handouts set is_revealed = true where id = $1 returning revealed_at`, [general.id]),
    );
    expect(revealed.revealed_at).not.toBeNull();
    expect(await titles(otherPlayer)).toEqual(['Carta do rei']);

    // Jogadores não criam nem alteram.
    await expectSqlError(
      db.as(player, (s) => s.query(`insert into public.campaign_handouts (campaign_id, title) values ($1, 'Falsa')`, [campaign.id])),
      '42501',
    );
    const changed = await db.as(player, (s) => s.query(`update public.campaign_handouts set title = 'X' where id = $1 returning id`, [secret.id]));
    expect(changed).toHaveLength(0);
  });

  it('público "characters" exige ao menos um personagem', async () => {
    const { gm, campaign } = await createTable(db);
    await expectSqlError(
      db.as(gm, (s) => s.query(`insert into public.campaign_handouts (campaign_id, title, audience) values ($1, 'Sem alvo', 'characters')`, [campaign.id])),
      '23514',
    );
  });
});

describe('retrato no grupo', () => {
  it('o dono esconde o retrato; o grupo vê o token no lugar', async () => {
    const { player, otherPlayer, campaign } = await createTable(db);
    const lyra = await createCharacter(db, player, campaign.id, 'Lyra');
    await db.as(player, (s) =>
      s.query(`update public.characters set portrait_path = $2, token_path = $3 where id = $1`, [lyra, `characters/${lyra}/retrato.webp`, `characters/${lyra}/token.webp`]),
    );
    const face = async () =>
      db.as(otherPlayer, (s) =>
        s.one<{ portrait_path: string | null }>(`select portrait_path from public.list_party_faces($1) where name = 'Lyra'`, [campaign.id]),
      );
    expect((await face()).portrait_path).toBe(`characters/${lyra}/retrato.webp`);
    await db.as(player, (s) => s.query(`update public.characters set share_portrait = false where id = $1`, [lyra]));
    expect((await face()).portrait_path).toBe(`characters/${lyra}/token.webp`);
  });
});
