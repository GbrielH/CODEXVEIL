import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addMember } from '../support/fixtures';
import { TestDatabase, expectSqlError, type TestUser } from '../support/pglite';

let db: TestDatabase;

beforeAll(async () => {
  db = await TestDatabase.create();
});

afterAll(async () => {
  await db.close();
});

const HASH = 'a'.repeat(32);

function upload(user: TestUser, name: string) {
  return db.as(user, (s) =>
    s.query(
      `insert into storage.objects (bucket_id, name, owner_id) values ('book-assets', $1, $2)`,
      [name, user.id],
    ),
  );
}

async function canRead(user: TestUser, name: string): Promise<boolean> {
  const rows = await db.as(user, (s) =>
    s.query(`select id from storage.objects where bucket_id = 'book-assets' and name = $1`, [name]),
  );
  return rows.length === 1;
}

async function setup() {
  const owner = await db.createUser(`mestre-ordem-${crypto.randomUUID()}@example.com`);
  const player = await db.createUser(`agente-ordem-${crypto.randomUUID()}@example.com`);
  const stranger = await db.createUser(`estranho-ordem-${crypto.randomUUID()}@example.com`);
  const campaign = await db.as(owner, (s) =>
    s.one<{ id: string }>(
      `insert into public.campaigns (name, system_id) values ('Pântano', 'ordem2') returning id`,
    ),
  );
  await addMember(db, campaign.id, player);
  const pack = await db.as(owner, (s) =>
    s.one<{ id: string }>(
      `insert into public.book_packs (system_id, book_key, name, category)
       values ('ordem2', 'ordem2-beta', 'Playtest Beta', 'core') returning id`,
    ),
  );
  await db.as(owner, (s) =>
    s.query(
      `insert into public.book_entries (pack_id, kind, key, name, data) values
       ($1, 'section', 'regras', 'Regras', '{"chapter":"Regras","order":1,"body":""}'::jsonb),
       ($1, 'tool', 'medidor-emf', 'Medidor EMF', '{}'::jsonb),
       ($1, 'mission', 'pantano', 'O Pântano dos Afogados', '{}'::jsonb),
       ($1, 'scene', 'cena-1', 'Os Afogados', '{"mission":"pantano"}'::jsonb),
       ($1, 'point_of_interest', 'carroca', 'Carroça', '{"mission":"pantano"}'::jsonb),
       ($1, 'creature', 'afogado', 'Afogado', '{}'::jsonb),
       ($1, 'map', 'mapa-ilhota', 'Ilhota', '{"image":"x"}'::jsonb),
       ($1, 'handout', 'runa', 'Runa', '{"image":"x"}'::jsonb)`,
      [pack.id],
    ),
  );
  await db.as(owner, (s) =>
    s.query(`update public.book_packs set is_ready = true where id = $1`, [pack.id]),
  );
  await db.as(owner, (s) =>
    s.query(
      `update public.campaigns set character_rules = '{"setting":"medieval","sourcebooks":["ordem2-beta"]}'::jsonb where id = $1`,
      [campaign.id],
    ),
  );
  return { owner, player, stranger, campaign };
}

describe('Ordem Paranormal 2', () => {
  it('registra o sistema', async () => {
    const owner = await db.createUser('sistema-ordem@example.com');
    const rows = await db.as(owner, (s) =>
      s.query<{ short_name: string }>(
        `select short_name from public.rpg_systems where id = 'ordem2'`,
      ),
    );
    expect(rows).toEqual([{ short_name: 'OP2' }]);
  });

  it('jogadores leem regras e ferramentas; missões e mapas são do mestre', async () => {
    const { owner, player } = await setup();
    const playerKinds = await db.as(player, (s) =>
      s.query<{ kind: string }>(`select kind from public.book_entries order by kind`),
    );
    expect(playerKinds.map(({ kind }) => kind)).toEqual(['section', 'tool']);
    const ownerKinds = await db.as(owner, (s) =>
      s.query<{ kind: string }>(`select distinct kind from public.book_entries`),
    );
    expect(ownerKinds).toHaveLength(8);
  });

  it('imagens do livro: o dono envia; donos e mestres leem; jogadores e estranhos não', async () => {
    const { owner, player, stranger } = await setup();
    const name = `ordem2/ordem2-beta/${HASH}-jpg`;
    await upload(owner, name);
    expect(await canRead(owner, name)).toBe(true);
    expect(await canRead(player, name)).toBe(false);
    expect(await canRead(stranger, name)).toBe(false);
    await expectSqlError(upload(stranger, `ordem2/ordem2-beta/${'b'.repeat(32)}-jpg`), '42501');
    await expectSqlError(upload(player, `ordem2/ordem2-beta/${'c'.repeat(32)}-jpg`), '42501');
  });

  it('recusa caminhos fora do formato', async () => {
    const { owner } = await setup();
    await expectSqlError(upload(owner, `ordem2/ordem2-beta/mapa.jpg`), '42501');
    await expectSqlError(upload(owner, `ordem2/outro-livro/${'d'.repeat(32)}-jpg`), '42501');
    await expectSqlError(upload(owner, `ordem2/ordem2-beta/../${'e'.repeat(32)}-jpg`), '42501');
  });

  it('nem o dono sobrescreve uma imagem já enviada', async () => {
    const { owner } = await setup();
    const name = `ordem2/ordem2-beta/${'f'.repeat(32)}-png`;
    await upload(owner, name);
    await expectSqlError(
      db.as(owner, (s) =>
        s
          .query(
            `update storage.objects set metadata = '{}'::jsonb where bucket_id = 'book-assets' and name = $1`,
            [name],
          )
          .then((rows) => {
            if (rows.length === 0)
              throw Object.assign(new Error('sem permissão'), { code: '42501' });
            return rows;
          }),
      ),
      '42501',
    );
  });
});
