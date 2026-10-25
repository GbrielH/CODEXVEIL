import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTable } from '../support/fixtures';
import { TestDatabase, admin, expectSqlError, service } from '../support/pglite';

let db: TestDatabase;

beforeAll(async () => {
  db = await TestDatabase.create();
});

afterAll(async () => {
  await db.close();
});

/** Arquivo no bucket, enviado há `hours` horas (como a Storage API gravaria). */
function file(name: string, hours: number) {
  return db.as(admin, (s) =>
    s.query(
      `insert into storage.objects (bucket_id, name, created_at) values ('campaign-media', $1, now() - make_interval(hours => $2))`,
      [name, hours],
    ),
  );
}

async function orphans(): Promise<string[]> {
  const rows = await db.as(service, (s) =>
    s.query<{ list_orphan_media: string }>(
      `select * from public.list_orphan_media(24, 1000) as list_orphan_media`,
    ),
  );
  return rows.map((row) => row.list_orphan_media);
}

describe('arquivos órfãos', () => {
  it('lista só o que nenhuma linha usa e que já passou do prazo de envio', async () => {
    const { campaign } = await createTable(db);
    const root = `campaigns/${campaign.id}`;
    const inUse = `${root}/cover/capa.webp`;
    const layer = `${root}/maps/camada.webp`;
    const orphan = `${root}/creatures/apagada.webp`;
    const fresh = `${root}/creatures/acabou-de-subir.webp`;
    await db.as(admin, (s) =>
      s.query(`update public.campaigns set cover_path = $1 where id = $2`, [inUse, campaign.id]),
    );
    await file(inUse, 48);
    await file(orphan, 48);
    await file(fresh, 1);
    await file(layer, 48);
    const sessionId = (
      await db.as(admin, (s) =>
        s.one<{ id: string }>(
          `insert into public.sessions (campaign_id, number, title) values ($1, 99, 'Teste') returning id`,
          [campaign.id],
        ),
      )
    ).id;
    await db.as(admin, (s) =>
      s.query(
        `insert into public.session_maps (campaign_id, session_id, name, images) values ($1, $2, 'Mapa', $3)`,
        [campaign.id, sessionId, JSON.stringify([{ path: layer, x: 0, y: 0, width: 10 }])],
      ),
    );

    const listed = await orphans();
    expect(listed).toContain(orphan);
    expect(listed).not.toContain(inUse);
    expect(listed).not.toContain(layer);
    expect(listed).not.toContain(fresh);
  });

  it('só a chave secreta consegue listar', async () => {
    const { gm } = await createTable(db);
    await expectSqlError(
      db.as(gm, (s) => s.query(`select * from public.list_orphan_media()`)),
      '42501',
    );
  });
});
