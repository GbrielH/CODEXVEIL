import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addBlock, createCharacter, createSession, createTable } from '../support/fixtures';
import { TestDatabase, expectSqlError, type TestUser } from '../support/pglite';

let db: TestDatabase;

beforeAll(async () => {
  db = await TestDatabase.create();
});

afterAll(async () => {
  await db.close();
});

/** Simula o upload: a Storage API insere em storage.objects com o dono da requisição. */
function upload(user: TestUser, bucket: string, name: string) {
  return db.as(user, (s) =>
    s.query(`insert into storage.objects (bucket_id, name, owner_id) values ($1, $2, $3)`, [
      bucket,
      name,
      user.id,
    ]),
  );
}

async function canRead(user: TestUser, bucket: string, name: string): Promise<boolean> {
  const rows = await db.as(user, (s) =>
    s.query(`select id from storage.objects where bucket_id = $1 and name = $2`, [bucket, name]),
  );
  return rows.length === 1;
}

describe('buckets', () => {
  it('limitam tipo e tamanho dos arquivos', async () => {
    const { gm } = await createTable(db);
    const buckets = await db.as(gm, (s) =>
      s.query<{
        id: string;
        public: boolean;
        file_size_limit: string;
        allowed_mime_types: string[];
      }>(
        `select id, public, file_size_limit::text, allowed_mime_types from storage.buckets order by id`,
      ),
    );
    expect(buckets).toEqual([
      {
        id: 'avatars',
        public: true,
        file_size_limit: '2097152',
        allowed_mime_types: ['image/png', 'image/jpeg', 'image/webp'],
      },
      {
        id: 'campaign-media',
        public: false,
        file_size_limit: '2097152',
        allowed_mime_types: ['image/png', 'image/jpeg', 'image/webp'],
      },
    ]);
  });
});

describe('avatares', () => {
  it('o envio de fotos de perfil foi desativado, inclusive na própria pasta', async () => {
    const { player, otherPlayer } = await createTable(db);
    await expectSqlError(upload(player, 'avatars', `${player.id}/retrato.webp`), '42501');
    await expectSqlError(upload(player, 'avatars', `${otherPlayer.id}/retrato.webp`), '42501');
  });

  it('o perfil não aceita mais caminho de avatar', async () => {
    const { player } = await createTable(db);
    await expectSqlError(
      db.as(player, (s) =>
        s.query(`update public.profiles set avatar_path = $1 where id = $2`, [
          `${player.id}/a.webp`,
          player.id,
        ]),
      ),
      '42501',
    );
  });
});

describe('mídia de campanha', () => {
  it('somente mestres enviam capas; participantes as veem; estranhos não', async () => {
    const { gm, player, outsider, campaign } = await createTable(db);
    const cover = `campaigns/${campaign.id}/cover/capa.webp`;
    await expectSqlError(upload(player, 'campaign-media', cover), '42501');
    await upload(gm, 'campaign-media', cover);
    expect(await canRead(player, 'campaign-media', cover)).toBe(true);
    expect(await canRead(outsider, 'campaign-media', cover)).toBe(false);
  });

  it('imagem de NPC oculto só fica visível ao jogador após a revelação', async () => {
    const { gm, player, campaign } = await createTable(db);
    const path = `campaigns/${campaign.id}/creatures/lich.png`;
    await upload(gm, 'campaign-media', path);
    const creature = await db.as(gm, (s) =>
      s.one<{ id: string }>(
        `insert into public.creatures (campaign_id, kind, name) values ($1, 'monster', 'Lich') returning id`,
        [campaign.id],
      ),
    );
    await db.as(gm, (s) =>
      s.query(`update public.creatures set image_path = $1 where id = $2`, [path, creature.id]),
    );
    expect(await canRead(player, 'campaign-media', path)).toBe(false);

    await db.as(gm, (s) =>
      s.query(`update public.creatures set visibility = 'members' where id = $1`, [creature.id]),
    );
    expect(await canRead(player, 'campaign-media', path)).toBe(true);
  });

  it('imagem de roteiro só é visível em bloco público de sessão publicada', async () => {
    const { gm, player, campaign } = await createTable(db);
    const session = await createSession(db, gm, campaign.id, { published: true });
    const secretPath = `campaigns/${campaign.id}/sessions/${session}/mapa-secreto.png`;
    const publicPath = `campaigns/${campaign.id}/sessions/${session}/taverna.png`;
    await upload(gm, 'campaign-media', secretPath);
    await upload(gm, 'campaign-media', publicPath);
    await addBlock(db, gm, session, campaign.id, {
      type: 'image',
      data: { path: secretPath, alt: 'Mapa', caption: null },
      visibility: 'gm',
    });
    await addBlock(db, gm, session, campaign.id, {
      type: 'image',
      data: { path: publicPath, alt: 'Taverna', caption: null },
      position: 2048,
    });
    expect(await canRead(player, 'campaign-media', secretPath)).toBe(false);
    expect(await canRead(player, 'campaign-media', publicPath)).toBe(true);
  });

  it('não aceita envio para sessão de outra campanha nem caminhos fora do padrão', async () => {
    const tableA = await createTable(db);
    const tableB = await createTable(db);
    const sessionB = await createSession(db, tableB.gm, tableB.campaign.id);
    await expectSqlError(
      upload(
        tableA.gm,
        'campaign-media',
        `campaigns/${tableA.campaign.id}/sessions/${sessionB}/x.png`,
      ),
      '42501',
    );
    await expectSqlError(
      upload(tableA.gm, 'campaign-media', `campaigns/${tableA.campaign.id}/segredos/x.png`),
      '42501',
    );
    await expectSqlError(
      upload(tableA.gm, 'campaign-media', `campaigns/nao-e-uuid/cover/x.png`),
      '42501',
    );
  });

  it('retratos seguem a visibilidade da ficha', async () => {
    const { player, otherPlayer, outsider, campaign } = await createTable(db);
    const aria = await createCharacter(db, player, campaign.id, 'Aria');
    const portrait = `characters/${aria}/retrato.jpg`;
    await expectSqlError(upload(otherPlayer, 'campaign-media', portrait), '42501');
    await upload(player, 'campaign-media', portrait);
    expect(await canRead(otherPlayer, 'campaign-media', portrait)).toBe(true);
    expect(await canRead(outsider, 'campaign-media', portrait)).toBe(false);
  });
});
