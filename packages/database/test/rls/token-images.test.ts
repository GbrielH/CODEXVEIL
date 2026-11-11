import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCharacter, createTable } from '../support/fixtures';
import { TestDatabase, admin } from '../support/pglite';

let db: TestDatabase;

beforeAll(async () => {
  db = await TestDatabase.create();
});

afterAll(async () => {
  await db.close();
});

describe('imagens dos tokens com fichas ocultas', () => {
  it('jogadores veem a imagem do token dos outros e dos NPCs no mapa, sem ler a ficha', async () => {
    const { gm, player, otherPlayer, outsider, campaign } = await createTable(db);
    await db.as(admin, (s) => s.query(`update public.campaigns set party_sheets_visible = false where id = $1`, [campaign.id]));

    const bram = await createCharacter(db, otherPlayer, campaign.id, 'Bram');
    await db.as(otherPlayer, (s) => s.query(`update public.characters set token_path = $2 where id = $1`, [bram, `characters/${bram}/token.webp`]));

    // NPC: ficha do mestre, fora do grupo, guardada na campanha.
    const npc = await createCharacter(db, gm, null, 'Grenda');
    await db.as(gm, (s) => s.query(`update public.characters set portrait_path = $2 where id = $1`, [npc, `characters/${npc}/retrato.webp`]));
    await db.as(gm, (s) => s.query(`select public.set_character_npc_campaign($1, $2)`, [npc, campaign.id]));

    const session = await db.as(gm, (s) =>
      s.one<{ id: string }>(`insert into public.sessions (campaign_id, title, is_published) values ($1, 'Noite', true) returning id`, [campaign.id]),
    );
    const map = await db.as(gm, (s) =>
      s.one<{ id: string }>(
        `insert into public.session_maps (campaign_id, session_id, name, cols, rows, is_active) values ($1, $2, 'Salão', 10, 8, true) returning id`,
        [campaign.id, session.id],
      ),
    );
    const npcToken = await db.as(gm, (s) =>
      s.one<{ id: string }>(
        `insert into public.map_tokens (map_id, campaign_id, kind, character_id, label, x, y) values ($1, $2, 'character', $3, 'Grenda', 3, 3) returning id`,
        [map.id, campaign.id, npc],
      ),
    );

    const images = async (user: typeof gm) =>
      Object.fromEntries(
        (
          await db.as(user, (s) =>
            s.query<{ id: string; image_path: string | null }>(`select * from public.list_character_token_images($1::uuid[])`, [[bram, npc]]),
          )
        ).map((row) => [row.id, row.image_path]),
      );

    // A ficha do Bram está oculta para a jogadora, mas a imagem do token chega.
    const fichas = await db.as(player, (s) => s.query(`select id from public.characters where id = $1`, [bram]));
    expect(fichas).toHaveLength(0);
    expect(await images(player)).toEqual({ [bram]: `characters/${bram}/token.webp`, [npc]: `characters/${npc}/retrato.webp` });

    // NPC escondido no mapa: a imagem some para os jogadores (o mestre continua vendo).
    await db.as(gm, (s) => s.query(`update public.map_tokens set is_hidden = true where id = $1`, [npcToken.id]));
    expect(await images(player)).toEqual({ [bram]: `characters/${bram}/token.webp` });
    expect((await images(gm))[npc]).toBe(`characters/${npc}/retrato.webp`);

    // Quem não participa da campanha não recebe nada.
    expect(await images(outsider)).toEqual({});
  });
});

describe('leitura das imagens no Storage com fichas ocultas', () => {
  it('o grupo lê retrato e token dos outros; o retrato some se o dono desligar', async () => {
    const { player, otherPlayer, outsider, campaign } = await createTable(db);
    await db.as(admin, (s) => s.query(`update public.campaigns set party_sheets_visible = false where id = $1`, [campaign.id]));
    const bram = await createCharacter(db, otherPlayer, campaign.id, 'Bram');
    const portrait = `characters/${bram}/retrato.webp`;
    const token = `characters/${bram}/token.webp`;
    for (const name of [portrait, token]) {
      await db.as(otherPlayer, (s) =>
        s.query(`insert into storage.objects (bucket_id, name, owner_id) values ('campaign-media', $1, $2)`, [name, otherPlayer.id]),
      );
    }
    await db.as(otherPlayer, (s) => s.query(`update public.characters set portrait_path = $2, token_path = $3 where id = $1`, [bram, portrait, token]));

    const canRead = async (user: typeof player, name: string) =>
      (await db.as(user, (s) => s.query(`select id from storage.objects where bucket_id = 'campaign-media' and name = $1`, [name]))).length === 1;

    expect(await canRead(player, portrait)).toBe(true);
    expect(await canRead(player, token)).toBe(true);
    expect(await canRead(outsider, portrait)).toBe(false);

    await db.as(otherPlayer, (s) => s.query(`update public.characters set share_portrait = false where id = $1`, [bram]));
    expect(await canRead(player, portrait)).toBe(false);
    expect(await canRead(player, token)).toBe(true);
  });
});
